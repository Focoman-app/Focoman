"use server";

import {
  getMembersByStudio,
  getDeletedMembersByStudio,
  getMemberById,
  getMemberByIdIncludeDeleted,
  saveMember,
  updateMember,
  softDeleteMember,
  restoreMember,
  saveInvitation,
  getStudioBySlug,
  getInvitationByCode,
  getInvitationsByStudio,
  getPendingInvitationsByEmail,
  getInvitationByCodeIncludeDeleted,
  recordInvitationPasscodeFailure,
  revokeInvitation,
  restoreInvitation,
  acceptInvitationTransaction,
} from "@focoman/db";
import { StudioMember, StudioInvitation, StudioInvitationSummary } from "@focoman/types";
import { requireVerifiedUser, requireStudioMember, requireStudioOwner } from "@/lib/serverAuth";
import {
  createInvitationLinkToken,
  formatInvitationCode,
  generateTimestampDigits,
  hashInvitationPasscode,
  verifyInvitationLinkToken,
  verifyInvitationPasscode,
} from "@/lib/invitationPasscode";
import { updatePendingInvitationLinkTokenHash } from "@focoman/db";
import { sendCrewInvitationEmail, sendCrewAcceptedOwnerEmail, sendCrewWelcomeMemberEmail } from "@/services/emailService";
import { hasStudioCapability } from "@/lib/entitlementAuth";

/**
 * Server Actions for Studio Crew & Resource Management (ERP)
 * Complete CRUD: Create, Read (active + deleted), Update, Delete (soft), Restore.
 * Full invitation lifecycle: Create, List, Revoke, Accept.
 */

export async function getStudioMembersAction(
  studioSlug: string,
  idToken: string
): Promise<StudioMember[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);
  return await getMembersByStudio(studioSlug);
}

export async function getDeletedStudioMembersAction(
  studioSlug: string,
  idToken: string
): Promise<StudioMember[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");
  return await getDeletedMembersByStudio(studioSlug);
}

export async function getMemberAction(
  memberId: string,
  studioSlug: string,
  idToken: string
): Promise<StudioMember | null> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);

  const member = await getMemberById(memberId);
  if (!member) return null;
  if (member.studioId !== studioSlug.toLowerCase()) {
    throw new Error("Access denied: Member does not belong to the authorized studio.");
  }
  return member;
}

export async function getStudioInvitationsAction(
  studioSlug: string,
  idToken: string
): Promise<StudioInvitationSummary[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");
  const invitations = await getInvitationsByStudio(studioSlug);
  return invitations.map(toInvitationSummary);
}

function toInvitationSummary(invitation: StudioInvitation): StudioInvitationSummary {
  const displayPin = invitation.claimCode || invitation.id.match(/\d{6}$/)?.[0];
  return {
    id: invitation.id,
    studioId: invitation.studioId,
    studioName: invitation.studioName,
    email: invitation.email,
    phone: invitation.phone,
    name: invitation.name,
    skills: invitation.skills,
    role: invitation.role,
    status: invitation.status,
    requiresPasscode: !invitation.email,
    claimCode: !invitation.email ? displayPin : undefined,
    claimLocked: invitation.claimLocked,
    createdAt: invitation.createdAt,
    acceptedAt: invitation.acceptedAt,
  };
}

export async function getMyPendingInvitationsAction(idToken: string): Promise<StudioInvitationSummary[]> {
  const decoded = await requireVerifiedUser(idToken);
  if (!decoded.email) return [];
  const invitations = await getPendingInvitationsByEmail(decoded.email);
  return invitations.map(toInvitationSummary);
}

