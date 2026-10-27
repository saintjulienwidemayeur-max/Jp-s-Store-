import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../../js/api.js';

const customer = { name: 'Jean Pierre', email: 'Jean@Example.com', phone: '555', address: '1 Main St', city: 'Miami', country: 'US', notes: '' };
const rejects = (p, code) => assert.rejects(p, (e) => e.code === code);
let scarf, headband, tattoo;

beforeEach(async () => {
  api._resetLocalForTests();
  await api.signOut();
  scarf = await api.getProduct('haiti-scarf');
  headband = await api.getProduct('haiti-headband');
  tattoo = await api.getProduct('haiti-face-tattoo');
});

test('mode is local', () => assert.equal(api.mode, 'local'));

test('catalog, categories, seed prices', async () => {
  assert.equal((await api.listCategories())[0].slug, 'fan-zone');
  const all = await api.listProducts();
  assert.ok(all.length >= 8);
  assert.equal(scarf.price, 17.99);
  assert.equal(headband.price, 9.99);
  assert.equal((await api.getProduct(scarf.id)).slug, 'haiti-scarf');
  assert.equal(await api.getProduct('nope'), null);
  assert.equal(all.filter((p) => p.image === null).length >= 3, true);
  assert.equal(all.filter((p) => p.is_popular).length, 4);
});

test('search, sort, category, limit', async () => {
  assert.deepEqual((await api.listProducts({ q: 'scarf' })).map((p) => p.slug), ['haiti-scarf']);
  assert.equal((await api.listProducts({ q: 'zzzz' })).length, 0);
  const asc = (await api.listProducts({ sort: 'price_asc' })).map((p) => p.price);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  const desc = (await api.listProducts({ sort: 'price_desc' })).map((p) => p.price);
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
  assert.equal((await api.listProducts({ limit: 2 })).length, 2);
  assert.equal((await api.listProducts({ category: 'nothing' })).length, 0);
  const pop = await api.listProducts({ sort: 'popular' });
  assert.ok(pop.slice(0, 4).every((p) => p.is_popular));
});

test('validateCoupon', async () => {
  assert.equal((await api.validateCoupon('ht26', 20)).valid, true);
  assert.equal((await api.validateCoupon('HT26', 10)).reason, 'min_subtotal');
  assert.equal((await api.validateCoupon('HT26', 10.01)).valid, true);
  assert.deepEqual(await api.validateCoupon('NOPE', 50), { valid: false, coupon: null, reason: 'invalid' });
});

test('placeOrder success: recompute, number format, stock decrement', async () => {
  const before = scarf.stock;
  const o = await api.placeOrder({ customer, items: [{ product_id: scarf.id, qty: 2 }, { product_id: tattoo.id, qty: 1 }], coupon_code: 'ht26', payment_method: 'moncash', price: 0 });
  assert.match(o.order_number, /^JPS-\d{6}-[A-Z0-9]{4}$/);
  assert.equal(o.status, 'pending');
  assert.equal(o.subtotal, 43.97);
  assert.equal(o.discount, 6.6);
  assert.equal(o.total, 37.37);
  assert.equal(o.shipping, 0);
  assert.equal(o.coupon_code, 'HT26');
  assert.equal(o.items.length, 2);
  assert.equal((await api.getProduct('haiti-scarf')).stock, before - 2);
});

test('placeOrder failures', async () => {
  const base = { customer, items: [{ product_id: scarf.id, qty: 1 }], payment_method: 'zelle' };
  await api.placeOrder({ ...base, items: [{ product_id: scarf.id, qty: 99 }] });
  await rejects(api.placeOrder({ ...base, items: [{ product_id: scarf.id, qty: 2 }] }), 'out_of_stock');
  assert.equal((await api.getProduct('haiti-scarf')).stock, scarf.stock - 99);
  await rejects(api.placeOrder({ ...base, items: [] }), 'validation');
  await rejects(api.placeOrder({ ...base, items: [{ product_id: scarf.id, qty: 0 }] }), 'validation');
  await rejects(api.placeOrder({ ...base, customer: { ...customer, email: 'bad' } }), 'validation');
  await rejects(api.placeOrder({ ...base, payment_method: 'card_soon' }), 'validation');
  await rejects(api.placeOrder({ ...base, coupon_code: 'WRONG' }), 'invalid_coupon');
  await rejects(api.placeOrder({ ...base, items: [{ product_id: tattoo.id, qty: 1 }], coupon_code: 'HT26' }), 'invalid_coupon');
  await rejects(api.placeOrder({ ...base, items: [{ product_id: 'missing', qty: 1 }] }), 'not_found');
});

test('getOrder requires matching email', async () => {
  const o = await api.placeOrder({ customer, items: [{ product_id: headband.id, qty: 1 }], payment_method: 'cash_on_delivery' });
  assert.equal((await api.getOrder(o.order_number, 'jean@example.com')).id, o.id);
  assert.equal(await api.getOrder(o.order_number, 'other@example.com'), null);
  assert.equal(await api.getOrder('JPS-000000-XXXX', 'jean@example.com'), null);
});

test('wishlist as guest', async () => {
  assert.deepEqual(await api.getWishlist(), []);
  assert.equal(await api.toggleWishlist(scarf.id), true);
  assert.deepEqual(await api.getWishlist(), [scarf.id]);
  assert.equal(await api.toggleWishlist(scarf.id), false);
  assert.deepEqual(await api.getWishlist(), []);
});

