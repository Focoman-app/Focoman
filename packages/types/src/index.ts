import type { BillingProfile } from './billing';
export * from './billing';
/**
 * Focoman Shared Domain Types
 * Primary Product Source of Truth: Focoman Product Discovery Document
 */

/**
 * PLAN & ENTITLEMENT TYPES (CHG-027 Capability-Based Pricing Model)
 */
export type PlanType = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'COMPLETE' | 'CUSTOM';

export type CapabilityId =
  // Primary Capability-Based Pricing IDs (CHG-030)
  | 'OMS_BASIC'              // Free Core: Basic Order Management (₹0)
  | 'OMS_ADVANCED'           // OMS Advanced: Google Drive Preview & Review (₹299/mo)
  | 'CUSTOMER_CRM'           // Customer Relations (CRM) (₹299/mo)
  | 'STUDIO_ERP'             // Studio Operations - ERP (₹299/mo)
  | 'WHATSAPP_ALERTS'        // WhatsApp Notifications (Alerts) (₹499/mo)
  | 'WHATSAPP_BOT'           // WhatsApp Operations & Bot (₹999/mo)
  | 'STUDIO_MARKETPLACE'     // Studio Marketplace (₹0 - 100% Free for Everyone)
  | 'BUSINESS_REPORTS'       // Business Reports & Analytics (₹299/mo)
  // Backward compatibility legacy aliases
  | 'CUSTOMER_BASIC'         // Alias to Customer CRM
  | 'CUSTOMER_ADVANCED'      // Alias to Customer CRM
  | 'CREW_BASIC'             // Alias to Studio Operations - ERP
  | 'CREW_ADVANCED'          // Alias to Studio Operations - ERP
  | 'MARKETPLACE'            // Alias to Studio Marketplace
  | 'DRIVE_CLIENT_REVIEW'    // Alias to OMS Advanced
  | 'WHATSAPP_NOTIFICATIONS' // Alias to WhatsApp Alerts
  | 'WHATSAPP_OPERATIONS'    // Alias to WhatsApp Operations & Bot
  | 'OMS_CORE'
  | 'TEAM_MANAGEMENT'
  | 'MANUAL_ASSIGNMENT'
  | 'MARKETPLACE_CONFIGURATION'
  | 'MARKETPLACE_PUBLIC'
  | 'BOOKING_REQUESTS'
  | 'NEGOTIATION'
  | 'PAYMENT_RECORDING'
  | 'PAYMENT_VERIFICATION'
  | 'ERP_BASIC'
  | 'ERP_AVAILABILITY'
  | 'ERP_WORKLOAD'
  | 'ERP_CONFLICT_DETECTION'
  | 'ERP_RESOURCE_SUGGESTION'
  | 'ERP_SMART_RESOURCE_AUTOMATION'
  | 'GOOGLE_CALENDAR'
  | 'GOOGLE_DRIVE'
  | 'AUTOMATION_BASIC'
  | 'AUTOMATION_ADVANCED'
  | 'ANALYTICS_BASIC'
  | 'ANALYTICS_ADVANCED'
  | 'MULTI_STUDIO'
  | 'ADVANCED_INTEGRATIONS';

export interface CapabilityMetadata {
  id: CapabilityId;
  name: string;
  category:
    | 'FREE_CORE'
    | 'CUSTOMER_MANAGEMENT'
    | 'CREW_MANAGEMENT'
    | 'STUDIO_MARKETPLACE'
    | 'DRIVE_CLIENT_REVIEW'
    | 'WHATSAPP'
    | 'BUSINESS_REPORTS';
  price: number;
  description: string;
  valueProp: string;
  includedCapabilities?: CapabilityId[];
  dependencies?: CapabilityId[];
  features: string[];
  limitations?: string[];
  isFreeCore?: boolean;
  studioScoped: boolean;
}

export interface StudioPlan {
  plan?: PlanType;
  selectedCapabilities: CapabilityId[];
  isTrial?: boolean;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  updatedAt: string;
}


export type BookingStatus =
  | 'BOOKING_REQUEST'
  | 'OPEN_FOR_NEGOTIATION'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_VERIFICATION'
  | 'BOOKING_CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED';

