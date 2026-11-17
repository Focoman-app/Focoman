"use server";

import {
  getStudioBySlug,
  registerStudioTransaction,
  getMembershipsByUid,
  getMembershipByUidAndStudio,
  getMembershipsByStudio,
  updateStudio,
  softDeleteStudio,
  permanentlyDeleteStudioData,
  getDeletedStudiosByOwner,
  leaveStudioMembership,
  restoreStudio,
  getFirestoreServerInstance,
  getUserDefaultStudio,
  setUserDefaultStudio,
  getStudioPackages,
  saveStudioPackage,
  softDeleteStudioPackage,
  getUserLegalConsent,
} from "@focoman/db";
import {
  Studio,
  StudioMembership,
  StudioPlan,
  StudioServiceConfig,
  StudioPackage,
  DeletedStudioRecoveryInfo,
} from "@focoman/types";
import { PLAN_CAPABILITIES } from "@focoman/config";
import {
  getAdminAuthInstance,
  requireVerifiedUser,
  requireStudioMember,
} from "@/lib/serverAuth";
import { requireCapability } from "@/lib/entitlementAuth";
import { DEFAULT_STUDIO_SERVICES, getDefaultStudioPackages } from "@/lib/studioServices";
import { deleteR2Objects } from "@/services/r2StorageService";

async function purgeStudioR2Objects(studioId: string): Promise<void> {
  try {
    const firestore = getFirestoreServerInstance();
    const snap = await firestore
      .collection("cloud_photos")
      .where("studioId", "==", studioId.toLowerCase())
      .get();
    if (snap.empty) return;
    const keys = snap.docs
      .map((d) => String((d.data() as { objectKey?: string }).objectKey || ""))
      .filter(Boolean);
    if (keys.length > 0) {
      await deleteR2Objects(keys);
    }
  } catch (err) {
    console.warn(`[purgeStudioR2Objects] Warning for studio ${studioId}:`, err);
  }
}

/**
 * Server Actions for Studio Registration, Workspaces & Settings
 * Supports Studio registration, soft-deletion, restoration, and configuration.
 */

export async function checkStudioSlugAvailabilityAction(slug: string): Promise<{
  available: boolean;
  message?: string;
}> {
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!cleanSlug || cleanSlug.length < 3) {
    return { available: false, message: "Slug must be at least 3 characters." };
  }

  const existing = await getStudioBySlug(cleanSlug);
  if (existing) {
    return { available: false, message: `Studio identifier "${cleanSlug}" is already in use.` };
  }

  // getStudioBySlug intentionally hides closed workspaces. Check the stored
  // document as well so its identifier cannot be reused during recovery.
  const storedStudio = await getFirestoreServerInstance().collection("studios").doc(cleanSlug).get();
  if (storedStudio.exists) {
    return { available: false, message: `Studio identifier "${cleanSlug}" is reserved while its data is retained.` };
  }

  return { available: true };
}

export async function registerStudioAction(input: {
  name: string;
  city: string;
  logoUrl?: string;
  website?: string;
  instagram?: string;
  idToken: string;
}): Promise<{
  success: boolean;
  studio?: Studio;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const ownerUid = decoded.uid;
    const ownerEmail = decoded.email || "";
    const ownerName = decoded.name || decoded.email || "Studio Owner";

    const name = input.name.trim();
    const city = input.city.trim();
    if (!name) return { success: false, error: "Studio name is required." };
    if ((name.match(/[a-zA-Z]/g) || []).length < 3) {
      return { success: false, error: "Studio name must have at least 3 letters." };
    }
    if (!city) return { success: false, error: "City is required." };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return { success: false, error: "Invalid studio name." };

    const now = new Date().toISOString();
    const studio: Studio = {
      id: slug,
      name,
      city,
      ownerId: ownerUid,
      ownerName,
      ownerEmail,
      ...(input.logoUrl?.trim() ? { logoUrl: input.logoUrl.trim() } : {}),
      ...(input.website?.trim() ? { website: input.website.trim() } : {}),
      ...(input.instagram?.trim() ? { instagram: input.instagram.trim() } : {}),
      features: {
        oms: true,
        crm: true,
        erp: true,
        whatsapp: true,
      },
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const membership: StudioMembership = {
      id: `${slug}_${ownerUid}`,
      studioId: slug,
      studioName: name,
      uid: ownerUid,
      role: "STUDIO_OWNER",
      status: "ACTIVE",
      joinedAt: now,
      updatedAt: now,
    };

    const result = await registerStudioTransaction(studio, membership);
    if (!result.success) {
      return { success: false, error: result.error || "Failed to register studio." };
    }

    return { success: true, studio };
  } catch (err: unknown) {
    console.error("[registerStudioAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to register studio." };
  }
}

