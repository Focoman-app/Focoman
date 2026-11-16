import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderListFilter, validatePageSize } from '../packages/db/src/listPaging.ts';

test('page sizes are bounded integers', () => {
  assert.equal(validatePageSize(), 20);
  assert.equal(validatePageSize(50), 50);
  for (const value of [0, -1, 51, 1.5, NaN, Infinity]) assert.throws(() => validatePageSize(value));
});

test('order list filter rejects unsupported values and normalizes search', () => {
  assert.deepEqual(normalizeOrderListFilter({ query: '  Wedding  ' }), { query: 'wedding', status: 'ALL', sort: 'DATE_ASC' });
  assert.throws(() => normalizeOrderListFilter({ query: 'x'.repeat(201) }));
  assert.throws(() => normalizeOrderListFilter({ status: 'UNKNOWN' as never }));
  assert.throws(() => normalizeOrderListFilter({ sort: 'UNKNOWN' as never }));
});
