import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../../js/api.js';
import {
  toCents, buildAmounts, couponParams, sessionParams, pickOrigin, returnUrls,
  verifyStripeSignature, signStripePayload, parseSignatureHeader, interpretEvent,
} from '../../supabase/functions/_shared/payments-core.js';

const customer = { name: 'Jean Pierre', email: 'jean@example.com', phone: '555', address: '1 Main St', city: 'Miami', country: 'US', notes: '' };

test('toCents has no float drift', () => {
  assert.equal(toCents(17.99), 1799);
  assert.equal(toCents('0.29'), 29);

  assert.equal(toCents(2.7), 270);
  assert.throws(() => toCents('abc'));
});

test('buildAmounts: HT26 order matches total exactly (scarf 17.99 -> 15.29)', () => {
  const a = buildAmounts({ subtotal: 17.99, discount: 2.7, shipping: 0, total: 15.29 }, [{ name: 'Haiti Scarf', unit_price: '17.99', qty: 1 }]);
  assert.deepEqual(a.lineItems, [{ name: 'Haiti Scarf', unit_amount: 1799, quantity: 1 }]);
  assert.equal(a.discountCents, 270);
  assert.equal(a.totalCents, 1529);
  assert.equal(1799 - a.discountCents, a.totalCents);
});

test('buildAmounts: multi-line, no coupon; and rounded coupon (19.98 -> 3.00 off)', () => {
  const items = [{ name: 'A', unit_price: 9.99, qty: 2 }, { name: 'B', unit_price: 7.99, qty: 3 }];
  const sub = 9.99 * 2 + 7.99 * 3; // 43.95
  const a = buildAmounts({ discount: 0, shipping: 0, total: 43.95 }, items);
  assert.equal(a.discountCents, 0); assert.equal(a.totalCents, 4395);
  assert.equal(sub.toFixed(2), '43.95');
  const b = buildAmounts({ discount: 3.0, shipping: 0, total: 16.98 }, [{ name: 'H', unit_price: 9.99, qty: 2 }]);
  assert.equal(b.totalCents, 1698); assert.equal(b.discountCents, 300);
});

test('buildAmounts rejects inconsistent orders, shipping, tiny totals and bad qty', () => {
  const it = [{ name: 'A', unit_price: 10, qty: 1 }];
  assert.throws(() => buildAmounts({ discount: 0, shipping: 0, total: 9 }, it), /do not match/);
  assert.throws(() => buildAmounts({ discount: 1, shipping: 0, total: 10 }, it), /do not match/);
  assert.throws(() => buildAmounts({ discount: 0, shipping: 5, total: 10 }, it), /shipping/);
  assert.throws(() => buildAmounts({ discount: 0, shipping: 0, total: 0.3 }, [{ name: 'x', unit_price: 0.3, qty: 1 }]), /minimum/);
  assert.throws(() => buildAmounts({ discount: 0, shipping: 0, total: 10 }, [{ name: 'A', unit_price: 10, qty: 0 }]));
  assert.throws(() => buildAmounts({ discount: 0, shipping: 0, total: 10 }, []));
});

test('Stripe request bodies: coupon and session', () => {
  const a = buildAmounts({ discount: 2.7, shipping: 0, total: 15.29 }, [{ name: 'Haiti Scarf', unit_price: 17.99, qty: 1 }]);
  const c = couponParams({ discountCents: a.discountCents, orderNumber: 'JPS-260101-ABCD', orderId: 'oid' });
  assert.equal(c.get('amount_off'), '270'); assert.equal(c.get('currency'), 'usd'); assert.equal(c.get('duration'), 'once');
  const { successUrl, cancelUrl } = returnUrls('https://s.example', 'JPS-260101-ABCD', 'a+b@x.com');
  const p = sessionParams({ order: { id: 'oid', order_number: 'JPS-260101-ABCD', customer_email: 'a+b@x.com' }, amounts: a, couponId: 'cp_1', successUrl, cancelUrl });
  assert.equal(p.get('mode'), 'payment');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '1799');
  assert.equal(p.get('line_items[0][quantity]'), '1');
  assert.equal(p.get('discounts[0][coupon]'), 'cp_1');
  assert.equal(p.get('metadata[order_id]'), 'oid');
  assert.equal(p.get('client_reference_id'), 'oid');
  assert.equal(p.get('success_url'), 'https://s.example/order.html?n=JPS-260101-ABCD&e=a%2Bb%40x.com&paid=1');
  assert.match(p.get('cancel_url'), /&cancelled=1$/);
  assert.equal(sessionParams({ order: { id: 'o', order_number: 'n', customer_email: 'e@x.co' }, amounts: a, successUrl, cancelUrl }).has('discounts[0][coupon]'), false);
});

test('pickOrigin only returns allow-listed origins', () => {
  const allow = 'https://store.jpslogistics.me, http://localhost:8080/';
  assert.equal(pickOrigin('http://localhost:8080', allow), 'http://localhost:8080');
  assert.equal(pickOrigin('https://evil.example', allow), 'https://store.jpslogistics.me');
  assert.equal(pickOrigin('x', ''), null);
});

