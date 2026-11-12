"use server";

import { randomBytes, randomUUID } from "crypto";
import { requireVerifiedUser, requireStudioOwner } from "@/lib/serverAuth";
import { hasStudioCapability, requireCapability } from "@/lib/entitlementAuth";
import { getFreeWorkflowTaskAssignee } from "@/lib/erpCrewPolicy";
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
  getCustomersByStudio,
  getStudioBySlug,
  saveCustomer,
  updateCustomer,
} from "@focoman/db";
import {
  MarketplaceProfile,
  StudioPackage,
  BookingRequest,
  PaymentRecord,
  PaymentMethod,
  Order,
  Task,
  ResourceAssignment,
} from "@focoman/types";
import {
  performPreflightCheck,
  performBasicPreflightCheck,
  generateResourceSuggestions,
  generateWorkflowTasks,
  getStudioTimestampIST,
  isContactMatch,
} from "@focoman/domain";
import {
  generateOrderIdentifiers,
  generateSixDigitPasskeyPin,
  generateTimestampDigits,
  prefixLetters,
} from "@/lib/invitationPasscode";
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

async function convertBookingToCanonicalOrder(params: {
  booking: BookingRequest;
  studioId: string;
  advanceAmount: number;
  paymentMethodLabel: string;
  actorName: string;
}): Promise<{ order: Order; tasks: Task[] }> {
  const { booking, studioId, advanceAmount, paymentMethodLabel, actorName } = params;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const { orderId, customerId } = generateOrderIdentifiers(studioId, nowDate);
  const passkeyPin = generateSixDigitPasskeyPin();
  const studioPrefix = prefixLetters(studioId);

  const [studioOrders, studioMembers, existingCustomers, studio, hasErp] = await Promise.all([
    getOrdersByStudio(studioId),
    getMembersByStudio(studioId),
    getCustomersByStudio(studioId),
    getStudioBySlug(studioId),
    hasStudioCapability(studioId, "STUDIO_ERP"),
  ]);

  const customerPhone = booking.customerPhone?.trim() || undefined;
  const customerEmail = booking.customerEmail?.trim() || undefined;
  const matchedCustomer = existingCustomers.find((c) =>
    isContactMatch(
      { phone: customerPhone, email: customerEmail },
      { phone: c.phone, email: c.email }
    )
  );
  const effectiveCustomerId = matchedCustomer ? matchedCustomer.id : customerId;

  const servicesList = [booking.packageName || booking.eventType];
  const preflight = hasErp
    ? performPreflightCheck(
        booking.eventDate,
        booking.location.address,
        servicesList,
        studioOrders,
        studioMembers
      )
    : performBasicPreflightCheck(
        booking.eventDate,
        booking.location.address,
        studioOrders
      );

  const suggestions = hasErp
    ? generateResourceSuggestions(
        booking.eventDate,
        ["PHOTOGRAPHY", "VIDEOGRAPHY", "ALBUM_DESIGN", "PHOTO_EDITING"],
        studioMembers,
        []
      )
    : [];

  const autoAssignEnabled = hasErp && studio?.features?.autoAssignCrew !== false;
  const assignedResources: ResourceAssignment[] = [];
  if (autoAssignEnabled) {
    const usedMembers = new Set<string>();
    for (const s of suggestions) {
      if (s.availableOnDate && !usedMembers.has(s.memberId) && assignedResources.length < 2) {
        usedMembers.add(s.memberId);
        assignedResources.push({
          memberId: s.memberId,
          memberName: s.memberName,
          skill: s.skill,
          availabilityConfirmed: null,
        });
      }
    }
  }

  const istTime = getStudioTimestampIST(nowDate);
  const newOrder: Order = {
    id: orderId,
    studioId: studioId.toLowerCase(),
    orderNumber: orderId,
    bookingRequestId: booking.id,
    customer: {
      id: effectiveCustomerId,
      name: booking.customerName,
      ...(customerEmail ? { email: customerEmail } : {}),
      ...(customerPhone ? { phone: customerPhone } : {}),
      ...(booking.customerId && booking.customerId !== "GUEST" ? { uid: booking.customerId } : {}),
    },
    eventType: booking.eventType,
    eventDate: booking.eventDate,
    eventLocation: booking.location.address,
    locationInfo: booking.location,
    services: servicesList,
    packages: booking.packageName ? [booking.packageName] : [],
    pricing: {
      estimatedPrice: booking.originalPrice,
      finalConfirmedPrice: booking.agreedPrice,
      advanceAmount,
      advanceDate: now.split("T")[0],
      installments: [],
      remainingAmount: Math.max(0, booking.agreedPrice - advanceAmount),
    },
    paymentStatus:
      booking.agreedPrice <= advanceAmount && booking.agreedPrice > 0
        ? "PAID"
        : advanceAmount > 0
        ? "ADVANCE_RECEIVED"
        : "PENDING",
    orderStatus: "AWAITING_EVENT",
    bookingStatus: "BOOKING_CONFIRMED",
    assignedResources,
    resourceSuggestions: suggestions,
    preflightReport: preflight,
    trackingPasskey: orderId,
    passkeyPin,
    isDeleted: false,
    createdBy: actorName,
    createdByRole: "Owner",
    auditLog: [
      {
        id: `audit_${Date.now()}_mkt`,
        timestamp: istTime,
        actorName,
        actorRole: "Owner",
        action: "Marketplace Order Confirmed",
        details: `Confirmed booking from Marketplace inquiry (${booking.id}) for ${booking.packageName || booking.eventType} · Agreed Price: ₹${booking.agreedPrice.toLocaleString("en-IN")}`,
      },
      ...(advanceAmount > 0
        ? [
            {
              id: `audit_${Date.now() + 1000}_adv`,
              timestamp: istTime,
              actorName,
              actorRole: "Owner" as const,
              action: "Advance Payment Verified",
              details: `Verified advance payment of ₹${advanceAmount.toLocaleString("en-IN")} (${paymentMethodLabel})`,
            },
          ]
        : []),
      ...(assignedResources.length > 0
        ? [
            {
              id: `audit_${Date.now() + 2000}_auto_crew`,
              timestamp: istTime,
              actorName: "Studio Automation",
              actorRole: "System" as const,
              action: "Crew Auto-Assigned",
              details: `Auto-assigned available crew based on skill match: ${assignedResources.map((r) => `${r.memberName} (${r.skill})`).join(", ")}`,
            },
          ]
        : []),
    ],
    createdAt: now,
    updatedAt: now,
  };

  const studioOwner = getFreeWorkflowTaskAssignee(hasErp, {
    memberId: studio?.ownerId || "",
    memberName: studio?.ownerName || actorName || "Studio Owner",
  });
  const workflowTasks: Task[] = generateWorkflowTasks(orderId, studioId, newOrder.services).map((t, idx) => {
    const { dateStamp, timeStamp } = generateTimestampDigits(nowDate);
    const seqSuffix = String(idx + 1).padStart(2, "0");
    const matchedCrew =
      autoAssignEnabled && assignedResources.length > 0
        ? assignedResources.find((r) => r.skill.includes(t.serviceCategory)) || assignedResources[0]
        : undefined;
    return {
      ...t,
      id: `TSK-${studioPrefix}-${dateStamp}-${timeStamp}-${seqSuffix}`,
      assignedMemberId: matchedCrew?.memberId || studioOwner?.memberId || t.assignedMemberId || "",
      assignedMemberName: matchedCrew?.memberName || studioOwner?.memberName || t.assignedMemberName || "Unassigned",
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };
  });

  const customerPersistence = matchedCustomer
    ? updateCustomer(matchedCustomer.id, {
        ...(customerPhone && !matchedCustomer.phone ? { phone: customerPhone } : {}),
        ...(customerEmail && !matchedCustomer.email ? { email: customerEmail } : {}),
        ...(booking.location?.address && !matchedCustomer.address
          ? { address: booking.location.address }
          : {}),
      })
    : saveCustomer({
        id: customerId,
        studioId: studioId.toLowerCase(),
        name: booking.customerName,
        ...(customerPhone ? { phone: customerPhone } : {}),
        ...(customerEmail ? { email: customerEmail } : {}),
        ...(booking.location?.address ? { address: booking.location.address } : {}),
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      });

  await Promise.all([
    saveOrder(newOrder),
    saveTasks(workflowTasks),
    customerPersistence,
    updateBookingRequest(booking.id, {
      bookingStatus: "BOOKING_CONFIRMED",
      orderId,
    }),
  ]);

  return { order: newOrder, tasks: workflowTasks };
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

    let createdOrder: Order | undefined;
    if (updatedPayment?.bookingRequestId && parsed.verified && booking) {
      const converted = await convertBookingToCanonicalOrder({
        booking,
        studioId: parsed.studioId,
        advanceAmount: updatedPayment.amount,
        paymentMethodLabel: updatedPayment.method,
        actorName: decoded.name || decoded.email || "Studio Owner",
      });
      createdOrder = converted.order;
    }

    return { success: true, payment: updatedPayment, order: createdOrder };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to verify payment" };
  }
}

