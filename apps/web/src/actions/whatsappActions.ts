'use server';

import { requireVerifiedUser, requireStudioMember } from '@/lib/serverAuth';
import {
  processWhatsAppBotMessage,
  WHATSAPP_TEMPLATES,
  WhatsAppTemplateId,
  generateWhatsAppClickToChatUrl,
  getStudioWhatsAppLogs,
  WhatsAppDispatchLog,
} from '@/services/whatsappService';
import { getStudioBySlug, getOrderById } from '@focoman/db';

/**
 * Server Actions for WhatsApp Operations Hub & Bot Simulator
 */

export async function getStudioWhatsappLogsAction(
  studioSlug: string,
  idToken: string
): Promise<WhatsAppDispatchLog[]> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, 'STUDIO_OWNER');
    return await getStudioWhatsAppLogs(studioSlug, 30);
  } catch {
    return [];
  }
}

export async function simulateWhatsappBotQueryAction(
  studioSlug: string,
  query: string,
  idToken: string
): Promise<{ success: boolean; reply?: string; command?: string; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    // WhatsApp Operations Bot is accessible to STUDIO_OWNER in dashboard simulator
    await requireStudioMember(decoded.uid, studioSlug, 'STUDIO_OWNER');

    const response = await processWhatsAppBotMessage(studioSlug, query, undefined, {
      role: 'STUDIO_OWNER',
      memberName: decoded.name || decoded.email || 'Studio Owner',
    });
    return {
      success: response.success,
      reply: response.message,
      command: response.commandRecognized,
    };
  } catch (err: unknown) {
    console.error('[simulateWhatsappBotQueryAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Bot query execution failed.',
    };
  }
}

export async function getWhatsappTemplatePreviewAction(
  studioSlug: string,
  templateId: WhatsAppTemplateId,
  idToken: string,
  orderId?: string
): Promise<{
  success: boolean;
  text?: string;
  clickToChatUrl?: string;
  error?: string;
}> {
  try {
    const actor = await requireVerifiedUser(idToken);
    await requireStudioMember(actor.uid, studioSlug, 'STUDIO_OWNER');
    const templateDef = WHATSAPP_TEMPLATES[templateId];
    if (!templateDef) {
      return { success: false, error: `Template [${templateId}] does not exist.` };
    }

    const studio = await getStudioBySlug(studioSlug);
    if (!studio) {
      return { success: false, error: 'Studio not found.' };
    }

    if (!orderId) return { success: false, error: 'Select a real order to preview this message.' };
    const order = await getOrderById(orderId);
    if (!order || order.studioId !== studio.id || order.isDeleted) return { success: false, error: 'Order unavailable.' };

    const canonicalOrderId = order.orderNumber;
    const text = templateDef.generateText({
      studioName: studio.name,
      customerName: order.customer.name,
      orderNumber: canonicalOrderId,
      eventType: order.eventType,
      eventDate: order.eventDate,
      callTime: order.callTime || 'Not recorded',
      venue: order.eventLocation || 'Not recorded',
      balanceDue: order.pricing.remainingAmount,
      trackingPasskey: canonicalOrderId,
      passkeyPin: order.passkeyPin || '',
      trackingUrl: `https://focoman.com/track/${order.trackingPasskey}`,
      crewName: 'Not assigned',
      taskTitle: 'Not assigned',
    });

    if (!order.customer.phone) return { success: false, error: 'This order has no customer phone number.' };
    const targetPhone = order.customer.phone;
    const clickToChatUrl = generateWhatsAppClickToChatUrl(targetPhone, text);

    return {
      success: true,
      text,
      clickToChatUrl,
    };
  } catch (err: unknown) {
    console.error('[getWhatsappTemplatePreviewAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate preview.',
    };
  }
}

