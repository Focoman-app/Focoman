"use server";

import { randomBytes, randomUUID } from "crypto";
import { requireVerifiedUser, requireStudioOwner } from "@/lib/serverAuth";
import { requireCapability } from "@/lib/entitlementAuth";
import {
  getMarketplaceProfile,
  upsertMarketplaceProfile,
  softDeleteMarketplaceProfile,
  restoreMarketplaceProfile,
  searchMarketplaceProfiles,
  getMarketplaceProfileBySlug,
  getStudioPackages,
  getPublishedStudioPackages,
  saveStudioPackage,
  updateStudioPackage,
  softDeleteStudioPackage,
  createBookingRequest,
  getBookingRequestsByStudio,
  getBookingRequestsByCustomer,
  getBookingRequestById,
  updateBookingRequest,
  savePaymentRecord,
  getPaymentsByStudio,
  getPaymentById,
  updatePaymentVerification,
  saveOrder,
  saveTasks,
  getMembersByStudio,
  getOrdersByStudio,
} from "@focoman/db";
import {
  MarketplaceProfile,
  StudioPackage,
  BookingRequest,
  PaymentRecord,
  PaymentMethod,
  Order,
  Task,
} from "@focoman/types";
import { performPreflightCheck, generateResourceSuggestions, generateWorkflowTasks } from "@focoman/domain";
import { generateTimestampDigits } from "@/lib/invitationPasscode";
import {
  CreatePackageSchema,
  UpdatePackageSchema,
  BookingRequestSchema,
  NegotiateBookingSchema,
  RecordPaymentSchema,
  VerifyPaymentSchema,
} from "@focoman/validation";

/**
 * Server Actions for Marketplace Profiles, Packages, Booking Requests, and Payment Verification
 */

export async function fetchMarketplaceProfile(studioId: string, idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);
    
    const profile = await getMarketplaceProfile(studioId);
    return { success: true, profile };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch profile" };
  }
}

export async function saveMarketplaceProfile(
  studioId: string,
  profileData: Partial<Omit<MarketplaceProfile, 'id' | 'studioId' | 'verifiedMetrics' | 'createdAt' | 'updatedAt'>>,
  idToken: string
) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);
    
    // Server-side entitlement gate: Publishing requires MARKETPLACE_PUBLIC capability
    if (profileData.isVisible) {
      await requireCapability(studioId, "MARKETPLACE_PUBLIC");
    }
    
    const profile = await upsertMarketplaceProfile(studioId, profileData);
    return { success: true, profile };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save profile" };
  }
}

export async function deleteMarketplaceProfileAction(studioId: string, idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);

    await softDeleteMarketplaceProfile(studioId, decoded.uid);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to unpublish profile" };
  }
}

export async function restoreMarketplaceProfileAction(studioId: string, idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);

    await restoreMarketplaceProfile(studioId);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to restore profile" };
  }
}

export async function searchPublicMarketplace(city?: string, tags?: string[]) {
  // Public Studio Marketplace search
  try {
    const profiles = await searchMarketplaceProfiles({ city, tags });
    return { success: true, profiles };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Search failed" };
  }
}

export async function getPublicMarketplaceProfile(slug: string) {
  // Public profile viewing with deleted studio account handling
  try {
    const { getFirestoreServerInstance } = await import("@focoman/db");
    const db = getFirestoreServerInstance();
    const cleanSlug = slug.trim().toLowerCase();

    const snap = await db
      .collection("marketplace_profiles")
      .where("slug", "==", cleanSlug)
      .limit(1)
      .get();

    if (!snap.empty) {
      const profile = snap.docs[0].data() as MarketplaceProfile;
      if (profile.isDeleted) {
        return { success: false, isStudioDeleted: true, studioName: profile.name };
      }
      if (!profile.isVisible) {
        return { success: false, error: "Profile is not public." };
      }
      return { success: true, profile };
    }

    // Also check studio collection if marketplace profile was not generated or slug matches studio ID directly
    const studioSnap = await db.collection("studios").doc(cleanSlug).get();
    if (studioSnap.exists) {
      const studioData = studioSnap.data();
      if (studioData?.isDeleted) {
        return { success: false, isStudioDeleted: true, studioName: studioData.name };
      }
    }

    return { success: false, error: "Profile not found or is not public." };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load public profile" };
  }
}

// --- STUDIO PACKAGES ACTIONS ---

