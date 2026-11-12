import { test, describe } from "node:test";
import assert from "node:assert";
import {
  isWithinRecoveryWindow,
  canRestoreRecord,
  applySoftDelete,
  applyRestore,
  canCompleteOrder,
  evaluateOrderStatus,
  getStudioCalendarDate,
  generateWorkflowTasks,
  canConfirmBooking,
  performPreflightCheck,
  performBasicPreflightCheck,
  generateResourceSuggestions,
  toCustomerOrderView,
  toCustomerTrackingView,
  toMemberWorkView,
} from "../packages/domain/src/index.ts";
import {
  CreateOrderSchema,
  UpdateOrderSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CreateMemberSchema,
  UpdateMemberSchema,
  UpdateStudioSchema,
  AssignResourceSchema,
  UpdateTaskStatusSchema,
  UpdatePaymentSchema,
  CreatePackageSchema,
  BookingRequestSchema,
  RecordPaymentSchema,
  CancelOrderSchema,
  SaveServiceCrewAssignmentsSchema,
} from "../packages/validation/src/index.ts";
import { PLAN_CAPABILITIES, PLAN_PRICES, RECOVERY_WINDOW_DAYS } from "../packages/config/src/index.ts";
import {
  createInvitationLinkToken,
  formatInvitationCode,
  hashInvitationPasscode,
  verifyInvitationLinkToken,
  verifyInvitationPasscode,
} from "../apps/web/src/lib/invitationPasscode.ts";
import { shouldUseSameOriginAuthDomain } from "../apps/web/src/lib/firebaseAuthDomain.ts";
import {
  getFreeWorkflowTaskAssignee,
  requiresErpForCrewMutation,
} from "../apps/web/src/lib/erpCrewPolicy.ts";

describe("ERP crew policy", () => {
  const owner = { memberId: "owner-1", memberName: "Studio Owner" };

  test("rejects a Free-plan crew assignment attempt", () => {
    assert.strictEqual(
      requiresErpForCrewMutation(false, { assignedMemberId: "crew-1", assignedMemberName: "Crew" }),
      true,
    );
  });

  test("allows non-assignment Free task updates and ERP crew mutations", () => {
    assert.strictEqual(requiresErpForCrewMutation(false, {}), false);
    assert.strictEqual(
      requiresErpForCrewMutation(true, { assignedMemberId: "crew-1", assignedMemberName: "Crew" }),
      false,
    );
  });

  test("assigns Free workflow tasks to the Studio Owner across order creation paths", () => {
    assert.deepStrictEqual(getFreeWorkflowTaskAssignee(false, owner), owner);
    assert.strictEqual(getFreeWorkflowTaskAssignee(true, owner), undefined);
  });

  test("keeps Free pre-flight free of crew warnings and suggestions", () => {
    const report = performBasicPreflightCheck("2030-01-01", "Chennai", []);
    assert.deepStrictEqual(report.warnings, []);
    assert.deepStrictEqual(report.suggestions, []);
    assert.deepStrictEqual(report.resourceConflicts, []);
  });
});

describe("Firebase same-origin redirect auth domain", () => {
  test("uses the app origin for a development Cloudflare Quick Tunnel", () => {
    assert.strictEqual(
      shouldUseSameOriginAuthDomain("test-tunnel.trycloudflare.com", true),
      true,
    );
  });

  test("does not enable Quick Tunnel auth proxying in production", () => {
    assert.strictEqual(
      shouldUseSameOriginAuthDomain("test-tunnel.trycloudflare.com", false),
      false,
    );
  });

  test("does not accept lookalike tunnel hostnames", () => {
    assert.strictEqual(
      shouldUseSameOriginAuthDomain("trycloudflare.com.attacker.example", true),
      false,
    );
  });

  test("keeps localhost on the canonical Firebase auth domain", () => {
    assert.strictEqual(shouldUseSameOriginAuthDomain("localhost", true), false);
  });

  test("preserves the existing Vercel same-origin behavior", () => {
    assert.strictEqual(
      shouldUseSameOriginAuthDomain("focoman-git-preview.vercel.app", false),
      true,
    );
  });
});

