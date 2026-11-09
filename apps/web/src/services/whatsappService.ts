import 'server-only';
import {
  getOrdersByStudio,
  getStudioBySlug,
  getMembersByStudio,
  getTasksByOrder,
  updateTask,
  updateOrder,
  getFirestoreServerInstance,
} from '@focoman/db';
import { canCompleteOrder, getStudioTimestampIST } from '@focoman/domain';
import type { Order, StudioMember, ResourceAssignment, TaskStatus, OrderAuditEntry } from '@focoman/types';

/**
 * WhatsApp Premium Operational Layer & Bot Operations Engine
 *
 * Supports:
 * - WA-001: Automated Order Stage Notifications & Firestore `whatsapp_logs`
 * - WA-002: Interactive Studio Operations Bot & WhatsApp-Based Workflow Actions (Owner & Crew)
 * - WA-003: Customer Order Status Queries (Order ID + 6-digit Passkey verification)
 * - WA-004: Crew Reminders & Call Times
 */

export interface WhatsAppTemplateData {
  studioName: string;
  customerName?: string;
  orderNumber?: string;
  eventDate?: string;
  eventType?: string;
  venue?: string;
  callTime?: string;
  venueNotes?: string;
  balanceDue?: number;
  trackingPasskey?: string;
  passkeyPin?: string;
  trackingUrl?: string;
  crewName?: string;
  taskTitle?: string;
  customNote?: string;
}

export type WhatsAppTemplateId =
  | 'upcoming_3day_reminder'
  | 'post_event_start'
  | 'raw_photos_ready'
  | 'customer_selection_done'
  | 'album_review_ready'
  | 'ready_for_delivery'
  | 'booking_confirmation'
  | 'crew_assignment_alert'
  | 'crew_task_assigned';

export interface WhatsAppTemplateDefinition {
  id: WhatsAppTemplateId;
  title: string;
  audience: 'OWNER' | 'MEMBER' | 'CUSTOMER';
  description: string;
  generateText: (data: WhatsAppTemplateData) => string;
}

export interface WhatsAppDispatchLog {
  id: string;
  studioId: string;
  orderId?: string;
  orderNumber?: string;
  templateId: string;
  audience: 'OWNER' | 'MEMBER' | 'CUSTOMER';
  recipientPhone: string;
  messagePreview: string;
  mode: 'CLOUD_API' | 'CLICK_TO_CHAT_FALLBACK' | 'BOT_REPLY';
  status: 'SENT' | 'LOGGED' | 'FAILED';
  createdAt: string;
}

