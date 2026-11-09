/**
 * Shared Focoman Constants and System Configuration
 */
import type { CapabilityId, CapabilityMetadata } from '@focoman/types';

export const APP_NAME = 'Focoman';
export const APP_DESCRIPTION = 'Order Management System for Photographic Studios';

export const BOOKING_STATUSES = [
  'BOOKING_REQUEST',
  'OPEN_FOR_NEGOTIATION',
  'AWAITING_PAYMENT',
  'PAYMENT_VERIFICATION',
  'BOOKING_CONFIRMED',
  'CANCELLED',
  'COMPLETED'
] as const;

export const ORDER_STATUSES = ['AWAITING_EVENT', 'POST_EVENT_IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export const TASK_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'REWORK', 'COMPLETED'] as const;

export const PAYMENT_STATUSES = [
  'PENDING',
  'PAYMENT_SUBMITTED',
  'PENDING_VERIFICATION',
  'PARTIAL',
  'ADVANCE_RECEIVED',
  'PAID',
  'OVERDUE'
] as const;

export const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'ONLINE_GATEWAY', 'OTHER'] as const;

export const PAYMENT_VERIFICATION_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'] as const;

export const DEFAULT_SERVICES = [
  { name: 'Traditional Photography', category: 'PHOTOGRAPHY' },
  { name: 'Candid Photography', category: 'PHOTOGRAPHY' },
  { name: 'Videography', category: 'VIDEOGRAPHY' },
  { name: 'Album Design & Printing', category: 'ALBUM' }
] as const;

/**
 * Standard Soft-Delete & Data Retention Configuration
 * Configurable recovery window before permanent administrative cleanup.
 */
export const RECOVERY_WINDOW_DAYS = 14;

/**
 * Flexible Capability-Based Pricing Model Catalog (CHG-027)
 */
export const FREE_CORE_CAPABILITY: CapabilityMetadata = {
  id: 'OMS_BASIC',
  name: 'Basic Order Management',
  category: 'FREE_CORE',
  price: 0,
  description: 'Essential Order Management System for photography and videography studios.',
  valueProp: 'Always ₹0 forever. No order volume caps or retention fees.',
  features: [
    'Basic OMS (Order Management System)',
    'Studio Marketplace',
    'Create, view, and edit confirmed orders',
    'Order workflow status tracker for real-time progress updates',
  ],
  isFreeCore: true,
  studioScoped: true,
};

export const FREE_MARKETPLACE_CAPABILITY: CapabilityMetadata = {
  id: 'MARKETPLACE',
  name: 'Studio Marketplace',
  category: 'STUDIO_MARKETPLACE',
  price: 0,
  description: 'Public studio showcase profile, service packages, and direct booking inquiries.',
  valueProp: '100% Free for all studios. Get discovered by new clients in your city and receive direct booking inquiries.',
  features: [
    'Public studio showcase page on a unique web URL with portfolio photos',
    'Publish customizable service packages, pricing, and deliverables',
    'Receive direct booking inquiries from prospective clients in your city',
    'Optional price negotiation and custom quote confirmation flow',
    'Strict operational privacy: internal CRM, notes, and finances remain 100% private',
  ],
  isFreeCore: true,
  studioScoped: true,
};