export async function getUserWorkspacesAction(idToken: string): Promise<StudioMembership[]> {
  const decoded = await requireVerifiedUser(idToken);
  return await getMembershipsByUid(decoded.uid, decoded.email);
}

export async function getStudioAction(studioSlug: string, idToken: string): Promise<{ success: boolean; studio?: Studio; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");
    const studio = await getStudioBySlug(studioSlug);
    if (!studio) return { success: false, error: "Studio not found" };
    return { success: true, studio };
  } catch (err: unknown) {
    return { success: false, error: "Failed to fetch studio." };
  }
}

export async function updateStudioAction(input: {
  studioSlug: string;
  updates: {
    name?: string;
    city?: string;
    logoUrl?: string;
    website?: string;
    instagram?: string;
    configuredServices?: StudioServiceConfig[];
    serviceCrewMapping?: Record<string, string[]>;
    features?: Partial<Studio['features']>;
    billingProfile?: Studio['billingProfile'];
    temporaryCrew?: Studio['temporaryCrew'];
  };
  idToken: string;
}): Promise<{ success: boolean; studio?: Studio; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioMember(decoded.uid, input.studioSlug, "STUDIO_OWNER");

    const updated = await updateStudio(input.studioSlug, {
      ...(input.updates.name ? { name: input.updates.name.trim() } : {}),
      ...(input.updates.city ? { city: input.updates.city.trim() } : {}),
      ...(input.updates.logoUrl !== undefined ? { logoUrl: input.updates.logoUrl.trim() } : {}),
      ...(input.updates.website !== undefined ? { website: input.updates.website.trim() } : {}),
      ...(input.updates.instagram !== undefined ? { instagram: input.updates.instagram.trim() } : {}),
      ...(input.updates.configuredServices ? { configuredServices: input.updates.configuredServices } : {}),
      ...(input.updates.serviceCrewMapping !== undefined ? { serviceCrewMapping: input.updates.serviceCrewMapping } : {}),
      ...(input.updates.features ? { features: input.updates.features as any } : {}),
      ...(input.updates.billingProfile ? { billingProfile: input.updates.billingProfile } : {}),
      ...(input.updates.temporaryCrew !== undefined ? { temporaryCrew: input.updates.temporaryCrew } : {}),
    });

    return { success: true, studio: updated || undefined };
  } catch (err: unknown) {
    console.error("[updateStudioAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update studio." };
  }
}

export async function updateStudioServicesAction(
  studioSlug: string,
  services: StudioServiceConfig[],
  idToken: string
): Promise<{ success: boolean; studio?: Studio; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");

    const updated = await updateStudio(studioSlug, {
      configuredServices: services,
    });
    return { success: true, studio: updated || undefined };
  } catch (err: unknown) {
    console.error("[updateStudioServicesAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update studio services." };
  }
}

export async function getStudioServicesAction(
  studioSlug: string,
  idToken: string
): Promise<{ success: boolean; services: StudioServiceConfig[]; packages: StudioPackage[]; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug);
    const studio = await getStudioBySlug(studioSlug);
    if (!studio) return { success: false, services: [], packages: [], error: "Studio not found" };

    const services = Array.isArray(studio.configuredServices)
      ? studio.configuredServices
      : DEFAULT_STUDIO_SERVICES;

    let packages = await getStudioPackages(studioSlug);
    // Only inject default starter packages if the studio has never configured services or packages
    if ((!packages || packages.length === 0) && !Array.isArray(studio.configuredServices)) {
      packages = getDefaultStudioPackages(studioSlug);
    }

    return { success: true, services, packages };
  } catch (err: unknown) {
    return { success: false, services: [], packages: [], error: err instanceof Error ? err.message : "Failed to load services" };
  }
}

