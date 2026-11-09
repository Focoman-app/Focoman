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
  orderId?: string
): Promise<{
  success: boolean;
  text?: string;
  clickToChatUrl?: string;
  error?: string;
}> {
  try {
    const templateDef = WHATSAPP_TEMPLATES[templateId];
    if (!templateDef) {
      return { success: false, error: `Template [${templateId}] does not exist.` };
    }

    const studio = await getStudioBySlug(studioSlug);
    if (!studio) {
      return { success: false, error: 'Studio not found.' };
    }

    let order = null;
    if (orderId) {
      order = await getOrderById(orderId);
    }

    const canonicalOrderId = order?.orderNumber || 'ORD-DEMO-261106-143025';
    const text = templateDef.generateText({
      studioName: studio.name,
      customerName: order?.customer?.name || 'Karthik & Ananya',
      orderNumber: canonicalOrderId,
      eventType: order?.eventType || 'Wedding & Reception',
      eventDate: order?.eventDate || '2026-11-15',
      callTime: order?.callTime || '08:00 AM',
      venue: order?.eventLocation || 'Grand Palace Hall, Chennai',
      balanceDue: order?.pricing?.remainingAmount ?? 35000,
      trackingPasskey: canonicalOrderId,
      passkeyPin: order?.passkeyPin || '482916',
      trackingUrl: `https://focoman.web.app/track/${canonicalOrderId}`,
      crewName: 'Suresh Kumar',
      taskTitle: 'Traditional Photography & 4K Cinematography',
    });

    const targetPhone = order?.customer?.phone || studio.ownerPhone || '9876543210';
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

