"use server";

import type {
  CustomerTrackingView,
  Order,
  OrderCollaborator,
  OrderDriveDeliverable,
  OrderStatus,
  Task,
} from "@focoman/types";
import {
  cancelOrderCore,
  createOrderCore,
  deleteOrderCore,
  getDeletedStudioOrdersCore,
  getOrderCore,
  getOrderTasksCore,
  getStudioOrdersCore,
  restoreOrderCore,
  updateOrderCore,
} from "./orders/orderCrudOperations";
import {
  createTaskCore,
  deleteTaskCore,
  restoreTaskCore,
  updateTaskCore,
  updateTaskStatusCore,
} from "./orders/orderTaskOperations";
import {
  sendManualPaymentReminderCore,
  updatePaymentStatusCore,
} from "./orders/orderPaymentOperations";
import {
  assignResourceCore,
  assignTaskCrewCore,
  checkIsStudioStaffCore,
  confirmResourceAvailabilityCore,
} from "./orders/orderCrewOperations";
import {
  getMySyncedOrdersCore,
  getOrderByPasskeyCore,
  submitCustomerDeliverableReviewCore,
  syncOrderToAccountCore,
  updateOrderCollaboratorsCore,
  updateOrderDriveDeliverablesCore,
} from "./orders/orderCustomerOperations";

/**
 * Server Actions for Order Lifecycle, Tasks & Post-Event Production Pipeline (OMS)
 * Delegates to domain-grouped modules in ./orders/* while preserving all Server Action exports.
 */

export async function createOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  tasks?: Task[];
  error?: string;
}> {
  return createOrderCore(rawInput);
}

export async function getStudioOrdersAction(
  studioSlug: string,
  idToken: string
): Promise<Order[]> {
  return getStudioOrdersCore(studioSlug, idToken);
}

export async function getDeletedStudioOrdersAction(
  studioSlug: string,
  idToken: string
): Promise<Order[]> {
  return getDeletedStudioOrdersCore(studioSlug, idToken);
}

export async function getOrderAction(
  orderId: string,
  studioSlug: string,
  idToken: string
): Promise<{ order: Order | null; tasks: Task[] }> {
  return getOrderCore(orderId, studioSlug, idToken);
}

export async function getOrderTasksAction(
  orderId: string,
  studioSlug: string,
  idToken: string
): Promise<Task[]> {
  return getOrderTasksCore(orderId, studioSlug, idToken);
}

export async function updateOrderAction(input: {
  orderId: string;
  studioId: string;
  updates: Partial<
    Pick<Order, "eventType" | "eventDate" | "eventLocation" | "services" | "packages">
  >;
  idToken: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  return updateOrderCore(input);
}

export async function deleteOrderAction(input: {
  orderId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  return deleteOrderCore(input);
}

export async function restoreOrderAction(input: {
  orderId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  return restoreOrderCore(input);
}

export async function cancelOrderAction(input: {
  orderId: string;
  studioId: string;
  cancellationReason: string;
  refundNotes?: string;
  idToken: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  return cancelOrderCore(input);
}

export async function getOrderByPasskeyAction(passkey: string): Promise<{
  success: boolean;
  view?: CustomerTrackingView;
  error?: string;
}> {
  return getOrderByPasskeyCore(passkey);
}

export async function createTaskAction(input: {
  orderId: string;
  studioId: string;
  title: string;
  serviceCategory: "PHOTOGRAPHY" | "VIDEOGRAPHY" | "ALBUM" | "GENERAL";
  assignedMemberId?: string;
  assignedMemberName?: string;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  return createTaskCore(input);
}

export async function updateTaskStatusAction(rawInput: unknown): Promise<{
  success: boolean;
  task?: Task;
  newOrderStatus?: OrderStatus;
  error?: string;
}> {
  return updateTaskStatusCore(rawInput);
}

export async function updateTaskAction(input: {
  taskId: string;
  studioId: string;
  updates: Partial<
    Pick<
      Task,
      | "title"
      | "serviceCategory"
      | "assignedMemberId"
      | "assignedMemberName"
      | "status"
      | "reworkNotes"
    >
  >;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  return updateTaskCore(input);
}

export async function deleteTaskAction(input: {
  taskId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  return deleteTaskCore(input);
}

export async function restoreTaskAction(input: {
  taskId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  return restoreTaskCore(input);
}

export async function updatePaymentStatusAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  return updatePaymentStatusCore(rawInput);
}

export async function sendManualPaymentReminderAction(input: {
  orderId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  return sendManualPaymentReminderCore(input);
}

export async function assignResourceAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  return assignResourceCore(rawInput);
}

export async function assignTaskCrewAction(rawInput: {
  orderId: string;
  studioId: string;
  taskId: string;
  memberId: string;
  memberName: string;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  return assignTaskCrewCore(rawInput);
}

export async function confirmResourceAvailabilityAction(
  inputOrOrderId:
    | {
        orderId: string;
        memberId: string;
        confirmed: boolean;
        idToken: string;
        studioId?: string;
      }
    | string,
  argMemberId?: string,
  argConfirmed?: boolean,
  argIdToken?: string,
  argStudioId?: string
): Promise<{ success: boolean; order?: Order; error?: string }> {
  return confirmResourceAvailabilityCore(
    inputOrOrderId,
    argMemberId,
    argConfirmed,
    argIdToken,
    argStudioId
  );
}

export async function checkIsStudioStaffAction(input: {
  studioId: string;
  idToken: string;
}): Promise<{ isStaff: boolean; role?: string }> {
  return checkIsStudioStaffCore(input);
}

export async function syncOrderToAccountAction(input: {
  passkey: string;
  idToken: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  return syncOrderToAccountCore(input);
}

export async function getMySyncedOrdersAction(idToken: string): Promise<Order[]> {
  return getMySyncedOrdersCore(idToken);
}

export async function updateOrderCollaboratorsAction(input: {
  orderId: string;
  collaborators: OrderCollaborator[];
  idToken: string;
}): Promise<{
  success: boolean;
  collaborators?: OrderCollaborator[];
  error?: string;
}> {
  return updateOrderCollaboratorsCore(input);
}

export async function updateOrderDriveDeliverablesAction(input: {
  orderId: string;
  studioId: string;
  deliverables: OrderDriveDeliverable[];
  idToken: string;
}): Promise<{
  success: boolean;
  order?: Order;
  deliverables?: OrderDriveDeliverable[];
  error?: string;
}> {
  return updateOrderDriveDeliverablesCore(input);
}

export async function submitCustomerDeliverableReviewAction(input: {
  orderId: string;
  deliverableId: string;
  approved: boolean;
  feedback?: string;
  idToken: string;
}): Promise<{
  success: boolean;
  deliverables?: OrderDriveDeliverable[];
  error?: string;
}> {
  return submitCustomerDeliverableReviewCore(input);
}