export async function saveStudioPackagesAction(
  studioSlug: string,
  packages: StudioPackage[],
  idToken: string
): Promise<{ success: boolean; packages?: StudioPackage[]; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");

    const saved: StudioPackage[] = [];
    for (const pkg of packages) {
      const packageDoc: StudioPackage = {
        ...pkg,
        studioId: studioSlug.toLowerCase(),
        updatedAt: new Date().toISOString(),
      };
      await saveStudioPackage(packageDoc);
      saved.push(packageDoc);
    }

    return { success: true, packages: saved };
  } catch (err: unknown) {
    console.error("[saveStudioPackagesAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to save packages." };
  }
}

export async function createStudioPackageAction(input: unknown, idToken: string) {
  try {
    const { CreatePackageSchema } = await import("@focoman/validation");
    const parsed = CreatePackageSchema.parse(input);
    const actor = await requireVerifiedUser(idToken);
    await requireStudioMember(actor.uid, parsed.studioId, "STUDIO_OWNER");
    const now = new Date().toISOString();
    const packageDoc: StudioPackage = { ...parsed, id: `PKG-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`, studioId: parsed.studioId.toLowerCase(), createdAt: now, updatedAt: now };
    await saveStudioPackage(packageDoc);
    return { success: true, package: packageDoc };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create package." };
  }
}

export async function deleteStudioPackageAction(packageId: string, studioSlug: string, idToken: string) {
  try {
    const actor = await requireVerifiedUser(idToken);
    await requireStudioMember(actor.uid, studioSlug, "STUDIO_OWNER");
    const packages = await getStudioPackages(studioSlug);
    if (!packages.some((studioPackage) => studioPackage.id === packageId)) {
      return { success: false, error: "Package not found in the authorized studio." };
    }
    const deleted = await softDeleteStudioPackage(packageId, actor.uid);
    if (!deleted) return { success: false, error: "Package not found." };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete package." };
  }
}

export async function updateStudioWhatsappConfigAction(
  studioSlug: string,
  config: Record<string, boolean>,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");
    await requireCapability(studioSlug, "WHATSAPP_OPERATIONS");
    
    await updateStudio(studioSlug, { whatsappConfig: config });
    return { success: true };
  } catch (err: unknown) {
    console.error("[updateStudioWhatsappConfigAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update config." };
  }
}

export async function resetStudioWhatsappConfigAction(
  studioSlug: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");
    await requireCapability(studioSlug, "WHATSAPP_OPERATIONS");

    const defaultToggles: Record<string, boolean> = {
      master_operational: true,
      oms_owner_3day_reminder: true,
      oms_owner_post_event_start: true,
      oms_owner_raw_photos_sent: true,
      oms_owner_customer_selection_done: true,
      oms_owner_album_review_done: true,
      oms_owner_ready_for_delivery: true,
      erp_crew_planned_alert: true,
      erp_crew_task_assigned: true,
      crm_customer_progress_update: true,
      crm_customer_delivery_ready: true,
      crm_customer_payment_reminder: true,
    };

    await updateStudio(studioSlug, { whatsappConfig: defaultToggles });
    return { success: true };
  } catch (err: unknown) {
    console.error("[resetStudioWhatsappConfigAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to reset config." };
  }
}

export async function getDeletedStudiosAction(
  idToken: string
): Promise<{ success: boolean; studios: DeletedStudioRecoveryInfo[]; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const studios = await getDeletedStudiosByOwner(decoded.uid, decoded.email);
    return { success: true, studios };
  } catch (err: unknown) {
    console.error("[getDeletedStudiosAction] Error:", err);
    return {
      success: false,
      studios: [],
      error: err instanceof Error ? err.message : "Failed to load deleted studios.",
    };
  }
}

