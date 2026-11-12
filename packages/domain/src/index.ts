import { getOrderFinancials, getReceiptSources } from './billing.ts';
export * from './billing.ts';
import type {
  OrderStatus,
  Task,
  SoftDeletable,
  Order,
  Customer,
  StudioMember,
  PreflightConflictReport,
  ResourceSuggestion,
  CustomerOrderView,
  CustomerTrackingView,
  MemberWorkView,
  PaymentVerificationStatus
} from '@focoman/types';
import { RECOVERY_WINDOW_DAYS } from '@focoman/config';

/**
 * Pure Business Logic & Domain State Engines
 * Source of Truth: Focoman Product Discovery Document & Major Product Design Amendment
 */

/**
 * Calculates whether an order can be marked COMPLETED.
 * An order is COMPLETED only when:
 * 1. Required production/delivery work tasks are COMPLETED.
 * 2. Payment status is marked PAYMENT_COMPLETED or PAID.
 */
export function canCompleteOrder(
  paymentStatus: string,
  tasks: Task[]
): boolean {
  if (paymentStatus !== 'PAYMENT_COMPLETED' && paymentStatus !== 'PAID') {
    return false;
  }
  return tasks.every(task => task.status === 'COMPLETED');
}

/**
 * Validates if booking confirmation requirements are satisfied.
 * Requires verified payment status or explicit owner verification.
 */
export function canConfirmBooking(
  paymentStatus: string,
  verificationStatus?: PaymentVerificationStatus
): { canConfirm: boolean; reason?: string } {
  if (verificationStatus === 'REJECTED') {
    return { canConfirm: false, reason: 'Payment was rejected.' };
  }
  if (
    paymentStatus === 'PAID' ||
    paymentStatus === 'PARTIAL' ||
    paymentStatus === 'ADVANCE_RECEIVED' ||
    paymentStatus === 'PAYMENT_COMPLETED' ||
    verificationStatus === 'VERIFIED'
  ) {
    return { canConfirm: true };
  }
  return {
    canConfirm: false,
    reason: 'Advance payment must be submitted and verified before booking confirmation.'
  };
}

/**
 * Evaluates operational pre-flight conflicts before confirming a booking or order.
 * Checks event date overlaps, location, and crew member skill/availability.
 */
