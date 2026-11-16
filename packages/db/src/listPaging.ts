import type { Order, OrderStatus } from '@focoman/types';

export type OrderListSort = 'DATE_ASC' | 'DATE_DESC' | 'PRICE_ASC' | 'PRICE_DESC';
export interface OrderListFilter { query?: string; status?: 'ALL' | OrderStatus; sort?: OrderListSort }
export type OrderListMetadata = Pick<Order, 'id' | 'customer' | 'orderNumber' | 'eventType' | 'eventDate' | 'createdAt' | 'orderStatus' | 'pricing' | 'isDeleted'>;

export function normalizeOrderListFilter(filter: OrderListFilter = {}): Required<OrderListFilter> {
  const status = filter.status ?? 'ALL';
  const sort = filter.sort ?? 'DATE_ASC';
  if (!['ALL', 'AWAITING_EVENT', 'POST_EVENT_IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status) ||
      !['DATE_ASC', 'DATE_DESC', 'PRICE_ASC', 'PRICE_DESC'].includes(sort)) throw new Error('Invalid order list filter.');
  if (filter.query !== undefined && (typeof filter.query !== 'string' || filter.query.length > 200)) throw new Error('Invalid search query.');
  return { query: (filter.query ?? '').trim().toLowerCase(), status, sort };
}

function timestamp(value: string | undefined, descending: boolean): number {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : descending ? -1 : Number.MAX_SAFE_INTEGER;
}

export function filterAndSortOrders<T extends OrderListMetadata>(records: T[], rawFilter: OrderListFilter): T[] {
  const { query, status, sort } = normalizeOrderListFilter(rawFilter);
  return records.filter(order => !order.isDeleted && (status === 'ALL' || order.orderStatus === status) &&
    (!query || `${order.customer?.name ?? ''} ${order.orderNumber ?? ''} ${order.eventType ?? ''}`.toLowerCase().includes(query)))
    .sort((a, b) => {
      let difference: number;
      if (sort === 'PRICE_ASC' || sort === 'PRICE_DESC') {
        difference = ((a.pricing?.finalConfirmedPrice ?? 0) - (b.pricing?.finalConfirmedPrice ?? 0)) * (sort === 'PRICE_ASC' ? 1 : -1);
      } else {
        const descending = sort === 'DATE_DESC';
        difference = (timestamp(a.eventDate, descending) - timestamp(b.eventDate, descending)) * (descending ? -1 : 1);
        if (!difference) difference = (timestamp(a.createdAt, true) - timestamp(b.createdAt, true)) * (descending ? -1 : 1);
      }
      return difference || a.id.localeCompare(b.id);
    });
}

export function validatePageSize(size = 20): number {
  if (!Number.isInteger(size) || size < 1 || size > 50) throw new Error('Page size must be between 1 and 50.');
  return size;
}
