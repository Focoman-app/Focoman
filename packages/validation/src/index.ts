import { z } from 'zod';

/**
 * Focoman Zod Validation Schemas
 * Source of Truth: Focoman Product Discovery Document
 */

/** Owner-only, whole-service replacement to avoid partial crew saves. */
export const SaveServiceCrewAssignmentsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  serviceName: z.string().trim().min(1, 'Service name is required'),
  assignments: z.array(z.object({
    memberId: z.string().trim().min(1, 'Crew member ID is required'),
    memberName: z.string().trim().min(1, 'Crew member name is required'),
  })).max(30, 'A service can have at most 30 crew members'),
  idToken: z.string().min(1, 'Identity token is required'),
});

export type SaveServiceCrewAssignmentsInput = z.infer<typeof SaveServiceCrewAssignmentsSchema>;

export const CreateOrderSchema = z.object({
  idToken: z.string().min(1, 'Authentication required. No identity token provided.').optional(),
  studioId: z.string().min(1, 'Studio ID is required'),
  customerName: z.string().min(1, 'Customer name is required').refine(
    (val) => (val.match(/[a-zA-Z]/g) || []).length >= 3,
    { message: 'Name must have at least 3 letters.' }
  ),
  customerPhone: z.string().optional().or(z.literal('')),
  customerEmail: z.string().email().optional().or(z.literal('')),
  passkeyPin: z.string().regex(/^\d{6}$/, "Guest access PIN must be exactly 6 digits").optional().or(z.literal('')),
  notifyWhatsApp: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  eventType: z.string().min(1, 'Event type is required'),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Event date must be YYYY-MM-DD'),
  eventLocation: z.string().optional().or(z.literal('')),
  services: z.array(z.string()).min(1, 'At least one service must be selected'),
  packages: z.array(z.string()).optional(),
  estimatedPrice: z.number().nonnegative(),
  finalConfirmedPrice: z.number().nonnegative(),
  advanceAmount: z.number().nonnegative()
}).refine(data => data.advanceAmount <= data.finalConfirmedPrice, {
  message: 'Advance amount cannot exceed the confirmed total price.',
  path: ['advanceAmount']
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const AssignResourceSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
  memberName: z.string().min(1, 'Member name is required'),
  skill: z.string().min(1, 'Skill is required'),
  studioId: z.string().optional(),
  idToken: z.string().optional(),
});

export type AssignResourceInput = z.infer<typeof AssignResourceSchema>;

export const UpdateTaskStatusSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  idToken: z.string().min(1, 'Identity token is required'),
  status: z.enum(['AWAITING_EVENT', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'REWORK', 'COMPLETED']),
  reworkNotes: z.string().optional()
});

export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>;

export const OrderInstallmentSchema = z.object({
  id: z.string(),
  amount: z.number().nonnegative(),
  date: z.string(),
  notes: z.string().optional(),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER']).optional(),
  referenceNumber: z.string().trim().max(200).optional(),
  proofUrl: z.string().url().optional(),
  createdAt: z.string().optional(),
  recordedBy: z.string().optional(),
  recordedByRole: z.string().optional(),
});

export const UpdatePaymentSchema = z.object({
  idToken: z.string().optional(),
  studioId: z.string().optional(),
  orderId: z.string().min(1, 'Order ID is required'),
  finalConfirmedPrice: z.number().nonnegative().optional(),
  advanceAmount: z.number().nonnegative().optional(),
  advanceDate: z.string().optional(),
  installments: z.array(OrderInstallmentSchema).optional(),
  paymentStatus: z.enum([
    'PENDING',
    'PAYMENT_SUBMITTED',
    'PENDING_VERIFICATION',
    'PARTIAL',
    'ADVANCE_RECEIVED',
    'PAID',
    'OVERDUE',
    'PAYMENT_PENDING',
    'PAYMENT_CONFIRMATION_REQUIRED',
    'PAYMENT_COMPLETED'
  ]).optional()
});