export async function getInvitationClaimStatusAction(
  inviteCode: string,
  idToken: string,
  linkToken?: string
): Promise<{
  status: "PENDING" | "CLAIMED_BY_YOU" | "CLAIMED" | "REVOKED" | "LOCKED" | "UNAVAILABLE" | "EMAIL_MISMATCH" | "NOT_FOUND" | "OWNER_VIEW";
  studioId?: string;
  studioName?: string;
  inviteeName?: string;
  inviteeEmail?: string;
  invitationStatus?: "PENDING" | "ACCEPTED" | "REVOKED";
  requiresPasscode?: boolean;
  acceptedAt?: string;
}> {
  const decoded = await requireVerifiedUser(idToken);
  const cleanCode = inviteCode?.trim().toUpperCase();
  if (!cleanCode) return { status: "NOT_FOUND" };

  const invitation = await getInvitationByCodeIncludeDeleted(cleanCode);
  if (!invitation) return { status: "NOT_FOUND" };

  // Check if current user is the studio owner who issued this invite
  const studio = await getStudioBySlug(invitation.studioId);
  const isOwner = Boolean(
    (studio && (studio.ownerId === decoded.uid || studio.ownerEmail?.toLowerCase() === decoded.email?.toLowerCase())) ||
    invitation.invitedByUid === decoded.uid
  );

  if (isOwner) {
    return {
      status: "OWNER_VIEW",
      studioId: invitation.studioId,
      studioName: invitation.studioName,
      inviteeName: invitation.name,
      inviteeEmail: invitation.email,
      invitationStatus: invitation.status as "PENDING" | "ACCEPTED" | "REVOKED",
      requiresPasscode: !invitation.email,
      acceptedAt: invitation.acceptedAt,
    };
  }

  if (invitation.isDeleted || invitation.status === "REVOKED") {
    return { status: "REVOKED", studioId: invitation.studioId, studioName: invitation.studioName };
  }

  if (invitation.status === "ACCEPTED") {
    return {
      status: invitation.acceptedByUid === decoded.uid ? "CLAIMED_BY_YOU" : "CLAIMED",
      studioId: invitation.studioId,
      studioName: invitation.studioName,
    };
  }

  if (invitation.status !== "PENDING") {
    return { status: "UNAVAILABLE", studioId: invitation.studioId, studioName: invitation.studioName };
  }

  if (invitation.claimLocked) {
    return { status: "LOCKED", studioId: invitation.studioId, studioName: invitation.studioName };
  }

  if (invitation.email) {
    const emailMatches = Boolean(
      decoded.email && invitation.email.trim().toLowerCase() === decoded.email.trim().toLowerCase()
    );
    if (!emailMatches) {
      return {
        status: "EMAIL_MISMATCH",
        studioId: invitation.studioId,
        studioName: invitation.studioName,
        inviteeEmail: invitation.email,
        inviteeName: invitation.name,
      };
    }
  }

  return {
    status: "PENDING",
    studioId: invitation.studioId,
    studioName: invitation.studioName,
    inviteeName: invitation.name,
    requiresPasscode: !invitation.email,
  };
}

export async function createInvitationShareLinkAction(input: {
  studioId: string;
  inviteCode: string;
  idToken: string;
}): Promise<{ success: boolean; linkToken?: string; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);
    const invitation = await getInvitationByCodeIncludeDeleted(input.inviteCode);
    if (!invitation || invitation.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Invitation not found in the authorized studio." };
    }
    if (invitation.status !== "PENDING" || invitation.isDeleted || invitation.claimLocked) {
      return { success: false, error: "This invitation cannot issue a new link. Revoke it and create a replacement." };
    }
    const newLink = createInvitationLinkToken();
    await updatePendingInvitationLinkTokenHash(invitation.id, newLink.hash);
    return { success: true, linkToken: newLink.token };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Could not create invitation link." };
  }
}