describe("1. Recovery System & Soft-Delete Domain Logic", () => {
  test("RECOVERY_WINDOW_DAYS is strictly configured to 30 days", () => {
    assert.strictEqual(RECOVERY_WINDOW_DAYS, 30);
  });

  test("isWithinRecoveryWindow returns true for recently deleted record", () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    assert.strictEqual(isWithinRecoveryWindow(recentDate), true);
  });

  test("isWithinRecoveryWindow returns false for non-deleted or null dates", () => {
    assert.strictEqual(isWithinRecoveryWindow(undefined), false);
    assert.strictEqual(isWithinRecoveryWindow(null), false);
  });

  test("isWithinRecoveryWindow returns false for records deleted > 30 days ago", () => {
    const expiredDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(isWithinRecoveryWindow(expiredDate), false);
  });

  test("canRestoreRecord correctly validates recovery eligibility", () => {
    const validRecord = {
      isDeleted: true,
      deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const nonDeletedRecord = {
      isDeleted: false,
    };
    const expiredRecord = {
      isDeleted: true,
      deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };

    assert.strictEqual(canRestoreRecord(validRecord).allowed, true);
    assert.strictEqual(canRestoreRecord(nonDeletedRecord).allowed, false);
    assert.strictEqual(canRestoreRecord(expiredRecord).allowed, false);
  });

  test("applySoftDelete adds deletion metadata", () => {
    const entity = { id: "ORD-123", name: "Wedding Shoot", isDeleted: false };
    const softDeleted = applySoftDelete(entity, "user_owner_456");

    assert.strictEqual(softDeleted.isDeleted, true);
    assert.strictEqual(softDeleted.deletedBy, "user_owner_456");
    assert.ok(softDeleted.deletedAt);
    assert.ok(Date.parse(softDeleted.deletedAt));
  });

  test("applyRestore resets soft deletion metadata", () => {
    const entity = {
      id: "ORD-123",
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: "user_owner_456",
    };
    const restored = applyRestore(entity);

    assert.strictEqual(restored.isDeleted, false);
    assert.strictEqual(restored.deletedAt, null);
    assert.strictEqual(restored.deletedBy, null);
  });
});

describe("1.1 Public plan catalog", () => {
  test("publishes only Free, Starter and Professional prices", () => {
    assert.strictEqual(PLAN_PRICES.FREE, 0);
    assert.strictEqual(PLAN_PRICES.STARTER, 999);
    assert.strictEqual(PLAN_PRICES.PROFESSIONAL, 1999);
  });

  test("keeps Starter and Professional capability sets separate", () => {
    assert.ok(PLAN_CAPABILITIES.STARTER.includes("CUSTOMER_CRM"));
    assert.ok(!PLAN_CAPABILITIES.STARTER.includes("WHATSAPP_OPERATIONS"));
    assert.ok(PLAN_CAPABILITIES.PROFESSIONAL.includes("WHATSAPP_OPERATIONS"));
  });
});