export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;

export const UpdateOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  eventType: z.string().min(1).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Event date must be YYYY-MM-DD').optional(),
  eventLocation: z.string().optional(),
  services: z.array(z.string()).min(1).optional(),
  packages: z.array(z.string()).optional(),
  estimatedPrice: z.number().nonnegative().optional(),
  finalConfirmedPrice: z.number().nonnegative().optional(),
  advanceAmount: z.number().nonnegative().optional(),
  paymentStatus: z.enum(['PAYMENT_PENDING', 'PAYMENT_CONFIRMATION_REQUIRED', 'PAYMENT_COMPLETED']).optional(),
  orderStatus: z.enum(['AWAITING_EVENT', 'POST_EVENT_IN_PROGRESS', 'COMPLETED']).optional()
});

export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;

export const CreateTaskSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  title: z.string().min(1, 'Task title is required'),
  serviceCategory: z.enum(['PHOTOGRAPHY', 'VIDEOGRAPHY', 'ALBUM', 'GENERAL']),
  assignedMemberId: z.string().optional(),
  assignedMemberName: z.string().optional(),
  sequenceOrder: z.number().int().positive().optional()
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  title: z.string().min(1).optional(),
  serviceCategory: z.enum(['PHOTOGRAPHY', 'VIDEOGRAPHY', 'ALBUM', 'GENERAL']).optional(),
  assignedMemberId: z.string().optional(),
  assignedMemberName: z.string().optional(),
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'REWORK', 'COMPLETED']).optional(),
  sequenceOrder: z.number().int().positive().optional(),
  reworkNotes: z.string().optional()
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const CreateCustomerSchema = z.object({
  studioId: z.string().min(1, 'Studio ID is required'),
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional()
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional()
});

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export const CreateMemberSchema = z.object({
  studioId: z.string().min(1, 'Studio ID is required'),
  name: z.string().min(1, 'Member name is required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  phone: z.string().optional(),
  claimCode: z.string().regex(/^\d{6}$/, 'Passcode must be exactly 6 digits').optional(),
  skills: z.array(z.string()).min(1, 'At least one skill is required')
});

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  name: z.string().min(1).optional(),
  ownerAssignedName: z.string().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;

export const UpdateStudioSchema = z.object({
  studioId: z.string().min(1, 'Studio ID is required'),
  name: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  ownerPhone: z.string().optional(),
  features: z.object({
    oms: z.boolean().optional(),
    crm: z.boolean().optional(),
    erp: z.boolean().optional(),
    whatsapp: z.boolean().optional()
  }).optional()
});

export type UpdateStudioInput = z.infer<typeof UpdateStudioSchema>;

export const CreatePackageSchema = z.object({
  studioId: z.string().min(1, 'Studio ID is required'),
  name: z.string().min(1, 'Package name is required'),
  description: z.string().optional(),
  services: z.array(z.string()).min(1, 'At least one service is required'),
  price: z.number().nonnegative('Price must be non-negative'),
  isEnabled: z.boolean().default(true),
});

export type CreatePackageInput = z.infer<typeof CreatePackageSchema>;

export const UpdatePackageSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  services: z.array(z.string()).min(1).optional(),
  price: z.number().nonnegative().optional(),
  isEnabled: z.boolean().optional(),
});

export type UpdatePackageInput = z.infer<typeof UpdatePackageSchema>;

export const RecordPaymentSchema = z.object({
  studioId: z.string().min(1, 'Studio ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  orderId: z.string().optional(),
  amount: z.number().positive('Payment amount must be positive'),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'ONLINE_GATEWAY', 'OTHER']),
  proofUrl: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

export const VerifyPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  verified: z.boolean(),
  rejectionReason: z.string().optional(),
});

export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;

export const CancelOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  studioId: z.string().min(1, 'Studio ID is required'),
  cancellationReason: z.string().min(1, 'Cancellation reason is required'),
  refundNotes: z.string().optional(),
});

export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;



