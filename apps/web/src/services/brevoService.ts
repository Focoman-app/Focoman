import 'server-only';
import { getFirestoreServerInstance } from '@focoman/db';

export interface BrevoAccountStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  dailyCredits?: number;
  planType?: string;
  keyCreatedDate: string;
  keyExpiryDate: string;
  inactivityLimitDays: number;
  lastUsedAt: string | null;
  daysRemainingUntilInactivity: number;
  error?: string;
}

export interface BrevoUsageStats {
  requests: number;
  delivered: number;
  hardBounces: number;
  softBounces: number;
  clicks: number;
  opens: number;
  spamReports: number;
  blocked: number;
}

const BREVO_KEY_CREATED_DATE = '2026-11-03';
const BREVO_KEY_EXPIRY_DATE = '2027-11-03';
const INACTIVITY_WINDOW_DAYS = 90;

function getBrevoApiKey(): string | null {
  return process.env.BREVO_API_KEY || null;
}

export async function getBrevoAccountStatus(): Promise<BrevoAccountStatus> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    return {
      configured: false,
      connected: false,
      keyCreatedDate: BREVO_KEY_CREATED_DATE,
      keyExpiryDate: BREVO_KEY_EXPIRY_DATE,
      inactivityLimitDays: INACTIVITY_WINDOW_DAYS,
      lastUsedAt: null,
      daysRemainingUntilInactivity: 0,
      error: 'BREVO_API_KEY is not configured in environment variables.',
    };
  }

  // Retrieve last recorded ping/usage from Firestore
  let lastUsedAt: string | null = null;
  try {
    const db = getFirestoreServerInstance();
    const doc = await db.collection('system_integrations').doc('brevo').get();
    if (doc.exists) {
      lastUsedAt = doc.data()?.lastUsedAt || null;
    }
  } catch {
    // Non-fatal if firestore read fails
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey,
        accept: 'application/json',
      },
      next: { revalidate: 300 }, // Cache up to 5 minutes
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        configured: true,
        connected: false,
        keyCreatedDate: BREVO_KEY_CREATED_DATE,
        keyExpiryDate: BREVO_KEY_EXPIRY_DATE,
        inactivityLimitDays: INACTIVITY_WINDOW_DAYS,
        lastUsedAt,
        daysRemainingUntilInactivity: computeDaysRemaining(lastUsedAt),
        error: errData.message || `Brevo API returned status ${res.status}`,
      };
    }

    const data = await res.json();
    const sendLimitPlan = (data.plan || []).find((p: { creditsType?: string }) => p.creditsType === 'sendLimit');
    const dailyCredits = sendLimitPlan?.credits ?? (data.plan?.[0]?.credits || 300);
    const planType = data.plan?.[0]?.type || 'Free';

    // If lastUsedAt is null, default to now since we just successfully hit the API
    const effectiveLastUsed = lastUsedAt || new Date().toISOString();

    return {
      configured: true,
      connected: true,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
      dailyCredits,
      planType: String(planType).toUpperCase(),
      keyCreatedDate: BREVO_KEY_CREATED_DATE,
      keyExpiryDate: BREVO_KEY_EXPIRY_DATE,
      inactivityLimitDays: INACTIVITY_WINDOW_DAYS,
      lastUsedAt: effectiveLastUsed,
      daysRemainingUntilInactivity: computeDaysRemaining(effectiveLastUsed),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      connected: false,
      keyCreatedDate: BREVO_KEY_CREATED_DATE,
      keyExpiryDate: BREVO_KEY_EXPIRY_DATE,
      inactivityLimitDays: INACTIVITY_WINDOW_DAYS,
      lastUsedAt,
      daysRemainingUntilInactivity: computeDaysRemaining(lastUsedAt),
      error: msg,
    };
  }
}

export async function getBrevoDailyUsageStats(): Promise<BrevoUsageStats | null> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) return null;

  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const res = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${todayStr}&endDate=${todayStr}`,
      {
        headers: {
          'api-key': apiKey,
          accept: 'application/json',
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return {
      requests: data.requests || 0,
      delivered: data.delivered || 0,
      hardBounces: data.hardBounces || 0,
      softBounces: data.softBounces || 0,
      clicks: data.clicks || 0,
      opens: data.opens || 0,
      spamReports: data.spamReports || 0,
      blocked: data.blocked || 0,
    };
  } catch {
    return null;
  }
}

export async function triggerBrevoKeepAlivePing(recipientEmail?: string): Promise<{
  success: boolean;
  pingedAt: string;
  testEmailSent: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = getBrevoApiKey();
  const pingedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      success: false,
      pingedAt,
      testEmailSent: false,
      error: 'BREVO_API_KEY is not configured.',
    };
  }

  // 1. Hit the Brevo Account API to ensure fresh API token activity
  let accountActive = false;
  try {
    const accRes = await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    accountActive = accRes.ok;
    if (!accRes.ok) {
      const err = await accRes.json().catch(() => ({}));
      return {
        success: false,
        pingedAt,
        testEmailSent: false,
        error: err.message || `Account check failed with HTTP ${accRes.status}`,
      };
    }
  } catch (err: unknown) {
    return {
      success: false,
      pingedAt,
      testEmailSent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Attempt to send a test transactional email
  const targetEmail = recipientEmail || 'webmaster@focoman.com';
  let testEmailSent = false;
  let messageId: string | undefined;
  let sendError: string | undefined;

  try {
    const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Focoman Dev Portal', email: 'noreply@focoman.com' },
        to: [{ email: targetEmail, name: 'Webmaster' }],
        subject: `Brevo Keep-Alive Ping — ${new Date().toLocaleString('en-IN')}`,
        htmlContent: `
          <div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:12px;max-width:500px;">
            <h2 style="margin:0 0 10px;color:#1e293b;">Brevo API Keep-Alive Ping</h2>
            <p style="color:#475569;font-size:14px;line-height:1.5;">
              This automated ping was triggered from the Focoman Dev Portal to reset the 90-day inactivity timer on your Brevo API key.
            </p>
            <div style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px;margin:16px 0;font-family:monospace;">
              Timestamp: ${pingedAt}<br/>
              Target: ${targetEmail}
            </div>
            <p style="color:#94a3b8;font-size:12px;margin:0;">Focoman Studio OS • Internal System Diagnostics</p>
          </div>
        `,
      }),
    });

    if (sendRes.ok) {
      const sendData = await sendRes.json();
      testEmailSent = true;
      messageId = sendData.messageId;
    } else {
      const errData = await sendRes.json().catch(() => ({}));
      sendError = errData.message || `Send returned HTTP ${sendRes.status}`;
    }
  } catch (e: unknown) {
    sendError = e instanceof Error ? e.message : String(e);
  }

  // 3. Record lastUsedAt timestamp in Firestore
  try {
    const db = getFirestoreServerInstance();
    await db.collection('system_integrations').doc('brevo').set(
      {
        lastUsedAt: pingedAt,
        lastPingStatus: accountActive ? 'SUCCESS' : 'FAILED',
        testEmailSent,
        targetEmail,
        updatedAt: pingedAt,
      },
      { merge: true }
    );
  } catch {
    // Non-fatal
  }

  return {
    success: accountActive,
    pingedAt,
    testEmailSent,
    messageId,
    error: sendError,
  };
}

function computeDaysRemaining(lastUsedAt: string | null): number {
  if (!lastUsedAt) return INACTIVITY_WINDOW_DAYS;
  const last = new Date(lastUsedAt).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  return Math.max(0, INACTIVITY_WINDOW_DAYS - diffDays);
}