export async function getRecoverableAccountStatusAction(
  idToken: string
): Promise<{
  success: boolean;
  hasRecoverableData: boolean;
  legalConsentRequired?: boolean;
  accountClosureRequestedAt?: string | null;
  remainingDays: number;
  scheduledDeletionAt?: string | null;
  studios: DeletedStudioRecoveryInfo[];
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const firestore = getFirestoreServerInstance();
    const [studios, activeMemberships, prefSnap, existingConsent] = await Promise.all([
      getDeletedStudiosByOwner(decoded.uid, decoded.email),
      getMembershipsByUid(decoded.uid, decoded.email),
      firestore.collection("user_preferences").doc(decoded.uid).get(),
      getUserLegalConsent(decoded.uid),
    ]);

    const prefData = prefSnap.exists ? prefSnap.data() : null;
    const accountClosureRequestedAt = (prefData?.accountClosureRequestedAt as string | undefined) || null;
    const legalConsentRequired = Boolean(prefData?.legalConsentRequired) && !existingConsent;

    // Show recovery prompt on login if the user has recoverable deleted studios
    // from a closed account (or has no active workspaces and has recoverable deleted studios)
    const hasRecoverableData =
      studios.length > 0 && (Boolean(accountClosureRequestedAt) || activeMemberships.length === 0);

    const remainingDays =
      studios.length > 0 ? Math.max(...studios.map((s) => s.remainingDays)) : 0;
    const scheduledDeletionAt = studios[0]?.scheduledDeletionAt || null;

    return {
      success: true,
      hasRecoverableData,
      legalConsentRequired,
      accountClosureRequestedAt,
      remainingDays,
      scheduledDeletionAt,
      studios,
    };
  } catch (err: unknown) {
    console.error("[getRecoverableAccountStatusAction] Error:", err);
    return {
      success: false,
      hasRecoverableData: false,
      remainingDays: 0,
      studios: [],
      error: err instanceof Error ? err.message : "Failed to check recoverable account data.",
    };
  }
}

