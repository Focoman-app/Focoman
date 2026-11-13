"use server";

import {
  getLeadsByStudio,
  getLeadById,
  saveStudioLead,
  updateStudioLead,
  getStudioBySlug,
  updateStudio,
  getMembersByStudio,
  getCustomersByStudio,
  saveCustomer,
  updateCustomer,
  saveOrder,
  saveTasks,
} from "@focoman/db";
import {
  StudioLead,
  LeadChannel,
  LeadStage,
  StudioLeadWebhookConfig,
  Order,
  Task,
  ResourceAssignment,
} from "@focoman/types";
import {
  generateOrderIdentifiers,
  generateSixDigitPasskeyPin,
  prefixLetters,
  generateTimestampDigits,
} from "@/lib/invitationPasscode";
import {
  generateResourceSuggestions,
  generateWorkflowTasks,
  getStudioTimestampIST,
  isContactMatch,
} from "@focoman/domain";
import {
  requireVerifiedUser,
  requireStudioMember,
  requireStudioOwner,
} from "@/lib/serverAuth";
import { hasStudioCapability, requireCapability } from "@/lib/entitlementAuth";
import { getFreeWorkflowTaskAssignee } from "@/lib/erpCrewPolicy";

function generateStudioLeadId(studioId: string, now = new Date()): string {
  const studioPrefix = prefixLetters(studioId);
  const { dateStamp, timeStamp } = generateTimestampDigits(now);
  return `LED-${studioPrefix}-${dateStamp}-${timeStamp}`;
}

export async function ensureStudioWebhookConfig(studioSlug: string): Promise<StudioLeadWebhookConfig> {
  const cleanSlug = studioSlug.toLowerCase();
  const studio = await getStudioBySlug(cleanSlug);
  if (studio?.leadWebhookConfig?.webhookKey) {
    return {
      enabled: studio.leadWebhookConfig.enabled !== false,
      ...studio.leadWebhookConfig,
    };
  }

  const defaultKey = `fcm_wh_${cleanSlug}_${Math.random().toString(36).slice(2, 10)}`;
  const config: StudioLeadWebhookConfig = {
    enabled: true,
    webhookKey: defaultKey,
    instagramHandle: studio?.instagram || `@${cleanSlug}`,
    whatsappBusinessPhone: studio?.ownerPhone || "",
    websiteDomain: studio?.website || "",
    autoCaptureWhatsAppUnknownSenders: true,
    autoReplyEnabled: true,
    updatedAt: new Date().toISOString(),
  };

  if (studio) {
    await updateStudio(cleanSlug, { leadWebhookConfig: config });
  }
  return config;
}

export async function getStudioLeadsAction(studioSlug: string, idToken?: string): Promise<{
  leads: StudioLead[];
  webhookConfig: StudioLeadWebhookConfig;
}> {
  const cleanSlug = studioSlug.toLowerCase();
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioMember(decoded.uid, cleanSlug);

  const [existingLeads, webhookConfig] = await Promise.all([
    getLeadsByStudio(cleanSlug),
    ensureStudioWebhookConfig(cleanSlug),
  ]);

  existingLeads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { leads: existingLeads, webhookConfig };
}

export async function saveStudioLeadWebhookConfigAction(params: {
  studioId: string;
  config: Partial<StudioLeadWebhookConfig>;
  idToken?: string;
}): Promise<{ success: boolean; webhookConfig?: StudioLeadWebhookConfig; error?: string }> {
  try {
    const cleanSlug = params.studioId.toLowerCase();
    const decoded = await requireVerifiedUser(params.idToken);
    await requireStudioOwner(decoded.uid, cleanSlug);
    await requireCapability(cleanSlug, "BUSINESS_REPORTS");

    const existing = await ensureStudioWebhookConfig(cleanSlug);
    const updatedConfig: StudioLeadWebhookConfig = {
      ...existing,
      ...params.config,
      webhookKey: params.config.webhookKey?.trim() || existing.webhookKey,
      updatedAt: new Date().toISOString(),
    };

    await updateStudio(cleanSlug, { leadWebhookConfig: updatedConfig });
    return { success: true, webhookConfig: updatedConfig };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save webhook configuration",
    };
  }
}

