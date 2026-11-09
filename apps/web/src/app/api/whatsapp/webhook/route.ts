import { NextRequest, NextResponse } from 'next/server';
import {
  processWhatsAppBotMessage,
  sendWhatsAppMessageOrFallback,
  recordWhatsAppLog,
} from '@/services/whatsappService';
import { getFirestoreServerInstance, saveStudioLead } from '@focoman/db';
import { prefixLetters, generateTimestampDigits } from '@/lib/invitationPasscode';

/**
 * Meta WhatsApp Business Cloud API Webhook
 *
 * GET: Webhook verification handshake
 * POST: Inbound message processor for Studio Owner Operations Bot,
 *       Authorized Studio Crew Members (WA-002), and Customer Order Status Queries (WA-003).
 */

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const configuredVerifyToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'focoman_whatsapp_verify_token_2026';

  if (mode === 'subscribe' && token === configuredVerifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden. Verification token mismatch.' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return NextResponse.json({ status: 'ignored_non_text' }, { status: 200 });
    }

    const fromPhone = message.from || '';
    const textBody = message.text?.body?.trim() || '';
    const cleanPhoneSuffix = fromPhone.replace(/\D/g, '').slice(-10);

    const db = getFirestoreServerInstance();

    // 1. Check if incoming message is a Customer Order Status Query (TRACK <OrderID> <Passkey>) — WA-003
    const tokens = textBody.split(/\s+/);
    const firstCmd = (tokens[0] || '').toUpperCase();
    if (firstCmd === 'TRACK' && tokens.length >= 3) {
      const orderIdArg = tokens[1].toUpperCase().replace(/^#/, '');
      const passkeyArg = tokens[2].trim();

      const ordersSnap = await db
        .collection('orders')
        .where('orderNumber', '==', orderIdArg)
        .limit(1)
        .get();

      const orderDoc = ordersSnap.docs[0];
      if (!orderDoc) {
        const notFoundMsg = `🔍 Order *${orderIdArg}* was not found. Please verify your Order ID and 6-digit passkey.`;
        await sendWhatsAppMessageOrFallback(fromPhone, notFoundMsg);
        return NextResponse.json({ status: 'customer_order_not_found' }, { status: 200 });
      }

      const orderData = orderDoc.data();
      if (orderData.passkeyPin && orderData.passkeyPin !== passkeyArg) {
        const invalidPinMsg = `🔒 Invalid 6-digit passkey for Order *${orderIdArg}*. Please check your booking confirmation.`;
        await sendWhatsAppMessageOrFallback(fromPhone, invalidPinMsg);
        return NextResponse.json({ status: 'customer_invalid_passkey' }, { status: 200 });
      }

      const customerReply =
        `📸 *Focoman Order Status — #${orderData.orderNumber}*\n\n` +
        `• Event: *${orderData.eventType || 'Event'}* on *${orderData.eventDate || 'TBD'}*\n` +
        `• Status: *${orderData.orderStatus}*\n` +
        `• Total Value: ₹${(orderData.pricing?.finalConfirmedPrice || 0).toLocaleString('en-IN')}\n` +
        `• Balance Due: ₹${(orderData.pricing?.remainingAmount || 0).toLocaleString('en-IN')}\n` +
        `• Live Portal: https://focoman.web.app/track/${orderData.orderNumber}`;

      await sendWhatsAppMessageOrFallback(fromPhone, customerReply);
      await recordWhatsAppLog({
        studioId: (orderData.studioId || 'unknown').toLowerCase(),
        orderId: orderData.id,
        orderNumber: orderData.orderNumber,
        templateId: 'customer_status_query',
        audience: 'CUSTOMER',
        recipientPhone: fromPhone,
        messagePreview: customerReply.slice(0, 180),
        mode: 'BOT_REPLY',
        status: 'SENT',
      });

      return NextResponse.json({ status: 'customer_track_replied', orderNumber: orderData.orderNumber }, { status: 200 });
    }

    // 2. Match sender phone against Studio Owners
    const studiosSnap = await db.collection('studios').get();
    let matchedStudioSlug: string | null = null;
    let callerRole: 'STUDIO_OWNER' | 'STUDIO_MEMBER' | null = null;
    let matchedMemberId: string | undefined;
    let matchedMemberName: string | undefined;

    for (const doc of studiosSnap.docs) {
      const data = doc.data();
      const studioPhone = (data.contactPhone || data.phone || '').replace(/\D/g, '');
      const ownerPhone = (data.ownerPhone || '').replace(/\D/g, '');

      if (
        cleanPhoneSuffix &&
        ((studioPhone && studioPhone.endsWith(cleanPhoneSuffix)) ||
          (ownerPhone && ownerPhone.endsWith(cleanPhoneSuffix)))
      ) {
        matchedStudioSlug = data.slug || data.id;
        callerRole = 'STUDIO_OWNER';
        matchedMemberName = data.ownerName || 'Studio Owner';
        break;
      }
    }

    // 3. If not Studio Owner, match against active Studio Crew Members (WA-002)
    if (!matchedStudioSlug && cleanPhoneSuffix) {
      const membersSnap = await db.collection('members').where('isDeleted', '==', false).get();
      for (const doc of membersSnap.docs) {
        const m = doc.data();
        const memberPhone = (m.phone || '').replace(/\D/g, '');
        if (memberPhone && memberPhone.endsWith(cleanPhoneSuffix) && m.status !== 'INACTIVE') {
          matchedStudioSlug = m.studioId;
          callerRole = 'STUDIO_MEMBER';
          matchedMemberId = m.id;
          matchedMemberName = m.name;
          break;
        }
      }
    }

    if (!matchedStudioSlug || !callerRole) {
      // Auto-capture incoming WhatsApp messages from prospective customers as a WHATSAPP Lead
      const targetStudioDoc =
        studiosSnap.docs.find((d) => !d.data().isDeleted && d.data().leadWebhookConfig?.autoCaptureWhatsAppUnknownSenders !== false) ||
        studiosSnap.docs[0];

      if (targetStudioDoc) {
        const sData = targetStudioDoc.data();
        const targetSlug = (sData.slug || sData.id || 'studio').toLowerCase();
        const contactName =
          value?.contacts?.[0]?.profile?.name ||
          `WhatsApp Inquiry (${cleanPhoneSuffix || fromPhone})`;
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const { dateStamp, timeStamp } = generateTimestampDigits(nowDate);
        const leadId = `LED-${prefixLetters(targetSlug)}-${dateStamp}-${timeStamp}`;

        await saveStudioLead({
          id: leadId,
          studioId: targetSlug,
          name: contactName,
          phone: fromPhone,
          channel: 'WHATSAPP',
          stage: 'NEW',
          eventType: 'WhatsApp Direct Inquiry',
          message: textBody,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        });

        const welcomeReply =
          `👋 *Thank you for contacting ${sData.name || targetSlug}!*\n\n` +
          `Your inquiry (*#${leadId}*) has been logged in our Studio Desk. Our team will reach out shortly.\n\n` +
          `Already have a confirmed booking? Check live status anytime by replying:\n` +
          `\`TRACK <OrderID> <6-Digit-Passkey>\``;

        await sendWhatsAppMessageOrFallback(fromPhone, welcomeReply);
        return NextResponse.json(
          { status: 'lead_captured_from_whatsapp', studio: targetSlug, leadId },
          { status: 200 }
        );
      }

      const unauthorizedMsg =
        `🔒 *Focoman Operations Bot*\n\n` +
        `This automated bot is restricted to verified Studio Owners and authorized Crew Members.\n` +
        `Customers can check order status anytime by replying:\n` +
        `\`TRACK <OrderID> <6-Digit-Passkey>\`\n` +
        `or visiting: https://focoman.web.app/track`;

      await sendWhatsAppMessageOrFallback(fromPhone, unauthorizedMsg);
      return NextResponse.json({ status: 'unauthorized_sender' }, { status: 200 });
    }

    const botResponse = await processWhatsAppBotMessage(matchedStudioSlug, textBody, fromPhone, {
      role: callerRole,
      memberId: matchedMemberId,
      memberName: matchedMemberName,
      senderPhone: fromPhone,
    });

    await sendWhatsAppMessageOrFallback(fromPhone, botResponse.message);
    await recordWhatsAppLog({
      studioId: matchedStudioSlug.toLowerCase(),
      templateId: `bot_${botResponse.commandRecognized.toLowerCase()}`,
      audience: callerRole === 'STUDIO_OWNER' ? 'OWNER' : 'MEMBER',
      recipientPhone: fromPhone,
      messagePreview: botResponse.message.slice(0, 180),
      mode: 'BOT_REPLY',
      status: 'SENT',
    });

    return NextResponse.json(
      {
        status: 'success',
        studio: matchedStudioSlug,
        role: callerRole,
        command: botResponse.commandRecognized,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[WhatsApp Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