export async function recoverDeletedAccountAction(
  idToken: string
): Promise<{
  success: boolean;
  restoredCount: number;
  firstStudioId?: string;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const firestore = getFirestoreServerInstance();
    const deletedStudios = await getDeletedStudiosByOwner(decoded.uid, decoded.email);

    let restoredCount = 0;
    let firstStudioId: string | undefined;

    for (const ds of deletedStudios) {
      const ok = await restoreStudio(ds.id);
      if (ok) {
        restoredCount += 1;
        if (!firstStudioId) firstStudioId = ds.id;
      }
    }

    await firestore
      .collection("user_preferences")
      .doc(decoded.uid)
      .set(
        {
          accountClosureRequestedAt: null,
          ...(firstStudioId ? { defaultStudioId: firstStudioId } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return { success: true, restoredCount, firstStudioId };
  } catch (err: unknown) {
    console.error("[recoverDeletedAccountAction] Error:", err);
    return {
      success: false,
      restoredCount: 0,
      error: err instanceof Error ? err.message : "Failed to recover account data.",
    };
  }
}

export async function startNewProfileAfterDeletionAction(
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const firestore = getFirestoreServerInstance();
    const deletedStudios = await getDeletedStudiosByOwner(decoded.uid, decoded.email);

    for (const ds of deletedStudios) {
      await purgeStudioR2Objects(ds.id);
      await permanentlyDeleteStudioData(ds.id);
    }

    try {
      await firestore.collection("user_legal_consents").doc(decoded.uid).delete();
    } catch (e) {
      console.warn("[startNewProfileAfterDeletionAction] Delete user_legal_consents warning:", e);
    }

    await firestore
      .collection("user_preferences")
      .doc(decoded.uid)
      .set(
        {
          accountClosureRequestedAt: null,
          defaultStudioId: null,
          legalConsentRequired: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return { success: true };
  } catch (err: unknown) {
    console.error("[startNewProfileAfterDeletionAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to start new profile.",
    };
  }
}

export async function deleteStudioAction(
  studioSlug: string,
  idToken: string,
  options?: { permanent?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const cleanSlug = studioSlug.trim().toLowerCase();

    // Verify ownership (active membership or owner of a soft-deleted studio)
    const firestore = getFirestoreServerInstance();
    const studioSnap = await firestore.collection("studios").doc(cleanSlug).get();
    const studioData = studioSnap.exists ? (studioSnap.data() as Studio) : null;
    const isDirectOwner =
      studioData &&
      (studioData.ownerId === decoded.uid ||
        (decoded.email &&
          studioData.ownerEmail?.toLowerCase() === decoded.email.toLowerCase()));

    if (!isDirectOwner) {
      await requireStudioMember(decoded.uid, cleanSlug, "STUDIO_OWNER");
    }

    if (options?.permanent) {
      await purgeStudioR2Objects(cleanSlug);
      await permanentlyDeleteStudioData(cleanSlug);
    } else {
      await softDeleteStudio(cleanSlug, decoded.uid);
    }
    return { success: true };
  } catch (err: unknown) {
    console.error("[deleteStudioAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete studio." };
  }
}

export async function leaveStudioAction(
  studioSlug: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const membership = await getMembershipByUidAndStudio(decoded.uid, studioSlug);
    if (!membership) {
      return { success: false, error: "Membership not found." };
    }
    if (membership.role === "STUDIO_OWNER") {
      return {
        success: false,
        error: "Studio owners cannot leave their studio. Use Delete Studio instead.",
      };
    }
    await leaveStudioMembership(decoded.uid, studioSlug);
    return { success: true };
  } catch (err: unknown) {
    console.error("[leaveStudioAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to leave studio." };
  }
}

export async function restoreStudioAction(
  studioSlug: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const cleanSlug = studioSlug.trim().toLowerCase();
    const firestore = getFirestoreServerInstance();
    const studioSnap = await firestore.collection("studios").doc(cleanSlug).get();

    if (!studioSnap.exists) {
      return { success: false, error: "Studio not found." };
    }

    const studioData = studioSnap.data() as Studio;
    const isOwnerByStudio =
      studioData.ownerId === decoded.uid ||
      (Boolean(decoded.email) &&
        studioData.ownerEmail?.toLowerCase() === decoded.email?.toLowerCase());

    if (!isOwnerByStudio) {
      const memSnap = await firestore
        .collection("memberships")
        .where("uid", "==", decoded.uid)
        .where("studioId", "==", cleanSlug)
        .get();
      const hasOwnerMembership = memSnap.docs.some(
        (d) => (d.data() as StudioMembership).role === "STUDIO_OWNER"
      );
      if (!hasOwnerMembership) {
        throw new Error("Only the studio owner can restore this workspace.");
      }
    }

    const restored = await restoreStudio(cleanSlug);
    if (!restored) {
      return { success: false, error: "Studio could not be restored." };
    }
    return { success: true };
  } catch (err: unknown) {
    console.error("[restoreStudioAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to restore studio." };
  }
}

const CHECKOUT_PLAN_IDS = ["FREE", "STARTER", "PROFESSIONAL"] as const;
type CheckoutPlanId = (typeof CHECKOUT_PLAN_IDS)[number];

function isCheckoutPlanId(plan: string): plan is CheckoutPlanId {
  return CHECKOUT_PLAN_IDS.includes(plan as CheckoutPlanId);
}

/**
 * Applies the fixed public plan chosen for one studio. Capabilities are
 * resolved from the server-owned plan catalogue, never from client input.
 */
export async function selectStudioPlanAction(
  studioSlug: string,
  plan: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");

    const normalizedPlan = plan === "COMPLETE" ? "PROFESSIONAL" : plan;
    if (!isCheckoutPlanId(normalizedPlan)) {
      return { success: false, error: "Choose a valid studio plan." };
    }

    const canonicalCapabilities = PLAN_CAPABILITIES[normalizedPlan];
    if (!canonicalCapabilities) {
      return { success: false, error: "The selected plan is not configured." };
    }

    const { updateStudioCapabilities } = await import("@focoman/entitlements");
    await updateStudioCapabilities(
      studioSlug,
      canonicalCapabilities,
      undefined,
      normalizedPlan
    );

    const existingStudio = await getStudioBySlug(studioSlug);
    await updateStudio(studioSlug, {
      features: {
        oms: true,
        crm: normalizedPlan !== "FREE",
        erp: normalizedPlan !== "FREE",
        whatsapp: normalizedPlan === "PROFESSIONAL",
        autoAssignCrew:
          normalizedPlan !== "FREE"
            ? existingStudio?.features?.autoAssignCrew ?? true
            : false,
        ...(existingStudio?.features?.autoAssignCrewConfigured !== undefined
          ? { autoAssignCrewConfigured: existingStudio.features.autoAssignCrewConfigured }
          : {}),
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error("[selectStudioPlanAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to save studio plan." };
  }
}

/**
 * Closes the user account. By default, sole-owner workspaces enter the 30-day
 * recovery window. When options.permanent is true ("Full instant delete"),
 * all sole-owner studios, studio data, and user records are immediately erased.
 */
export async function deleteUserAccountAction(
  idToken: string,
  options?: { permanent?: boolean }
): Promise<{
  success: boolean;
  authDeleted?: boolean;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const uid = decoded.uid;
    const isPermanent = Boolean(options?.permanent);
    const firestore = getFirestoreServerInstance();

    // 1. Fetch all active memberships for this user
    const memberships = await getMembershipsByUid(uid, decoded.email);
    const processedStudios = new Set<string>();

    // 2. Process active memberships
    for (const m of memberships) {
      const sid = m.studioId.toLowerCase();
      processedStudios.add(sid);
      if (m.role === "STUDIO_OWNER") {
        try {
          const studioMembers = await getMembershipsByStudio(sid);
          const otherActiveOwners = studioMembers.filter(
            (sm) => sm.uid !== uid && sm.role === "STUDIO_OWNER" && sm.status === "ACTIVE"
          );

          if (otherActiveOwners.length === 0) {
            if (isPermanent) {
              await purgeStudioR2Objects(sid);
              await permanentlyDeleteStudioData(sid);
            } else {
              await softDeleteStudio(sid, uid);
            }
          } else {
            await leaveStudioMembership(uid, sid);
          }
        } catch (e) {
          console.warn(`[deleteUserAccountAction] Close studio ${sid} warning:`, e);
        }
      } else {
        try {
          await leaveStudioMembership(uid, sid);
        } catch (e) {
          console.warn(`[deleteUserAccountAction] Leave studio ${sid} warning:`, e);
        }
      }
    }

    // 3. When Full Instant Delete is selected, also purge any soft-deleted studios owned by this user,
    // remove user-level documents/memberships, and delete the Firebase Authentication user record.
    if (isPermanent) {
      try {
        const deletedStudios = await getDeletedStudiosByOwner(uid, decoded.email);
        for (const ds of deletedStudios) {
          const sid = ds.id.toLowerCase();
          if (!processedStudios.has(sid)) {
            processedStudios.add(sid);
            await purgeStudioR2Objects(sid);
            await permanentlyDeleteStudioData(sid);
          }
        }
      } catch (e) {
        console.warn("[deleteUserAccountAction] Purge soft-deleted studios warning:", e);
      }

      try {
        const remainingMemberships = await firestore
          .collection("memberships")
          .where("uid", "==", uid)
          .get();
        if (!remainingMemberships.empty) {
          const batch = firestore.batch();
          remainingMemberships.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (e) {
        console.warn("[deleteUserAccountAction] Purge remaining memberships warning:", e);
      }

      try {
        await firestore.collection("user_preferences").doc(uid).delete();
      } catch (e) {
        console.warn("[deleteUserAccountAction] Delete user_preferences warning:", e);
      }

      try {
        await firestore.collection("user_legal_consents").doc(uid).delete();
      } catch (e) {
        console.warn("[deleteUserAccountAction] Delete user_legal_consents warning:", e);
      }

      let authDeleted = false;
      try {
        const adminAuth = getAdminAuthInstance();
        try {
          await adminAuth.revokeRefreshTokens(uid);
        } catch (revokeErr) {
          console.warn("[deleteUserAccountAction] Revoke refresh tokens warning:", revokeErr);
        }
        await adminAuth.deleteUser(uid);
        authDeleted = true;
      } catch (authErr: unknown) {
        const code =
          typeof authErr === "object" && authErr !== null && "code" in authErr
            ? String((authErr as { code?: unknown }).code)
            : "";
        if (code === "auth/user-not-found") {
          authDeleted = true;
        } else {
          console.warn("[deleteUserAccountAction] Admin deleteUser warning:", authErr);
        }
      }

      if (!authDeleted) {
        try {
          await firestore.collection("user_preferences").doc(uid).set(
            {
              accountClosureRequestedAt: null,
              defaultStudioId: null,
              legalConsentRequired: true,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("[deleteUserAccountAction] Set fallback legalConsentRequired warning:", e);
        }
      }

      return { success: true, authDeleted };
    } else {
      // Record the closure request while preserving the 30-day recovery window
      try {
        await firestore.collection("user_preferences").doc(uid).set(
          {
            accountClosureRequestedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("[deleteUserAccountAction] Record closure request warning:", e);
      }

      return { success: true };
    }
  } catch (err: unknown) {
    console.error("[deleteUserAccountAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete user account.",
    };
  }
}

export async function getUserDefaultStudioAction(idToken: string): Promise<string | null> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    return await getUserDefaultStudio(decoded.uid);
  } catch {
    return null;
  }
}

export async function setUserDefaultStudioAction(
  studioId: string | null,
  idToken: string
): Promise<boolean> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    return await setUserDefaultStudio(decoded.uid, studioId);
  } catch {
    return false;
  }
}