test('webhook signature: valid, tampered, wrong secret, stale, malformed, multiple v1', async () => {
  const secret = 'whsec_test'; const body = '{"id":"evt_1","type":"x"}';
  const now = 1_700_000_000_000; const t = Math.floor(now / 1000);
  const hdr = await signStripePayload(body, secret, t);
  assert.deepEqual(await verifyStripeSignature(body, hdr, secret, { now }), { ok: true });
  assert.equal((await verifyStripeSignature(body + ' ', hdr, secret, { now })).reason, 'bad_signature');
  assert.equal((await verifyStripeSignature(body, hdr, 'whsec_other', { now })).reason, 'bad_signature');
  assert.equal((await verifyStripeSignature(body, hdr, secret, { now: now + 301_000 })).reason, 'timestamp_out_of_tolerance');
  assert.equal((await verifyStripeSignature(body, hdr, secret, { now: now - 301_000 })).reason, 'timestamp_out_of_tolerance');
  assert.equal((await verifyStripeSignature(body, hdr, secret, { now: now + 299_000 })).ok, true);
  assert.equal((await verifyStripeSignature(body, 'garbage', secret, { now })).reason, 'malformed_header');
  assert.equal((await verifyStripeSignature(body, null, secret, { now })).ok, false);
  assert.equal((await verifyStripeSignature(body, hdr, '', { now })).reason, 'no_secret');
  const multi = `t=${t},v1=${'0'.repeat(64)},${hdr.split(',')[1]},v0=abc`;
  assert.equal((await verifyStripeSignature(body, multi, secret, { now })).ok, true);
  assert.equal((await verifyStripeSignature(body, `t=abc,v1=${'0'.repeat(64)}`, secret, { now })).reason, 'malformed_header');
  assert.deepEqual(parseSignatureHeader('t=1,v1=a,v1=b,v0=c'), { t: '1', v1: ['a', 'b'] });
});

test('interpretEvent maps Stripe events to order actions', () => {
  const ev = (type, o) => ({ id: 'evt', type, data: { object: { id: 'cs_1', metadata: { order_id: 'oid' }, payment_intent: 'pi_1', amount_total: 1529, ...o } } });
  assert.deepEqual(interpretEvent(ev('checkout.session.completed', { payment_status: 'paid' })), { order_id: 'oid', action: 'paid', payment_intent: 'pi_1', amount_total: 1529, session_id: 'cs_1' });
  assert.equal(interpretEvent(ev('checkout.session.completed', { payment_status: 'unpaid' })), null);
  assert.equal(interpretEvent(ev('checkout.session.async_payment_succeeded', { payment_status: 'paid' })).action, 'paid');
  assert.equal(interpretEvent(ev('checkout.session.expired', {})).action, 'expired');
  assert.equal(interpretEvent(ev('checkout.session.async_payment_failed', {})).action, 'failed');
  assert.equal(interpretEvent(ev('charge.succeeded', {})), null);
  assert.equal(interpretEvent({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } }), null);
});

/* ---- local DEMO path ---- */
beforeEach(async () => { api._resetLocalForTests(); await api.signOut(); });
async function cardOrder(pm = 'debit_card') {
  const p = await api.getProduct('haiti-scarf');
  return api.placeOrder({ customer, items: [{ product_id: p.id, qty: 1 }], payment_method: pm });
}

test('debit_card is accepted and createCardCheckout returns a demo url in local mode', async () => {
  const o = await cardOrder();
  assert.equal(o.payment_method, 'debit_card'); assert.equal(o.status, 'pending'); assert.equal(o.payment_status, 'unpaid');
  const r = await api.createCardCheckout({ order_number: o.order_number, email: 'JEAN@example.com' });
  assert.equal(r.mode, 'demo');
  assert.match(r.url, /^order\.html\?n=JPS-\d{6}-[A-Z0-9]{4}&e=jean%40example\.com&demo=1$/);
  await assert.rejects(api.createCardCheckout({ order_number: o.order_number, email: 'other@example.com' }), (e) => e.code === 'not_found');
  const cod = await cardOrder('cash_on_delivery');
  await assert.rejects(api.createCardCheckout({ order_number: cod.order_number, email: customer.email }), (e) => e.code === 'validation');
});

test('demoMarkPaid marks only the matching card order paid (local only), idempotent', async () => {
  const o = await cardOrder();
  await assert.rejects(api.demoMarkPaid(o.order_number, 'wrong@example.com'), (e) => e.code === 'not_found');
  const p = await api.demoMarkPaid(o.order_number, customer.email);
  assert.equal(p.status, 'paid'); assert.equal(p.payment_status, 'paid'); assert.ok(p.paid_at);
  assert.equal((await api.getOrder(o.order_number, customer.email)).payment_status, 'paid');
  assert.equal((await api.demoMarkPaid(o.order_number, customer.email)).status, 'paid');
  await assert.rejects(api.createCardCheckout({ order_number: o.order_number, email: customer.email }), (e) => e.code === 'validation');
  const cod = await cardOrder('moncash');
  await assert.rejects(api.demoMarkPaid(cod.order_number, customer.email), (e) => e.code === 'validation');
});

test('card_soon is no longer a valid payment method', async () => {
  const p = await api.getProduct('haiti-scarf');
  await assert.rejects(api.placeOrder({ customer, items: [{ product_id: p.id, qty: 1 }], payment_method: 'card_soon' }), (e) => e.code === 'validation');
  assert.equal(globalThis.JPS_CONFIG.PAYMENT_METHODS[0].id, 'debit_card');
  assert.equal(globalThis.JPS_CONFIG.PAYMENT_METHODS[0].default, true);
});