// ============================================================================
// 1. TEMPLATE REGISTRY
// ============================================================================

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateId, WhatsAppTemplateDefinition> = {
  booking_confirmation: {
    id: 'booking_confirmation',
    title: 'Booking Confirmation & 6-Digit Access Passkey',
    audience: 'CUSTOMER',
    description: 'Sent to the customer when an order is confirmed, with their canonical Order ID and 6-digit passkey.',
    generateText: (d) =>
      `📸 *${d.studioName}* — Booking Confirmed!\n\n` +
      `Hello ${d.customerName || 'Valued Client'},\n` +
      `Your booking for *${d.eventType || 'Event'}* on *${d.eventDate || 'Scheduled Date'}* has been confirmed.\n\n` +
      `📌 *Order ID:* ${d.orderNumber || 'Pending'}\n` +
      `🔑 *6-Digit Passkey:* ${d.passkeyPin || 'Available in portal'}\n` +
      `🔗 *Live Order Portal:* ${d.trackingUrl || `https://focoman.web.app/track/${d.orderNumber || d.trackingPasskey}`}\n\n` +
      `Track shoot milestones, photo proofing, and album progress live anytime. Thank you!`,
  },

  upcoming_3day_reminder: {
    id: 'upcoming_3day_reminder',
    title: 'Upcoming Shoot 3-Day Call Reminder',
    audience: 'OWNER',
    description: 'Alert sent 3 days before event date for equipment pre-flight and crew check.',
    generateText: (d) =>
      `⏰ *${d.studioName} Operational Alert*\n\n` +
      `Upcoming shoot in 3 days: *${d.eventType || 'Event'}* for *${d.customerName || 'Client'}*.\n` +
      `📅 *Date:* ${d.eventDate || 'TBD'}\n` +
      `⏰ *Call Time:* ${d.callTime || '08:30 AM'}\n` +
      `📍 *Venue:* ${d.venue || 'Confirmed Venue'}\n` +
      `📌 *Order ID:* ${d.orderNumber || 'N/A'}\n\n` +
      `Please ensure battery packs, memory cards, and assigned crew call-times are verified.`,
  },

  post_event_start: {
    id: 'post_event_start',
    title: 'Post-Event Workflow Started',
    audience: 'OWNER',
    description: 'Fired when event date passes and the order enters post-production.',
    generateText: (d) =>
      `🎬 *${d.studioName} Production Update*\n\n` +
      `Event shoot for *${d.customerName || 'Client'}* (*${d.orderNumber}*) is complete.\n` +
      `Order has automatically progressed to *Post-Event Production*.\n` +
      `Next milestone: Ingest memory cards and upload RAW gallery for customer selection.`,
  },

  raw_photos_ready: {
    id: 'raw_photos_ready',
    title: 'RAW Photos Ready for Customer Proofing',
    audience: 'CUSTOMER',
    description: 'Sent to customer with link to select favorites for photo editing and album design.',
    generateText: (d) =>
      `✨ *${d.studioName}* — Your Photos Are Ready for Selection!\n\n` +
      `Hello ${d.customerName || 'Client'},\n` +
      `Your event photos for Order *${d.orderNumber}* are now available in your private portal.\n` +
      `Please review and mark your favorite shots for final retouching & album design:\n\n` +
      `🔗 *Proofing Gallery:* ${d.trackingUrl || `https://focoman.web.app/track/${d.orderNumber || d.trackingPasskey}`}\n` +
      `🔑 *Passkey:* ${d.passkeyPin || 'Use your 6-digit PIN'}\n\n` +
      `Let us know once you complete selection so editing can begin immediately!`,
  },

  customer_selection_done: {
    id: 'customer_selection_done',
    title: 'Customer Photo Selection Completed',
    audience: 'OWNER',
    description: 'Alerts studio owner/editor that the client has finalized proofing selections.',
    generateText: (d) =>
      `✅ *${d.studioName} Milestone Alert*\n\n` +
      `*${d.customerName || 'Client'}* has completed photo selection for Order *#${d.orderNumber}*.\n` +
      `Retouching and album layout stream is now unlocked. Assigned editors have been queued.`,
  },

  album_review_ready: {
    id: 'album_review_ready',
    title: 'Album Layout Ready for Client Approval',
    audience: 'CUSTOMER',
    description: 'Sent to customer to preview the draft album layout before final print.',
    generateText: (d) =>
      `📖 *${d.studioName}* — Album Design Draft Ready!\n\n` +
      `Hello ${d.customerName || 'Client'},\n` +
      `Your photobook album layout for Order *${d.orderNumber}* is ready for your review.\n` +
      `Please review page spreads and submit comments or final approval:\n\n` +
      `🔗 *Album Review Portal:* ${d.trackingUrl || `https://focoman.web.app/track/${d.orderNumber || d.trackingPasskey}`}\n\n` +
      `Once approved, your album will be sent for high-grade archival printing.`,
  },

  ready_for_delivery: {
    id: 'ready_for_delivery',
    title: 'Order Ready for Delivery / Studio Pickup',
    audience: 'CUSTOMER',
    description: 'Sent when physical photobook and final cloud deliverables are complete.',
    generateText: (d) =>
      `🎉 *${d.studioName}* — Your Order is Ready for Delivery!\n\n` +
      `Hello ${d.customerName || 'Client'},\n` +
      `All photos, cinematic video, and album prints for your *${d.eventType || 'Event'}* are complete and packed!\n\n` +
      `📌 *Order ID:* ${d.orderNumber}\n` +
      (d.balanceDue && d.balanceDue > 0
        ? `💰 *Pending Balance:* ₹${d.balanceDue.toLocaleString('en-IN')}\n\n`
        : `💰 *Payment Status:* Paid in Full ✅\n\n`) +
      `Please coordinate studio pickup or courier delivery details with us. Thank you for choosing us!`,
  },

  crew_assignment_alert: {
    id: 'crew_assignment_alert',
    title: 'Crew Assignment & Call-Time Alert',
    audience: 'MEMBER',
    description: 'Sent to studio team member with event date, call time, venue, and role details.',
    generateText: (d) =>
      `📋 *${d.studioName} Crew Call-Time Reminder*\n\n` +
      `Hi ${d.crewName || 'Team Member'},\n` +
      `You have been assigned to shoot *${d.eventType || 'Event'}* (Order *#${d.orderNumber || 'N/A'}*).\n` +
      `📅 *Date:* ${d.eventDate || 'Scheduled Date'}\n` +
      `⏰ *Call Time:* ${d.callTime || '08:30 AM'}\n` +
      `📍 *Venue:* ${d.venue || 'Confirmed Venue'}\n` +
      (d.venueNotes ? `📝 *Shoot Notes:* ${d.venueNotes}\n` : '') +
      `📌 *Role/Service:* ${d.taskTitle || 'Photography & Cinematography'}\n\n` +
      `Reply with \`CONFIRM ${d.orderNumber || ''}\` to confirm availability or check your studio dashboard.`,
  },

  crew_task_assigned: {
    id: 'crew_task_assigned',
    title: 'Production Task Assigned',
    audience: 'MEMBER',
    description: 'Sent when an editing, grading, or album design task is assigned to a crew member.',
    generateText: (d) =>
      `⚡ *${d.studioName} Task Assignment*\n\n` +
      `Hi ${d.crewName || 'Editor'},\n` +
      `New production task assigned: *${d.taskTitle || 'Editing'}* for Order *#${d.orderNumber}*.\n` +
      `Client: ${d.customerName || 'Studio Client'}\n\n` +
      `Reply with \`DONE ${d.orderNumber}\` when completed, or update status in your studio dashboard.`,
  },
};