export type OrderStatus = 'AWAITING_EVENT' | 'POST_EVENT_IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type TaskStatus = 'AWAITING_EVENT' | 'ASSIGNED' | 'IN_PROGRESS' | 'REVIEW' | 'REWORK' | 'COMPLETED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAYMENT_SUBMITTED'
  | 'PENDING_VERIFICATION'
  | 'PARTIAL'
  | 'ADVANCE_RECEIVED'
  | 'PAID'
  | 'OVERDUE';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY' | 'OTHER';

export type PaymentVerificationStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export interface SoftDeletable {
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface StudioPackage extends SoftDeletable {
  id: string;
  studioId: string;
  name: string;
  description?: string;
  services: string[]; // Category or service names
  price: number;
  isNegotiable: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProof {
  proofUrl?: string;
  referenceNumber?: string;
  notes?: string;
  uploadedAt: string;
}

export interface PaymentRecord extends SoftDeletable {
  id: string;
  orderId?: string;
  bookingRequestId?: string;
  studioId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  verificationStatus: PaymentVerificationStatus;
  proof?: PaymentProof;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventLocationInfo {
  address: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface PreflightConflictReport {
  hasConflicts: boolean;
  eventDateConflicts: {
    orderId: string;
    orderNumber: string;
    eventType: string;
  }[];
  resourceConflicts: {
    memberId: string;
    memberName: string;
    role: string;
    conflictingOrderId: string;
  }[];
  warnings: string[];
  suggestions: string[];
  evaluatedAt: string;
}

export interface ResourceSuggestion {
  memberId: string;
  memberName: string;
  skill: string;
  matchScore: number;
  matchReason: string;
  availableOnDate: boolean;
  currentWorkload: number; // Number of assigned active tasks
  status: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
}

export interface BookingRequest extends SoftDeletable {
  id: string;
  studioId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  packageId?: string;
  packageName?: string;
  eventType: string;
  eventDate: string; // YYYY-MM-DD
  location: EventLocationInfo;
  notes?: string;
  originalPrice: number;
  negotiatedPrice?: number;
  agreedPrice: number;
  advanceRequested: number;
  isNegotiable: boolean;
  bookingStatus: BookingStatus;
  orderId?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationInfo {
  cancellationReason: string;
  cancelledBy: string;
  cancelledAt: string;
  refundNotes?: string;
}

export interface CustomerOrderView {
  id: string;
  orderNumber: string;
  studioName: string;
  studioId: string;
  eventType: string;
  eventDate: string;
  eventLocation?: string;
  services: string[];
  totalAmount: number;
  advanceAmount: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  bookingStatus?: BookingStatus;
  trackingPasskey: string;
  passkeyPin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderCollaborator {
  email: string;
  role: "VIEWER" | "EDITOR"; // "can view" | "can edit"
  addedAt: string;
}

export interface StudioBillingProfile {
  issuerType?: 'STUDIO' | 'INDIVIDUAL';
  issuerName?: string;
  showLogo?: boolean;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  bankDetails?: string;
  upiId?: string;
  authorizedSignatory?: string;
  footerNotes?: string;
}

export interface OrderDriveDeliverable {
  id: string;
  title: string;
  category: 'FOLDER' | 'IMAGE' | 'VIDEO' | 'PDF' | 'OTHER';
  driveUrl: string;
  driveId?: string;
  notes?: string;
  /** The task this client review may advance. Deliberately absent for ordinary delivery links. */
  linkedTaskId?: string;
  reviewPurpose?: 'PHOTO_SELECTION' | 'FINAL_PROOF';
  /** A real-world handoff is recorded by staff; no Drive URL is fabricated for it. */
  offlineHandoffConfirmedAt?: string;
  offlineHandoffConfirmedBy?: string;
  clientApproved?: boolean;
  clientFeedback?: string;
  selectedPhotos?: string[];
  clientReviewedAt?: string;
  addedAt: string;
  addedBy?: string;
}

export interface CustomerTrackingView {
  order: {
    id: string;
    studioId?: string;
    studioOwnerId?: string;
    studioOwnerEmail?: string;
    orderNumber: string;
    bookingRequestId?: string;
    trackingPasskey: string;
    passkeyPin?: string;
    studioName: string;
    studioLogoUrl?: string;
    studioCity?: string;
    studioPhone?: string;
    hasErp?: boolean;
    studioBillingProfile?: StudioBillingProfile;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerUid?: string;
    collaborators?: OrderCollaborator[];
    eventType: string;
    eventDate: string;
    eventLocation?: string;
    callTime?: string;
    services: string[];
    packages?: string[];
    totalAmount: number;
    advanceAmount: number;
    advanceDate?: string;
    amountPaid?: number;
    remainingAmount: number;
    installments?: OrderInstallment[];
    driveDeliverables?: OrderDriveDeliverable[];
    paymentStatus: PaymentStatus;
    orderStatus: OrderStatus;
    staffEmails?: string[];
    staffUids?: string[];
    isHeadless?: boolean;
    studioStatus?: string;
    createdAt?: string;
  };
  tasks: Array<{
    title: string;
    serviceCategory: string;
    status: TaskStatus;
    sequenceOrder: number;
  }>;
}

export interface MemberOrderSummary {
  id: string;
  orderNumber: string;
  eventType: string;
  eventDate: string;
  eventLocation?: string;
  callTime?: string;
  services: string[];
  orderStatus: OrderStatus;
}

export interface MemberTaskSummary {
  id: string;
  orderId: string;
  title: string;
  serviceCategory: Task['serviceCategory'];
  status: TaskStatus;
  sequenceOrder: number;
}

export interface MemberWorkView {
  orders: MemberOrderSummary[];
  tasks: MemberTaskSummary[];
}

export interface TemporaryCrewMember {
  id: string;
  name: string;
  createdAt: string;
  lastUsedService?: string;
}

export interface StudioServiceConfig {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
  isDeliverable?: boolean;
  enabled: boolean;
  priceDisabled?: boolean;
}

export type LeadChannel = 'INSTAGRAM' | 'WHATSAPP' | 'WEBSITE' | 'MARKETPLACE' | 'DIRECT';

export type LeadStage = 'NEW' | 'CONTACTED' | 'QUOTED' | 'CONVERTED' | 'ARCHIVED';

export interface StudioLeadWebhookConfig {
  enabled?: boolean;
  webhookKey: string;
  instagramBusinessId?: string;
  instagramHandle?: string;
  whatsappBusinessPhone?: string;
  websiteDomain?: string;
  autoCaptureWhatsAppUnknownSenders?: boolean;
  autoReplyEnabled?: boolean;
  updatedAt?: string;
}

export interface StudioLead extends SoftDeletable {
  id: string;
  studioId: string;
  bookingRequestId?: string;
  name: string;
  phone?: string;
  email?: string;
  instagramHandle?: string;
  channel: LeadChannel;
  stage: LeadStage;
  eventType?: string;
  eventDate?: string;
  location?: string;
  estimatedBudget?: number;
  message?: string;
  notes?: string;
  convertedOrderId?: string;
  convertedCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Studio extends SoftDeletable {
  issuedBillingProfile?: BillingProfile;
  id: string;
  name: string;
  logoUrl?: string;
  // Plan information (CHG-026)
  planInfo?: StudioPlan;

  city: string;
  website?: string;
  instagram?: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  temporaryCrew?: TemporaryCrewMember[];
  whatsappConfig?: Record<string, boolean>;
  leadWebhookConfig?: StudioLeadWebhookConfig;
  configuredServices?: StudioServiceConfig[];
  features?: {
    oms: boolean;
    crm: boolean;
    erp: boolean;
    whatsapp: boolean;
    marketplace: boolean;
    reports?: boolean;
    driveReview?: boolean;
    basicDashboard?: boolean;
    autoAssignCrew?: boolean;
  };
  billingProfile?: StudioBillingProfile;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceProfile extends SoftDeletable {
  id: string; // Typically matches studioId
  studioId: string;
  name: string;
  slug: string;
  city: string;
  description?: string;
  logoUrl?: string;
  tags: string[]; // e.g. ['WEDDING', 'PORTRAIT', 'CORPORATE']
  coverImageUrl?: string;
  isVisible: boolean;
  verifiedMetrics: {
    onTimeDeliveryPercentage: number;
    completedOrdersCount: number;
    lastCalculatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StudioMember extends SoftDeletable {
  id: string;
  studioId: string;
  name: string;
  ownerAssignedName?: string; // Original nickname / name provided by owner at invite creation
  email: string;
  phone?: string;
  skills: string[]; // e.g. ['PHOTOGRAPHY', 'VIDEOGRAPHY', 'PHOTO_EDITING', 'ALBUM_DESIGN']
  role?: 'STUDIO_OWNER' | 'STUDIO_MEMBER';
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface StudioMembership extends SoftDeletable {
  id: string; // composite: {studioId}_{uid}
  studioId: string;
  studioName: string;
  uid: string;
  role: 'STUDIO_OWNER' | 'STUDIO_MEMBER';
  skills?: string[];
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: string;
  updatedAt: string;
}

export interface StudioInvitation extends SoftDeletable {
  id: string; // unique single-use invite code, e.g. INV-FOC-RAH-1234
  studioId: string;
  studioName: string;
  email?: string;
  phone?: string;
  name?: string;
  skills: string[];
  claimCode?: string;
  claimCodeSalt?: string;
  claimCodeHash?: string;
  failedClaimAttempts?: number;
  claimLocked?: boolean;
  claimLinkTokenHash?: string;
  role: 'STUDIO_MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  invitedByUid: string;
  createdAt: string;
  acceptedAt?: string;
  acceptedByUid?: string;
}

export interface StudioInvitationSummary {
  id: string;
  studioId: string;
  studioName: string;
  email?: string;
  phone?: string;
  name?: string;
  skills: string[];
  role: 'STUDIO_MEMBER';
  status: StudioInvitation['status'];
  requiresPasscode: boolean;
  claimCode?: string;
  claimLocked?: boolean;
  createdAt: string;
  acceptedAt?: string;
}

export interface Customer extends SoftDeletable {
  id: string;
  studioId: string;
  name: string;
  phone?: string;
  email?: string;
  uid?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  studioId: string;
  name: string;
  category: 'PHOTOGRAPHY' | 'VIDEOGRAPHY' | 'ALBUM' | 'GENERAL';
  defaultPrice: number;
}

export interface Package {
  id: string;
  studioId: string;
  name: string;
  serviceIds: string[];
  packagePrice: number;
}

export interface ResourceAssignment {
  memberId: string;
  memberName: string;
  skill: string;
  callTime?: string;
  venueNotes?: string;
  availabilityConfirmed: boolean | null; // null = pending, true = confirmed, false = rejected
}

export interface OrderInstallment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  method?: PaymentMethod;
  referenceNumber?: string;
  proofUrl?: string;
  createdAt?: string;
  recordedBy?: string;
  recordedByRole?: string;
}

export interface OrderPricing {
  estimatedPrice: number;
  finalConfirmedPrice: number;
  advanceAmount: number;
  advanceDate?: string;
  remainingAmount: number;
  previousAdvanceAmount?: number;
  installments?: OrderInstallment[];
}

export interface OrderAuditEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: 'Owner' | 'Member' | 'Customer' | 'System';
  action: string;
  details: string;
}

export interface Order extends SoftDeletable {
  id: string;
  studioId: string;
  orderNumber: string; // e.g. ORD-1024
  bookingRequestId?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    uid?: string;
  };
  eventType: string;
  eventDate: string; // YYYY-MM-DD
  eventLocation?: string;
  callTime?: string;
  locationInfo?: EventLocationInfo;
  services: string[];
  packages: string[];
  pricing: OrderPricing;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  bookingStatus?: BookingStatus;
  assignedResources: ResourceAssignment[];
  resourceSuggestions?: ResourceSuggestion[];
  preflightReport?: PreflightConflictReport;
  cancellationInfo?: CancellationInfo;
  trackingPasskey: string;
  passkeyPin?: string;
  isHeadless?: boolean;
  studioStatus?: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  archivedStudioId?: string;
  notifyWhatsApp?: boolean;
  notifySms?: boolean;
  notifyEmail?: boolean;
  collaborators?: OrderCollaborator[];
  driveDeliverables?: OrderDriveDeliverable[];
  createdBy?: string;
  createdByRole?: string;
  updatedBy?: string;
  updatedByRole?: string;
  auditLog?: OrderAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Task extends SoftDeletable {
  id: string;
  orderId: string;
  studioId: string;
  title: string;
  serviceCategory: 'PHOTOGRAPHY' | 'VIDEOGRAPHY' | 'ALBUM' | 'GENERAL';
  assignedMemberId: string;
  assignedMemberName: string;
  status: TaskStatus;
  sequenceOrder: number;
  reworkNotes?: string;
  createdAt: string;
  updatedAt: string;
}

