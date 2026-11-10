"use server";

import {
  getStudioBySlug,
  registerStudioTransaction,
  getMembershipsByUid,
  getMembershipByUidAndStudio,
  getMembershipsByStudio,
  updateStudio,
  softDeleteStudio,
  leaveStudioMembership,
  restoreStudio,
  getFirestoreServerInstance,
  getUserDefaultStudio,
  setUserDefaultStudio,
  getStudioPackages,
  saveStudioPackage,
} from "@focoman/db";
import { Studio, StudioMembership, StudioPlan, StudioServiceConfig, StudioPackage } from "@focoman/types";
import { requireVerifiedUser, requireStudioMember } from "@/lib/serverAuth";
import { DEFAULT_STUDIO_SERVICES, getDefaultStudioPackages } from "@/lib/studioServices";

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
        marketplace: true,
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

export async function updateStudioWhatsappConfigAction(
  studioSlug: string,
  config: Record<string, boolean>,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");
    
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

export async function deleteStudioAction(
  studioSlug: string,
  idToken: string,
  _options?: { permanent?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");

    // Browser-initiated closure stays recoverable for the configured window.
    // Permanent cleanup is an administrative operation, not a client request.
    await softDeleteStudio(studioSlug, decoded.uid);
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
    const membership = await getMembershipByUidAndStudio(decoded.uid, studioSlug);
    if (!membership || membership.role !== "STUDIO_OWNER") {
      throw new Error("Only the studio owner can restore this workspace.");
    }

    await restoreStudio(studioSlug);
    return { success: true };
  } catch (err: unknown) {
    console.error("[restoreStudioAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to restore studio." };
  }
}

export async function saveStudioCapabilitiesAction(
  studioSlug: string,
  selectedCapabilities: string[],
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");

    if (selectedCapabilities.length > 0) {
      return {
        success: false,
        error: "Paid capability activation requires verified payment confirmation. No plan change was made.",
      };
    }

    const { updateStudioCapabilities } = await import("@focoman/entitlements");
    await updateStudioCapabilities(studioSlug, []);
    return { success: true };
  } catch (err: unknown) {
    console.error("[saveStudioCapabilitiesAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to save studio capabilities." };
  }
}

/**
 * Starts account closure while preserving sole-owner workspaces for the
 * configured recovery window. Permanent cleanup is not a browser action.
 */
export async function deleteUserAccountAction(idToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const uid = decoded.uid;
    const firestore = getFirestoreServerInstance();

    // 1. Fetch all memberships for this user
    const memberships = await getMembershipsByUid(uid);

    // 2. For studios where this user is the STUDIO_OWNER:
    for (const m of memberships) {
      if (m.role === "STUDIO_OWNER") {
        try {
          const studioMembers = await getMembershipsByStudio(m.studioId);
          const otherActiveOwners = studioMembers.filter(
            (sm) => sm.uid !== uid && sm.role === "STUDIO_OWNER" && sm.status === "ACTIVE"
          );

          if (otherActiveOwners.length === 0) {
            // Sole-owner workspaces remain recoverable under the Privacy Policy.
            await softDeleteStudio(m.studioId, uid);
          } else {
            // Co-owned studio: Leave membership so studio remains with remaining owner
            await leaveStudioMembership(uid, m.studioId);
          }
        } catch (e) {
          console.warn(`[deleteUserAccountAction] Close studio ${m.studioId} warning:`, e);
        }
      } else {
        try {
          await leaveStudioMembership(uid, m.studioId);
        } catch (e) {
          console.warn(`[deleteUserAccountAction] Leave studio ${m.studioId} warning:`, e);
        }
      }
    }

    // 3. Record the request without deleting the account identity. This allows
    // an authorised recovery request during the workspace recovery period.
    try {
      await firestore.collection("user_preferences").doc(uid).set({
        accountClosureRequestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn("[deleteUserAccountAction] Record closure request warning:", e);
    }

    return { success: true };
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