export function performPreflightCheck(
  eventDateISO: string,
  locationAddress: string,
  requiredServices: string[],
  existingStudioOrders: Order[],
  studioMembers: StudioMember[]
): PreflightConflictReport {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // 1. Event Date Conflict Check
  const eventDateConflicts = existingStudioOrders
    .filter(o => !o.isDeleted && o.orderStatus !== 'CANCELLED' && o.eventDate === eventDateISO)
    .map(o => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      eventType: o.eventType,
    }));

  if (eventDateConflicts.length > 0) {
    warnings.push(
      `Studio already has ${eventDateConflicts.length} active event(s) booked on ${eventDateISO}.`
    );
  }

  // 2. Resource/Skill match check
  const requiredSkills: string[] = [];
  for (const svc of requiredServices) {
    const sLower = svc.toLowerCase();
    if (sLower.includes('photo')) requiredSkills.push('PHOTOGRAPHY');
    if (sLower.includes('video')) requiredSkills.push('VIDEOGRAPHY');
    if (sLower.includes('album')) requiredSkills.push('ALBUM_DESIGN');
  }

  const matchingMembers = studioMembers.filter(m =>
    !m.isDeleted &&
    (m.status === 'ACTIVE' || !m.status) &&
    requiredSkills.some(reqSkill => m.skills.includes(reqSkill))
  );

  if (matchingMembers.length === 0 && requiredSkills.length > 0) {
    warnings.push('No active studio crew members match the required skills for this booking.');
  } else if (matchingMembers.length > 0) {
    suggestions.push(
      `Found ${matchingMembers.length} available member(s) with matching skills (${matchingMembers.map(m => m.name).join(', ')}).`
    );
  }

  if (!locationAddress || locationAddress.trim().length === 0) {
    warnings.push('Event location address is incomplete.');
  }

  return {
    hasConflicts: eventDateConflicts.length > 0 || warnings.length > 0,
    eventDateConflicts,
    resourceConflicts: [],
    warnings,
    suggestions,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Free OMS pre-flight retains real event-date and location checks without
 * introducing ERP crew terminology, matching, or resource suggestions.
 */
export function performBasicPreflightCheck(
  eventDateISO: string,
  locationAddress: string,
  existingStudioOrders: Order[]
): PreflightConflictReport {
  const warnings: string[] = [];
  const eventDateConflicts = existingStudioOrders
    .filter(o => !o.isDeleted && o.orderStatus !== 'CANCELLED' && o.eventDate === eventDateISO)
    .map(o => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      eventType: o.eventType,
    }));

  if (eventDateConflicts.length > 0) {
    warnings.push(
      `Studio already has ${eventDateConflicts.length} active event(s) booked on ${eventDateISO}.`
    );
  }
  if (!locationAddress || locationAddress.trim().length === 0) {
    warnings.push('Event location address is incomplete.');
  }

  return {
    hasConflicts: eventDateConflicts.length > 0 || warnings.length > 0,
    eventDateConflicts,
    resourceConflicts: [],
    warnings,
    suggestions: [],
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Generates automated resource suggestions for studio owner review & confirmation.
 * Follows principle: SYSTEM SUGGESTS -> STUDIO OWNER REVIEWS -> STUDIO OWNER CONFIRMS -> SAVED.
 */
export function generateResourceSuggestions(
  eventDateISO: string,
  requiredSkills: string[],
  studioMembers: StudioMember[],
  activeTasks: Task[]
): ResourceSuggestion[] {
  const activeMembers = studioMembers.filter(m => !m.isDeleted && (m.status === 'ACTIVE' || !m.status));

  return activeMembers.map(member => {
    const matchingSkills = requiredSkills.filter(skill => member.skills.includes(skill));
    const memberTasks = activeTasks.filter(t => !t.isDeleted && t.assignedMemberId === member.id && t.status !== 'COMPLETED');
    const matchScore = matchingSkills.length > 0 ? Math.min(100, matchingSkills.length * 40 - memberTasks.length * 10) : 10;

    let reason = 'General availability';
    if (matchingSkills.length > 0) {
      reason = `Matches skills: ${matchingSkills.join(', ')}. Current active workload: ${memberTasks.length} task(s).`;
    }

    return {
      memberId: member.id,
      memberName: member.name,
      skill: matchingSkills[0] || member.skills[0] || 'GENERAL',
      matchScore: Math.max(0, matchScore),
      matchReason: reason,
      availableOnDate: true,
      currentWorkload: memberTasks.length,
      status: 'SUGGESTED' as const,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

export interface OrderReceiptEntry {
  id: string;
  receiptNumber: string;
  type: 'ADVANCE' | 'INSTALLMENT';
  label: string;
  amount: number;
  date: string;
  notes?: string;
  recordedBy?: string;
}

export interface OrderPaymentBreakdown {
  confirmedPrice: number;
  advanceAmount: number;
  advanceDate: string;
  installments: NonNullable<Order['pricing']['installments']>;
  installmentsTotal: number;
  totalPaid: number;
  remainingAmount: number;
  receipts: OrderReceiptEntry[];
}

/**
 * Single source of truth for order payment totals and discrete receipt items.
 * Prevents double-counting between advanceAmount and installments[].
 */
export function calculateOrderPaymentBreakdown(
  order: Pick<Order, 'orderNumber' | 'pricing' | 'paymentStatus' | 'createdAt' | 'eventDate'>
): OrderPaymentBreakdown {
  const amounts = getOrderFinancials(order);
  const confirmedPrice = amounts.confirmed / 100;
  const advanceAmount = amounts.advance / 100;
  const advanceDate = order.pricing.advanceDate || '';
  const installments = order.pricing.installments || [];
  const installmentsTotal = amounts.installmentsTotal / 100;
  const totalPaid = amounts.paid / 100;
  const remainingAmount = amounts.remaining / 100;
  const receipts: OrderReceiptEntry[] = getReceiptSources(order)
    .filter(source => !source.requiresConfirmation)
    .map(source => ({
      id: source.source.kind === 'ADVANCE' ? 'ADVANCE' : source.source.id,
      receiptNumber: '',
      type: source.source.kind,
      label: source.label,
      amount: source.amountMinor / 100,
      date: source.paymentDate!,
    }));

  return {
    confirmedPrice,
    advanceAmount,
    advanceDate,
    installments,
    installmentsTotal,
    totalPaid,
    remainingAmount,
    receipts,
  };
}

/**
 * Transforms full Order into safe CustomerOrderView DTO (hiding private internal notes, internal tasks, crew info, internal financials).
 */
export function toCustomerOrderView(order: Order, studioName: string): CustomerOrderView {
  const breakdown = calculateOrderPaymentBreakdown(order);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    studioName,
    studioId: order.studioId,
    eventType: order.eventType,
    eventDate: order.eventDate,
    eventLocation: order.eventLocation || order.locationInfo?.address,
    services: order.services,
    totalAmount: breakdown.confirmedPrice,
    advanceAmount: breakdown.advanceAmount,
    amountPaid: breakdown.totalPaid,
    remainingAmount: breakdown.remainingAmount,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    bookingStatus: order.bookingStatus,
    trackingPasskey: order.trackingPasskey,
    passkeyPin: order.passkeyPin,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toCustomerTrackingView(
  order: Order,
  studioName: string,
  tasks: Task[],
  studioInfo?: {
    studioId?: string;
    studioOwnerId?: string;
    studioOwnerEmail?: string;
    studioLogoUrl?: string;
    studioCity?: string;
    studioPhone?: string;
    hasErp?: boolean;
    studioBillingProfile?: CustomerTrackingView['order']['studioBillingProfile'];
    staffEmails?: string[];
    staffUids?: string[];
  }
): CustomerTrackingView {
  const breakdown = calculateOrderPaymentBreakdown(order);
  return {
    order: {
      id: order.id,
      studioId: studioInfo?.studioId || order.studioId,
      studioOwnerId: studioInfo?.studioOwnerId,
      studioOwnerEmail: studioInfo?.studioOwnerEmail,
      orderNumber: order.orderNumber,
      bookingRequestId: order.bookingRequestId,
      trackingPasskey: order.trackingPasskey,
      passkeyPin: order.passkeyPin,
      studioName,
      studioLogoUrl: studioInfo?.studioLogoUrl,
      studioCity: studioInfo?.studioCity,
      studioPhone: studioInfo?.studioPhone,
      hasErp: studioInfo?.hasErp,
      studioBillingProfile: studioInfo?.studioBillingProfile,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone,
      customerUid: order.customer.uid,
      collaborators: order.collaborators,
      eventType: order.eventType,
      eventDate: order.eventDate,
      eventLocation: order.eventLocation || order.locationInfo?.address,
      services: order.services,
      packages: order.packages,
      totalAmount: breakdown.confirmedPrice,
      advanceAmount: breakdown.advanceAmount,
      advanceDate: breakdown.advanceDate,
      amountPaid: breakdown.totalPaid,
      remainingAmount: breakdown.remainingAmount,
      installments: breakdown.installments,
      driveDeliverables: order.driveDeliverables || [],
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      staffEmails: studioInfo?.staffEmails,
      staffUids: studioInfo?.staffUids,
      isHeadless: order.isHeadless || order.studioStatus === "INACTIVE" || false,
      studioStatus: order.studioStatus || (studioInfo?.studioOwnerId ? "ACTIVE" : (order.isHeadless ? "INACTIVE" : "ACTIVE")),
      createdAt: order.createdAt,
    },
    tasks: tasks.map((task) => ({
      title: task.title,
      serviceCategory: task.serviceCategory,
      status: task.status,
      sequenceOrder: task.sequenceOrder,
    })),
  };
}

export function toMemberWorkView(
  studioId: string,
  memberId: string,
  orders: Order[],
  tasks: Task[]
): MemberWorkView {
  const normalizedStudioId = studioId.toLowerCase();
  const memberTasks = tasks.filter((task) =>
    task.studioId === normalizedStudioId
    && !task.isDeleted
    && task.assignedMemberId === memberId
  );
  const taskOrderIds = new Set(memberTasks.map((task) => task.orderId));
  const assignedOrders = orders.filter((order) =>
    order.studioId === normalizedStudioId
    && !order.isDeleted
    && (taskOrderIds.has(order.id)
      || order.assignedResources?.some((resource) => resource.memberId === memberId))
  );
  const assignedOrderIds = new Set(assignedOrders.map((order) => order.id));

  return {
    orders: assignedOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      eventType: order.eventType,
      eventDate: order.eventDate,
      eventLocation: order.eventLocation || order.locationInfo?.address,
      services: order.services,
      orderStatus: order.orderStatus,
    })),
    tasks: memberTasks
      .filter((task) => assignedOrderIds.has(task.orderId))
      .map((task) => ({
        id: task.id,
        orderId: task.orderId,
        title: task.title,
        serviceCategory: task.serviceCategory,
        status: task.status,
        sequenceOrder: task.sequenceOrder,
      })),
  };
}

/**
 * Returns current calendar date (YYYY-MM-DD) in Indian Standard Time (or local studio timezone).
 */
export function getStudioCalendarDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Returns current timestamp in Indian Standard Time (Asia/Kolkata) formatted as YYYY-MM-DD HH:mm
 */
export function getStudioTimestampIST(dateInput: Date | string | number = new Date()): string {
  try {
    const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);
    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
    return d.toISOString().replace("T", " ").substring(0, 16);
  }
}

/**
 * Evaluates automatic order status transition based on event date and task progress.
 */
export function evaluateOrderStatus(
  currentStatus: OrderStatus,
  eventDateISO: string,
  tasksCompleted: boolean,
  paymentCompleted: boolean
): OrderStatus {
  if (currentStatus === 'CANCELLED') return 'CANCELLED';

  if (tasksCompleted && paymentCompleted) {
    return 'COMPLETED';
  }

  const today = getStudioCalendarDate();
  if (currentStatus === 'AWAITING_EVENT' && eventDateISO < today) {
    return 'POST_EVENT_IN_PROGRESS';
  }

  return currentStatus;
}

/**
 * Generates dynamic post-event task pipeline based on selected services.
 */
export function generateWorkflowTasks(
  orderId: string,
  studioId: string,
  services: string[]
): Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> {
  const tasks: Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> = [];
  let seq = 1;

  const servicesLower = services.map(s => s.toLowerCase());

  const hasPhoto = servicesLower.some(s => s.includes('photo') || s.includes('candid') || s.includes('traditional') || s.includes('outdoor') || s.includes('wedding'));
  const hasVideo = servicesLower.some(s => s.includes('video') || s.includes('cinematic') || s.includes('teaser') || s.includes('drone') || s.includes('aerial') || s.includes('wedding'));
  const hasAlbum = servicesLower.some(s => s.includes('album') || s.includes('book') || s.includes('print'));

  if (hasPhoto || (!hasVideo && !hasAlbum)) {
    tasks.push({
      orderId,
      studioId,
      title: 'Raw Photo Selection',
      serviceCategory: 'PHOTOGRAPHY',
      assignedMemberId: '',
      assignedMemberName: 'Unassigned',
      status: 'ASSIGNED',
      sequenceOrder: seq++
    });
    tasks.push({
      orderId,
      studioId,
      title: 'Photo Editing',
      serviceCategory: 'PHOTOGRAPHY',
      assignedMemberId: '',
      assignedMemberName: 'Unassigned',
      status: 'ASSIGNED',
      sequenceOrder: seq++
    });
  }

  if (hasVideo) {
    tasks.push({
      orderId,
      studioId,
      title: 'Video Editing',
      serviceCategory: 'VIDEOGRAPHY',
      assignedMemberId: '',
      assignedMemberName: 'Unassigned',
      status: 'ASSIGNED',
      sequenceOrder: seq++
    });
  }

  if (hasAlbum) {
    tasks.push({
      orderId,
      studioId,
      title: 'Album Edit',
      serviceCategory: 'ALBUM',
      assignedMemberId: '',
      assignedMemberName: 'Unassigned',
      status: 'ASSIGNED',
      sequenceOrder: seq++
    });
  }

  tasks.push({
    orderId,
    studioId,
    title: 'Final Delivery & Payment',
    serviceCategory: 'GENERAL',
    assignedMemberId: '',
    assignedMemberName: 'Unassigned',
    status: 'ASSIGNED',
    sequenceOrder: seq++
  });

  return tasks;
}

/**
 * Validates whether a soft-deleted record is within the allowed recovery window.
 * Default recovery window is 14 days per Focoman configuration.
 */
export function isWithinRecoveryWindow(
  deletedAtISO: string | null | undefined,
  windowDays = RECOVERY_WINDOW_DAYS
): boolean {
  if (!deletedAtISO) return false;
  const deletedTime = new Date(deletedAtISO).getTime();
  if (isNaN(deletedTime)) return false;

  const now = Date.now();
  const maxRetentionMs = windowDays * 24 * 60 * 60 * 1000;
  return now - deletedTime <= maxRetentionMs;
}

/**
 * Pure domain check if a record can be restored.
 */
export function canRestoreRecord(
  record: SoftDeletable,
  windowDays = RECOVERY_WINDOW_DAYS
): { allowed: boolean; reason?: string } {
  if (!record.isDeleted) {
    return { allowed: false, reason: 'Record is not deleted.' };
  }

  if (!isWithinRecoveryWindow(record.deletedAt, windowDays)) {
    return {
      allowed: false,
      reason: `Recovery window of ${windowDays} days has expired. Record cannot be restored.`,
    };
  }

  return { allowed: true };
}

/**
 * Pure transformation applying soft delete attributes to an entity.
 */
export function applySoftDelete<T extends SoftDeletable>(
  entity: T,
  deletedByUid: string
): T {
  return {
    ...entity,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: deletedByUid,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Pure transformation applying restore attributes to an entity.
 */
export function applyRestore<T extends SoftDeletable>(entity: T): T {
  return {
    ...entity,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Normalizes contact phone numbers to last 10 digits for accurate duplicate and matching checks.
 */
export function normalizeContactPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Checks whether two contact profiles match by 10-digit phone or email.
 */
export function isContactMatch(
  a: { phone?: string | null; email?: string | null },
  b: { phone?: string | null; email?: string | null }
): boolean {
  const phoneA = normalizeContactPhone(a.phone);
  const phoneB = normalizeContactPhone(b.phone);
  if (phoneA && phoneB && phoneA.length === 10 && phoneA === phoneB) {
    return true;
  }
  const emailA = a.email?.trim().toLowerCase();
  const emailB = b.email?.trim().toLowerCase();
  if (emailA && emailB && emailA === emailB) {
    return true;
  }
  return false;
}

/**
 * Checks if an order belongs to a customer, either via explicit customer ID or matching contact info.
 */
export function isOrderForCustomer(
  order: Order,
  customer: { id: string; phone?: string | null; email?: string | null }
): boolean {
  if (order.customer.id === customer.id) return true;
  return isContactMatch(order.customer, customer);
}

/**
 * Calculates customer Lifetime Value (LTV), total orders, and pending receivables.
 * Excludes cancelled orders from uncollected pending dues.
 */
export function calculateCustomerLTV(orders: Order[]): {
  totalOrders: number;
  completedOrders: number;
  lifetimeValue: number;
  pendingReceivables: number;
  latestOrderDate: string | null;
} {
  let totalOrders = 0;
  let completedOrders = 0;
  let lifetimeValue = 0;
  let pendingReceivables = 0;
  let latestOrderDate: string | null = null;

  for (const o of orders) {
    if (o.isDeleted) continue;
    totalOrders += 1;
    if (o.orderStatus === 'COMPLETED') completedOrders += 1;

    // Cancelled orders do not accumulate pending receivables
    if (o.orderStatus !== 'CANCELLED') {
      const breakdown = calculateOrderPaymentBreakdown(o);
      lifetimeValue += breakdown.confirmedPrice;
      if (o.paymentStatus !== 'PAID') {
        pendingReceivables += breakdown.remainingAmount;
      }
    }

    const orderDate = o.createdAt || o.eventDate;
    if (orderDate) {
      if (!latestOrderDate || new Date(orderDate) > new Date(latestOrderDate)) {
        latestOrderDate = orderDate;
      }
    }
  }

  return {
    totalOrders,
    completedOrders,
    lifetimeValue,
    pendingReceivables,
    latestOrderDate,
  };
}

export interface CustomerMilestone {
  orderId: string;
  orderNumber: string;
  eventType: string;
  eventDate: string;
  type: 'UPCOMING_EVENT' | 'ANNUAL_ANNIVERSARY';
  title: string;
  targetDate: string;
  daysRemaining: number;
  yearsCount?: number;
}

function getOrdinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Computes authentic customer milestones & upcoming annual anniversaries.
 * Driven strictly by actual order event dates (no fake / placeholder data).
 */
export function calculateCustomerMilestones(
  orders: Order[],
  referenceDateStr?: string
): CustomerMilestone[] {
  const todayStr = referenceDateStr || getStudioCalendarDate();
  const [refYear, refMonth, refDay] = todayStr.split('-').map(Number);
  const refDate = new Date(refYear, refMonth - 1, refDay);

  const milestones: CustomerMilestone[] = [];

  for (const order of orders) {
    if (order.isDeleted || order.orderStatus === 'CANCELLED') continue;
    if (!order.eventDate) continue;

    const [evYear, evMonth, evDay] = order.eventDate.split('-').map(Number);
    if (!evYear || !evMonth || !evDay) continue;

    const eventDateObj = new Date(evYear, evMonth - 1, evDay);

    if (order.eventDate >= todayStr) {
      // Future event shoot
      const diffMs = eventDateObj.getTime() - refDate.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      milestones.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        eventType: order.eventType,
        eventDate: order.eventDate,
        type: 'UPCOMING_EVENT',
        title: `Upcoming: ${order.eventType}`,
        targetDate: order.eventDate,
        daysRemaining: Math.max(0, days),
      });
    } else {
      // Past event: calculate next annual anniversary
      let targetYear = refYear;
      let nextAnniv = new Date(targetYear, evMonth - 1, evDay);
      if (nextAnniv.getTime() < refDate.getTime()) {
        targetYear += 1;
        nextAnniv = new Date(targetYear, evMonth - 1, evDay);
      }
      const yearsCount = targetYear - evYear;
      if (yearsCount > 0) {
        const diffMs = nextAnniv.getTime() - refDate.getTime();
        const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const targetDateStr = `${targetYear}-${String(evMonth).padStart(2, '0')}-${String(evDay).padStart(2, '0')}`;
        milestones.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          eventType: order.eventType,
          eventDate: order.eventDate,
          type: 'ANNUAL_ANNIVERSARY',
          title: `${yearsCount}${getOrdinalSuffix(yearsCount)} Anniversary: ${order.eventType}`,
          targetDate: targetDateStr,
          daysRemaining: Math.max(0, days),
          yearsCount,
        });
      }
    }
  }

  // Sort upcoming milestones by daysRemaining ascending
  return milestones.sort((a, b) => a.daysRemaining - b.daysRemaining);
}


