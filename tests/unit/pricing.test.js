import test from 'node:test';
import assert from 'node:assert/strict';
import { COUPON_DEFAULT, computeTotals, roundMoney, formatMoney } from '../../js/pricing.js';

test('COUPON_DEFAULT', () => assert.deepEqual({ ...COUPON_DEFAULT }, { code: 'HT26', percent: 15, min_subtotal: 10 }));

test('exactly $10 gets no coupon', () => {
  const t = computeTotals([{ unit_price: 10, qty: 1 }], COUPON_DEFAULT);
  assert.equal(t.couponApplied, false);
  assert.equal(t.couponReason, 'min_subtotal');
  assert.equal(t.discount, 0);
  assert.equal(t.total, 10);
});

test('$10.01 gets coupon', () => {
  const t = computeTotals([{ unit_price: 10.01, qty: 1 }], COUPON_DEFAULT);
  assert.equal(t.couponApplied, true);
  assert.equal(t.discount, 1.5);
  assert.equal(t.total, 8.51);
});

test('rounding and shipping always 0', () => {
  const t = computeTotals([{ unit_price: 17.99, qty: 1 }], COUPON_DEFAULT);
  assert.equal(t.discount, 2.7);
  assert.equal(t.total, 15.29);
  assert.equal(t.shipping, 0);
  assert.equal(computeTotals([{ unit_price: 0.1, qty: 3 }], null).subtotal, 0.3);
  assert.equal(roundMoney(1.005), 1.01);
});

test('no coupon, empty cart, bad coupons', () => {
  assert.deepEqual(computeTotals([], null), { subtotal: 0, discount: 0, shipping: 0, total: 0, couponApplied: false, couponReason: null });
  assert.equal(computeTotals([{ unit_price: 50, qty: 1 }], { ...COUPON_DEFAULT, active: false }).couponReason, 'invalid');
  assert.equal(computeTotals([{ unit_price: 50, qty: 1 }], { ...COUPON_DEFAULT, expires_at: '2020-01-01' }).couponReason, 'expired');
});

test('formatMoney', () => {
  assert.equal(formatMoney(17.99), '$17.99');
  assert.equal(formatMoney(5), '$5.00');
  assert.equal(formatMoney(1234.5), '$1,234.50');
});