export async function createStudioLeadAction(params: {
  studioId: string;
  name: string;
  phone?: string;
  email?: string;
  instagramHandle?: string;
  channel: LeadChannel;
  eventType?: string;
  eventDate?: string;
  location?: string;
  estimatedBudget?: number;
  message?: string;
  idToken?: string;
}): Promise<{ success: boolean; lead?: StudioLead; error?: string }> {
  try {
    const cleanSlug = params.studioId.toLowerCase();
    const decoded = await requireVerifiedUser(params.idToken);
    await requireStudioMember(decoded.uid, cleanSlug);
    if (["INSTAGRAM", "WHATSAPP", "WEBSITE"].includes(params.channel)) {
      await requireCapability(cleanSlug, "BUSINESS_REPORTS");
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const lead: StudioLead = {
      id: generateStudioLeadId(cleanSlug, nowDate),
      studioId: cleanSlug,
      name: params.name.trim() || "Prospective Client",
      ...(params.phone?.trim() ? { phone: params.phone.trim() } : {}),
      ...(params.email?.trim() ? { email: params.email.trim() } : {}),
      ...(params.instagramHandle?.trim() ? { instagramHandle: params.instagramHandle.trim() } : {}),
      channel: params.channel,
      stage: "NEW",
      ...(params.eventType?.trim() ? { eventType: params.eventType.trim() } : {}),
      ...(params.eventDate?.trim() ? { eventDate: params.eventDate.trim() } : {}),
      ...(params.location?.trim() ? { location: params.location.trim() } : {}),
      ...(typeof params.estimatedBudget === "number" && params.estimatedBudget > 0
        ? { estimatedBudget: params.estimatedBudget }
        : {}),
      ...(params.message?.trim() ? { message: params.message.trim() } : {}),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await saveStudioLead(lead);
    return { success: true, lead: saved };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create lead",
    };
  }
}

export async function updateStudioLeadAction(params: {
  leadId: string;
  studioId: string;
  updates: {
    name?: string;
    phone?: string;
    email?: string;
    instagramHandle?: string;
    stage?: LeadStage;
    eventType?: string;
    eventDate?: string;
    location?: string;
    estimatedBudget?: number;
    notes?: string;
    isDeleted?: boolean;
  };
  idToken?: string;
}): Promise<{ success: boolean; lead?: StudioLead; error?: string }> {
  try {
    const cleanSlug = params.studioId.toLowerCase();
    const decoded = await requireVerifiedUser(params.idToken);
    await requireStudioMember(decoded.uid, cleanSlug);

    const existing = await getLeadById(params.leadId);
    if (!existing || existing.studioId !== cleanSlug) {
      return { success: false, error: "Lead not found in this studio." };
    }

    const updated = await updateStudioLead(params.leadId, params.updates);
    if (!updated) {
      return { success: false, error: "Failed to update lead." };
    }

    return { success: true, lead: updated };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update lead",
    };
  }
}