export async function getStudioPackagesAction(studioId: string, idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);
    const packages = await getStudioPackages(studioId);
    return { success: true, packages };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch packages" };
  }
}

export async function getPublicStudioPackagesAction(studioId: string) {
  try {
    const packages = await getPublishedStudioPackages(studioId);
    return { success: true, packages };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch public packages" };
  }
}

export async function createStudioPackageAction(input: unknown, idToken: string) {
  try {
    const parsed = CreatePackageSchema.parse(input);
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, parsed.studioId);

    const packageId = `PKG-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const pkg: StudioPackage = {
      id: packageId,
      studioId: parsed.studioId.toLowerCase(),
      name: parsed.name,
      description: parsed.description,
      services: parsed.services,
      price: parsed.price,
      isNegotiable: parsed.isNegotiable,
      isPublished: parsed.isPublished,
      createdAt: now,
      updatedAt: now,
    };

    await saveStudioPackage(pkg);
    return { success: true, package: pkg };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create package" };
  }
}

export async function updateStudioPackageAction(input: unknown, idToken: string) {
  try {
    const parsed = UpdatePackageSchema.parse(input);
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, parsed.studioId);

    const packages = await getStudioPackages(parsed.studioId);
    if (!packages.some((studioPackage) => studioPackage.id === parsed.packageId)) {
      throw new Error("Package not found in the authorized studio.");
    }

    const updated = await updateStudioPackage(parsed.packageId, {
      name: parsed.name,
      description: parsed.description,
      services: parsed.services,
      price: parsed.price,
      isNegotiable: parsed.isNegotiable,
      isPublished: parsed.isPublished,
    });

    return { success: true, package: updated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update package" };
  }
}

export async function deleteStudioPackageAction(packageId: string, studioId: string, idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);

    const packages = await getStudioPackages(studioId);
    if (!packages.some((studioPackage) => studioPackage.id === packageId)) {
      throw new Error("Package not found in the authorized studio.");
    }

    await softDeleteStudioPackage(packageId, decoded.uid);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete package" };
  }
}

// --- BOOKING REQUESTS ACTIONS ---

export async function createBookingRequestAction(input: unknown, idToken?: string) {
  try {
    const parsed = BookingRequestSchema.parse(input);
    const profile = await getMarketplaceProfile(parsed.studioId);
    if (!profile || !profile.isVisible || profile.isDeleted) {
      throw new Error("This studio is not accepting public booking inquiries.");
    }

    let selectedPackage: StudioPackage | undefined;
    if (parsed.packageId) {
      const publishedPackages = await getPublishedStudioPackages(parsed.studioId);
      selectedPackage = publishedPackages.find((studioPackage) => studioPackage.id === parsed.packageId);
      if (!selectedPackage) {
        throw new Error("The selected package is unavailable.");
      }
    }

    let customerUid = "GUEST";
    if (idToken) {
      const decoded = await requireVerifiedUser(idToken);
      customerUid = decoded.uid;
    }

    const bookingId = `BKG-${randomBytes(16).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    const price = selectedPackage?.price || 0;
    const isNegotiable = Boolean(selectedPackage?.isNegotiable && parsed.requestNegotiation);

    const req: BookingRequest = {
      id: bookingId,
      studioId: parsed.studioId.toLowerCase(),
      customerId: customerUid,
      customerName: parsed.customerName,
      customerEmail: parsed.customerEmail || undefined,
      customerPhone: parsed.customerPhone || undefined,
      packageId: parsed.packageId || undefined,
      packageName: selectedPackage?.name,
      eventType: parsed.eventType,
      eventDate: parsed.eventDate,
      location: {
        address: parsed.address,
        mapsUrl: parsed.mapsUrl || undefined,
      },
      notes: parsed.notes || undefined,
      originalPrice: price,
      agreedPrice: price,
      advanceRequested: Math.round(price * 0.3),
      isNegotiable,
      bookingStatus: isNegotiable ? 'OPEN_FOR_NEGOTIATION' : 'BOOKING_REQUEST',
      createdAt: now,
      updatedAt: now,
    };

    await createBookingRequest(req);
    return { success: true, bookingRequest: req };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create booking request" };
  }
}

export async function getStudioBookingRequestsAction(studioId: string, idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);

    const requests = await getBookingRequestsByStudio(studioId);
    return { success: true, bookingRequests: requests };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch booking requests" };
  }
}

