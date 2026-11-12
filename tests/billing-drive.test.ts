import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrderFinancials, getReceiptSources } from '../packages/domain/src/billing.ts';
import { parseGoogleDriveUrl } from '../apps/web/src/utils/googleDriveUtils.ts';

test('billing totals use only recorded payments and preserve a missing payment date for confirmation', () => {
  const order = { pricing: { finalConfirmedPrice: 1000, advanceAmount: 200, installments: [{ id: 'p1', amount: 300, date: '', method: 'UPI', referenceNumber: 'UPI-123' }] } } as any;
  assert.deepEqual(getOrderFinancials(order), { confirmed: 100000, advance: 20000, installmentsTotal: 30000, paid: 50000, remaining: 50000, overpayment: 0 });
  assert.equal(getReceiptSources(order)[1].requiresConfirmation, true);
});

test('Drive preview accepts only HTTPS exact Google hosts and retains a resource key', () => {
  const safe = parseGoogleDriveUrl('https://drive.google.com/file/d/abc_123/view?resourcekey=key-1');
  assert.equal(safe.canEmbedPreview, true);
  assert.match(safe.previewEmbedUrl || '', /resourcekey=key-1/);
  assert.equal(parseGoogleDriveUrl('https://drive.google.com.attacker.example/file/d/abc').isValidDriveUrl, false);
  assert.equal(parseGoogleDriveUrl('http://drive.google.com/file/d/abc').isValidDriveUrl, false);
});