export async function createMemberAction(input: {
  studioId: string;
  name: string;
  email?: string;
  phone?: string;
  notifyWhatsApp?: boolean;
  claimCode?: string;
  skills: string[];
  idToken: string;
}): Promise<{
  success: boolean;
  invitation?: StudioInvitationSummary;
  invitationCode?: string;
  invitationLinkToken?: string;
  claimCode?: string;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioMember(decoded.uid, input.studioId, "STUDIO_OWNER");

    if (
      input.notifyWhatsApp &&
      !(await hasStudioCapability(input.studioId, "WHATSAPP_OPERATIONS"))
    ) {
      return {
        success: false,
        error: "WhatsApp alerts and notifications require the Professional (₹1,999/mo) plan.",
      };
    }

    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: "Member name is required." };
    }
    const email = input.email?.trim().toLowerCase() || "";
    if (email && !email.includes("@")) {
      return { success: false, error: "Valid email address is required." };
    }
    if (!email && !/^\d{6}$/.test(input.claimCode || "")) {
      return { success: false, error: "A six-digit passcode is required when no email is provided." };
    }
    if (email && input.claimCode) {
      return { success: false, error: "Passcodes are only used for email-free invitations." };
    }
    if (!input.skills || input.skills.length === 0) {
      return { success: false, error: "At least one certified skill must be selected." };
    }

    const studio = await getStudioBySlug(input.studioId);
    const studioName = studio?.name || input.studioId;

    const [existingMembers, existingInvitations] = await Promise.all([
      getMembersByStudio(input.studioId),
      getInvitationsByStudio(input.studioId),
    ]);

    const normalizedName = input.name.trim().toLowerCase();

    // 0. Check if the name matches the studio owner
    if (studio?.ownerName && studio.ownerName.trim().toLowerCase() === normalizedName) {
      return {
        success: false,
        error: `"${input.name.trim()}" is the studio owner and is already active as the first crew member.`,
      };
    }

    // 1. Check uniqueness of the entered name within this studio (active members)
    const memberNameExists = existingMembers.some(
      (m) =>
        m.name.trim().toLowerCase() === normalizedName ||
        (m.ownerAssignedName && m.ownerAssignedName.trim().toLowerCase() === normalizedName)
    );
    if (memberNameExists) {
      return {
        success: false,
        error: `A crew member named "${input.name.trim()}" already exists in your studio. Please use a unique name or initial.`,
      };
    }

    // 2. Check uniqueness of the entered name within this studio (pending invitations)
    const pendingInviteNameExists = existingInvitations.some(
      (inv) => inv.status === "PENDING" && inv.name?.trim().toLowerCase() === normalizedName
    );
    if (pendingInviteNameExists) {
      return {
        success: false,
        error: `A pending invitation for "${input.name.trim()}" already exists in your studio.`,
      };
    }

    // 3. Disallow self-invites & duplicate member emails
    if (email) {
      const callerEmail = decoded.email?.trim().toLowerCase() ?? "";
      const ownerEmail = studio?.ownerEmail?.trim().toLowerCase() ?? "";
      const isSelfInvite = (callerEmail && email === callerEmail) || (ownerEmail && email === ownerEmail);

      if (isSelfInvite) {
        return {
          success: false,
          error: "You cannot invite yourself. The studio owner is automatically the first crew member with owner status.",
        };
      }

      const memberEmailExists = existingMembers.some(
        (m) => m.email?.trim().toLowerCase() === email
      );
      if (memberEmailExists) {
        return {
          success: false,
          error: `A crew member with email "${email}" is already a member of your studio.`,
        };
      }

      const pendingInviteEmailExists = existingInvitations.some(
        (inv) => inv.status === "PENDING" && inv.email?.trim().toLowerCase() === email
      );
      if (pendingInviteEmailExists) {
        return {
          success: false,
          error: `A pending invitation has already been sent to "${email}". You can copy or revoke the existing invitation from the Pending Invitations list.`,
        };
      }
    }

    const now = new Date().toISOString();
    const passcodeHash = email ? undefined : hashInvitationPasscode(input.claimCode!);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { dateStamp, timeStamp } = generateTimestampDigits();
      const inviteCode = formatInvitationCode(studio?.name || input.studioId, input.name, `${dateStamp}-${timeStamp}`);
      const linkToken = createInvitationLinkToken();
      const invitation: StudioInvitation = {
        id: inviteCode,
        studioId: input.studioId.toLowerCase(),
        studioName,
        ...(email ? { email } : {}),
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        ...(input.notifyWhatsApp !== undefined
          ? { notifyWhatsApp: Boolean(input.notifyWhatsApp && input.phone?.trim()) }
          : {}),
        name: input.name.trim(),
        skills: input.skills,
        ...(input.claimCode && !email ? { claimCode: input.claimCode } : {}),
        ...(passcodeHash ? { claimCodeSalt: passcodeHash.salt, claimCodeHash: passcodeHash.hash } : {}),
        claimLinkTokenHash: linkToken.hash,
        role: 'STUDIO_MEMBER',
        status: 'PENDING',
        isDeleted: false,
        invitedByUid: decoded.uid,
        createdAt: now,
      };

      try {
        await saveInvitation(invitation);

        if (email) {
          void sendCrewInvitationEmail({
            toEmail: email,
            studioName,
            memberName: input.name.trim(),
            inviteCode,
            skills: input.skills,
          }).catch((mailErr) =>
            console.error("[createMemberAction] Background invite email failed:", mailErr)
          );
        }

        return {
          success: true,
          invitation: toInvitationSummary(invitation),
          invitationCode: inviteCode,
          invitationLinkToken: linkToken.token,
          ...(email ? {} : { claimCode: input.claimCode }),
        };
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('Invitation code collision')) continue;
        throw error;
      }
    }
    throw new Error('Could not reserve a unique invitation code. Please try again.');
  } catch (err: unknown) {
    console.error("[createMemberAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create studio member" };
  }
}

