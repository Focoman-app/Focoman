"use server";

import { readOrderListPage, readOrderPageByIds, readStudioPage, getOrderScheduleProjection } from '@focoman/db';
import type { OrderStatus } from '@focoman/types';
import { requireVerifiedUser, requireStudioOwner } from '@/lib/serverAuth';
import { getStudioCustomersAction } from './customerActions';
import { getStudioMembersAction } from './memberActions';
import { getStudioServicesAction } from './studioActions';
import { hasStudioCapability } from '@/lib/entitlementAuth';

export async function getOmsPageAction(studioId: string, idToken: string, input: {
  query?: string; status?: 'ALL' | OrderStatus; sort?: 'DATE_ASC' | 'DATE_DESC' | 'PRICE_ASC' | 'PRICE_DESC';
}) {
  const user = await requireVerifiedUser(idToken);
  await requireStudioOwner(user.uid, studioId);
  return readOrderListPage({ ...input, studioId, pageSize: 20 });
}

export async function getOmsNextPageAction(studioId: string, idToken: string, ids: string[]) {
  const user = await requireVerifiedUser(idToken);
  await requireStudioOwner(user.uid, studioId);
  return readOrderPageByIds(studioId, ids);
}

export async function getWorkspacePageAction(studioId: string, idToken: string, input: {
  collection: 'customers' | 'members'; cursor?: string | null; deleted?: boolean; pageSize?: number;
}) {
  const user = await requireVerifiedUser(idToken);
  await requireStudioOwner(user.uid, studioId);
  return readStudioPage({ ...input, studioId });
}

/** Parallelism lives on the server; options never block the orders table. */
export async function getOmsOptionsAction(studioId: string, idToken: string) {
  const user = await requireVerifiedUser(idToken);
  await requireStudioOwner(user.uid, studioId);
  const hasErp = await hasStudioCapability(studioId, 'STUDIO_ERP');
  const [customers, members, services, schedules] = await Promise.all([
    getStudioCustomersAction(studioId, idToken),
    hasErp ? getStudioMembersAction(studioId, idToken) : Promise.resolve([]),
    getStudioServicesAction(studioId, idToken),
    getOrderScheduleProjection(studioId),
  ]);
  if (!services.success) throw new Error(services.error || 'Unable to load order options.');
  return { customers, members, schedules, services: services.services, packages: services.packages };
}