export async function confirmBookingAndConvertToOrderAction(
  input: {
    bookingRequestId: string;
    studioId: string;
    advanceAmount: number;
    paymentMethod?: PaymentMethod;
    referenceNumber?: string;
  },
  idToken: string
) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const booking = await getBookingRequestById(input.bookingRequestId);
    if (!booking || booking.studioId !== input.studioId.toLowerCase()) {
      throw new Error("Booking request not found in the authorized studio.");
    }
    if (booking.bookingStatus === "BOOKING_CONFIRMED" && booking.orderId) {
      return { success: false, error: `Booking is already confirmed as Order ${booking.orderId}.` };
    }

    const advance = Math.max(0, Number(input.advanceAmount) || 0);
    const method: PaymentMethod = input.paymentMethod || "UPI";
    const now = new Date().toISOString();

    if (advance > 0) {
      const paymentId = `PAY-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const payment: PaymentRecord = {
        id: paymentId,
        bookingRequestId: booking.id,
        studioId: booking.studioId,
        customerId: booking.customerId,
        amount: advance,
        method,
        status: "ADVANCE_RECEIVED",
        verificationStatus: "VERIFIED",
        verifiedBy: decoded.uid,
        verifiedAt: now,
        ...(input.referenceNumber
          ? {
              proof: {
                referenceNumber: input.referenceNumber,
                uploadedAt: now,
              },
            }
          : {}),
        createdAt: now,
        updatedAt: now,
      };
      await savePaymentRecord(payment);
    }

    const { order } = await convertBookingToCanonicalOrder({
      booking,
      studioId: input.studioId,
      advanceAmount: advance,
      paymentMethodLabel: method,
      actorName: decoded.name || decoded.email || "Studio Owner",
    });

    return { success: true, order };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to confirm booking and create order",
    };
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