export const PURCHASABLE_CAPABILITIES: CapabilityMetadata[] = [
  {
    id: 'CUSTOMER_CRM',
    name: 'Customer Relations - CRM',
    category: 'CUSTOMER_MANAGEMENT',
    price: 299,
    description: 'Central customer directory, order history, lifetime spend, and anniversary reminders.',
    valueProp: 'Manage client profiles, past shoot history, and repeat booking anniversary reminders.',
    features: [
      'Customer directory with searchable profiles, phone, email, and addresses',
      'Complete customer photoshoot and order history',
      'Cumulative customer spend, advance receipts, and balance due history',
      'Automated wedding anniversary and milestone reminder notifications',
    ],
    studioScoped: true,
  },
  {
    id: 'STUDIO_ERP',
    name: 'Studio Operations - ERP',
    category: 'CREW_MANAGEMENT',
    price: 299,
    description: 'Add photographers and editors, assign shoots, check crew availability, and log expenses and payouts.',
    valueProp: 'Streamline team assignments, calendar availability, and expense payouts based on crew availability.',
    features: [
      'Team directory for photographers, videographers, drone pilots, and editors',
      'Shoot and editing task assignment with availability calendar',
      'Check crew availability when planning upcoming studio work',
      'Shoot day-rates, travel expenses, and crew payment payout logs',
    ],
    studioScoped: true,
  },
  {
    id: 'BUSINESS_REPORTS',
    name: 'Business Reports & Analytics',
    category: 'BUSINESS_REPORTS',
    price: 299,
    description: 'Monthly & yearly revenue charts, pending balance dues tracking, and package profitability insights.',
    valueProp: 'Make more money with clear monthly revenue curves and track pending balances before album release.',
    features: [
      'Monthly and yearly revenue charts and year-over-year growth curves',
      'Pending balance dues pipeline to ensure full payment before album delivery',
      'Most profitable photoshoot package categories breakdown',
      'Shoot-to-delivery turnaround time (TAT) and on-time performance metrics',
    ],
    studioScoped: true,
  },
  {
    id: 'DRIVE_CLIENT_REVIEW',
    name: 'OMS Advanced - Drive Preview & Review',
    category: 'DRIVE_CLIENT_REVIEW',
    price: 299,
    description: 'In-app Google Drive photo previews, client photo selection/rejection, and review comments.',
    valueProp: 'Connect Google Drive so clients can review and select photos inside their private link.',
    features: [
      'Google Drive folder integration linked directly to orders',
      'In-app gallery preview for clients without downloading large RAW files',
      'Clients mark photos as selected or rejected interactively',
      'Direct review comments on photos for the editing team',
      'Review status tracking in production workflow',
    ],
    studioScoped: true,
  },
  {
    id: 'WHATSAPP_NOTIFICATIONS',
    name: 'WhatsApp Notifications - Alerts',
    category: 'WHATSAPP',
    price: 499,
    description: 'Automated WhatsApp alerts for booking confirmations, shoot reminders, and gallery delivery links.',
    valueProp: 'Keep clients and crew informed automatically on WhatsApp at key milestones.',
    features: [
      'Booking and order confirmation alerts sent to clients',
      'Crew shoot reminders, call-times, and venue directions',
      'Selection gallery ready notifications with direct tracking link',
      'Final album delivery and dispatch notifications',
    ],
    studioScoped: true,
  },
  {
    id: 'WHATSAPP_OPERATIONS',
    name: 'WhatsApp Operations & Bot',
    category: 'WHATSAPP',
    price: 999,
    description: 'Interactive WhatsApp Bot for Studio Owners plus all automated notifications.',
    valueProp: 'Manage and query your studio operations directly via WhatsApp chat.',
    includedCapabilities: ['WHATSAPP_NOTIFICATIONS'],
    features: [
      'Includes all automated WhatsApp Notifications & Alerts',
      'Interactive WhatsApp Operations Bot for the verified studio owner',
      'Query active orders, upcoming shoot schedules, and pending tasks via chat',
      'Update operational order progress directly through WhatsApp',
      '499 bot queries included per month with no overage charges',
    ],
    limitations: [
      'Studio Owner access only (restricted from customers and general crew)',
      'Operational usage safeguard: 499 bot messages/interactions per studio per month',
    ],
    studioScoped: true,
  },
];

export const ALL_CAPABILITIES = [FREE_CORE_CAPABILITY, FREE_MARKETPLACE_CAPABILITY, ...PURCHASABLE_CAPABILITIES];

export const WHATSAPP_OPERATIONS_BOT_MONTHLY_LIMIT = 499;

/**
 * Calculates the combined monthly price for a set of selected capabilities.
 * Handles dependencies (e.g., WhatsApp Bot includes Notifications) so customers are never double-charged.
 */
export function calculateMonthlyTotal(selectedCapabilities: CapabilityId[]): number {
  const selectedSet = new Set(selectedCapabilities);
  let total = 0;

  // Customer Relations (CRM) - ₹299
  if (
    selectedSet.has('CUSTOMER_CRM') ||
    selectedSet.has('CUSTOMER_ADVANCED') ||
    selectedSet.has('CUSTOMER_BASIC')
  ) {
    total += 299;
  }

  // Studio Operations - ERP - ₹299
  if (
    selectedSet.has('STUDIO_ERP') ||
    selectedSet.has('CREW_ADVANCED') ||
    selectedSet.has('CREW_BASIC') ||
    selectedSet.has('TEAM_MANAGEMENT') ||
    selectedSet.has('ERP_BASIC')
  ) {
    total += 299;
  }

  // Business Reports & Analytics - ₹299
  if (
    selectedSet.has('BUSINESS_REPORTS') ||
    selectedSet.has('ANALYTICS_BASIC') ||
    selectedSet.has('ANALYTICS_ADVANCED')
  ) {
    total += 299;
  }

  // OMS Advanced (Google Drive Preview & Review) - ₹299
  if (
    selectedSet.has('DRIVE_CLIENT_REVIEW') ||
    selectedSet.has('OMS_ADVANCED') ||
    selectedSet.has('GOOGLE_DRIVE')
  ) {
    total += 299;
  }

  // WhatsApp Category: Bot (₹999) includes Alerts (₹499)
  if (selectedSet.has('WHATSAPP_OPERATIONS') || selectedSet.has('WHATSAPP_BOT')) {
    total += 999;
  } else if (selectedSet.has('WHATSAPP_NOTIFICATIONS') || selectedSet.has('WHATSAPP_ALERTS')) {
    total += 499;
  }

  // Studio Marketplace - Free for everyone (₹0)
  // No subscription charge applied

  return total;
}

/**
 * Returns the complete effective set of capabilities granted to a studio,
 * expanding any parent capability inclusions (e.g. Advanced includes Basic).
 */