export async function convertLeadToOrderAction(params: {
  leadId: string;
  studioId: string;
  eventType: string;
  eventDate: string;
  eventLocation?: string;
  confirmedPrice: number;
  advanceAmount: number;
  services?: string[];
  idToken?: string;
}): Promise<{ success: boolean; order?: Order; lead?: StudioLead; error?: string }> {
  try {
    const cleanSlug = params.studioId.toLowerCase();
    const decoded = await requireVerifiedUser(params.idToken);
    await requireStudioOwner(decoded.uid, cleanSlug);

    const lead = await getLeadById(params.leadId);
    if (!lead || lead.studioId !== cleanSlug) {
      return { success: false, error: "Lead not found in this studio." };
    }
    if (lead.stage === "CONVERTED" && lead.convertedOrderId) {
      return {
        success: false,
        error: `This lead was already converted to Order ${lead.convertedOrderId}.`,
      };
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const { orderId, customerId } = generateOrderIdentifiers(cleanSlug, nowDate);
    const passkeyPin = generateSixDigitPasskeyPin();
    const studioPrefix = prefixLetters(cleanSlug);

    const [studioMembers, existingCustomers, studio, hasErp] = await Promise.all([
      getMembersByStudio(cleanSlug),
      getCustomersByStudio(cleanSlug),
      getStudioBySlug(cleanSlug),
      hasStudioCapability(cleanSlug, "STUDIO_ERP"),
    ]);

    const customerPhone = lead.phone?.trim() || undefined;
    const customerEmail = lead.email?.trim() || undefined;
    const matchedCustomer = existingCustomers.find((c) =>
      isContactMatch(
        { phone: customerPhone, email: customerEmail },
        { phone: c.phone, email: c.email }
      )
    );
    const effectiveCustomerId = matchedCustomer ? matchedCustomer.id : customerId;

    const servicesList =
      params.services && params.services.length > 0
        ? params.services
        : [params.eventType || lead.eventType || "Photography"];

    const eventDateVal = params.eventDate || lead.eventDate || now.split("T")[0];
    const locationVal = params.eventLocation || lead.location || studio?.city || "TBD";

    const suggestions = hasErp
      ? generateResourceSuggestions(
          eventDateVal,
          ["PHOTOGRAPHY", "VIDEOGRAPHY", "ALBUM_DESIGN", "PHOTO_EDITING"],
          studioMembers,
          []
        )
      : [];

    const autoAssignEnabled = hasErp && studio?.features?.autoAssignCrew !== false;
    const assignedResources: ResourceAssignment[] = [];
    if (autoAssignEnabled) {
      const usedMembers = new Set<string>();
      for (const s of suggestions) {
        if (s.availableOnDate && !usedMembers.has(s.memberId) && assignedResources.length < 2) {
          usedMembers.add(s.memberId);
          assignedResources.push({
            memberId: s.memberId,
            memberName: s.memberName,
            skill: s.skill,
            availabilityConfirmed: null,
          });
        }
      }
    }

    const confirmedPrice = Math.max(0, Number(params.confirmedPrice) || lead.estimatedBudget || 0);
    const advanceAmount = Math.max(0, Math.min(confirmedPrice, Number(params.advanceAmount) || 0));
    const actorName = decoded.name || decoded.email || "Studio Owner";
    const istTime = getStudioTimestampIST(nowDate);

    const newOrder: Order = {
      id: orderId,
      studioId: cleanSlug,
      orderNumber: orderId,
      customer: {
        id: effectiveCustomerId,
        name: lead.name,
        ...(customerPhone ? { phone: customerPhone } : {}),
        ...(customerEmail ? { email: customerEmail } : {}),
      },
      eventType: params.eventType || lead.eventType || "Wedding Photography",
      eventDate: eventDateVal,
      eventLocation: locationVal,
      locationInfo: { address: locationVal },
      services: servicesList,
      packages: [],
      pricing: {
        estimatedPrice: lead.estimatedBudget || confirmedPrice,
        finalConfirmedPrice: confirmedPrice,
        advanceAmount,
        advanceDate: now.split("T")[0],
        installments: [],
        remainingAmount: Math.max(0, confirmedPrice - advanceAmount),
      },
      paymentStatus:
        confirmedPrice <= advanceAmount && confirmedPrice > 0
          ? "PAID"
          : advanceAmount > 0
          ? "ADVANCE_RECEIVED"
          : "PENDING",
      orderStatus: "AWAITING_EVENT",
      assignedResources,
      resourceSuggestions: suggestions,
      trackingPasskey: orderId,
      passkeyPin,
      isDeleted: false,
      createdBy: actorName,
      createdByRole: "Owner",
      auditLog: [
        {
          id: `audit_${Date.now()}_lead`,
          timestamp: istTime,
          actorName,
          actorRole: "Owner",
          action: "Lead Converted to Order",
          details: `Converted ${lead.channel} lead (${lead.id}) for ${lead.name} into confirmed Order ${orderId}.`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const studioOwner = getFreeWorkflowTaskAssignee(hasErp, {
      memberId: studio?.ownerId || decoded.uid,
      memberName: studio?.ownerName || decoded.name || decoded.email || "Studio Owner",
    });
    const workflowTasks: Task[] = generateWorkflowTasks(orderId, cleanSlug, newOrder.services).map((t, idx) => {
      const { dateStamp, timeStamp } = generateTimestampDigits(nowDate);
      const seqSuffix = String(idx + 1).padStart(2, "0");
      const matchedCrew =
        autoAssignEnabled && assignedResources.length > 0
          ? assignedResources.find((r) => r.skill.includes(t.serviceCategory)) || assignedResources[0]
          : undefined;
      return {
        ...t,
        id: `TSK-${studioPrefix}-${dateStamp}-${timeStamp}-${seqSuffix}`,
        assignedMemberId: matchedCrew?.memberId || studioOwner?.memberId || t.assignedMemberId || "",
        assignedMemberName: matchedCrew?.memberName || studioOwner?.memberName || t.assignedMemberName || "Unassigned",
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
    });

    const customerPersistence = matchedCustomer
      ? updateCustomer(matchedCustomer.id, {
          ...(customerPhone && !matchedCustomer.phone ? { phone: customerPhone } : {}),
          ...(customerEmail && !matchedCustomer.email ? { email: customerEmail } : {}),
          ...(locationVal && !matchedCustomer.address ? { address: locationVal } : {}),
        })
      : saveCustomer({
          id: customerId,
          studioId: cleanSlug,
          name: lead.name,
          ...(customerPhone ? { phone: customerPhone } : {}),
          ...(customerEmail ? { email: customerEmail } : {}),
          ...(locationVal ? { address: locationVal } : {}),
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        });

    const [, , , updatedLead] = await Promise.all([
      saveOrder(newOrder),
      saveTasks(workflowTasks),
      customerPersistence,
      updateStudioLead(lead.id, {
        stage: "CONVERTED",
        convertedOrderId: orderId,
        convertedCustomerId: effectiveCustomerId,
        eventType: newOrder.eventType,
        eventDate: newOrder.eventDate,
        location: locationVal,
        estimatedBudget: confirmedPrice,
      }),
    ]);

    return {
      success: true,
      order: newOrder,
      lead: updatedLead || undefined,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to convert lead to order",
    };
  }
}
