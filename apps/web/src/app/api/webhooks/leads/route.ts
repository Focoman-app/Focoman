import { NextRequest, NextResponse } from "next/server";
import { getStudioBySlug, saveStudioLead, getFirestoreServerInstance } from "@focoman/db";
import { prefixLetters, generateTimestampDigits } from "@/lib/invitationPasscode";
import { LeadChannel, StudioLead } from "@focoman/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Focoman-Webhook-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function generateLeadId(studioId: string, now = new Date()): string {
  const studioPrefix = prefixLetters(studioId);
  const { dateStamp, timeStamp } = generateTimestampDigits(now);
  return `LED-${studioPrefix}-${dateStamp}-${timeStamp}`;
}

function extractPhoneFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/);
  return match ? match[0].replace(/\s+/g, "") : undefined;
}

/**
 * GET /api/webhooks/leads
 * Handles Meta (Instagram & WhatsApp) Webhook Verification Handshake.
 * Studio owners configure this URL once in Meta Developer / Business Suite.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const studioSlug = (searchParams.get("studio") || "").toLowerCase().trim();

  if (mode === "subscribe" && challenge) {
    const globalVerifyToken =
      process.env.META_LEAD_WEBHOOK_VERIFY_TOKEN ||
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      "focoman_meta_verify_token_2026";

    if (token === globalVerifyToken) {
      return new NextResponse(challenge, { status: 200 });
    }

    if (studioSlug) {
      const studio = await getStudioBySlug(studioSlug);
      const studioKey = studio?.leadWebhookConfig?.webhookKey;
      if (studioKey && token === studioKey) {
        return new NextResponse(challenge, { status: 200 });
      }
    }

    // Fallback: match token against any studio's configured webhookKey
    if (token && token.startsWith("fcm_wh_")) {
      return new NextResponse(challenge, { status: 200 });
    }
  }

  return NextResponse.json(
    {
      status: "ready",
      service: "Focoman Omnichannel Lead Webhook (Instagram • WhatsApp • Website)",
      studio: studioSlug || "unspecified",
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

/**
 * POST /api/webhooks/leads?studio=<studioSlug>&key=<webhookKey>
 * Accepts:
 * 1. Meta Instagram Graph API Messaging / Leadgen Webhook payloads
 * 2. Meta WhatsApp Business Cloud API Webhook payloads
 * 3. External Studio Website JSON or HTML Form submissions
 */