export async function updateMemberAction(input: {
  memberId: string;
  studioId: string;
  updates: {
    name?: string;
    phone?: string;
    notifyWhatsApp?: boolean;
    skills?: string[];
    status?: 'ACTIVE' | 'INACTIVE';
  };
  idToken: string;
}): Promise<{ success: boolean; member?: StudioMember; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioMember(decoded.uid, input.studioId, "STUDIO_OWNER");

    if (
      input.updates.notifyWhatsApp &&
      !(await hasStudioCapability(input.studioId, "WHATSAPP_OPERATIONS"))
    ) {
      return {
        success: false,
        error: "WhatsApp alerts and notifications require the Professional (₹1,999/mo) plan.",
      };
    }

    const existing = await getMemberById(input.memberId);
    if (!existing) {
      return { success: false, error: "Crew member not found." };
    }
    if (existing.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Member does not belong to this studio." };
    }

    const updated = await updateMember(input.memberId, {
      ...(input.updates.name ? { name: input.updates.name.trim() } : {}),
      ...(input.updates.phone !== undefined ? { phone: input.updates.phone.trim() } : {}),
      ...(input.updates.notifyWhatsApp !== undefined
        ? { notifyWhatsApp: input.updates.notifyWhatsApp }
        : {}),
      ...(input.updates.skills ? { skills: input.updates.skills } : {}),
      ...(input.updates.status ? { status: input.updates.status } : {}),
    });

    return { success: true, member: updated || undefined };
  } catch (err: unknown) {
    console.error("[updateMemberAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update member" };
  }
}

export async function deleteMemberAction(input: {
  memberId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioMember(decoded.uid, input.studioId, "STUDIO_OWNER");

    const existing = await getMemberById(input.memberId);
    if (!existing) {
      return { success: false, error: "Crew member not found." };
    }
    if (existing.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Member does not belong to this studio." };
    }

    await softDeleteMember(input.memberId, decoded.uid);
    return { success: true };
  } catch (err: unknown) {
    console.error("[deleteMemberAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete member" };
  }
}

export async function restoreMemberAction(input: {
  memberId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioMember(decoded.uid, input.studioId, "STUDIO_OWNER");

    const member = await getMemberByIdIncludeDeleted(input.memberId);
    if (!member || member.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Crew member not found in the authorized studio." };
    }

    await restoreMember(input.memberId);
    return { success: true };
  } catch (err: unknown) {
    console.error("[restoreMemberAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to restore member" };
  }
}

export async function revokeInvitationAction(input: {
  inviteCode: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioMember(decoded.uid, input.studioId, "STUDIO_OWNER");

    const invitation = await getInvitationByCode(input.inviteCode);
    if (!invitation || invitation.studioId !== input.studioId.toLowerCase() || invitation.status !== "PENDING") {
      return { success: false, error: "Invitation not found in the authorized studio." };
    }

    await revokeInvitation(input.inviteCode, decoded.uid);
    return { success: true };
  } catch (err: unknown) {
    console.error("[revokeInvitationAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to revoke invitation" };
  }
}