// ============================================================================
// 2. HELPER: ONE-CLICK WHATSAPP CLICK-TO-CHAT URL & LOG PERSISTENCE
// ============================================================================

export function generateWhatsAppClickToChatUrl(phone: string, text: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

export async function recordWhatsAppLog(entry: Omit<WhatsAppDispatchLog, 'id' | 'createdAt'>): Promise<void> {
  try {
    const db = getFirestoreServerInstance();
    const id = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const doc: WhatsAppDispatchLog = {
      ...entry,
      id,
      createdAt: new Date().toISOString(),
    };
    await db.collection('whatsapp_logs').doc(id).set(doc);
  } catch (err) {
    console.warn('[recordWhatsAppLog] Non-fatal log write warning:', err);
  }
}

export async function getStudioWhatsAppLogs(studioSlug: string, limit = 25): Promise<WhatsAppDispatchLog[]> {
  try {
    const db = getFirestoreServerInstance();
    const snap = await db
      .collection('whatsapp_logs')
      .where('studioId', '==', studioSlug.toLowerCase())
      .limit(limit)
      .get();
    const logs = snap.docs.map((d) => d.data() as WhatsAppDispatchLog);
    return logs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

/**
 * WA-001: Dispatches automated WhatsApp stage notifications when an order or task changes state.
 */
export async function dispatchOrderStageWhatsAppNotification(input: {
  studioId: string;
  order: Order;
  taskTitle: string;
  newStatus: string;
}): Promise<void> {
  try {
    const studio = await getStudioBySlug(input.studioId);
    if (!studio) return;

    const config = studio.whatsappConfig || {};
    if (config.masterEnabled === false || config.master_operational === false) return;

    const lowerTitle = input.taskTitle.toLowerCase();
    let templateId: WhatsAppTemplateId | null = null;
    let targetPhone = input.order.customer?.phone || '';
    let audience: 'OWNER' | 'MEMBER' | 'CUSTOMER' = 'CUSTOMER';

    if (input.newStatus === 'COMPLETED' && lowerTitle.includes('raw photo')) {
      if (config.raw_photos_sent === false) return;
      templateId = 'raw_photos_ready';
      audience = 'CUSTOMER';
    } else if (input.newStatus === 'REVIEW' && lowerTitle.includes('album')) {
      if (config.album_review_done === false) return;
      templateId = 'album_review_ready';
      audience = 'CUSTOMER';
    } else if (input.newStatus === 'COMPLETED' && (lowerTitle.includes('final delivery') || lowerTitle.includes('gallery'))) {
      if (config.ready_for_delivery === false && config.customer_ready_delivery === false) return;
      templateId = 'ready_for_delivery';
      audience = 'CUSTOMER';
    } else if (input.newStatus === 'IN_PROGRESS') {
      if (config.post_event_start === false) return;
      templateId = 'post_event_start';
      audience = 'OWNER';
      targetPhone = studio.ownerPhone || input.order.customer?.phone || '';
    }

    if (!templateId || !targetPhone) return;

    const tpl = WHATSAPP_TEMPLATES[templateId];
    const messageText = tpl.generateText({
      studioName: studio.name,
      customerName: input.order.customer?.name,
      orderNumber: input.order.orderNumber,
      eventDate: input.order.eventDate,
      eventType: input.order.eventType,
      venue: input.order.eventLocation,
      balanceDue: input.order.pricing?.remainingAmount,
      passkeyPin: input.order.passkeyPin,
      trackingPasskey: input.order.orderNumber,
      trackingUrl: `https://focoman.web.app/track/${input.order.orderNumber}`,
      taskTitle: input.taskTitle,
    });

    const sendRes = await sendWhatsAppMessageOrFallback(targetPhone, messageText);

    await recordWhatsAppLog({
      studioId: studio.id.toLowerCase(),
      orderId: input.order.id,
      orderNumber: input.order.orderNumber,
      templateId,
      audience,
      recipientPhone: targetPhone,
      messagePreview: messageText.slice(0, 180),
      mode: sendRes.mode,
      status: sendRes.dispatched ? 'SENT' : 'LOGGED',
    });
  } catch (err) {
    console.warn('[dispatchOrderStageWhatsAppNotification] Warning:', err);
  }
}

// ============================================================================
// 3. WHATSAPP OPERATIONS BOT COMMAND ENGINE (OWNER, CREW & CUSTOMER)
// ============================================================================

export interface BotCommandResponse {
  success: boolean;
  message: string;
  commandRecognized: string;
}

export interface BotCallerContext {
  role?: 'STUDIO_OWNER' | 'STUDIO_MEMBER' | 'CUSTOMER';
  memberId?: string;
  memberName?: string;
  senderPhone?: string;
}

/**
 * Parses and executes text commands sent by Studio Owners or Authorized Crew Members
 * to the Operations Bot (WA-002, WA-003).
 */
export async function processWhatsAppBotMessage(
  studioSlug: string,
  incomingText: string,
  _senderPhone?: string,
  callerContext?: BotCallerContext
): Promise<BotCommandResponse> {
  const studio = await getStudioBySlug(studioSlug);
  if (!studio) {
    return {
      success: false,
      commandRecognized: 'UNKNOWN',
      message: `Studio [${studioSlug}] was not found in Focoman.`,
    };
  }

  const callerRole = callerContext?.role || 'STUDIO_OWNER';
  const raw = incomingText.trim();
  const parts = raw.split(/\s+/);
  const command = (parts[0] || '').toUpperCase();
  const arg = parts.slice(1).join(' ').trim();

  const getTodayIst = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  const todayStr = getTodayIst();

  switch (command) {
    case 'HELP':
    case 'MENU':
    case '?':
      return {
        success: true,
        commandRecognized: 'HELP',
        message:
          `🤖 *${studio.name} — WhatsApp Operations Bot*\n\n` +
          `Available Operational Commands:\n` +
          `• *TODAY* — View shoots & call-times scheduled for today\n` +
          `• *SHOOTS* — Upcoming events in the next 14 days\n` +
          `• *ORDERS* — Active in-progress orders summary\n` +
          `• *STATUS <OrderID>* — Lookup order status & tasks\n` +
          `• *CREW* — Active team roster & assigned roles\n` +
          `• *DONE <OrderID>* — Mark your active production task Completed\n` +
          `• *PROGRESS <OrderID>* — Mark your assigned task In Progress\n` +
          `• *CONFIRM <OrderID>* — Confirm crew availability for shoot\n` +
          `• *HELP* — Show this command menu`,
      };

    case 'TODAY': {
      const orders = await getOrdersByStudio(studio.id);
      const todaysOrders = orders.filter((o: Order) => o.eventDate === todayStr);

      if (todaysOrders.length === 0) {
        return {
          success: true,
          commandRecognized: 'TODAY',
          message:
            `📅 *Today's Schedule (${todayStr})*\n\n` +
            `No event shoots scheduled for today for *${studio.name}*.\n` +
            `Check *SHOOTS* for upcoming events this week.`,
        };
      }

      const listText = todaysOrders
        .map(
          (o: Order, idx: number) =>
            `${idx + 1}. *${o.customer?.name || 'Client'}* (${o.orderNumber})\n` +
            `   • Type: ${o.eventType || 'Event'}\n` +
            `   • Call Time: ${o.callTime || o.assignedResources?.[0]?.callTime || '08:30 AM'}\n` +
            `   • Venue: ${o.eventLocation || 'Confirmed Venue'}\n` +
            `   • Crew: ${o.assignedResources?.map((c: ResourceAssignment) => c.memberName).join(', ') || 'Unassigned'}\n` +
            `   • Status: ${o.orderStatus}`
        )
        .join('\n\n');

      return {
        success: true,
        commandRecognized: 'TODAY',
        message: `📅 *Today's Events (${todayStr}) — ${todaysOrders.length} Order(s)*:\n\n${listText}`,
      };
    }

    case 'SHOOTS':
    case 'UPCOMING': {
      const orders = await getOrdersByStudio(studio.id);
      const upcoming = orders
        .filter((o: Order) => o.eventDate && o.eventDate >= todayStr && o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'COMPLETED')
        .sort((a: Order, b: Order) => (a.eventDate! > b.eventDate! ? 1 : -1))
        .slice(0, 5);

      if (upcoming.length === 0) {
        return {
          success: true,
          commandRecognized: 'SHOOTS',
          message: `📅 *Upcoming Shoots:*\nNo upcoming confirmed events scheduled in the calendar.`,
        };
      }

      const listText = upcoming
        .map(
          (o: Order, idx: number) =>
            `${idx + 1}. *${o.eventDate}* — ${o.eventType || 'Shoot'}\n` +
            `   • Client: ${o.customer?.name || 'Client'} (${o.orderNumber})\n` +
            `   • Call Time: ${o.callTime || o.assignedResources?.[0]?.callTime || '08:30 AM'}\n` +
            `   • Venue: ${o.eventLocation || 'TBD'}\n` +
            `   • Crew: ${o.assignedResources?.map((c: ResourceAssignment) => c.memberName).join(', ') || 'Not assigned yet'}`
        )
        .join('\n\n');

      return {
        success: true,
        commandRecognized: 'SHOOTS',
        message: `📅 *Upcoming Shoots for ${studio.name} (Next 5):*\n\n${listText}`,
      };
    }

    case 'ORDERS':
    case 'ACTIVE': {
      const orders = await getOrdersByStudio(studio.id);
      const active = orders.filter((o: Order) => o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED');

      const awaitingEvent = active.filter((o: Order) => o.orderStatus === 'AWAITING_EVENT').length;
      const inProgress = active.filter((o: Order) => o.orderStatus === 'POST_EVENT_IN_PROGRESS').length;
      const totalBalanceDue = active.reduce((acc: number, o: Order) => acc + (o.pricing?.remainingAmount || 0), 0);

      return {
        success: true,
        commandRecognized: 'ORDERS',
        message:
          `📊 *${studio.name} — Active OMS Summary*\n\n` +
          `• Total Active Orders: *${active.length}*\n` +
          `• Awaiting Event Date: *${awaitingEvent}*\n` +
          `• In Post-Production: *${inProgress}*\n` +
          `• Outstanding Balance Due: *₹${totalBalanceDue.toLocaleString('en-IN')}*\n\n` +
          `Reply with \`STATUS <OrderID>\` to look up specific details.`,
      };
    }

    case 'STATUS': {
      if (!arg) {
        return {
          success: false,
          commandRecognized: 'STATUS',
          message: `⚠️ Please provide an Order ID or 6-digit passkey. Example: \`STATUS ORD-LUM-261106-143025\`.`,
        };
      }

      const orders = await getOrdersByStudio(studio.id);
      const cleanQuery = arg.toUpperCase().replace(/^#/, '');

      const matched = orders.find(
        (o: Order) =>
          o.orderNumber?.toUpperCase().includes(cleanQuery) ||
          o.passkeyPin === cleanQuery ||
          o.id.toUpperCase() === cleanQuery
      );

      if (!matched) {
        return {
          success: false,
          commandRecognized: 'STATUS',
          message: `🔍 Order [${arg}] not found in ${studio.name}. Please check the Order ID.`,
        };
      }

      return {
        success: true,
        commandRecognized: 'STATUS',
        message:
          `📋 *Order Status: #${matched.orderNumber}*\n\n` +
          `• Client: *${matched.customer?.name || 'N/A'}*\n` +
          `• Event: *${matched.eventType || 'Event'}* on *${matched.eventDate || 'N/A'}*\n` +
          `• Venue: ${matched.eventLocation || 'N/A'}\n` +
          `• Lifecycle Status: *${matched.orderStatus}*\n` +
          `• Total Price: ₹${matched.pricing?.finalConfirmedPrice?.toLocaleString('en-IN') || 0}\n` +
          `• Balance Due: ₹${matched.pricing?.remainingAmount?.toLocaleString('en-IN') || 0}\n` +
          `• Assigned Crew: ${matched.assignedResources?.map((c: ResourceAssignment) => c.memberName).join(', ') || 'None'}\n` +
          `• 6-Digit Passkey: *${matched.passkeyPin || 'N/A'}*`,
      };
    }

    case 'CREW':
    case 'TEAM': {
      const members = await getMembersByStudio(studio.id);
      if (members.length === 0) {
        return {
          success: true,
          commandRecognized: 'CREW',
          message: `👥 No team members registered under ${studio.name} yet.`,
        };
      }

      const listText = members
        .map(
          (m: StudioMember, idx: number) =>
            `${idx + 1}. *${m.name}* (${m.role || 'Member'})\n` +
            `   • Skills: ${m.skills?.join(', ') || 'General'}\n` +
            `   • Contact: ${m.phone || m.email}`
        )
        .join('\n\n');

      return {
        success: true,
        commandRecognized: 'CREW',
        message: `👥 *${studio.name} Team Roster (${members.length} members):*\n\n${listText}`,
      };
    }

    // ========================================================================
    // WA-002: WHATSAPP-BASED WORKFLOW ACTIONS (DONE / PROGRESS / CONFIRM)
    // ========================================================================
    case 'DONE':
    case 'COMPLETE':
    case 'PROGRESS': {
      if (!arg) {
        return {
          success: false,
          commandRecognized: command,
          message: `⚠️ Please specify the Order ID or Task ID. Example: \`${command} ORD-LUM-261106-143025\`.`,
        };
      }

      const targetStatus: TaskStatus = command === 'PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED';
      const orders = await getOrdersByStudio(studio.id);
      const cleanArg = arg.toUpperCase().replace(/^#/, '');

      const matchedOrder = orders.find(
        (o: Order) =>
          o.orderNumber?.toUpperCase().includes(cleanArg) ||
          o.id.toUpperCase() === cleanArg
      );

      if (!matchedOrder) {
        return {
          success: false,
          commandRecognized: command,
          message: `🔍 Order [${arg}] not found in ${studio.name}.`,
        };
      }

      const orderTasks = await getTasksByOrder(matchedOrder.id);
      const candidateTask = orderTasks.find((t) => {
        if (t.status === 'COMPLETED') return false;
        if (callerRole === 'STUDIO_OWNER') return true;
        return callerContext?.memberId && t.assignedMemberId === callerContext.memberId;
      });

      if (!candidateTask) {
        return {
          success: false,
          commandRecognized: command,
          message:
            callerRole === 'STUDIO_MEMBER'
              ? `🔒 No pending task assigned to your crew profile (${callerContext?.memberName || 'Member'}) on Order #${matchedOrder.orderNumber}.`
              : `✅ All production tasks on Order #${matchedOrder.orderNumber} are already completed.`,
        };
      }

      await updateTask(candidateTask.id, { status: targetStatus });
      const updatedTasks = await getTasksByOrder(matchedOrder.id);
      const isCompletable = canCompleteOrder(matchedOrder.paymentStatus, updatedTasks);

      const auditEntry: OrderAuditEntry = {
        id: `audit_${Date.now()}_wa`,
        timestamp: getStudioTimestampIST(new Date()),
        actorName: callerContext?.memberName || 'WhatsApp Bot User',
        actorRole: callerRole === 'STUDIO_OWNER' ? 'Owner' : 'Member',
        action: 'WhatsApp Workflow Action',
        details: `Updated task "${candidateTask.title}" to ${targetStatus} via WhatsApp Bot`,
      };

      await updateOrder(matchedOrder.id, {
        orderStatus: isCompletable
          ? 'COMPLETED'
          : matchedOrder.orderStatus === 'AWAITING_EVENT'
          ? 'POST_EVENT_IN_PROGRESS'
          : matchedOrder.orderStatus,
        auditLog: [...(matchedOrder.auditLog || []), auditEntry],
      });

      return {
        success: true,
        commandRecognized: command,
        message:
          `✅ *Workflow Updated via WhatsApp*\n\n` +
          `• Order: *#${matchedOrder.orderNumber}* (${matchedOrder.customer?.name})\n` +
          `• Task: *${candidateTask.title}*\n` +
          `• New Status: *${targetStatus}*\n` +
          `• Synced to Focoman OMS automatically.`,
      };
    }

    case 'CONFIRM':
    case 'REJECT': {
      if (!arg) {
        return {
          success: false,
          commandRecognized: command,
          message: `⚠️ Specify the Order ID to ${command.toLowerCase()} shoot availability. Example: \`${command} ORD-LUM-261106-143025\`.`,
        };
      }

      const orders = await getOrdersByStudio(studio.id);
      const cleanArg = arg.toUpperCase().replace(/^#/, '');
      const matchedOrder = orders.find(
        (o: Order) =>
          o.orderNumber?.toUpperCase().includes(cleanArg) ||
          o.id.toUpperCase() === cleanArg
      );

      if (!matchedOrder) {
        return {
          success: false,
          commandRecognized: command,
          message: `🔍 Order [${arg}] not found in ${studio.name}.`,
        };
      }

      const confirmed = command === 'CONFIRM';
      const updatedResources = (matchedOrder.assignedResources || []).map((r) => {
        if (!callerContext?.memberId || r.memberId === callerContext.memberId) {
          return { ...r, availabilityConfirmed: confirmed };
        }
        return r;
      });

      await updateOrder(matchedOrder.id, { assignedResources: updatedResources });

      return {
        success: true,
        commandRecognized: command,
        message:
          `${confirmed ? '✅' : '⚠️'} *Crew Availability ${confirmed ? 'Confirmed' : 'Declined'}*\n\n` +
          `Order *#${matchedOrder.orderNumber}* (${matchedOrder.eventType} on ${matchedOrder.eventDate}) has been updated in Focoman ERP.`,
      };
    }

    default:
      return {
        success: false,
        commandRecognized: 'UNKNOWN',
        message:
          `❓ Unknown command: "${raw}".\n\n` +
          `Reply with *HELP* to see available commands (TODAY, SHOOTS, ORDERS, STATUS, CREW, DONE, PROGRESS, CONFIRM).`,
      };
  }
}

// ============================================================================
// 4. META WHATSAPP BUSINESS CLOUD API DISPATCH (OPTIONAL ADVANCED GATEWAY)
// ============================================================================

export interface MetaCloudApiResult {
  dispatched: boolean;
  messageId?: string;
  error?: string;
  mode: 'CLOUD_API' | 'CLICK_TO_CHAT_FALLBACK';
  clickToChatUrl?: string;
}

export async function sendWhatsAppMessageOrFallback(
  recipientPhone: string,
  messageText: string
): Promise<MetaCloudApiResult> {
  const token = process.env.WHATSAPP_BUSINESS_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const clickToChatUrl = generateWhatsAppClickToChatUrl(recipientPhone, messageText);

  if (!token || !phoneId) {
    return {
      dispatched: false,
      mode: 'CLICK_TO_CHAT_FALLBACK',
      clickToChatUrl,
    };
  }

  try {
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: messageText },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        dispatched: false,
        mode: 'CLICK_TO_CHAT_FALLBACK',
        error: data.error?.message || 'Meta Cloud API call failed',
        clickToChatUrl,
      };
    }

    return {
      dispatched: true,
      mode: 'CLOUD_API',
      messageId: data.messages?.[0]?.id,
      clickToChatUrl,
    };
  } catch (err: any) {
    return {
      dispatched: false,
      mode: 'CLICK_TO_CHAT_FALLBACK',
      error: err.message,
      clickToChatUrl,
    };
  }
}