export async function getCustomerBookingRequestsAction(idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const requests = await getBookingRequestsByCustomer(decoded.uid);
    return { success: true, bookingRequests: requests };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch customer requests" };
  }
}

export async function negotiateBookingRequestAction(input: unknown, idToken: string) {
  try {
    const parsed = NegotiateBookingSchema.parse(input);
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, parsed.studioId);

    const existingBooking = await getBookingRequestById(parsed.bookingRequestId);
    if (!existingBooking || existingBooking.studioId !== parsed.studioId.toLowerCase()) {
      throw new Error("Booking request not found in the authorized studio.");
    }
    if (!existingBooking.isNegotiable || existingBooking.bookingStatus !== "OPEN_FOR_NEGOTIATION") {
      throw new Error("This booking request is not open for negotiation.");
    }

    const updated = await updateBookingRequest(parsed.bookingRequestId, {
      negotiatedPrice: parsed.agreedPrice,
      agreedPrice: parsed.agreedPrice,
      advanceRequested: parsed.advanceRequested,
      bookingStatus: 'AWAITING_PAYMENT',
    });

    return { success: true, bookingRequest: updated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update negotiation" };
  }
}

// --- PAYMENT RECORDING & VERIFICATION ACTIONS ---

export async function recordPaymentAction(input: unknown, idToken?: string) {
  try {
    const parsed = RecordPaymentSchema.parse(input);
    if (!parsed.bookingRequestId) {
      throw new Error("A booking request is required to submit marketplace payment proof.");
    }

    const booking = await getBookingRequestById(parsed.bookingRequestId);
    if (!booking || booking.studioId !== parsed.studioId.toLowerCase()) {
      throw new Error("Booking request not found for this studio.");
    }
    if (!["BOOKING_REQUEST", "AWAITING_PAYMENT"].includes(booking.bookingStatus)) {
      throw new Error("This booking is not accepting payment submissions.");
    }
    if (parsed.amount > booking.agreedPrice) {
      throw new Error("Payment amount cannot exceed the agreed booking amount.");
    }

    let customerUid = booking.customerId;
    if (idToken) {
      const decoded = await requireVerifiedUser(idToken);
      if (booking.customerId !== "GUEST" && booking.customerId !== decoded.uid) {
        throw new Error("This booking request belongs to another customer.");
      }
      if (booking.customerId !== "GUEST") customerUid = decoded.uid;
    }

    const paymentId = `PAY-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const payment: PaymentRecord = {
      id: paymentId,
      orderId: parsed.orderId,
      bookingRequestId: parsed.bookingRequestId,
      studioId: booking.studioId,
      customerId: customerUid,
      amount: parsed.amount,
      method: parsed.method as PaymentMethod,
      status: 'PENDING_VERIFICATION',
      verificationStatus: 'PENDING_VERIFICATION',
      proof: parsed.proofUrl || parsed.referenceNumber ? {
        proofUrl: parsed.proofUrl,
        referenceNumber: parsed.referenceNumber,
        notes: parsed.notes,
        uploadedAt: now,
      } : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await savePaymentRecord(payment);

    if (parsed.bookingRequestId) {
      await updateBookingRequest(parsed.bookingRequestId, {
        bookingStatus: 'PAYMENT_VERIFICATION',
      });
    }

    return { success: true, payment };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to record payment" };
  }
}

export async function verifyPaymentAction(input: unknown, idToken: string) {
  try {
    const parsed = VerifyPaymentSchema.parse(input);
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, parsed.studioId);

    const payment = await getPaymentById(parsed.paymentId);
    if (!payment || payment.studioId !== parsed.studioId.toLowerCase()) {
      throw new Error("Payment record not found in the authorized studio.");
    }
    const booking = payment.bookingRequestId
      ? await getBookingRequestById(payment.bookingRequestId)
      : null;
    if (payment.bookingRequestId && (!booking || booking.studioId !== parsed.studioId.toLowerCase())) {
      throw new Error("Booking request not found in the authorized studio.");
    }

    const updatedPayment = await updatePaymentVerification(
      parsed.paymentId,
      parsed.verified,
      decoded.uid,
      parsed.rejectionReason
    );

    if (updatedPayment?.bookingRequestId && parsed.verified) {
      if (booking) {
        // Convert Booking Request to Confirmed Order
        const orderId = `ORD-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
        const trackingPasskey = `FOC-${randomBytes(16).toString('hex').toUpperCase()}`;
        const now = new Date().toISOString();

        const studioOrders = await getOrdersByStudio(parsed.studioId);
        const studioMembers = await getMembersByStudio(parsed.studioId);

        const preflight = performPreflightCheck(
          booking.eventDate,
          booking.location.address,
          [booking.packageName || booking.eventType],
          studioOrders,
          studioMembers
        );

        const suggestions = generateResourceSuggestions(
          booking.eventDate,
          ['PHOTOGRAPHY', 'VIDEOGRAPHY'],
          studioMembers,
          []
        );

        const newOrder: Order = {
          id: orderId,
          studioId: parsed.studioId.toLowerCase(),
          orderNumber,
          bookingRequestId: booking.id,
          customer: {
            id: booking.customerId,
            name: booking.customerName,
            email: booking.customerEmail,
            phone: booking.customerPhone,
          },
          eventType: booking.eventType,
          eventDate: booking.eventDate,
          eventLocation: booking.location.address,
          locationInfo: booking.location,
          services: [booking.packageName || booking.eventType],
          packages: booking.packageName ? [booking.packageName] : [],
          pricing: {
            estimatedPrice: booking.originalPrice,
            finalConfirmedPrice: booking.agreedPrice,
            advanceAmount: updatedPayment.amount,
            remainingAmount: Math.max(0, booking.agreedPrice - updatedPayment.amount),
          },
          paymentStatus: booking.agreedPrice <= updatedPayment.amount ? 'PAID' : 'PARTIAL',
          orderStatus: 'AWAITING_EVENT',
          bookingStatus: 'BOOKING_CONFIRMED',
          assignedResources: [],
          resourceSuggestions: suggestions,
          preflightReport: preflight,
          trackingPasskey,
          auditLog: [
            {
              id: `audit_${Date.now()}_mkt`,
              timestamp: now,
              actorName: decoded.name || decoded.email || "Studio Owner",
              actorRole: "Owner",
              action: "Marketplace Order Confirmed",
              details: `Confirmed booking from Marketplace inquiry for ${booking.packageName || booking.eventType} · Agreed Price: ₹${booking.agreedPrice.toLocaleString("en-IN")}`,
            },
            {
              id: `audit_${Date.now() + 1000}_adv`,
              timestamp: now,
              actorName: decoded.name || decoded.email || "Studio Owner",
              actorRole: "Owner",
              action: "Advance Payment Verified",
              details: `Verified advance payment of ₹${updatedPayment.amount.toLocaleString("en-IN")} (${updatedPayment.method})`,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };

        const studioPrefix = parsed.studioId.slice(0, 4).toUpperCase();
        const workflowTasks: Task[] = generateWorkflowTasks(orderId, parsed.studioId, newOrder.services).map((t, idx) => {
          const { dateStamp, timeStamp } = generateTimestampDigits(new Date());
          const seqSuffix = String(idx + 1).padStart(2, "0");
          return {
            ...t,
            id: `TSK-${studioPrefix}-${dateStamp}-${timeStamp}-${seqSuffix}`,
            assignedMemberId: t.assignedMemberId || "",
            assignedMemberName: t.assignedMemberName || "Unassigned",
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
          };
        });

        await Promise.all([
          saveOrder(newOrder),
          saveTasks(workflowTasks),
          updateBookingRequest(booking.id, {
            bookingStatus: 'BOOKING_CONFIRMED',
            orderId,
          }),
        ]);
      }
    }

    return { success: true, payment: updatedPayment };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to verify payment" };
  }
}

export async function getStudioPaymentsAction(studioId: string, idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioId);

    const payments = await getPaymentsByStudio(studioId);
    return { success: true, payments };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch studio payments" };
  }
}

export async function fetchPlatformPublicStatsAction() {
  try {
    const { getPlatformPublicStats } = await import("@focoman/db");
    const stats = await getPlatformPublicStats();
    return { success: true, stats };
  } catch (err: unknown) {
    return {
      success: false,
      stats: {
        marketplaceStudiosCount: 0,
        marketplaceLeadsCount: 0,
        activeStudiosCount: 0,
        registeredOrdersCount: 0,
      },
      error: err instanceof Error ? err.message : "Failed to load platform stats",
    };
  }
}
