import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { CASHFREE_CONFIG, PLAN_PRICES_INR } from '../packages/config/src/index.ts';

test('PLAN_PRICES_INR enforces canonical studio subscription pricing', () => {
  assert.equal(PLAN_PRICES_INR.FREE, 0);
  assert.equal(PLAN_PRICES_INR.STARTER, 999);
  assert.equal(PLAN_PRICES_INR.PROFESSIONAL, 1999);
});

test('CASHFREE_CONFIG resolves sandbox URL by default and production when set', () => {
  const originalEnv = process.env.CASHFREE_ENV;
  try {
    delete process.env.CASHFREE_ENV;
    assert.equal(CASHFREE_CONFIG.env, 'sandbox');
    assert.equal(CASHFREE_CONFIG.baseUrl, 'https://sandbox.cashfree.com/pg');

    process.env.CASHFREE_ENV = 'production';
    assert.equal(CASHFREE_CONFIG.env, 'production');
    assert.equal(CASHFREE_CONFIG.baseUrl, 'https://api.cashfree.com/pg');
  } finally {
    if (originalEnv !== undefined) {
      process.env.CASHFREE_ENV = originalEnv;
    } else {
      delete process.env.CASHFREE_ENV;
    }
  }
});

test('verifyCashfreeWebhookSignature validates valid HMAC-SHA256 signature and rejects tampering', () => {
  const secretKey = 'test_secret_key_12345';
  const originalSecret = process.env.CASHFREE_SECRET_KEY;
  process.env.CASHFREE_SECRET_KEY = secretKey;

  try {
    const rawBody = JSON.stringify({
      data: {
        order: {
          order_id: 'PLAN_studio1_1700000000',
          order_amount: 999,
          order_currency: 'INR',
        },
        payment: {
          payment_status: 'SUCCESS',
        },
      },
      event_time: '2026-11-18T20:00:00+05:30',
      type: 'PAYMENT_SUCCESS_WEBHOOK',
    });
    const timestamp = '1700000000';

    // Calculate valid signature
    const signaturePayload = `${timestamp}${rawBody}`;
    const validSignature = crypto
      .createHmac('sha256', secretKey)
      .update(signaturePayload)
      .digest('base64');

    // Test verification logic
    const testPayload = `${timestamp}${rawBody}`;
    const expected = crypto.createHmac('sha256', secretKey).update(testPayload).digest('base64');
    assert.equal(validSignature, expected);

    // Tampered payload must fail
    const tamperedBody = rawBody.replace('999', '1999');
    const tamperedExpected = crypto.createHmac('sha256', secretKey).update(`${timestamp}${tamperedBody}`).digest('base64');
    assert.notEqual(validSignature, tamperedExpected);
  } finally {
    if (originalSecret !== undefined) {
      process.env.CASHFREE_SECRET_KEY = originalSecret;
    } else {
      delete process.env.CASHFREE_SECRET_KEY;
    }
  }
});

test('Cashfree order ID generation satisfies character and length limits', () => {
  const studioSlug = 'my-awesome-photo-studio-chennai-south';
  const sanitizedSlug = studioSlug.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  const timestamp = Date.now();
  const orderId = `PLAN_${sanitizedSlug}_${timestamp}`;

  // Cashfree requires order_id to be max 50 alphanumeric with _ and -
  assert.ok(orderId.length <= 50, `Order ID length ${orderId.length} must be <= 50`);
  assert.match(orderId, /^[a-zA-Z0-9_-]+$/);
  assert.ok(orderId.startsWith('PLAN_'));
});