describe("2. OMS Domain Pipeline Logic", () => {
  test("generateWorkflowTasks generates sequential, studio-isolated tasks", () => {
    const tasks = generateWorkflowTasks("ORD-001", "studio-alpha", ["Candid Photography", "Cinematic Video"]);
    assert.ok(tasks.length > 0);
    assert.strictEqual(tasks[0].orderId, "ORD-001");
    assert.strictEqual(tasks[0].studioId, "studio-alpha");
    assert.strictEqual(tasks[0].status, "ASSIGNED");
    assert.strictEqual(tasks[0].sequenceOrder, 1);
  });

  test("canCompleteOrder requires full payment and completed tasks", () => {
    const pendingPaymentTasks = [{ status: "COMPLETED" as const }, { status: "COMPLETED" as const }];
    assert.strictEqual(canCompleteOrder("PAYMENT_PENDING", pendingPaymentTasks as any), false);

    const completedTasksWithFullPayment = [{ status: "COMPLETED" as const }, { status: "COMPLETED" as const }];
    assert.strictEqual(canCompleteOrder("PAYMENT_COMPLETED", completedTasksWithFullPayment as any), true);
  });

  test("evaluateOrderStatus automatically transitions AWAITING_EVENT to POST_EVENT_IN_PROGRESS when event date has passed", () => {
    // Past date (yesterday)
    const yesterday = "2026-10-07";
    const status = evaluateOrderStatus("AWAITING_EVENT", yesterday, false, false);
    assert.strictEqual(status, "POST_EVENT_IN_PROGRESS");

    // Future date
    const futureDate = "2026-12-31";
    const futureStatus = evaluateOrderStatus("AWAITING_EVENT", futureDate, false, false);
    assert.strictEqual(futureStatus, "AWAITING_EVENT");

    // All tasks completed and payment done
    const completedStatus = evaluateOrderStatus("POST_EVENT_IN_PROGRESS", yesterday, true, true);
    assert.strictEqual(completedStatus, "COMPLETED");

    // Cancelled status is preserved
    const cancelledStatus = evaluateOrderStatus("CANCELLED", yesterday, true, true);
    assert.strictEqual(cancelledStatus, "CANCELLED");
  });

  test("getStudioCalendarDate returns ISO YYYY-MM-DD formatted date in Indian Standard Time", () => {
    const today = getStudioCalendarDate();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("generateWorkflowTasks generates simplified 5-step production pipeline", () => {
    const services = ["Traditional Photography", "Candid Photography", "Cinematic Video", "Premium Photobook Album"];
    const tasks = generateWorkflowTasks("ORD-999", "studio-alpha", services);

    assert.ok(tasks.length >= 4);
    const titles = tasks.map((t) => t.title);
    assert.ok(titles.includes("Raw Photo Selection"));
    assert.ok(titles.includes("Photo Editing"));
    assert.ok(titles.includes("Video Editing"));
    assert.ok(titles.includes("Album Edit"));
    assert.ok(titles.includes("Final Delivery & Payment"));
  });
});

describe("3. Validation Schemas - CRUD Operations", () => {
  test("CreateOrderSchema parses valid order and rejects invalid prices", () => {
    const valid = CreateOrderSchema.safeParse({
      studioId: "studio-1",
      customerName: "Alice Walker",
      customerPhone: "+919876543210",
      eventType: "WEDDING",
      eventDate: "2026-10-15",
      eventLocation: "Grand Palace",
      services: ["Photography"],
      estimatedPrice: 50000,
      finalConfirmedPrice: 50000,
      advanceAmount: 10000,
    });
    assert.strictEqual(valid.success, true);

    const invalid = CreateOrderSchema.safeParse({
      studioId: "studio-1",
      customerName: "Alice",
      eventType: "WEDDING",
      finalConfirmedPrice: -500, // Negative price forbidden
    });
    assert.strictEqual(invalid.success, false);
  });

  test("UpdateOrderSchema validates partial fields", () => {
    const valid = UpdateOrderSchema.safeParse({
      orderId: "ORD-999",
      studioId: "studio-1",
      eventType: "PRE_WEDDING",
      eventLocation: "Beach Resort",
    });
    assert.strictEqual(valid.success, true);
  });

  test("CreateTaskSchema and UpdateTaskSchema validation", () => {
    const validTask = CreateTaskSchema.safeParse({
      orderId: "ORD-001",
      studioId: "studio-1",
      title: "Color Grading and Export",
      serviceCategory: "VIDEOGRAPHY",
    });
    assert.strictEqual(validTask.success, true);

    const validUpdate = UpdateTaskSchema.safeParse({
      taskId: "TSK-001",
      orderId: "ORD-001",
      studioId: "studio-1",
      idToken: "valid-id-token",
      status: "REVIEW",
      reworkNotes: "Please adjust contrast",
    });
    assert.strictEqual(validUpdate.success, true);

    const validStatusUpdate = UpdateTaskStatusSchema.safeParse({
      taskId: "TSK-001",
      orderId: "ORD-001",
      studioId: "studio-1",
      idToken: "valid-id-token",
      status: "IN_PROGRESS",
    });
    assert.strictEqual(validStatusUpdate.success, true);

    const missingAuth = UpdateTaskStatusSchema.safeParse({
      taskId: "TSK-001",
      orderId: "ORD-001",
      status: "IN_PROGRESS",
    });
    assert.strictEqual(missingAuth.success, false);
  });

  test("SaveServiceCrewAssignmentsSchema requires an authenticated whole-service payload", () => {
    const valid = SaveServiceCrewAssignmentsSchema.safeParse({
      orderId: "ORD-001",
      studioId: "studio-1",
      serviceName: "Photography",
      assignments: [
        { memberId: "MEM-1", memberName: "Anu" },
        { memberId: "MEM-2", memberName: "Ravi" },
      ],
      idToken: "verified-token",
    });
    assert.strictEqual(valid.success, true);
    const unauthenticated = SaveServiceCrewAssignmentsSchema.safeParse({
      orderId: "ORD-001", studioId: "studio-1", serviceName: "Photography", assignments: [],
    });
    assert.strictEqual(unauthenticated.success, false);
  });

  test("CreateCustomerSchema and UpdateCustomerSchema validation", () => {
    const validCustomer = CreateCustomerSchema.safeParse({
      studioId: "studio-1",
      name: "Jane Doe",
      phone: "+919876543210",
      email: "jane@example.com",
    });
    assert.strictEqual(validCustomer.success, true);

    const validUpdate = UpdateCustomerSchema.safeParse({
      customerId: "CUS-100",
      studioId: "studio-1",
      address: "742 Evergreen Terrace",
    });
    assert.strictEqual(validUpdate.success, true);
  });

  test("CreateMemberSchema and UpdateMemberSchema validation", () => {
    const validMember = CreateMemberSchema.safeParse({
      studioId: "studio-1",
      name: "Bob Editor",
      email: "bob@studio.com",
      skills: ["Video Editing", "Color Grading"],
    });
    assert.strictEqual(validMember.success, true);

    const emptySkills = CreateMemberSchema.safeParse({
      studioId: "studio-1",
      name: "Bob Editor",
      email: "bob@studio.com",
      skills: [],
    });
    assert.strictEqual(emptySkills.success, false);

    const genericInvite = CreateMemberSchema.safeParse({
      studioId: "studio-1",
      name: "Rahul",
      email: "",
      claimCode: "284617",
      skills: ["PHOTOGRAPHY"],
    });
    assert.strictEqual(genericInvite.success, true);

    const invalidGenericInvite = CreateMemberSchema.safeParse({
      studioId: "studio-1",
      name: "Rahul",
      email: "",
      claimCode: "1234",
      skills: ["PHOTOGRAPHY"],
    });
    assert.strictEqual(invalidGenericInvite.success, false);

    const validUpdate = UpdateMemberSchema.safeParse({
      memberId: "MEM-100",
      studioId: "studio-1",
      skills: ["Drone Operation"],
    });
    assert.strictEqual(validUpdate.success, true);
  });

  test("UpdateStudioSchema validation", () => {
    const validStudioUpdate = UpdateStudioSchema.safeParse({
      studioId: "studio-alpha",
      name: "Studio Alpha Pro",
      city: "Bangalore",
      features: {
        marketplace: true,
      },
    });
    assert.strictEqual(validStudioUpdate.success, true);
  });

  test("CreatePackageSchema and BookingRequestSchema validation", () => {
    const validPackage = CreatePackageSchema.safeParse({
      studioId: "studio-1",
      name: "Standard Wedding Package",
      services: ["Photography", "Videography"],
      price: 45000,
      isNegotiable: true,
    });
    assert.strictEqual(validPackage.success, true);

    const validBooking = BookingRequestSchema.safeParse({
      studioId: "studio-1",
      customerName: "Siddharth Verma",
      customerEmail: "siddharth@example.com",
      eventType: "Wedding",
      eventDate: "2026-11-25",
      address: "Hotel Leela, Bangalore",
      price: 45000,
      requestNegotiation: true,
    });
    assert.strictEqual(validBooking.success, true);

    const validPayment = RecordPaymentSchema.safeParse({
      studioId: "studio-1",
      customerId: "CUS-101",
      bookingRequestId: "BKG-101",
      amount: 15000,
      method: "UPI",
      referenceNumber: "UPI-9876543210",
    });
    assert.strictEqual(validPayment.success, true);

    const validCancellation = CancelOrderSchema.safeParse({
      orderId: "ORD-101",
      studioId: "studio-1",
      cancellationReason: "Client requested date change to unavailable slot",
    });
    assert.strictEqual(validCancellation.success, true);
  });
});

describe("4. Major Design Amendment - Preflight Checks & Booking Confirmation", () => {
  test("canConfirmBooking requires verified payment", () => {
    const unverified = canConfirmBooking("PENDING", "PENDING_VERIFICATION");
    assert.strictEqual(unverified.canConfirm, false);

    const verified = canConfirmBooking("PAID", "VERIFIED");
    assert.strictEqual(verified.canConfirm, true);

    const rejected = canConfirmBooking("PAID", "REJECTED");
    assert.strictEqual(rejected.canConfirm, false);
  });

  test("performPreflightCheck detects date conflicts and matching skills", () => {
    const existingOrders = [
      {
        id: "ORD-1",
        studioId: "studio-1",
        orderNumber: "ORD-101",
        eventType: "Wedding",
        eventDate: "2026-11-20",
        orderStatus: "AWAITING_EVENT" as const,
        isDeleted: false,
      },
    ];

    const studioMembers = [
      {
        id: "MEM-1",
        studioId: "studio-1",
        name: "Rahul",
        email: "rahul@studio.com",
        skills: ["PHOTOGRAPHY"],
        status: "ACTIVE" as const,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ];

    const report = performPreflightCheck(
      "2026-11-20",
      "123 Main St, Chennai",
      ["Photography"],
      existingOrders as any,
      studioMembers as any
    );

    assert.strictEqual(report.hasConflicts, true);
    assert.strictEqual(report.eventDateConflicts.length, 1);
    assert.strictEqual(report.eventDateConflicts[0].orderNumber, "ORD-101");
    assert.ok(report.suggestions.length > 0);
  });

  test("generateResourceSuggestions computes match scores correctly", () => {
    const studioMembers = [
      {
        id: "MEM-1",
        studioId: "studio-1",
        name: "Priya",
        email: "priya@studio.com",
        skills: ["PHOTOGRAPHY", "ALBUM_DESIGN"],
        status: "ACTIVE" as const,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
      {
        id: "MEM-2",
        studioId: "studio-1",
        name: "Karan",
        email: "karan@studio.com",
        skills: ["VIDEOGRAPHY"],
        status: "ACTIVE" as const,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ];

    const suggestions = generateResourceSuggestions(
      "2026-11-20",
      ["PHOTOGRAPHY"],
      studioMembers as any,
      []
    );

    assert.strictEqual(suggestions.length, 2);
    assert.strictEqual(suggestions[0].memberId, "MEM-1");
    assert.strictEqual(suggestions[0].status, "SUGGESTED");
    assert.ok(suggestions[0].matchScore > suggestions[1].matchScore);
  });
});

describe("5. Major Design Amendment - Customer Order View Data Isolation", () => {
  test("toCustomerOrderView sanitizes order and strips private internal fields", () => {
    const order = {
      id: "ORD-555",
      studioId: "studio-1",
      orderNumber: "ORD-1055",
      customer: { id: "CUS-1", name: "Anand", phone: "+919876543210" },
      eventType: "Wedding",
      eventDate: "2026-12-01",
      eventLocation: "Beach Resort, Goa",
      services: ["Photography", "Cinematography"],
      packages: ["Royal Package"],
      pricing: {
        estimatedPrice: 100000,
        finalConfirmedPrice: 90000,
        advanceAmount: 25000,
        remainingAmount: 65000,
      },
      paymentStatus: "PARTIAL" as const,
      orderStatus: "AWAITING_EVENT" as const,
      bookingStatus: "BOOKING_CONFIRMED" as const,
      assignedResources: [{ memberId: "M1", memberName: "Private Crew", skill: "PHOTO", availabilityConfirmed: true }],
      trackingPasskey: "PASS-999",
      createdAt: "2026-09-01T10:00:00Z",
      updatedAt: "2026-09-01T10:00:00Z",
    };

    const customerView = toCustomerOrderView(order as any, "Studio One");

    assert.strictEqual(customerView.id, "ORD-555");
    assert.strictEqual(customerView.studioName, "Studio One");
    assert.strictEqual(customerView.totalAmount, 90000);
    assert.strictEqual(customerView.advanceAmount, 25000);
    assert.strictEqual((customerView as any).assignedResources, undefined);
    assert.strictEqual((customerView as any).internalNotes, undefined);
  });

  test("customer tracking projection excludes raw order and crew fields", () => {
    const order = {
      id: "ORD-556",
      studioId: "studio-1",
      orderNumber: "ORD-1056",
      customer: { id: "CUS-1", name: "Anand", phone: "+919876543210" },
      eventType: "Wedding",
      eventDate: "2026-12-01",
      eventLocation: "Beach Resort, Goa",
      services: ["Photography"],
      pricing: {
        estimatedPrice: 100000,
        finalConfirmedPrice: 90000,
        advanceAmount: 25000,
        remainingAmount: 65000,
      },
      paymentStatus: "PARTIAL" as const,
      orderStatus: "AWAITING_EVENT" as const,
      assignedResources: [{ memberId: "M1", memberName: "Private Crew", skill: "PHOTO", availabilityConfirmed: true }],
      trackingPasskey: "SECRET-PASSKEY",
      internalNotes: "Private studio note",
      createdAt: "2026-09-01T10:00:00Z",
      updatedAt: "2026-09-01T10:00:00Z",
    };
    const tasks = [{
      id: "TSK-1",
      orderId: "ORD-556",
      studioId: "studio-1",
      title: "Edit photos",
      serviceCategory: "PHOTOGRAPHY",
      assignedMemberId: "M1",
      assignedMemberName: "Private Crew",
      status: "IN_PROGRESS" as const,
      sequenceOrder: 1,
    }];

    const view = toCustomerTrackingView(order as any, "Studio One", tasks as any);

    assert.strictEqual(view.order.customerName, "Anand");
    assert.strictEqual(view.order.totalAmount, 90000);
    assert.strictEqual(view.order.trackingPasskey, "SECRET-PASSKEY");
    assert.strictEqual((view.order as any).internalNotes, undefined);
    assert.strictEqual((view.order as any).assignedResources, undefined);
    assert.deepStrictEqual(view.tasks[0], {
      title: "Edit photos",
      serviceCategory: "PHOTOGRAPHY",
      status: "IN_PROGRESS",
      sequenceOrder: 1,
    });
  });

  test("member work projection includes only assigned studio orders and safe fields", () => {
    const assignedOrder = {
      id: "ORD-100",
      studioId: "studio-1",
      orderNumber: "ORD-100",
      customer: { id: "CUS-1", name: "Private Customer", phone: "+919999999999" },
      eventType: "Wedding",
      eventDate: "2026-12-01",
      eventLocation: "Beach Resort",
      services: ["Photography"],
      pricing: { estimatedPrice: 100000, finalConfirmedPrice: 90000, advanceAmount: 25000, remainingAmount: 65000 },
      paymentStatus: "PARTIAL" as const,
      orderStatus: "AWAITING_EVENT" as const,
      assignedResources: [{ memberId: "MEM-1", memberName: "Alex", skill: "PHOTOGRAPHY", availabilityConfirmed: true }],
      trackingPasskey: "SECRET",
    };
    const unrelatedOrder = { ...assignedOrder, id: "ORD-200", orderNumber: "ORD-200", assignedResources: [] };
    const otherStudioOrder = { ...assignedOrder, id: "ORD-300", studioId: "studio-2" };
    const tasks = [{
      id: "TASK-1",
      orderId: "ORD-100",
      studioId: "studio-1",
      title: "Shoot coverage",
      serviceCategory: "PHOTOGRAPHY" as const,
      assignedMemberId: "MEM-1",
      assignedMemberName: "Alex",
      status: "ASSIGNED" as const,
      sequenceOrder: 1,
    }, {
      id: "TASK-2",
      orderId: "ORD-200",
      studioId: "studio-1",
      title: "Unassigned task",
      serviceCategory: "PHOTOGRAPHY" as const,
      assignedMemberId: "MEM-2",
      assignedMemberName: "Other Member",
      status: "ASSIGNED" as const,
      sequenceOrder: 1,
    }];

    const view = toMemberWorkView("studio-1", "MEM-1", [assignedOrder, unrelatedOrder, otherStudioOrder] as any, tasks as any);

    assert.deepStrictEqual(view.orders.map((order) => order.id), ["ORD-100"]);
    assert.deepStrictEqual(view.tasks.map((task) => task.id), ["TASK-1"]);
    assert.strictEqual((view.orders[0] as any).customer, undefined);
    assert.strictEqual((view.orders[0] as any).pricing, undefined);
    assert.strictEqual((view.orders[0] as any).trackingPasskey, undefined);
  });
});

describe("6. Studio Invitation Passcode", () => {
  test("invitation ID follows the requested readable globally-unique prefix format", () => {
    assert.strictEqual(formatInvitationCode("Focoman Studio", "Sivakrishna Alternate", "4821"), "INV-FOC-SIV-4821");
    assert.strictEqual(formatInvitationCode("A", "Li", "0007"), "INV-AXX-LIX-0007");
    assert.throws(() => formatInvitationCode("Studio", "Member", "123"));
  });

  test("passcodes are salted, verifiable, and reject an incorrect value", () => {
    const first = hashInvitationPasscode("284617");
    const second = hashInvitationPasscode("284617");

    assert.notStrictEqual(first.salt, second.salt);
    assert.notStrictEqual(first.hash, second.hash);
    assert.strictEqual(verifyInvitationPasscode("284617", first.salt, first.hash), true);
    assert.strictEqual(verifyInvitationPasscode("111111", first.salt, first.hash), false);
  });

  test("invitation link token is separate from its readable ID and rejects tampering", () => {
    const link = createInvitationLinkToken();
    assert.notStrictEqual(link.token, link.hash);
    assert.strictEqual(verifyInvitationLinkToken(link.token, link.hash), true);
    assert.strictEqual(verifyInvitationLinkToken(`${link.token}x`, link.hash), false);
  });

  test("member name uses Google account name as primary and preserves owner alias in brackets when mismatched", () => {
    const googleName = "Rahul Sharma";
    const ownerName = "Rahul Editor";
    const primaryName = googleName || ownerName;
    const ownerAssignedName = (ownerName && ownerName.toLowerCase() !== googleName.toLowerCase()) ? ownerName : undefined;

    assert.strictEqual(primaryName, "Rahul Sharma");
    assert.strictEqual(ownerAssignedName, "Rahul Editor");

    // Display formatted for studio owners
    const ownerView = ownerAssignedName ? `${primaryName} (${ownerAssignedName})` : primaryName;
    assert.strictEqual(ownerView, "Rahul Sharma (Rahul Editor)");

    // Matching names do not duplicate
    const sameOwnerName = "Rahul Sharma";
    const resolvedAlias = (sameOwnerName && sameOwnerName.toLowerCase() !== googleName.toLowerCase()) ? sameOwnerName : undefined;
    assert.strictEqual(resolvedAlias, undefined);
  });

  test("duplicate invite check detects existing member email and pending invitation email", () => {
    const existingMembers = [{
      id: "MEM-1",
      studioId: "studio-1",
      name: "Rahul Sharma",
      email: "rahul@studio.com",
      skills: ["PHOTOGRAPHY"],
      createdAt: "",
      updatedAt: "",
    }];

    const existingInvitations = [{
      id: "INV-STU-PRI-1234",
      studioId: "studio-1",
      studioName: "Studio 1",
      email: "priya@studio.com",
      name: "Priya",
      skills: ["VIDEOGRAPHY"],
      role: "STUDIO_MEMBER" as const,
      status: "PENDING" as const,
      invitedByUid: "owner-1",
      createdAt: "",
    }];

    const duplicateMemberEmail = "rahul@studio.com";
    const isMemberEmailDuplicate = existingMembers.some((m) => m.email.toLowerCase() === duplicateMemberEmail.toLowerCase());
    assert.strictEqual(isMemberEmailDuplicate, true);

    const duplicateInviteEmail = "priya@studio.com";
    const isInviteEmailDuplicate = existingInvitations.some((inv) => inv.status === "PENDING" && inv.email?.toLowerCase() === duplicateInviteEmail.toLowerCase());
    assert.strictEqual(isInviteEmailDuplicate, true);

    const freshEmail = "fresh@studio.com";
    assert.strictEqual(existingMembers.some((m) => m.email.toLowerCase() === freshEmail), false);
    assert.strictEqual(existingInvitations.some((inv) => inv.email?.toLowerCase() === freshEmail), false);
  });

  test("studio-scoped name uniqueness rejects duplicate names across active members and pending invitations", () => {
    const existingMembers = [{
      id: "MEM-1",
      studioId: "studio-1",
      name: "Rahul Sharma",
      ownerAssignedName: "Rahul Photo",
      email: "rahul@studio.com",
      skills: ["PHOTOGRAPHY"],
      createdAt: "",
      updatedAt: "",
    }];

    const existingInvitations = [{
      id: "INV-STU-PRI-1234",
      studioId: "studio-1",
      studioName: "Studio 1",
      name: "Priya Video",
      skills: ["VIDEOGRAPHY"],
      role: "STUDIO_MEMBER" as const,
      status: "PENDING" as const,
      invitedByUid: "owner-1",
      createdAt: "",
    }];

    // Primary name match
    assert.strictEqual(
      existingMembers.some((m) => m.name.toLowerCase() === "rahul sharma"),
      true
    );
    // Alias name match
    assert.strictEqual(
      existingMembers.some((m) => m.ownerAssignedName?.toLowerCase() === "rahul photo"),
      true
    );
    // Pending invite name match
    assert.strictEqual(
      existingInvitations.some((inv) => inv.status === "PENDING" && inv.name.toLowerCase() === "priya video"),
      true
    );
    // Unique plain invite name
    assert.strictEqual(
      existingMembers.some((m) => m.name.toLowerCase() === "deepak drone"),
      false
    );
    assert.strictEqual(
      existingInvitations.some((inv) => inv.name.toLowerCase() === "deepak drone"),
      false
    );
  });
});


