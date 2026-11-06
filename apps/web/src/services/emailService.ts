import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[EmailService] RESEND_API_KEY is not defined in environment variables.");
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  error?: string;
}

/**
 * Universal Email Styling Constants (Production-Grade)
 */
const STYLES = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  bodyBg: "#f8fafc",
  cardBg: "#ffffff",
  primary: "#18181b",
  accent: "#7c3aed",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
};

/**
 * 0. Studio Workspace Created Welcome Email (Sent to Studio Owner upon Sign-Up/Registration)
 */
export function buildStudioWelcomeOwnerHtml(params: {
  ownerName: string;
  studioName: string;
  studioSlug: string;
  dashboardUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Focoman — ${params.studioName}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#18181b;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a1a1aa;font-weight:700;">FOCOMAN OS • STUDIO ONBOARDING</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">Welcome to Focoman!</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Hello ${params.ownerName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          Congratulations! Your photography studio workspace <strong>${params.studioName}</strong> has been successfully registered and initialized on Focoman.
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid ${STYLES.border};border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Studio Name:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.studioName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Workspace Slug:</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px;font-weight:700;color:${STYLES.accent};">/${params.studioSlug}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Dashboard URL:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:${STYLES.primary};">${params.dashboardUrl}</td>
          </tr>
        </table>

        <div style="text-align:center;margin:32px 0 24px;">
          <a href="${params.dashboardUrl}" style="display:inline-block;padding:14px 32px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,0.2);">
            Open Studio Dashboard
          </a>
        </div>

        <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${STYLES.textMuted};text-align:center;">
          For questions or assistance, reach us anytime at <a href="mailto:support@focoman.com" style="color:${STYLES.accent};text-decoration:none;font-weight:600;">support@focoman.com</a>.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        Focoman Studio Management OS • Photography Business Operations
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 1. Crew Member Invitation Email Template
 */
export function buildCrewInvitationHtml(params: {
  studioName: string;
  memberName: string;
  inviteCode: string;
  skills: string[];
  joinUrl: string;
  claimCode?: string;
}): string {
  const skillsBadges = params.skills
    .map(
      (s) =>
        `<span style="display:inline-block;background:#f3e8ff;color:#6b21a8;font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px;margin:2px 4px 2px 0;">${s}</span>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to join ${params.studioName}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <!-- Brand Header -->
    <tr>
      <td style="padding:28px 32px;background:#18181b;color:#ffffff;text-align:left;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a1a1aa;font-weight:700;">FOCOMAN WORKSPACE</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Hello ${params.memberName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          You have been invited by <strong>${params.studioName}</strong> to join their photography & production crew on Focoman.
        </p>

        <!-- Summary Details Table -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid ${STYLES.border};border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Studio:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.studioName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Assigned Role / Skills:</td>
            <td style="padding:8px 0;">${skillsBadges}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Invitation Code:</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px;font-weight:700;color:${STYLES.accent};">${params.inviteCode}</td>
          </tr>
          ${
            params.claimCode
              ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Access PIN:</td>
            <td style="padding:8px 0;font-family:monospace;font-size:14px;font-weight:800;color:#0f172a;">${params.claimCode}</td>
          </tr>`
              : ""
          }
        </table>

        <!-- Call to Action -->
        <div style="text-align:center;margin:32px 0 24px;">
          <a href="${params.joinUrl}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(124,58,237,0.35);">
            Accept Invitation & Join Studio
          </a>
        </div>

        <p style="margin:0;font-size:12px;line-height:1.5;color:${STYLES.textMuted};text-align:center;">
          Click the button above to sign in with your Google account and gain access to your scheduled shoots and assignments.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        Sent via Focoman Workspace Management Platform • Photography Business OS
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 2. Crew Member Accepted Notification (Sent to Studio Owner)
 */
export function buildCrewAcceptedOwnerHtml(params: {
  studioName: string;
  ownerName: string;
  memberName: string;
  memberEmail: string;
  skills: string[];
  acceptedAt: string;
  erpUrl: string;
}): string {
  const skillsList = params.skills.join(", ");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Crew Member Joined ${params.studioName}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#059669;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a7f3d0;font-weight:700;">CREW ONBOARDING UPDATE</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">New Crew Member Onboarded</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Hello ${params.ownerName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          Great news! <strong>${params.memberName}</strong> has accepted your invitation and successfully joined your studio team.
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid ${STYLES.border};border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Member Name:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.memberName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Email Address:</td>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textPrimary};">${params.memberEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Certified Skills:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:#059669;">${skillsList}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Joined On:</td>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">${new Date(params.acceptedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
          </tr>
        </table>

        <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:${STYLES.textSecondary};">
          You can now assign ${params.memberName} to upcoming shoots, track their schedules, and manage production tasks in your ERP dashboard.
        </p>

        <div style="text-align:center;margin:28px 0 16px;">
          <a href="${params.erpUrl}" style="display:inline-block;padding:12px 28px;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 12px rgba(5,150,105,0.3);">
            View Crew in ERP Dashboard
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Powered by Focoman OS
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 2b. Welcome Email to Crew Member after Accepting Invitation
 */
export function buildCrewWelcomeMemberHtml(params: {
  studioName: string;
  memberName: string;
  dashboardUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to ${params.studioName} Crew!</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#7c3aed;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#ddd6fe;font-weight:700;">WELCOME TO THE TEAM</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Welcome aboard, ${params.memberName}! 🎉
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          You have successfully joined <strong>${params.studioName}</strong> as an active crew member. You can now view assigned shoots, track workflow tasks, and manage production.
        </p>

        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.dashboardUrl}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(124,58,237,0.35);">
            Access Crew Dashboard
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Focoman Crew Operations
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 3. Customer Order Confirmed & Deliverables Tracking Email
 */
export function buildOrderConfirmedCustomerHtml(params: {
  studioName: string;
  studioPhone?: string;
  customerName: string;
  orderId: string;
  eventTitle: string;
  eventDate: string;
  passkey: string;
  trackUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Confirmed: #${params.orderId}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#18181b;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a1a1aa;font-weight:700;">BOOKING CONFIRMATION</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Dear ${params.customerName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          Thank you for choosing <strong>${params.studioName}</strong>. Your photoshoot booking has been confirmed!
        </p>

        <!-- Booking details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid ${STYLES.border};border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Order Number:</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">#${params.orderId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Event:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.eventTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Event Date:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:${STYLES.textPrimary};">${params.eventDate}</td>
          </tr>
          ${
            params.studioPhone
              ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Studio Phone:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:${STYLES.textPrimary};">${params.studioPhone}</td>
          </tr>`
              : ""
          }
        </table>

        <!-- Passkey Card -->
        <div style="margin:24px 0;padding:18px;background:#f5f3ff;border:1px dashed #7c3aed;border-radius:12px;text-align:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;">Your Private Passkey</div>
          <div style="font-family:monospace;font-size:18px;font-weight:800;color:#18181b;margin:8px 0;letter-spacing:2px;">${params.passkey}</div>
          <p style="margin:0;font-size:11px;color:#6b7280;">Use this passkey to securely access and view your photo galleries and deliverables.</p>
        </div>

        <!-- CTA Button -->
        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.trackUrl}" style="display:inline-block;padding:14px 32px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,0.2);">
            Track Photos & Order Status
          </a>
        </div>

        <p style="margin:0;font-size:12px;line-height:1.5;color:${STYLES.textMuted};text-align:center;">
          You can track production progress, timeline milestones, and download deliverables anytime through the tracking portal above.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Focoman Customer Portal
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 4. Crew Member Shoot Assignment Email Template
 */
export function buildCrewShootAssignedHtml(params: {
  studioName: string;
  memberName: string;
  orderNumber: string;
  eventType: string;
  eventDate: string;
  skill: string;
  eventLocation?: string;
  portalUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Shoot Assignment: ${params.eventType}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#18181b;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a1a1aa;font-weight:700;">NEW SHOOT ASSIGNMENT</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Hello ${params.memberName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          You have been assigned to an upcoming shoot by <strong>${params.studioName}</strong>.
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid ${STYLES.border};border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Order:</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">#${params.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Event:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.eventType}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Event Date:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:#7c3aed;">${params.eventDate}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Your Assigned Role:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.skill}</td>
          </tr>
          ${
            params.eventLocation
              ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Location:</td>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">${params.eventLocation}</td>
          </tr>`
              : ""
          }
        </table>

        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.portalUrl}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(124,58,237,0.35);">
            View Shoot Details & Tasks
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Focoman Crew Operations
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 5. Customer Payment Balance Reminder Email Template
 */
export function buildPaymentReminderCustomerHtml(params: {
  studioName: string;
  customerName: string;
  orderId: string;
  eventTitle: string;
  amountDue: string;
  dueDate: string;
  paymentUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Balance Due: #${params.orderId}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#d97706;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#fef3c7;font-weight:700;">PAYMENT STATEMENT</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Hello ${params.customerName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          This is a friendly reminder regarding your pending balance for <strong>${params.eventTitle}</strong>.
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Order Number:</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">#${params.orderId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Pending Balance:</td>
            <td style="padding:8px 0;font-size:16px;font-weight:800;color:#b45309;">${params.amountDue}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Due Date:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.dueDate}</td>
          </tr>
        </table>

        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.paymentUrl}" style="display:inline-block;padding:14px 32px;background:#d97706;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(217,119,6,0.35);">
            Pay Balance Now
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Focoman Billing System
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 6. Customer Photo Gallery & Album Deliverables Ready Email Template
 */
export function buildGalleryReadyCustomerHtml(params: {
  studioName: string;
  customerName: string;
  orderId: string;
  eventTitle: string;
  passkey: string;
  galleryUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Photos are Ready! #${params.orderId}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#0284c7;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#bae6fd;font-weight:700;">DELIVERABLES READY</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Dear ${params.customerName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          Exciting news! Your edited high-resolution photo gallery for <strong>${params.eventTitle}</strong> is now ready for viewing & download.
        </p>

        <div style="margin:24px 0;padding:18px;background:#f0f9ff;border:1px dashed #0284c7;border-radius:12px;text-align:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0284c7;">Private Gallery Passkey</div>
          <div style="font-family:monospace;font-size:20px;font-weight:800;color:#0f172a;margin:8px 0;letter-spacing:2px;">${params.passkey}</div>
        </div>

        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.galleryUrl}" style="display:inline-block;padding:14px 32px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(2,132,199,0.35);">
            Open High-Res Photo Gallery
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Powered by Focoman OS
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 7. Post-Event Review & Feedback Request Email
 */
export function buildReviewRequestCustomerHtml(params: {
  studioName: string;
  customerName: string;
  eventTitle: string;
  reviewUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>How was your experience with ${params.studioName}?</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#7c3aed;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#ddd6fe;font-weight:700;">CLIENT FEEDBACK</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Dear ${params.customerName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          It was an absolute pleasure capturing your special moments for <strong>${params.eventTitle}</strong>. We would love to hear about your experience!
        </p>

        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          Your feedback helps us continuously elevate our photography service and helps future clients know what to expect.
        </p>

        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.reviewUrl}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(124,58,237,0.35);">
            Leave a 5-Star Review
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Focoman Client Relations
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 8. Shoot / Event Day Started Alert Email
 */
export function buildEventStartedHtml(params: {
  studioName: string;
  recipientName: string;
  role: "CUSTOMER" | "CREW" | "OWNER";
  orderId: string;
  eventTitle: string;
  eventLocation?: string;
  trackingUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Event Day Started: ${params.eventTitle}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#059669;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a7f3d0;font-weight:700;">EVENT DAY LIVE</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.eventTitle} Is Today! 📸</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Hello ${params.recipientName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          ${
            params.role === "CUSTOMER"
              ? `Today is the day for <strong>${params.eventTitle}</strong> with <strong>${params.studioName}</strong>! Our crew is ready to capture your special moments.`
              : `Reminder: Photoshoot for <strong>${params.eventTitle}</strong> (Order #${params.orderId}) is scheduled for today.`
          }
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Order Number:</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">#${params.orderId}</td>
          </tr>
          ${
            params.eventLocation
              ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Venue / Location:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:${STYLES.textPrimary};">${params.eventLocation}</td>
          </tr>`
              : ""
          }
        </table>

        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.trackingUrl}" style="display:inline-block;padding:14px 32px;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(5,150,105,0.35);">
            View Shoot Details & Live Status
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Focoman OS
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 9. Workflow Pipeline Milestone / Status Update Email
 */
export function buildPipelineStatusUpdateHtml(params: {
  studioName: string;
  recipientName: string;
  orderId: string;
  eventTitle: string;
  taskTitle: string;
  newStatus: string;
  details?: string;
  portalUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Production Update: #${params.orderId} - ${params.taskTitle}</title>
</head>
<body style="margin:0;padding:32px 12px;background-color:${STYLES.bodyBg};font-family:${STYLES.fontFamily};color:${STYLES.textPrimary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:${STYLES.cardBg};border-radius:16px;border:1px solid ${STYLES.border};overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px;background:#18181b;color:#ffffff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#a1a1aa;font-weight:700;">PRODUCTION WORKFLOW UPDATE</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${params.studioName}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${STYLES.textPrimary};">
          Hello ${params.recipientName},
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${STYLES.textSecondary};">
          There is a new status update on order <strong>#${params.orderId}</strong> (${params.eventTitle}).
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid ${STYLES.border};border-radius:12px;padding:16px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};width:40%;">Task / Milestone:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:${STYLES.textPrimary};">${params.taskTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">New Status:</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:#7c3aed;">${params.newStatus}</td>
          </tr>
          ${
            params.details
              ? `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">Details:</td>
            <td style="padding:8px 0;font-size:13px;color:${STYLES.textSecondary};">${params.details}</td>
          </tr>`
              : ""
          }
        </table>

        <div style="text-align:center;margin:32px 0 20px;">
          <a href="${params.portalUrl}" style="display:inline-block;padding:14px 32px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,0.2);">
            View Order & Pipeline Progress
          </a>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${STYLES.border};font-size:11px;color:${STYLES.textMuted};text-align:center;">
        ${params.studioName} • Focoman Workflow Engine
      </td>
    </tr>
  </table>
</body>
</html>
`;
}


// ----------------------------------------------------------------------------
// Core Sending Actions (Direct Delivery to Real Recipients)
// ----------------------------------------------------------------------------

export const DEFAULT_SENDER_FROM = "Focoman <noreply@focoman.com>";
export const DEFAULT_SENDER_REPLY_TO = "support@focoman.com";

export function getSenderConfig(): { fromEmail: string; replyToEmail: string } {
  return {
    fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER_FROM,
    replyToEmail: process.env.RESEND_REPLY_TO_EMAIL || DEFAULT_SENDER_REPLY_TO,
  };
}

export interface ResendStatus {
  configured: boolean;
  fromEmail: string;
  replyToEmail: string;
}

export function getResendStatus(): ResendStatus {
  const { fromEmail, replyToEmail } = getSenderConfig();
  return {
    configured: Boolean(process.env.RESEND_API_KEY),
    fromEmail,
    replyToEmail,
  };
}
// ----------------------------------------------------------------------------


/**
 * Sends a Crew Member Invitation Email
 */
export async function sendCrewInvitationEmail(params: {
  toEmail: string;
  studioName: string;
  memberName: string;
  inviteCode: string;
  skills: string[];
  claimCode?: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const joinUrl = `${baseUrl}/onboarding/join-studio?code=${encodeURIComponent(params.inviteCode)}`;

  const html = buildCrewInvitationHtml({
    studioName: params.studioName,
    memberName: params.memberName,
    inviteCode: params.inviteCode,
    skills: params.skills,
    claimCode: params.claimCode,
    joinUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `${params.studioName} invites you to join their crew on Focoman`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send crew invite:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    console.log("[EmailService] Crew invite email sent successfully to", params.toEmail, "ID:", data?.id);
    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[EmailService] Exception during crew invite send:", errorMsg);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends an alert to Studio Owner when a Crew Member accepts their invite
 */
export async function sendCrewAcceptedOwnerEmail(params: {
  ownerEmail: string;
  studioSlug: string;
  studioName: string;
  ownerName: string;
  memberName: string;
  memberEmail: string;
  skills: string[];
  acceptedAt: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.ownerEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const erpUrl = `${baseUrl}/${params.studioSlug}/dashboard/erp`;

  const html = buildCrewAcceptedOwnerHtml({
    studioName: params.studioName,
    ownerName: params.ownerName,
    memberName: params.memberName,
    memberEmail: params.memberEmail,
    skills: params.skills,
    acceptedAt: params.acceptedAt,
    erpUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.ownerEmail,
      subject: `New Crew Member Joined: ${params.memberName} has joined ${params.studioName}`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send crew accepted notice:", error);
      return { success: false, recipient: params.ownerEmail, error: error.message };
    }

    console.log("[EmailService] Crew accepted notice sent to owner", params.ownerEmail, "ID:", data?.id);
    return { success: true, messageId: data?.id, recipient: params.ownerEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[EmailService] Exception during owner notification send:", errorMsg);
    return { success: false, recipient: params.ownerEmail, error: errorMsg };
  }
}

/**
 * Sends Customer Order Confirmation & Deliverables Passkey Email
 */
export async function sendOrderConfirmedCustomerEmail(params: {
  toEmail: string;
  customerName: string;
  orderId: string;
  eventTitle: string;
  eventDate: string;
  passkey: string;
  studioName: string;
  studioPhone?: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const trackUrl = `${baseUrl}/track/${params.passkey}`;

  const html = buildOrderConfirmedCustomerHtml({
    studioName: params.studioName,
    studioPhone: params.studioPhone,
    customerName: params.customerName,
    orderId: params.orderId,
    eventTitle: params.eventTitle,
    eventDate: params.eventDate,
    passkey: params.passkey,
    trackUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `Booking Confirmed: #${params.orderId} - ${params.studioName}`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send order confirmation email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    console.log("[EmailService] Order confirmation email sent to", params.toEmail, "ID:", data?.id);
    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[EmailService] Exception during order confirmation send:", errorMsg);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends Crew Shoot Assignment Email
 */
export async function sendCrewShootAssignedEmail(params: {
  toEmail: string;
  studioName: string;
  studioSlug: string;
  memberName: string;
  orderNumber: string;
  eventType: string;
  eventDate: string;
  skill: string;
  eventLocation?: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const portalUrl = `${baseUrl}/${params.studioSlug}/dashboard/oms`;

  const html = buildCrewShootAssignedHtml({
    studioName: params.studioName,
    memberName: params.memberName,
    orderNumber: params.orderNumber,
    eventType: params.eventType,
    eventDate: params.eventDate,
    skill: params.skill,
    eventLocation: params.eventLocation,
    portalUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `Shoot Assignment: ${params.eventType} on ${params.eventDate} (${params.studioName})`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send shoot assignment email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    console.log("[EmailService] Shoot assignment email sent to", params.toEmail, "ID:", data?.id);
    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[EmailService] Exception during shoot assignment send:", errorMsg);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends Customer Payment Balance Reminder Email
 */
export async function sendPaymentReminderCustomerEmail(params: {
  toEmail: string;
  studioName: string;
  customerName: string;
  orderId: string;
  eventTitle: string;
  amountDue: string;
  dueDate: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const paymentUrl = `${baseUrl}/pay/${params.orderId}`;

  const html = buildPaymentReminderCustomerHtml({
    studioName: params.studioName,
    customerName: params.customerName,
    orderId: params.orderId,
    eventTitle: params.eventTitle,
    amountDue: params.amountDue,
    dueDate: params.dueDate,
    paymentUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `Payment Reminder: Balance Due for #${params.orderId} - ${params.studioName}`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send payment reminder email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends Customer Photo Gallery & Deliverables Ready Email
 */
export async function sendGalleryReadyCustomerEmail(params: {
  toEmail: string;
  studioName: string;
  customerName: string;
  orderId: string;
  eventTitle: string;
  passkey: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const galleryUrl = `${baseUrl}/track/${params.passkey}`;

  const html = buildGalleryReadyCustomerHtml({
    studioName: params.studioName,
    customerName: params.customerName,
    orderId: params.orderId,
    eventTitle: params.eventTitle,
    passkey: params.passkey,
    galleryUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `Your Photos are Ready! Order #${params.orderId} - ${params.studioName}`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send gallery ready email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends Post-Event Review Request Email
 */
export async function sendReviewRequestCustomerEmail(params: {
  toEmail: string;
  studioName: string;
  customerName: string;
  eventTitle: string;
  reviewUrl?: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const reviewUrl = params.reviewUrl || `${baseUrl}/review`;

  const html = buildReviewRequestCustomerHtml({
    studioName: params.studioName,
    customerName: params.customerName,
    eventTitle: params.eventTitle,
    reviewUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `How was your photoshoot with ${params.studioName}?`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send review request email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends Welcome Email to Crew Member upon accepting invitation
 */
export async function sendCrewWelcomeMemberEmail(params: {
  toEmail: string;
  studioName: string;
  studioSlug: string;
  memberName: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const dashboardUrl = `${baseUrl}/${params.studioSlug}/dashboard/oms`;

  const html = buildCrewWelcomeMemberHtml({
    studioName: params.studioName,
    memberName: params.memberName,
    dashboardUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `Welcome to ${params.studioName} Crew!`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send crew welcome email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends Shoot / Event Day Started Alert Email
 */
export async function sendEventStartedEmail(params: {
  toEmail: string;
  studioName: string;
  studioSlug: string;
  recipientName: string;
  role: "CUSTOMER" | "CREW" | "OWNER";
  orderId: string;
  eventTitle: string;
  eventLocation?: string;
  passkey?: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const trackingUrl = params.passkey ? `${baseUrl}/track/${params.passkey}` : `${baseUrl}/${params.studioSlug}/dashboard/oms`;

  const html = buildEventStartedHtml({
    studioName: params.studioName,
    recipientName: params.recipientName,
    role: params.role,
    orderId: params.orderId,
    eventTitle: params.eventTitle,
    eventLocation: params.eventLocation,
    trackingUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `📸 Event Day Live: ${params.eventTitle} is Today! (${params.studioName})`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send event started email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}

/**
 * Sends Pipeline / Status Update Email to Customer, Crew or Owner
 */
export async function sendPipelineStatusUpdateEmail(params: {
  toEmail: string;
  studioName: string;
  studioSlug: string;
  recipientName: string;
  orderId: string;
  eventTitle: string;
  taskTitle: string;
  newStatus: string;
  details?: string;
  passkey?: string;
  baseUrl?: string;
}): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, recipient: params.toEmail, error: "Resend client not configured." };
  }

  const { fromEmail, replyToEmail } = getSenderConfig();
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-r23tbivkepodqcgcat4bbg-1076087076684.asia-southeast1.run.app";
  const portalUrl = params.passkey ? `${baseUrl}/track/${params.passkey}` : `${baseUrl}/${params.studioSlug}/dashboard/oms`;

  const html = buildPipelineStatusUpdateHtml({
    studioName: params.studioName,
    recipientName: params.recipientName,
    orderId: params.orderId,
    eventTitle: params.eventTitle,
    taskTitle: params.taskTitle,
    newStatus: params.newStatus,
    details: params.details,
    portalUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: params.toEmail,
      subject: `Production Progress: #${params.orderId} - ${params.taskTitle} (${params.newStatus})`,
      html,
    });

    if (error) {
      console.error("[EmailService] Failed to send pipeline status update email:", error);
      return { success: false, recipient: params.toEmail, error: error.message };
    }

    return { success: true, messageId: data?.id, recipient: params.toEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, recipient: params.toEmail, error: errorMsg };
  }
}


