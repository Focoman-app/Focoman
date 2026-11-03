import 'server-only';
import { getFirestoreServerInstance } from '@focoman/db';
import { Resend } from 'resend';

export interface ResendDomainInfo {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  region: string;
}

export interface ResendAccountStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string;
  domains: ResendDomainInfo[];
  dailyLimit: number;
  monthlyLimit: number;
  lastUsedAt: string | null;
  error?: string;
}

export interface DomainExpirationInfo {
  domain: string;
  registrar: string;
  expiryDate: string;
  daysRemaining: number;
  alertThresholdsDays: number[];
  alertRecipients: string[];
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

const DOMAIN_EXPIRY_DATE = '2029-11-02T23:59:59Z';
const ALERT_THRESHOLDS = [60, 30, 15, 7, 3, 1];

export function getDomainExpirationInfo(): DomainExpirationInfo {
  const expiry = new Date(DOMAIN_EXPIRY_DATE).getTime();
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));

  let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (daysRemaining <= 7) {
    status = 'CRITICAL';
  } else if (daysRemaining <= 60) {
    status = 'WARNING';
  }

  const recipients = [
    'webmaster@focoman.com',
    'founder@focoman.com',
  ];
  if (process.env.DEV_TEST_EMAIL) {
    recipients.push(process.env.DEV_TEST_EMAIL);
  }

  return {
    domain: 'focoman.com',
    registrar: 'Hostinger',
    expiryDate: '2029-11-02',
    daysRemaining,
    alertThresholdsDays: ALERT_THRESHOLDS,
    alertRecipients: recipients,
    status,
  };
}

export async function getResendAccountStatus(): Promise<ResendAccountStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      configured: false,
      connected: false,
      accountEmail: 'webmaster@focoman.com',
      domains: [],
      dailyLimit: 100,
      monthlyLimit: 3000,
      lastUsedAt: null,
      error: 'RESEND_API_KEY is not defined in environment variables.',
    };
  }

  // Retrieve last pinged timestamp from Firestore
  let lastUsedAt: string | null = null;
  try {
    const db = getFirestoreServerInstance();
    const doc = await db.collection('system_integrations').doc('resend').get();
    if (doc.exists) {
      lastUsedAt = doc.data()?.lastUsedAt || null;
    }
  } catch {
    // Non-fatal
  }

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        configured: true,
        connected: false,
        accountEmail: 'webmaster@focoman.com',
        domains: [],
        dailyLimit: 100,
        monthlyLimit: 3000,
        lastUsedAt,
        error: err.message || `Resend API returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const domains: ResendDomainInfo[] = (data.data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      createdAt: d.created_at,
      region: d.region,
    }));

    return {
      configured: true,
      connected: true,
      accountEmail: 'webmaster@focoman.com',
      domains,
      dailyLimit: 100,
      monthlyLimit: 3000,
      lastUsedAt: lastUsedAt || new Date().toISOString(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      connected: false,
      accountEmail: 'webmaster@focoman.com',
      domains: [],
      dailyLimit: 100,
      monthlyLimit: 3000,
      lastUsedAt,
      error: msg,
    };
  }
}

export async function triggerResendTestPing(recipientEmail?: string): Promise<{
  success: boolean;
  pingedAt: string;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const pingedAt = new Date().toISOString();
  const targetEmail = recipientEmail || 'webmaster@focoman.com';

  if (!apiKey) {
    return {
      success: false,
      pingedAt,
      error: 'RESEND_API_KEY is not configured.',
    };
  }

  try {
    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Focoman <noreply@focoman.com>';
    const replyTo = process.env.RESEND_REPLY_TO_EMAIL || 'support@focoman.com';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      replyTo,
      to: targetEmail,
      subject: `Resend Diagnostic Ping — ${new Date().toLocaleString('en-IN')}`,
      html: `
        <div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:12px;max-width:500px;">
          <h2 style="margin:0 0 10px;color:#1e293b;">Resend API Diagnostic Ping</h2>
          <p style="color:#475569;font-size:14px;line-height:1.5;">
            This test email was triggered from the Focoman Dev Portal to verify production email delivery via Resend.
          </p>
          <div style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px;margin:16px 0;font-family:monospace;">
            Timestamp: ${pingedAt}<br/>
            Recipient: ${targetEmail}<br/>
            Sender: ${fromAddress}<br/>
            Reply-To: ${replyTo}
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0;">Focoman Studio OS • Internal Diagnostic Service</p>
        </div>
      `,
    });

    if (error) {
      return {
        success: false,
        pingedAt,
        error: error.message,
      };
    }

    // Record in Firestore
    try {
      const db = getFirestoreServerInstance();
      await db.collection('system_integrations').doc('resend').set(
        {
          lastUsedAt: pingedAt,
          lastPingStatus: 'SUCCESS',
          targetEmail,
          messageId: data?.id,
          updatedAt: pingedAt,
        },
        { merge: true }
      );
    } catch {
      // Non-fatal
    }

    return {
      success: true,
      pingedAt,
      messageId: data?.id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      pingedAt,
      error: msg,
    };
  }
}

