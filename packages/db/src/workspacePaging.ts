import 'server-only';
import { FieldPath } from 'firebase-admin/firestore';
import type { Customer, Order, StudioMember } from '@focoman/types';
import { getFirestoreServerInstance } from './index';
import { filterAndSortOrders, normalizeOrderListFilter, validatePageSize, type OrderListFilter, type OrderListMetadata } from './listPaging';

type RecordMap = { orders: Order; customers: Customer; members: StudioMember };
export interface StudioPage<T> { items: T[]; nextCursor: string | null }
export interface StudioPageInput { studioId: string; cursor?: string | null; pageSize?: number; deleted?: boolean }

function decodeCursor(cursor: string | null | undefined, scope: string): string | null {
  if (!cursor) return null;
  if (cursor.length > 4096) throw new Error('Invalid page cursor.');
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed.scope !== scope || typeof parsed.id !== 'string' || !parsed.id || parsed.id.includes('/')) throw new Error();
    return parsed.id;
  } catch { throw new Error('This page cursor is invalid for the current studio or filters. Reload the list.'); }
}
function encodeCursor(id: string, scope: string): string { return Buffer.from(JSON.stringify({ id, scope })).toString('base64url'); }

/** Bounded legacy-compatible page: no isDeleted/createdAt index excludes old documents. */
export async function readStudioPage<C extends keyof RecordMap>(input: StudioPageInput & { collection: C }): Promise<StudioPage<RecordMap[C]>> {
  const size = validatePageSize(input.pageSize);
  if (!['orders', 'customers', 'members'].includes(input.collection)) throw new Error('Invalid collection.');
  const studioId = input.studioId.toLowerCase();
  const scope = JSON.stringify([studioId, input.collection, Boolean(input.deleted)]);
  const cursor = decodeCursor(input.cursor, scope);
  let query = getFirestoreServerInstance().collection(input.collection).where('studioId', '==', studioId).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(cursor);
  // Scan a bounded number even if this section contains many archived records.
  // An empty page with nextCursor means more documents can still match.
  const snap = await query.limit(100).get();
  const items: RecordMap[C][] = [];
  let lastId: string | null = null;
  let consumed = 0;
  for (const doc of snap.docs) {
    consumed++;
    lastId = doc.id;
    const record = { ...doc.data(), id: doc.id } as RecordMap[C];
    if (Boolean(record.isDeleted) === Boolean(input.deleted)) items.push(record);
    if (items.length === size) break;
  }
  const hasMore = consumed < snap.size || snap.size === 100;
  return { items, nextCursor: hasMore && lastId ? encodeCursor(lastId, scope) : null };
}

/** Preserve global legacy sort/search, reading only list fields before hydrating a page. */
export async function readOrderListPage(input: StudioPageInput & OrderListFilter): Promise<StudioPage<Order> & { total: number; remainingIds: string[] }> {
  const size = validatePageSize(input.pageSize);
  const studioId = input.studioId.toLowerCase();
  const filter = normalizeOrderListFilter(input);
  const scope = JSON.stringify([studioId, 'order-list', filter]);
  const cursor = decodeCursor(input.cursor, scope);
  const db = getFirestoreServerInstance();
  const snapshot = await db.collection('orders').where('studioId', '==', studioId)
    .select('customer.name', 'orderNumber', 'eventType', 'eventDate', 'eventDates', 'serviceSchedules', 'createdAt', 'orderStatus', 'pricing.finalConfirmedPrice', 'isDeleted').get();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const metadata = snapshot.docs.map(doc => {
    const data = doc.data();
    const dates = [...(data.eventDates ?? []), data.eventDate, ...Object.values(data.serviceSchedules ?? {}).flat()].filter(Boolean).sort();
    if (data.orderStatus === 'AWAITING_EVENT' && dates.length && dates[dates.length - 1] < today) data.orderStatus = 'POST_EVENT_IN_PROGRESS';
    return { ...data, id: doc.id } as OrderListMetadata;
  });
  const sorted = filterAndSortOrders(metadata, filter);
  const cursorIndex = cursor ? sorted.findIndex(order => order.id === cursor) : -1;
  if (cursor && cursorIndex < 0) throw new Error('The order list changed. Refresh the list before loading more.');
  const page = sorted.slice(cursorIndex + 1, cursorIndex + 1 + size);
  const docs = page.length ? await db.getAll(...page.map(order => db.collection('orders').doc(order.id))) : [];
  const items = docs.flatMap((doc, index) => {
    if (!doc.exists) return [];
    const order = doc.data() as Order;
    if (order.studioId !== studioId || order.isDeleted) return [];
    return [{ ...order, id: doc.id, orderStatus: page[index].orderStatus }];
  });
  return { items, total: sorted.length, remainingIds: sorted.slice(cursorIndex + 1 + size).map(order => order.id), nextCursor: cursorIndex + 1 + size < sorted.length && page.length ? encodeCursor(page[page.length - 1].id, scope) : null };
}

/** Complete dashboard series without history, deliverables, crew or access secrets. */
export async function getDashboardOrderProjection(studioId: string): Promise<Order[]> {
  const snap = await getFirestoreServerInstance().collection('orders').where('studioId', '==', studioId.toLowerCase())
    .select('id', 'customer.name', 'orderNumber', 'eventType', 'eventLocation', 'eventDate', 'createdAt', 'orderStatus', 'pricing', 'isDeleted').get();
  return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order)).filter(order => !order.isDeleted);
}

/** Hydrate a known ordered snapshot without rescanning metadata on every scroll. */
export async function readOrderPageByIds(studioId: string, ids: string[]): Promise<Order[]> {
  if (!Array.isArray(ids) || ids.length > 50 || ids.some(id => typeof id !== 'string' || !id || id.includes('/'))) throw new Error('Invalid order page.');
  if (!ids.length) return [];
  const db = getFirestoreServerInstance();
  const docs = await db.getAll(...Array.from(new Set(ids)).map(id => db.collection('orders').doc(id)));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return docs.flatMap(doc => {
    if (!doc.exists) return [];
    const order = doc.data() as Order;
    if (order.studioId !== studioId.toLowerCase()) throw new Error('Order does not belong to this studio.');
    if (order.isDeleted) return [];
    const dates = [...(order.eventDates ?? []), order.eventDate, ...Object.values(order.serviceSchedules ?? {}).flat()].filter(Boolean).sort();
    const orderStatus = order.orderStatus === 'AWAITING_EVENT' && dates.length && dates[dates.length - 1] < today ? 'POST_EVENT_IN_PROGRESS' : order.orderStatus;
    return [{ ...order, id: doc.id, orderStatus }];
  });
}
