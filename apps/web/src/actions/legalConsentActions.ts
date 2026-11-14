"use server";

import { getUserLegalConsent, saveUserLegalConsent } from "@focoman/db";
import { requireVerifiedUser } from "@/lib/serverAuth";

const CURRENT_TERMS_VERSION = "2026-11-10";
const CURRENT_PRIVACY_VERSION = "2026-11-10";

export async function recordNewUserLegalConsentAction(input: {
  idToken: string;
  termsRead: boolean;
  privacyRead: boolean;
  accepted: boolean;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!input.termsRead || !input.privacyRead || !input.accepted) {
      return { success: false, error: "Read both legal documents and confirm your agreement before continuing." };
    }

    const user = await requireVerifiedUser(input.idToken);
    const existing = await getUserLegalConsent(user.uid);
    if (existing) return { success: true };

    const now = new Date().toISOString();
    await saveUserLegalConsent({
      uid: user.uid,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to record legal consent." };
  }
}