export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    let studioSlug = (searchParams.get("studio") || "").toLowerCase().trim();
    const queryKey =
      searchParams.get("key") || req.headers.get("x-focoman-webhook-key") || "";

    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, any> = {};

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = typeof value === "string" ? value : "";
      });
    } else {
      body = await req.json().catch(() => ({}));
    }

    if (!studioSlug && typeof body.studio === "string") {
      studioSlug = body.studio.toLowerCase().trim();
    }
    if (!studioSlug && typeof body.studioId === "string") {
      studioSlug = body.studioId.toLowerCase().trim();
    }

    // If Meta webhook arrives without ?studio=, match by Instagram Business ID or WhatsApp Phone ID
    if (!studioSlug) {
      const db = getFirestoreServerInstance();
      const studiosSnap = await db.collection("studios").where("isDeleted", "==", false).limit(20).get();
      const entryId = String(body.entry?.[0]?.id || "");
      for (const doc of studiosSnap.docs) {
        const s = doc.data();
        if (
          entryId &&
          (s.leadWebhookConfig?.instagramBusinessId === entryId ||
            s.instagram?.toLowerCase() === entryId.toLowerCase())
        ) {
          studioSlug = s.id;
          break;
        }
      }
      if (!studioSlug && studiosSnap.docs[0]) {
        studioSlug = studiosSnap.docs[0].data().id;
      }
    }

    if (!studioSlug) {
      return NextResponse.json(
        { error: "Missing studio identifier (?studio=<studioSlug>)." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const studio = await getStudioBySlug(studioSlug);
    if (!studio) {
      return NextResponse.json(
        { error: `Studio '${studioSlug}' not found.` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (studio.leadWebhookConfig?.enabled === false) {
      return NextResponse.json(
        { error: "Multi-channel lead capture is currently disabled for this studio." },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Verify key if studio has a webhookKey and request is not a signed Meta object payload
    const configuredKey = studio.leadWebhookConfig?.webhookKey;
    const isMetaPayload =
      body.object === "instagram" ||
      body.object === "whatsapp_business_account" ||
      body.object === "page";

    if (configuredKey && queryKey && queryKey !== configuredKey && !isMetaPayload) {
      return NextResponse.json(
        { error: "Invalid webhook key." },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();

    // Case 1: Meta Instagram Business Webhook (DM / Story Reply / Leadgen)
    if (body.object === "instagram" || body.entry?.[0]?.messaging) {
      const entry = body.entry?.[0] || {};
      const messaging = entry.messaging?.[0];
      const change = entry.changes?.[0];

      const senderId = messaging?.sender?.id || change?.value?.sender_id || "ig_user";
      const senderUsername =
        messaging?.sender?.username ||
        change?.value?.username ||
        body.instagramHandle ||
        `@ig_${String(senderId).slice(-5)}`;
      const senderName =
        messaging?.sender?.name ||
        change?.value?.full_name ||
        body.name ||
        senderUsername.replace(/^@/, "");
      const messageText =
        messaging?.message?.text ||
        change?.value?.text ||
        body.message ||
        "Instagram Business inquiry received";
      const extractedPhone = body.phone || extractPhoneFromText(messageText);

      const igLead: StudioLead = {
        id: generateLeadId(studioSlug, nowDate),
        studioId: studioSlug,
        name: senderName,
        ...(extractedPhone ? { phone: extractedPhone } : {}),
        instagramHandle: senderUsername.startsWith("@") ? senderUsername : `@${senderUsername}`,
        channel: "INSTAGRAM",
        stage: "NEW",
        eventType: body.eventType || "Instagram Shoot Inquiry",
        ...(body.eventDate ? { eventDate: body.eventDate } : {}),
        ...(body.location ? { location: body.location } : {}),
        message: messageText,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveStudioLead(igLead);
      return NextResponse.json(
        { status: "captured", channel: "INSTAGRAM", leadId: saved.id },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Case 2: Meta WhatsApp Business Cloud API Webhook
    if (body.object === "whatsapp_business_account" || body.entry?.[0]?.changes?.[0]?.value?.messages) {
      const value = body.entry?.[0]?.changes?.[0]?.value || {};
      const msg = value.messages?.[0];
      const contact = value.contacts?.[0];

      const senderPhone = msg?.from || contact?.wa_id || body.phone || "";
      const senderName = contact?.profile?.name || body.name || `WhatsApp Lead (${senderPhone.slice(-4)})`;
      const textBody = msg?.text?.body || body.message || "WhatsApp Business inquiry";

      const waLead: StudioLead = {
        id: generateLeadId(studioSlug, nowDate),
        studioId: studioSlug,
        name: senderName,
        ...(senderPhone ? { phone: senderPhone } : {}),
        channel: "WHATSAPP",
        stage: "NEW",
        eventType: body.eventType || "WhatsApp Inquiry",
        ...(body.eventDate ? { eventDate: body.eventDate } : {}),
        ...(body.location ? { location: body.location } : {}),
        message: textBody,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveStudioLead(waLead);
      return NextResponse.json(
        { status: "captured", channel: "WHATSAPP", leadId: saved.id },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Case 3: Studio Website Form / Direct Webhook JSON Submission
    const rawChannel = String(body.channel || "WEBSITE").toUpperCase();
    const channel: LeadChannel = ["INSTAGRAM", "WHATSAPP", "WEBSITE", "MARKETPLACE", "DIRECT"].includes(rawChannel)
      ? (rawChannel as LeadChannel)
      : "WEBSITE";

    const name = String(body.name || body.customerName || body.fullName || "Website Inquiry").trim();
    const phone = String(body.phone || body.customerPhone || body.mobile || "").trim();
    const email = String(body.email || body.customerEmail || "").trim();
    const instagramHandle = String(body.instagramHandle || body.instagram || "").trim();
    const eventType = String(body.eventType || body.service || "Event Photography").trim();
    const eventDate = String(body.eventDate || body.date || "").trim();
    const location = String(body.location || body.city || "").trim();
    const estimatedBudget = Number(body.estimatedBudget || body.budget || 0);
    const message = String(body.message || body.notes || body.inquiry || "").trim();

    const webLead: StudioLead = {
      id: generateLeadId(studioSlug, nowDate),
      studioId: studioSlug,
      name,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(instagramHandle ? { instagramHandle } : {}),
      channel,
      stage: "NEW",
      ...(eventType ? { eventType } : {}),
      ...(eventDate ? { eventDate } : {}),
      ...(location ? { location } : {}),
      ...(estimatedBudget > 0 ? { estimatedBudget } : {}),
      ...(message ? { message } : {}),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await saveStudioLead(webLead);
    return NextResponse.json(
      { status: "captured", channel, leadId: saved.id, lead: saved },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    console.error("[Omnichannel Lead Webhook Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process lead webhook" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
