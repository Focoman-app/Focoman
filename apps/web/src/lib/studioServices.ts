import { StudioServiceConfig, StudioPackage } from "@focoman/types";

/**
 * Standard industry preset services & deliverables for photography studios.
 * Studio owners can toggle, set base prices, and add custom services.
 */
export const DEFAULT_STUDIO_SERVICES: StudioServiceConfig[] = [
  {
    id: "trad_photo",
    name: "Traditional Photography",
    category: "Photography",
    defaultPrice: 15000,
    isDeliverable: false,
    enabled: true,
  },
  {
    id: "candid_photo",
    name: "Candid Photography",
    category: "Photography",
    defaultPrice: 25000,
    isDeliverable: false,
    enabled: true,
  },
  {
    id: "trad_video",
    name: "Traditional Videography",
    category: "Videography",
    defaultPrice: 18000,
    isDeliverable: false,
    enabled: true,
  },
  {
    id: "cinema_teaser",
    name: "Cinematic Video / Teaser",
    category: "Videography",
    defaultPrice: 30000,
    isDeliverable: false,
    enabled: true,
  },
  {
    id: "drone_aerial",
    name: "Drone Aerial Shoots",
    category: "Aerial & Drone",
    defaultPrice: 12000,
    isDeliverable: false,
    enabled: true,
  },
  {
    id: "pre_wedding",
    name: "Pre-Wedding Photoshoot",
    category: "Shoots & Sessions",
    defaultPrice: 20000,
    isDeliverable: false,
    enabled: true,
  },
  {
    id: "post_wedding",
    name: "Post-Wedding Photoshoot",
    category: "Shoots & Sessions",
    defaultPrice: 15000,
    isDeliverable: false,
    enabled: true,
  },
  {
    id: "album_premium",
    name: "Premium Photobook Album",
    category: "Albums & Deliverables",
    defaultPrice: 15000,
    isDeliverable: true,
    enabled: true,
  },
  {
    id: "raw_pen_drive",
    name: "Raw Footage / Hard Drive",
    category: "Albums & Deliverables",
    defaultPrice: 5000,
    isDeliverable: true,
    enabled: false,
  },
  {
    id: "live_streaming",
    name: "Live Streaming / LED Wall",
    category: "Equipment & Live",
    defaultPrice: 15000,
    isDeliverable: false,
    enabled: false,
  },
];

export interface StarterPackageTemplate {
  name: string;
  description: string;
  services: string[];
  price: number;
  isEnabled: boolean;
}

export const STARTER_STUDIO_COMBOS: StarterPackageTemplate[] = [
  {
    name: "Classic Event Package",
    description: "Essential coverage with Traditional Photography, Traditional Videography, and 40-sheet Photobook Album for ceremonies, family events, and celebrations.",
    services: ["Traditional Photography", "Traditional Videography", "Premium Photobook Album"],
    price: 45000,
    isEnabled: true,
  },
  {
    name: "Premium Cinematic Combo",
    description: "Modern visual experience featuring Candid Photography, Cinematic Video Teaser, Drone coverage, and Photobook.",
    services: ["Candid Photography", "Cinematic Video / Teaser", "Drone Aerial Shoots", "Premium Photobook Album"],
    price: 80000,
    isEnabled: true,
  },
  {
    name: "Grand Complete Wedding Combo",
    description: "Comprehensive all-inclusive wedding production: Pre-Wedding Shoot, Traditional & Candid Photography, Traditional Video, Cinematic Film, Drone Aerials, and Photobook.",
    services: [
      "Traditional Photography",
      "Candid Photography",
      "Traditional Videography",
      "Cinematic Video / Teaser",
      "Drone Aerial Shoots",
      "Pre-Wedding Photoshoot",
      "Premium Photobook Album",
    ],
    price: 130000,
    isEnabled: true,
  },
];

export function getDefaultStudioPackages(studioSlug: string): StudioPackage[] {
  const now = new Date().toISOString();
  return STARTER_STUDIO_COMBOS.map((combo, idx) => ({
    id: `pkg_default_${idx + 1}`,
    studioId: studioSlug.toLowerCase(),
    name: combo.name,
    description: combo.description,
    services: combo.services,
    price: combo.price,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  }));
}
