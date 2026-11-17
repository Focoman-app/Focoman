export const PRESET_SKILLS = [
  "PHOTOGRAPHY",
  "VIDEOGRAPHY",
  "PHOTO_EDITING",
  "ALBUM_DESIGN",
  "DRONE_OPERATOR",
] as const;

export const SKILL_LABELS: Record<string, string> = {
  PHOTOGRAPHY: "Photographer",
  VIDEOGRAPHY: "Videographer",
  PHOTO_EDITING: "Photo Editor",
  ALBUM_DESIGN: "Album Designer",
  DRONE_OPERATOR: "Drone Operator",
};

export const SKILL_COLORS: Record<string, string> = {
  PHOTOGRAPHY: "badge-brand-blue",
  VIDEOGRAPHY: "badge-brand-orange",
  PHOTO_EDITING: "badge-brand-purple",
  ALBUM_DESIGN: "badge-brand-blue",
  DRONE_OPERATOR: "badge-brand-purple",
};

export function getSkillLabel(skill: string): string {
  const trimmed = (skill || "").trim();
  if (!trimmed) return "General";
  return SKILL_LABELS[trimmed] || trimmed;
}

export function getSkillBadgeClass(skill: string): string {
  return SKILL_COLORS[skill] || "badge-status-neutral";
}

export function isSkillRelatedToService(
  memberSkills: string[] | undefined,
  serviceName: string,
  serviceCategory?: string
): boolean {
  if (!memberSkills || memberSkills.length === 0) return false;
  const svcText = `${serviceName} ${serviceCategory || ""}`.toLowerCase();

  return memberSkills.some((rawSkill) => {
    const skill = (rawSkill || "").trim();
    if (!skill) return false;
    const skillLower = skill.toLowerCase();
    const labelLower = getSkillLabel(skill).toLowerCase();

    if (
      svcText.includes(skillLower) ||
      svcText.includes(labelLower) ||
      skillLower.includes(serviceName.trim().toLowerCase())
    ) {
      return true;
    }

    const isAlbumDeliverable =
      svcText.includes("album") ||
      svcText.includes("photobook") ||
      svcText.includes("book") ||
      svcText.includes("print");

    if (skill === "DRONE_OPERATOR") {
      return svcText.includes("drone") || svcText.includes("aerial");
    }
    if (skill === "PHOTOGRAPHY") {
      if (isAlbumDeliverable && !svcText.includes("photography") && !svcText.includes("photoshoot")) {
        return false;
      }
      return (
        svcText.includes("photo") ||
        svcText.includes("candid") ||
        svcText.includes("wedding") ||
        svcText.includes("shoot") ||
        svcText.includes("portrait")
      );
    }
    if (skill === "VIDEOGRAPHY") {
      return (
        svcText.includes("video") ||
        svcText.includes("cinemat") ||
        svcText.includes("teaser") ||
        svcText.includes("reel") ||
        svcText.includes("film") ||
        svcText.includes("live") ||
        svcText.includes("stream")
      );
    }
    if (skill === "PHOTO_EDITING") {
      if (isAlbumDeliverable && !svcText.includes("photo edit")) {
        return false;
      }
      return (
        svcText.includes("edit") ||
        svcText.includes("photo") ||
        svcText.includes("retouch") ||
        svcText.includes("color") ||
        svcText.includes("raw")
      );
    }
    if (skill === "ALBUM_DESIGN") {
      return (
        isAlbumDeliverable ||
        svcText.includes("design")
      );
    }

    return false;
  });
}