export async function acceptInvitationAction(input: {
  inviteCode: string;
  linkToken?: string;
  claimCode?: string;
  idToken: string;
}): Promise<{
  success: boolean;
  studioId?: string;
  studioName?: string;
  error?: string;
}> {
  try {
    const cleanCode = input.inviteCode?.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 5) {
      return { success: false, error: "Please provide a valid invitation code." };
    }

    const decoded = await requireVerifiedUser(input.idToken);
    const uid = decoded.uid;
    const userEmail = decoded.email;

    if (!userEmail) {
      return { success: false, error: "Authenticated account does not have an email address." };
    }

    const invitation = await getInvitationByCodeIncludeDeleted(cleanCode);
    if (!invitation || invitation.isDeleted || invitation.status === "REVOKED") {
      return { success: false, error: "This invitation is no longer available." };
    }
    if (invitation.status === "ACCEPTED") {
      if (
        !invitation.email?.trim()
        && (!input.linkToken || !invitation.claimLinkTokenHash
          || !verifyInvitationLinkToken(input.linkToken, invitation.claimLinkTokenHash))
      ) {
        return { success: false, error: "This invitation link is not valid." };
      }
      if (invitation.acceptedByUid === uid) {
        return { success: true, studioId: invitation.studioId, studioName: invitation.studioName };
      }
      return { success: false, error: "This invitation has already been claimed." };
    }
    if (invitation.status !== "PENDING") {
      return { success: false, error: "This invitation is no longer available." };
    }

    let claimCodeVerified = false;
    if (!invitation.email?.trim()) {
      if (!input.linkToken || !invitation.claimLinkTokenHash
        || !verifyInvitationLinkToken(input.linkToken, invitation.claimLinkTokenHash)) {
        return { success: false, error: "This invitation link is not valid." };
      }
      if (invitation.claimLocked) {
        return { success: false, error: "This invitation is locked after too many incorrect passcode attempts. Ask the studio owner to create a new invitation." };
      }
      if (!/^\d{6}$/.test(input.claimCode || "")) {
        return { success: false, error: "Enter the six-digit passcode provided by the studio owner." };
      }
      const fallbackPin = invitation.claimCode || invitation.id.match(/\d{6}$/)?.[0];
      const isHashValid = Boolean(
        invitation.claimCodeSalt && invitation.claimCodeHash
        && verifyInvitationPasscode(input.claimCode!, invitation.claimCodeSalt, invitation.claimCodeHash)
      );
      const isPlaintextOrFallbackValid = Boolean(fallbackPin && input.claimCode === fallbackPin);

      if (!isHashValid && !isPlaintextOrFallbackValid) {
        const failure = await recordInvitationPasscodeFailure(cleanCode);
        return {
          success: false,
          error: failure.locked
            ? "Too many incorrect passcode attempts. Ask the studio owner to create a new invitation."
            : `Incorrect passcode. ${failure.attemptsRemaining} attempts remain.`,
        };
      }
      claimCodeVerified = true;
    }

    const res = await acceptInvitationTransaction({
      code: cleanCode,
      uid,
      userEmail,
      userName: decoded.name || decoded.email,
      claimCodeVerified,
    });

    if (!res.success) {
      return { success: false, error: res.error || "Failed to accept invitation." };
    }

    // Trigger owner notification email & member welcome email in background
    void (async () => {
      try {
        const studio = await getStudioBySlug(invitation.studioId);
        const studioName = studio?.name || invitation.studioName;

        // 1. Send notice to Studio Owner
        if (studio?.ownerEmail) {
          await sendCrewAcceptedOwnerEmail({
            ownerEmail: studio.ownerEmail,
            studioSlug: invitation.studioId,
            studioName,
            ownerName: studio.ownerName || "Studio Owner",
            memberName: invitation.name || "Crew Member",
            memberEmail: userEmail,
            skills: invitation.skills || [],
            acceptedAt: new Date().toISOString(),
          });
        }

        // 2. Send Welcome email to Crew Member
        await sendCrewWelcomeMemberEmail({
          toEmail: userEmail,
          studioName,
          studioSlug: invitation.studioId,
          memberName: invitation.name || "Crew Member",
        });
      } catch (emailErr) {
        console.error("[acceptInvitationAction] Invitation acceptance emails failed:", emailErr);
      }
    })();

    return {
      success: true,
      studioId: res.studioId,
      studioName: res.studioName,
    };
  } catch (err: unknown) {
    console.error("[acceptInvitationAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to activate studio invitation." };
  }
}

export async function restoreInvitationAction(input: {
  inviteCode: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioMember(decoded.uid, input.studioId, "STUDIO_OWNER");

    const invitation = await getInvitationByCodeIncludeDeleted(input.inviteCode);
    if (!invitation || invitation.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Invitation not found in the authorized studio." };
    }

    await restoreInvitation(input.inviteCode);
    return { success: true };
  } catch (err: unknown) {
    console.error("[restoreInvitationAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to restore invitation" };
  }
}