test('auth, guest wishlist merge, my orders, reviews', async () => {
  await api.toggleWishlist(scarf.id);
  await rejects(api.signUp({ email: 'x', password: 'secret1', name: 'X' }), 'validation');
  await rejects(api.signIn({ email: 'new@example.com', password: 'secret1' }), 'auth');
  let events = 0;
  const off = api.onAuthChange(() => events++);
  const u = await api.signUp({ email: 'New@Example.com', password: 'secret1', name: 'New User' });
  assert.equal(u.email, 'new@example.com');
  assert.equal(u.is_admin, false);
  assert.equal((await api.getUser()).id, u.id);
  assert.deepEqual(await api.getWishlist(), [scarf.id]);
  await rejects(api.signUp({ email: 'new@example.com', password: 'secret1', name: 'Dup' }), 'validation');
  await api.placeOrder({ customer, items: [{ product_id: tattoo.id, qty: 1 }], payment_method: 'zelle' });
  assert.equal((await api.listMyOrders()).length, 1);
  await api.addReview({ product_id: scarf.id, rating: 4, comment: 'Nice' });
  await rejects(api.addReview({ product_id: scarf.id, rating: 9 }), 'validation');
  const p = await api.getProduct('haiti-scarf');
  assert.equal(p.rating, 4); assert.equal(p.review_count, 1);
  assert.equal((await api.listReviews(scarf.id))[0].user_name, 'New User');
  await api.signOut();
  assert.equal(await api.getUser(), null);
  assert.deepEqual(await api.listMyOrders(), []);
  await rejects(api.addReview({ product_id: scarf.id, rating: 5 }), 'auth');
  await rejects(api.signIn({ email: 'new@example.com', password: 'wrong' }), 'auth');
  await api.signIn({ email: 'new@example.com', password: 'secret1' });
  assert.equal((await api.listMyOrders()).length, 1);
  off();
  assert.ok(events >= 3);
});

test('newsletter and contact', async () => {
  assert.equal(await api.subscribeNewsletter('a@b.co'), true);
  assert.equal(await api.subscribeNewsletter('a@b.co'), true);
  await rejects(api.subscribeNewsletter('nope'), 'validation');
  assert.equal(await api.sendContactMessage({ name: 'A', email: 'a@b.co', message: 'Hello there' }), true);
  await rejects(api.sendContactMessage({ name: '', email: 'a@b.co', message: 'Hello there' }), 'validation');
});

test('admin guards', async () => {
  await rejects(api.adminStats(), 'auth');
  await rejects(api.adminListOrders(), 'auth');
  await api.signUp({ email: 'user@example.com', password: 'secret1', name: 'U' });
  await rejects(api.adminListOrders(), 'forbidden');
  await rejects(api.adminUpsertProduct({ name: 'X', price: 1 }), 'forbidden');
  await rejects(api.adminDeleteProduct(scarf.id), 'forbidden');
  await rejects(api.adminListCoupons(), 'forbidden');
  await rejects(api.adminUpdateOrderStatus('x', 'paid'), 'forbidden');
});

test('admin functions', async () => {
  const o = await api.placeOrder({ customer, items: [{ product_id: scarf.id, qty: 3 }], payment_method: 'moncash' });
  const admin = await api.signIn({ email: 'admin@jpslogistics.me', password: 'admin123' });
  assert.equal(admin.is_admin, true);
  assert.equal((await api.adminListOrders()).length, 1);
  assert.equal((await api.adminListOrders({ status: 'paid' })).length, 0);
  assert.equal((await api.adminUpdateOrderStatus(o.id, 'paid')).status, 'paid');
  await rejects(api.adminUpdateOrderStatus(o.id, 'bogus'), 'validation');
  await rejects(api.adminUpdateOrderStatus('nope', 'paid'), 'not_found');
  const stats = await api.adminStats();
  assert.equal(stats.orders, 1); assert.equal(stats.revenue, 53.97);
  await api.adminUpdateOrderStatus(o.id, 'cancelled');
  assert.equal((await api.getProduct('haiti-scarf')).stock, scarf.stock);
  assert.equal((await api.adminStats()).revenue, 0);

  const np = await api.adminUpsertProduct({ name: 'Haiti Sticker', price: 3.5, stock: 2, category_slug: 'fan-zone', is_popular: true });
  assert.equal(np.slug, 'haiti-sticker');
  assert.ok((await api.adminStats()).lowStock.some((p) => p.id === np.id));
  const up = await api.adminUpsertProduct({ ...np, price: 4 });
  assert.equal(up.id, np.id); assert.equal(up.price, 4);
  await rejects(api.adminUpsertProduct({ name: '', price: 1 }), 'validation');
  await api.adminUpsertProduct({ ...np, is_active: false });
  assert.equal((await api.listProducts()).some((p) => p.id === np.id), false);
  assert.equal((await api.listProducts({ includeInactive: true })).some((p) => p.id === np.id), true);
  await api.adminDeleteProduct(np.id);
  assert.equal(await api.getProduct(np.id), null);

  await api.adminUpsertCoupon({ code: 'vip20', percent: 20, min_subtotal: 0 });
  assert.equal((await api.adminListCoupons()).length, 2);
  assert.equal((await api.validateCoupon('VIP20', 1)).valid, true);
  await rejects(api.adminUpsertCoupon({ code: 'x', percent: 500 }), 'validation');
});