export function getEffectiveCapabilities(selectedCapabilities: CapabilityId[] = []): CapabilityId[] {
  const effective = new Set<CapabilityId>();
  
  // Free core and Studio Marketplace are always included for every studio
  effective.add('OMS_BASIC');
  effective.add('OMS_CORE');
  effective.add('MARKETPLACE');
  effective.add('STUDIO_MARKETPLACE');
  effective.add('MARKETPLACE_CONFIGURATION');
  effective.add('MARKETPLACE_PUBLIC');
  effective.add('BOOKING_REQUESTS');
  effective.add('NEGOTIATION');

  for (const capId of selectedCapabilities) {
    effective.add(capId);

    if (capId === 'CUSTOMER_CRM' || capId === 'CUSTOMER_ADVANCED' || capId === 'CUSTOMER_BASIC') {
      effective.add('CUSTOMER_CRM');
      effective.add('CUSTOMER_BASIC');
      effective.add('CUSTOMER_ADVANCED');
    }

    if (capId === 'STUDIO_ERP' || capId === 'CREW_ADVANCED' || capId === 'CREW_BASIC') {
      effective.add('STUDIO_ERP');
      effective.add('CREW_BASIC');
      effective.add('CREW_ADVANCED');
      effective.add('TEAM_MANAGEMENT');
      effective.add('MANUAL_ASSIGNMENT');
      effective.add('ERP_BASIC');
      effective.add('ERP_AVAILABILITY');
      effective.add('ERP_WORKLOAD');
      effective.add('ERP_CONFLICT_DETECTION');
      effective.add('ERP_RESOURCE_SUGGESTION');
      effective.add('ERP_SMART_RESOURCE_AUTOMATION');
    }

    if (capId === 'BUSINESS_REPORTS' || capId === 'ANALYTICS_BASIC' || capId === 'ANALYTICS_ADVANCED') {
      effective.add('BUSINESS_REPORTS');
      effective.add('ANALYTICS_BASIC');
      effective.add('ANALYTICS_ADVANCED');
    }

    if (capId === 'MARKETPLACE' || capId === 'STUDIO_MARKETPLACE' || capId === 'MARKETPLACE_PUBLIC') {
      effective.add('MARKETPLACE');
      effective.add('STUDIO_MARKETPLACE');
      effective.add('MARKETPLACE_CONFIGURATION');
      effective.add('MARKETPLACE_PUBLIC');
      effective.add('BOOKING_REQUESTS');
      effective.add('NEGOTIATION');
    }

    if (capId === 'DRIVE_CLIENT_REVIEW' || capId === 'OMS_ADVANCED' || capId === 'GOOGLE_DRIVE') {
      effective.add('DRIVE_CLIENT_REVIEW');
      effective.add('OMS_ADVANCED');
      effective.add('GOOGLE_DRIVE');
    }

    if (capId === 'WHATSAPP_OPERATIONS' || capId === 'WHATSAPP_BOT') {
      effective.add('WHATSAPP_OPERATIONS');
      effective.add('WHATSAPP_NOTIFICATIONS');
      effective.add('WHATSAPP_BOT');
      effective.add('WHATSAPP_ALERTS');
    }
    if (capId === 'WHATSAPP_NOTIFICATIONS' || capId === 'WHATSAPP_ALERTS') {
      effective.add('WHATSAPP_NOTIFICATIONS');
      effective.add('WHATSAPP_ALERTS');
    }
  }

  return Array.from(effective);
}

/**
 * Pricing and Capability Mapping (Backward Compatibility Mapping)
 */
export const PLAN_PRICES: Record<string, number> = {
  FREE: 0,
  PROFESSIONAL: 999,
  COMPLETE: 1999,
};

export const TRIAL_DURATION_DAYS = 30;

export const PLAN_CAPABILITIES: Record<string, CapabilityId[]> = {
  FREE: ['OMS_BASIC', 'OMS_CORE', 'MARKETPLACE', 'STUDIO_MARKETPLACE'],
  PROFESSIONAL: [
    'OMS_BASIC',
    'OMS_CORE',
    'MARKETPLACE',
    'STUDIO_MARKETPLACE',
    'DRIVE_CLIENT_REVIEW',
    'OMS_ADVANCED',
    'CUSTOMER_CRM',
    'CUSTOMER_BASIC',
    'CUSTOMER_ADVANCED',
    'STUDIO_ERP',
    'CREW_BASIC',
    'CREW_ADVANCED',
    'ANALYTICS_BASIC',
  ],
  COMPLETE: [
    'OMS_BASIC',
    'OMS_CORE',
    'MARKETPLACE',
    'STUDIO_MARKETPLACE',
    'DRIVE_CLIENT_REVIEW',
    'OMS_ADVANCED',
    'CUSTOMER_CRM',
    'CUSTOMER_BASIC',
    'CUSTOMER_ADVANCED',
    'STUDIO_ERP',
    'CREW_BASIC',
    'CREW_ADVANCED',
    'ANALYTICS_BASIC',
    'WHATSAPP_NOTIFICATIONS',
    'WHATSAPP_OPERATIONS',
    'WHATSAPP_BOT',
    'BUSINESS_REPORTS',
    'ANALYTICS_ADVANCED',
  ],
};
