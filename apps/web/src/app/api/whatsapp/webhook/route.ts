import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  processWhatsAppBotMessage,
  sendWhatsAppMessageOrFallback,
  recordWhatsAppLog,
} from '@/services/whatsappService';
import { getFirestoreServerInstance } from '@focoman/db';
import { hasStudioCapability } from '@/lib/entitlementAuth';

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

  const configuredVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (configuredVerifyToken && mode === 'subscribe' && token === configuredVerifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden. Verification token mismatch.' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WHATSAPP_APP_SECRET;
    const signature = req.headers.get('x-hub-signature-256');
    if (!secret || !signature?.startsWith('sha256=')) {
      return NextResponse.json({ error: 'Webhook authentication is not configured.' }, { status: 403 });
    }
    const rawBody = await req.text();
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const received = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 403 });
    }
    const body = JSON.parse(rawBody);

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
      if (!(await hasStudioCapability(orderData.studioId, 'WHATSAPP_OPERATIONS'))) {
        return NextResponse.json({ status: 'whatsapp_unavailable_for_studio' }, { status: 200 });
      }
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
      // A webhook has no trustworthy target studio for unknown senders. Do not attach
      // private customer messages to an arbitrary studio or expose an operations reply.
      return NextResponse.json({ status: 'ignored_unrecognized_sender' }, { status: 200 });
    }

    if (!(await hasStudioCapability(matchedStudioSlug, 'WHATSAPP_OPERATIONS'))) {
      return NextResponse.json({ status: 'whatsapp_unavailable_for_studio' }, { status: 200 });
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
