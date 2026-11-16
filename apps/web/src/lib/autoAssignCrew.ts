import type {
  Order,
  ResourceAssignment,
  Studio,
  StudioMember,
  Task,
} from "@focoman/types";
import { PRESET_SKILLS, isSkillRelatedToService } from "./crewSkills";

export interface AutoAssignRosterMember {
  id: string;
  name: string;
  skills: string[];
  isOwner: boolean;
}

function getOrderAssignedDates(order: Order, skillName?: string): string[] {
  if (
    skillName &&
    order.serviceSchedules &&
    Array.isArray(order.serviceSchedules[skillName]) &&
    order.serviceSchedules[skillName].length > 0
  ) {
    return order.serviceSchedules[skillName].map((d) => d.trim()).filter(Boolean);
  }
  const dates =
    Array.isArray(order.eventDates) && order.eventDates.length > 0
      ? order.eventDates
      : order.eventDate
      ? [order.eventDate]
      : [];
  return dates.map((d) => d.trim()).filter(Boolean);
}

export function isMemberBusyOnDates(
  memberId: string,
  targetDates: string[],
  existingOrders: Order[]
): boolean {
  const targetSet = new Set(targetDates.map((d) => d.trim()).filter(Boolean));
  if (targetSet.size === 0) return false;

  for (const order of existingOrders) {
    if (order.isDeleted || order.orderStatus === "CANCELLED") continue;
    const assignments = (order.assignedResources || []).filter(
      (r) => r.memberId === memberId
    );
    if (assignments.length === 0) continue;

    for (const assignment of assignments) {
      const assignedDates = getOrderAssignedDates(order, assignment.skill);
      if (assignedDates.some((d) => targetSet.has(d))) {
        return true;
      }
    }
  }

  return false;
}

function getMemberActiveOrderLoad(memberId: string, existingOrders: Order[]): number {
  let count = 0;
  for (const order of existingOrders) {
    if (
      order.isDeleted ||
      order.orderStatus === "CANCELLED" ||
      order.orderStatus === "COMPLETED"
    ) {
      continue;
    }
    if ((order.assignedResources || []).some((r) => r.memberId === memberId)) {
      count += 1;
    }
  }
  return count;
}

export function buildAutoAssignRoster(
  studio: Studio | null | undefined,
  studioSlug: string,
  studioMembers: StudioMember[]
): AutoAssignRosterMember[] {
  const ownerId = `owner-${studio?.id || studioSlug.toLowerCase()}`;
  const ownerEntry: AutoAssignRosterMember = {
    id: ownerId,
    name: studio?.ownerName || "Studio Owner",
    skills: [...PRESET_SKILLS],
    isOwner: true,
  };

  const activeCrew: AutoAssignRosterMember[] = studioMembers
    .filter((m) => !m.isDeleted && (m.status === "ACTIVE" || !m.status))
    .filter((m) => m.id !== ownerId && m.role !== "STUDIO_OWNER")
    .map((m) => ({
      id: m.id,
      name: m.name,
      skills: Array.isArray(m.skills) ? m.skills : [],
      isOwner: false,
    }));

  return [ownerEntry, ...activeCrew];
}

export function computeAutoAssignedResources(params: {
  studio: Studio | null | undefined;
  studioSlug: string;
  services: string[];
  eventDates: string[];
  serviceSchedules?: Record<string, string[]>;
  studioMembers: StudioMember[];
  existingOrders: Order[];
}): ResourceAssignment[] {
  const {
    studio,
    studioSlug,
    services,
    eventDates,
    serviceSchedules,
    studioMembers,
    existingOrders,
  } = params;

  const roster = buildAutoAssignRoster(studio, studioSlug, studioMembers);
  const rosterById = new Map(roster.map((m) => [m.id, m]));
  const mapping = studio?.serviceCrewMapping || {};
  const assignedResources: ResourceAssignment[] = [];
  const seenKeys = new Set<string>();

  for (const svcName of services) {
    const cleanSvc = svcName.trim();
    if (!cleanSvc) continue;

    const targetDates =
      serviceSchedules?.[cleanSvc] && serviceSchedules[cleanSvc].length > 0
        ? serviceSchedules[cleanSvc]
        : eventDates;

    const mappedIds = Array.isArray(mapping[cleanSvc]) ? mapping[cleanSvc] : [];

    if (mappedIds.length > 0) {
      for (const memberId of mappedIds) {
        const member = rosterById.get(memberId);
        if (!member) continue;
        if (isMemberBusyOnDates(member.id, targetDates, existingOrders)) continue;

        const key = `${member.id}::${cleanSvc.toLowerCase()}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        assignedResources.push({
          memberId: member.id,
          memberName: member.name,
          skill: cleanSvc,
          availabilityConfirmed: null,
        });
      }
      continue;
    }

    // Fallback: pick an available skill-matched active crew member (non-owner first) with lowest workload
    const availableCandidates = roster
      .filter((m) => !m.isOwner && isSkillRelatedToService(m.skills, cleanSvc))
      .filter((m) => !isMemberBusyOnDates(m.id, targetDates, existingOrders))
      .sort(
        (a, b) =>
          getMemberActiveOrderLoad(a.id, existingOrders) -
          getMemberActiveOrderLoad(b.id, existingOrders)
      );

    const bestMatch = availableCandidates[0];
    if (bestMatch) {
      const key = `${bestMatch.id}::${cleanSvc.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        assignedResources.push({
          memberId: bestMatch.id,
          memberName: bestMatch.name,
          skill: cleanSvc,
          availabilityConfirmed: null,
        });
      }
    }
  }

  return assignedResources;
}

export function findWorkflowTaskAssignee(
  taskCategory: Task["serviceCategory"],
  assignedResources: ResourceAssignment[],
  studioMembers: StudioMember[]
): ResourceAssignment | undefined {
  if (!assignedResources || assignedResources.length === 0) return undefined;

  const memberSkillsById = new Map<string, string[]>(
    studioMembers.map((m) => [m.id, Array.isArray(m.skills) ? m.skills : []])
  );

  const matchBySkillText = (text: string): boolean => {
    const lower = text.toLowerCase();
    if (taskCategory === "PHOTOGRAPHY") {
      return (
        lower.includes("photo") ||
        lower.includes("candid") ||
        lower.includes("drone") ||
        lower.includes("shoot")
      );
    }
    if (taskCategory === "VIDEOGRAPHY") {
      return (
        lower.includes("video") ||
        lower.includes("cinema") ||
        lower.includes("teaser") ||
        lower.includes("reel") ||
        lower.includes("drone") ||
        lower.includes("film")
      );
    }
    if (taskCategory === "ALBUM") {
      return (
        lower.includes("album") ||
        lower.includes("book") ||
        lower.includes("print") ||
        lower.includes("design")
      );
    }
    return false;
  };

  const exactMatch = assignedResources.find((res) => {
    if (matchBySkillText(res.skill)) return true;
    const memberSkills = memberSkillsById.get(res.memberId) || [];
    if (taskCategory === "PHOTOGRAPHY") {
      return memberSkills.some(
        (s) => s === "PHOTOGRAPHY" || s === "PHOTO_EDITING" || s === "DRONE_OPERATOR"
      );
    }
    if (taskCategory === "VIDEOGRAPHY") {
      return memberSkills.some((s) => s === "VIDEOGRAPHY" || s === "DRONE_OPERATOR");
    }
    if (taskCategory === "ALBUM") {
      return memberSkills.includes("ALBUM_DESIGN");
    }
    return false;
  });

  return exactMatch || assignedResources[0];
}
