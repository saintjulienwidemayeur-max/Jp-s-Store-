// Data layer. The ONLY module that touches storage / Supabase.
// Mode is auto-selected from window.JPS_CONFIG: Supabase when URL + anon key exist, else local (localStorage).
import './config.js';
import { computeTotals, roundMoney, COUPON_DEFAULT } from './pricing.js';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_COUPONS, SAMPLE_CATEGORIES, SAMPLE_PRODUCTS, mediaFromImages } from './seed.js';

const CFG = () => globalThis.JPS_CONFIG || {};
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
const CODES = ['out_of_stock', 'invalid_coupon', 'validation', 'auth', 'not_found', 'forbidden'];

export const mode = (CFG().SUPABASE_URL && CFG().SUPABASE_ANON_KEY) ? 'supabase' : 'local';

function err(code, message) { const e = new Error(message || code); e.code = code; return e; }
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
const emailOk = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) && e.length <= 254;
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function validateOrderInput(input) {
  const c = (input && input.customer) || {};
  const customer = {
    name: str(c.name, 120), email: str(c.email, 254).toLowerCase(), phone: str(c.phone, 40),
    address: str(c.address, 300), city: str(c.city, 100), country: str(c.country, 100), notes: str(c.notes, 1000)
  };
  if (!customer.name || !emailOk(customer.email) || !customer.address || !customer.city || !customer.country)
    throw err('validation', 'Missing or invalid customer details');
  const items = (input && Array.isArray(input.items)) ? input.items : [];
  if (!items.length || items.length > 50) throw err('validation', 'Cart is empty');
  const merged = new Map();
  for (const it of items) {
    const q = Number(it && it.qty);
    if (!it || !it.product_id || !Number.isInteger(q) || q < 1 || q > 99) throw err('validation', 'Invalid item');
    merged.set(String(it.product_id), (merged.get(String(it.product_id)) || 0) + q);
  }
  const methods = (CFG().PAYMENT_METHODS || []).filter((m) => m.enabled !== false).map((m) => m.id);
  const pm = input.payment_method;
  if (!pm || (methods.length && !methods.includes(pm))) throw err('validation', 'Invalid payment method');
  const code = str(input.coupon_code, 40).toUpperCase() || null;
  return { customer, items: [...merged].map(([product_id, qty]) => ({ product_id, qty })), coupon_code: code, payment_method: pm };
}

function sortProducts(list, sort) {
  const idx = new Map(list.map((p, i) => [p.id, i]));
  const by = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    popular: (a, b) => (b.is_popular - a.is_popular) || (b.review_count - a.review_count)
  }[sort] || null;
  return list.slice().sort((a, b) => (by ? by(a, b) : 0) || idx.get(a.id) - idx.get(b.id));
}

function matchesQuery(p, q) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const hay = [p.name, p.description, p.category_slug, ...(p.tags || [])].join(' ').toLowerCase();
  return terms.every((t) => hay.includes(t));
}

/* ====================================================================== */
/* LOCAL MODE                                                              */
/* ====================================================================== */
const mem = new Map();
const store = {
  get(key, def) {
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : mem.get(key);
      return raw == null ? def : JSON.parse(raw);
    } catch { const raw = mem.get(key); return raw == null ? def : JSON.parse(raw); }
  },
  set(key, val) {
    const raw = JSON.stringify(val);
    try { if (typeof localStorage !== 'undefined') { localStorage.setItem(key, raw); return; } } catch { /* fall through */ }
    mem.set(key, raw);
  },
  del(key) { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch { /* ignore */ } mem.delete(key); }
};

// Test helper: wipe every local-mode key.
export function _resetLocalForTests() {
  mem.clear();
  try {
    if (typeof localStorage !== 'undefined')
      Object.keys(localStorage).filter((k) => k.startsWith('jps_') && k !== 'jps_cart_v1' && k !== 'jps_lang').forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  authListeners.clear();
  blobMem.clear(); objectUrls.clear();
}

const K = { seeded: 'jps_seeded_v1', products: 'jps_products', categories: 'jps_categories', coupons: 'jps_coupons',
  orders: 'jps_orders', users: 'jps_users', session: 'jps_session', reviews: 'jps_reviews',
  newsletter: 'jps_newsletter', contact: 'jps_contact', wishGuest: 'jps_wishlist' };
const authListeners = new Set();

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hashPw(password, salt) {
  // Dev-only local auth: SHA-256 + salt. Real auth is Supabase Auth.
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return hex(await globalThis.crypto.subtle.digest('SHA-256', data));
}
const newSalt = () => hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));

const SEEDED_V2 = 'jps_seeded_v2'; // categories as managed entities + local sample catalog
async function ensureSeeded() {
  if (!store.get(K.seeded)) await seedV1();
  if (!store.get(SEEDED_V2)) seedV2();
}
// Idempotent upgrade (also upgrades browsers seeded before categories were managed): fills new fields, adds sample data.
function seedV2() {
  const cats = store.get(K.categories, []).map(normCat);
  for (const sc of [...SEED_CATEGORIES, ...SAMPLE_CATEGORIES]) {
    const have = cats.find((c) => c.slug === sc.slug);
    if (!have) cats.push(normCat(sc));
    else if (!have.description && sc.description) have.description = sc.description;
  }
  store.set(K.categories, cats);
  const byId = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
  const products = store.get(K.products, []);
  for (const p of products) {
    const sp = byId.get(p.id);
    if (p.is_featured === undefined) p.is_featured = sp ? !!sp.is_featured : false;
    if (sp && sp.is_sample && p.is_sample === undefined) p.is_sample = true;
    if (!p.category_id) p.category_id = (cats.find((c) => c.slug === p.category_slug) || {}).id;
  }
  for (const sp of SAMPLE_PRODUCTS) {
    if (!products.some((p) => p.slug === sp.slug)) products.push({ ...clone(sp), category_id: (cats.find((c) => c.slug === sp.category_slug) || {}).id });
  }
  store.set(K.products, products);
  store.set(SEEDED_V2, true);
}
async function seedV1() {
  const cat = new Map(SEED_CATEGORIES.map((c) => [c.slug, c]));
  store.set(K.categories, clone(SEED_CATEGORIES));
  store.set(K.products, clone(SEED_PRODUCTS.map((p) => ({ ...p, category_id: cat.get(p.category_slug)?.id }))));
  store.set(K.coupons, clone(SEED_COUPONS));
  store.set(K.orders, []); store.set(K.reviews, []); store.set(K.newsletter, []); store.set(K.contact, []);
  const salt = newSalt();
  store.set(K.users, [{ id: uuid(), email: 'admin@jpslogistics.me', name: 'Admin', salt, hash: await hashPw('admin123', salt) }]);
  store.set(K.seeded, true);
}

const isAdminEmail = (email) => (CFG().ADMIN_EMAILS || []).map((e) => String(e).toLowerCase()).includes(String(email).toLowerCase());
const publicUser = (u) => (u ? { id: u.id, email: u.email, name: u.name, is_admin: isAdminEmail(u.email) } : null);

function currentLocalUser() {
  const s = store.get(K.session, null);
  if (!s) return null;
  return store.get(K.users, []).find((u) => u.id === s.user_id) || null;
}
function emit() { const u = publicUser(currentLocalUser()); authListeners.forEach((cb) => { try { cb(u); } catch { /* ignore */ } }); }
function requireAdminLocal() {
  const u = currentLocalUser();
  if (!u) throw err('auth', 'Sign in required');
  if (!isAdminEmail(u.email)) throw err('forbidden', 'Admin only');
  return u;
}
const wishKey = () => { const u = currentLocalUser(); return u ? `jps_wishlist_${u.id}` : K.wishGuest; };

const local = {
  async getProduct(slugOrId) {
    await ensureSeeded();
    const p = loadProducts().find((x) => x.slug === slugOrId || x.id === slugOrId);
    return p ? hydrate(p) : null;
  },

  async validateCoupon(code, subtotal) {
    await ensureSeeded();
    const c = store.get(K.coupons, []).find((x) => x.code.toUpperCase() === String(code || '').trim().toUpperCase());
    return couponCheck(c, subtotal);
  },

  async placeOrder(input) {
    await ensureSeeded();
    const v = validateOrderInput(input);
    // synchronous critical section (no awaits) so stock checks and decrements are atomic
    const products = store.get(K.products, []);
    const lines = v.items.map((it) => {
      const p = products.find((x) => x.id === it.product_id);
      if (!p || !p.is_active) throw err('not_found', 'Product not found');
      if (p.stock < it.qty) throw err('out_of_stock', `Not enough stock for ${p.name}`);
      return { p, qty: it.qty };
    });
    let coupon = null;
    if (v.coupon_code) {
      coupon = store.get(K.coupons, []).find((x) => x.code.toUpperCase() === v.coupon_code) || null;
      const pre = computeTotals(lines.map((l) => ({ unit_price: l.p.price, qty: l.qty })), null).subtotal;
      const chk = couponCheck(coupon, pre);
      if (!chk.valid) throw err('invalid_coupon', `Coupon rejected: ${chk.reason}`);
    }
    const totals = computeTotals(lines.map((l) => ({ unit_price: l.p.price, qty: l.qty })), coupon);
    lines.forEach((l) => { l.p.stock -= l.qty; });
    store.set(K.products, products);
    const orders = store.get(K.orders, []);
    const user = currentLocalUser();
    const order = {
      id: uuid(), order_number: makeOrderNumber(orders), status: 'pending', user_id: user ? user.id : null,
      items: lines.map((l) => ({ product_id: l.p.id, name: l.p.name, image: l.p.image, unit_price: l.p.price, qty: l.qty,
        line_total: roundMoney(l.p.price * l.qty) })),
      subtotal: totals.subtotal, discount: totals.discount, shipping: totals.shipping, total: totals.total,
      coupon_code: totals.couponApplied ? coupon.code : null, created_at: new Date().toISOString(),
      customer: v.customer, payment_method: v.payment_method, payment_status: 'unpaid', paid_at: null
    };
    orders.push(order);
    store.set(K.orders, orders);
    return clone(order);
  },

  async getOrder(orderNumber, email) {
    await ensureSeeded();
    const o = store.get(K.orders, []).find((x) => x.order_number.toUpperCase() === String(orderNumber || '').trim().toUpperCase()
      && x.customer.email.toLowerCase() === String(email || '').trim().toLowerCase());
    return o ? clone(o) : null;
  },

  // Card payment start. Local mode has no Stripe: returns the DEMO payment screen (order.html?demo=1).
  async createCardCheckout({ order_number, email } = {}) {
    const o = await local.getOrder(order_number, email);
    if (!o) throw err('not_found', 'Order not found');
    if (o.payment_method !== 'debit_card') throw err('validation', 'Order is not a card order');
    if (o.payment_status === 'paid') throw err('validation', 'Order already paid');
    return { url: `order.html?n=${encodeURIComponent(o.order_number)}&e=${encodeURIComponent(o.customer.email)}&demo=1`, mode: 'demo' };
  },
  // LOCAL DEMO ONLY: marks a debit-card order paid without any card. Refuses in supabase mode (the webhook is the only
  // thing that may mark a real order paid).
  async demoMarkPaid(order_number, email) {
    if (mode !== 'local') throw err('forbidden', 'Demo payments are only available in local mode');
    await ensureSeeded();
    const orders = store.get(K.orders, []);
    const o = orders.find((x) => x.order_number.toUpperCase() === String(order_number || '').trim().toUpperCase()
      && x.customer.email.toLowerCase() === String(email || '').trim().toLowerCase());
    if (!o) throw err('not_found', 'Order not found');
    if (o.payment_method !== 'debit_card') throw err('validation', 'Order is not a card order');
    if (o.status === 'cancelled') throw err('validation', 'Order cancelled');
    if (o.payment_status !== 'paid') {
      o.payment_status = 'paid'; o.paid_at = new Date().toISOString(); o.demo_payment = true;
      if (o.status === 'pending') o.status = 'paid';
      store.set(K.orders, orders);
    }
    return clone(o);
  },

  async listMyOrders() {
    await ensureSeeded();
    const u = currentLocalUser();
    if (!u) return [];
    return clone(store.get(K.orders, []).filter((o) => o.user_id === u.id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },

  async getWishlist() { await ensureSeeded(); return clone(store.get(wishKey(), [])); },
  async toggleWishlist(productId) {
    await ensureSeeded();
    const key = wishKey(); const list = store.get(key, []);
    const i = list.indexOf(productId);
    if (i >= 0) list.splice(i, 1); else list.push(productId);
    store.set(key, list);
    return i < 0;
  },

  async signUp({ email, password, name } = {}) {
    await ensureSeeded();
    email = str(email, 254).toLowerCase();
    if (!emailOk(email) || typeof password !== 'string' || password.length < 6 || !str(name, 120)) throw err('validation', 'Invalid sign-up details');
    const users = store.get(K.users, []);
    if (users.some((u) => u.email === email)) throw err('validation', 'Email already registered');
    const salt = newSalt();
    const u = { id: uuid(), email, name: str(name, 120), salt, hash: await hashPw(password, salt) };
    users.push(u); store.set(K.users, users);
    store.set(K.session, { user_id: u.id });
    mergeGuestWishlist(u.id); emit();
    return publicUser(u);
  },
  async signIn({ email, password } = {}) {
    await ensureSeeded();
    const u = store.get(K.users, []).find((x) => x.email === str(email, 254).toLowerCase());
    if (!u || typeof password !== 'string' || (await hashPw(password, u.salt)) !== u.hash) throw err('auth', 'Invalid email or password');
    store.set(K.session, { user_id: u.id });
    mergeGuestWishlist(u.id); emit();
    return publicUser(u);
  },
  async signOut() { store.del(K.session); emit(); },
  async getUser() { await ensureSeeded(); return publicUser(currentLocalUser()); },
  onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },

  async listReviews(productId) {
    await ensureSeeded();
    return clone(store.get(K.reviews, []).filter((r) => r.product_id === productId).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },
  async addReview({ product_id, rating, comment } = {}) {
    await ensureSeeded();
    const u = currentLocalUser();
    if (!u) throw err('auth', 'Sign in to review');
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) throw err('validation', 'Rating must be 1-5');
    const products = store.get(K.products, []);
    const p = products.find((x) => x.id === product_id);
    if (!p) throw err('not_found', 'Product not found');
    let reviews = store.get(K.reviews, []).filter((x) => !(x.product_id === product_id && x.user_id === u.id));
    const rev = { id: uuid(), product_id, user_id: u.id, user_name: u.name, rating: r, comment: str(comment, 2000), created_at: new Date().toISOString() };
    reviews.push(rev); store.set(K.reviews, reviews);
    const mine = reviews.filter((x) => x.product_id === product_id);
    p.review_count = mine.length;
    p.rating = Math.round(mine.reduce((s, x) => s + x.rating, 0) / mine.length * 10) / 10;
    store.set(K.products, products);
    return clone(rev);
  },

  async subscribeNewsletter(email) {
    await ensureSeeded();
    email = str(email, 254).toLowerCase();
    if (!emailOk(email)) throw err('validation', 'Invalid email');
    const list = store.get(K.newsletter, []);
    if (!list.some((x) => x.email === email)) { list.push({ email, created_at: new Date().toISOString() }); store.set(K.newsletter, list); }
    return true;
  },
  async sendContactMessage({ name, email, message } = {}) {
    await ensureSeeded();
    if (!str(name, 120) || !emailOk(str(email, 254)) || str(message, 5000).length < 5) throw err('validation', 'Invalid message');
    const list = store.get(K.contact, []);
    list.push({ id: uuid(), name: str(name, 120), email: str(email, 254), message: str(message, 5000), created_at: new Date().toISOString() });
    store.set(K.contact, list);
    return true;
  },

  async adminListOrders({ status } = {}) {
    await ensureSeeded(); requireAdminLocal();
    return clone(store.get(K.orders, []).filter((o) => !status || o.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },
  async adminUpdateOrderStatus(id, status) {
    await ensureSeeded(); requireAdminLocal();
    if (!STATUSES.includes(status)) throw err('validation', 'Invalid status');
    const orders = store.get(K.orders, []);
    const o = orders.find((x) => x.id === id);
    if (!o) throw err('not_found', 'Order not found');
    if (status === 'cancelled' && o.status !== 'cancelled') { // restock
      const products = store.get(K.products, []);
      o.items.forEach((it) => { const p = products.find((x) => x.id === it.product_id); if (p) p.stock += it.qty; });
      store.set(K.products, products);
    }
    o.status = status; store.set(K.orders, orders);
    return clone(o);
  },
  async adminUpsertProduct(product) {
    await ensureSeeded(); requireAdminLocal();
    const d = normalizeProduct(product);
    const products = loadProducts();
    const cats = store.get(K.categories, []);
    if (!cats.some((c) => c.slug === d.category_slug)) throw err('validation', 'Unknown category');
    const existing = d.id ? products.find((x) => x.id === d.id) : null;
    if (products.some((x) => x.slug === d.slug && x.id !== (existing && existing.id))) throw err('validation', 'Slug already used');
    if (existing) {
      const { image, images, ...rest } = d;
      Object.assign(existing, rest);
      existing.category_id = (cats.find((c) => c.slug === d.category_slug) || {}).id;
      if (!(Array.isArray(existing.media) && existing.media.length)) existing.media = mediaFromImages(existing.id, existing.name, images);
      ensureMedia(existing); store.set(K.products, products);
      return hydrate(existing);
    }
    const id = uuid();
    const p = { rating: 5, review_count: 0, created_at: new Date().toISOString(), ...d, id, media: mediaFromImages(id, d.name, d.images),
      category_id: (cats.find((c) => c.slug === d.category_slug) || {}).id };
    ensureMedia(p); products.push(p); store.set(K.products, products);
    return hydrate(p);
  },
  async adminDeleteProduct(id) {
    await ensureSeeded(); requireAdminLocal();
    const products = store.get(K.products, []);
    const i = products.findIndex((x) => x.id === id);
    if (i < 0) throw err('not_found', 'Product not found');
    products.splice(i, 1); store.set(K.products, products);
    return true;
  },
  async adminListCoupons() { await ensureSeeded(); requireAdminLocal(); return clone(store.get(K.coupons, [])); },
  async adminUpsertCoupon(c) {
    await ensureSeeded(); requireAdminLocal();
    const d = normalizeCoupon(c);
    const list = store.get(K.coupons, []);
    const i = list.findIndex((x) => x.code === d.code);
    if (i >= 0) list[i] = d; else list.push(d);
    store.set(K.coupons, list);
    return clone(d);
  },
  async adminStats() {
    await ensureSeeded(); requireAdminLocal();
    const orders = store.get(K.orders, []); const products = store.get(K.products, []);
    return {
      orders: orders.length,
      revenue: roundMoney(orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)),
      products: products.length,
      lowStock: clone(products.filter((p) => p.is_active && p.stock <= 5).map((p) => ({ id: p.id, name: p.name, slug: p.slug, stock: p.stock })))
    };
  }
};

function couponCheck(c, subtotal) {
  if (!c) return { valid: false, coupon: null, reason: 'invalid' };
  const t = computeTotals([{ unit_price: Number(subtotal) || 0, qty: 1 }], c);
  return { valid: t.couponApplied, coupon: { code: c.code, percent: c.percent, min_subtotal: c.min_subtotal }, reason: t.couponReason };
}
function makeOrderNumber(orders) {
  const d = new Date(); const yy = String(d.getFullYear()).slice(-2);
  const ymd = yy + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let n;
  do {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(4));
    n = `JPS-${ymd}-${[...bytes].map((b) => alpha[b % alpha.length]).join('')}`;
  } while (orders.some((o) => o.order_number === n));
  return n;
}
function mergeGuestWishlist(userId) {
  const guest = store.get(K.wishGuest, []);
  if (!guest.length) return;
  const key = `jps_wishlist_${userId}`; const mine = store.get(key, []);
  guest.forEach((id) => { if (!mine.includes(id)) mine.push(id); });
  store.set(key, mine); store.del(K.wishGuest);
}
function normalizeProduct(p) {
  p = p || {};
  const name = str(p.name, 200); const price = Number(p.price);
  if (!name || !Number.isFinite(price) || price < 0) throw err('validation', 'Invalid product');
  const stock = Number.isFinite(Number(p.stock)) ? Math.max(0, Math.floor(Number(p.stock))) : 0;
  const images = Array.isArray(p.images) ? p.images.filter(Boolean).map(String) : (p.image ? [String(p.image)] : []);
  const image = p.image || images[0] || null;
  const cmp = p.compare_at_price == null || p.compare_at_price === '' ? null : Number(p.compare_at_price);
  if (cmp !== null && !(cmp >= 0)) throw err('validation', 'Invalid compare price');
  return {
    ...(p.id ? { id: p.id } : {}), slug: slugify(p.slug || name) || uuid().slice(0, 8), name, description: str(p.description, 5000),
    price: roundMoney(price), compare_at_price: cmp === null ? null : roundMoney(cmp), category_slug: str(p.category_slug, 80) || 'fan-zone',
    image, images: images.length ? images : (image ? [image] : []), stock,
    is_active: p.is_active !== false, is_popular: !!p.is_popular, is_featured: !!p.is_featured, tags: Array.isArray(p.tags) ? p.tags.map(String) : []
  };
}
function normalizeCoupon(c) {
  c = c || {};
  const code = str(c.code, 40).toUpperCase(); const percent = Number(c.percent);
  const min = Number(c.min_subtotal ?? 0);
  if (!/^[A-Z0-9_-]{2,40}$/.test(code) || !(percent > 0 && percent <= 100) || !(min >= 0)) throw err('validation', 'Invalid coupon');
  return { code, percent, min_subtotal: min, active: c.active !== false, expires_at: c.expires_at || null };
}

/* ====================================================================== */
/* SUPABASE MODE                                                           */
/* ====================================================================== */
let clientPromise = null;
function sb() {
  if (!clientPromise) {
    clientPromise = import(/* @vite-ignore */ SUPABASE_CDN).then(({ createClient }) =>
      createClient(CFG().SUPABASE_URL, CFG().SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }));
  }
  return clientPromise;
}
function unwrap({ data, error }) {
  if (error) {
    const msg = String(error.message || '');
    const code = CODES.find((c) => msg.includes(c))
      || (error.code === '42501' || /row-level security|permission denied/i.test(msg) ? 'forbidden'
        : /jwt|not authenticated|invalid login|credentials/i.test(msg) ? 'auth' : 'validation');
    throw err(code, msg);
  }
  return data;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_SELECT = '*, categories(slug)';
function mapProduct(r) {
  const p = {
    id: r.id, slug: r.slug, name: r.name, description: r.description || '', price: Number(r.price),
    compare_at_price: r.compare_at_price == null ? null : Number(r.compare_at_price),
    category_slug: r.categories ? r.categories.slug : null, image: r.image || null,
    images: (r.images && r.images.length) ? r.images : (r.image ? [r.image] : []),
    rating: Number(r.rating), review_count: r.review_count, stock: r.stock, is_active: r.is_active,
    is_popular: r.is_popular, is_featured: !!r.is_featured, tags: r.tags || [], created_at: r.created_at,
    media: Array.isArray(r.media) ? r.media : []
  };
  if (!p.media.length) p.media = mediaFromImages(p.id, p.name, p.images);
  ensureMedia(p);
  return p;
}
function mapOrder(r) {
  const items = (r.order_items || []).map((i) => ({ product_id: i.product_id, name: i.name, image: i.image,
    unit_price: Number(i.unit_price), qty: i.qty, line_total: roundMoney(i.unit_price * i.qty) }));
  return { id: r.id, order_number: r.order_number, status: r.status, items, subtotal: Number(r.subtotal), discount: Number(r.discount),
    shipping: Number(r.shipping), total: Number(r.total), coupon_code: r.coupon_code, created_at: r.created_at,
    customer: r.customer, payment_method: r.payment_method,
    payment_status: r.payment_status || 'unpaid', paid_at: r.paid_at || null };
}
async function supaUser() {
  const c = await sb();
  const { data } = await c.auth.getSession();
  const u = data && data.session && data.session.user;
  if (!u) return null;
  const { data: prof } = await c.from('profiles').select('name,is_admin').eq('id', u.id).maybeSingle();
  return { id: u.id, email: u.email, name: (prof && prof.name) || (u.user_metadata && u.user_metadata.name) || '', is_admin: !!(prof && prof.is_admin) };
}
async function supaGuestWishMerge(c, userId) {
  const guest = store.get(K.wishGuest, []);
  if (!guest.length) return;
  const rows = guest.filter((id) => UUID_RE.test(id)).map((product_id) => ({ user_id: userId, product_id }));
  if (rows.length) await c.from('wishlists').upsert(rows, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
  store.del(K.wishGuest);
}

const supa = {
  async getProduct(slugOrId) {
    const c = await sb();
    const col = UUID_RE.test(slugOrId) ? 'id' : 'slug';
    const r = unwrap(await c.from('products').select(PRODUCT_SELECT).eq(col, slugOrId).maybeSingle());
    return r ? mapProduct(r) : null;
  },
  async validateCoupon(code, subtotal) {
    const c = await sb();
    return unwrap(await c.rpc('validate_coupon', { p_code: String(code || ''), p_subtotal: Number(subtotal) || 0 }));
  },
  async placeOrder(input) {
    const v = validateOrderInput(input);
    const c = await sb();
    return unwrap(await c.rpc('place_order', { payload: v }));
  },
  async getOrder(orderNumber, email) {
    const c = await sb();
    return unwrap(await c.rpc('track_order', { order_number: String(orderNumber || ''), email: String(email || '') })) || null;
  },
  async createCardCheckout({ order_number, email } = {}) {
    const c = await sb();
    const fn = (CFG().PAYMENTS && CFG().PAYMENTS.function) || 'create-checkout';
    const { data, error } = await c.functions.invoke(fn, { body: {
      order_number: String(order_number || ''), email: String(email || ''), origin: globalThis.location ? globalThis.location.origin : undefined } });
    if (error) {
      let body = null;
      try { body = await error.context.json(); } catch { /* not an HTTP error body */ }
      const code = body && body.error;
      throw err(code === 'not_found' ? 'not_found' : 'validation',
        'Could not start the card payment' + (code ? ` (${code})` : ''));
    }
    if (!data || !data.url) throw err('validation', 'No payment URL returned');
    return { url: data.url, mode: 'stripe' };
  },
  async demoMarkPaid() { throw err('forbidden', 'Demo payments are only available in local mode'); },
  async listMyOrders() {
    const u = await supaUser(); if (!u) return [];
    const c = await sb();
    return unwrap(await c.from('orders').select('*, order_items(*)').eq('user_id', u.id).order('created_at', { ascending: false })).map(mapOrder);
  },
  async getWishlist() {
    const u = await supaUser();
    if (!u) return store.get(K.wishGuest, []);
    const c = await sb();
    return unwrap(await c.from('wishlists').select('product_id').eq('user_id', u.id)).map((r) => r.product_id);
  },
  async toggleWishlist(productId) {
    const u = await supaUser();
    if (!u) {
      const list = store.get(K.wishGuest, []); const i = list.indexOf(productId);
      if (i >= 0) list.splice(i, 1); else list.push(productId);
      store.set(K.wishGuest, list); return i < 0;
    }
    const c = await sb();
    const { data } = await c.from('wishlists').select('product_id').eq('user_id', u.id).eq('product_id', productId).maybeSingle();
    if (data) { unwrap(await c.from('wishlists').delete().eq('user_id', u.id).eq('product_id', productId)); return false; }
    unwrap(await c.from('wishlists').insert({ user_id: u.id, product_id: productId }));
    return true;
  },
  async signUp({ email, password, name } = {}) {
    email = str(email, 254).toLowerCase();
    if (!emailOk(email) || typeof password !== 'string' || password.length < 6 || !str(name, 120)) throw err('validation', 'Invalid sign-up details');
    const c = await sb();
    const data = unwrap(await c.auth.signUp({ email, password, options: { data: { name: str(name, 120) } } }));
    if (data.session) await supaGuestWishMerge(c, data.user.id);
    return data.session ? supaUser() : { id: data.user && data.user.id, email, name: str(name, 120), is_admin: false, confirm_email: true };
  },
  async signIn({ email, password } = {}) {
    const c = await sb();
    const { data, error } = await c.auth.signInWithPassword({ email: str(email, 254).toLowerCase(), password: String(password || '') });
    if (error) throw err('auth', error.message);
    await supaGuestWishMerge(c, data.user.id);
    return supaUser();
  },
  async signOut() { const c = await sb(); await c.auth.signOut(); },
  async getUser() { return supaUser(); },
  onAuthChange(cb) {
    let unsub = () => {}; let dead = false;
    sb().then((c) => {
      if (dead) return;
      const { data } = c.auth.onAuthStateChange(() => { supaUser().then(cb).catch(() => cb(null)); });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => { dead = true; unsub(); };
  },
  async listReviews(productId) {
    const c = await sb();
    return unwrap(await c.from('reviews').select('id,product_id,user_id,user_name,rating,comment,created_at').eq('product_id', productId).order('created_at', { ascending: false }));
  },
  async addReview({ product_id, rating, comment } = {}) {
    const u = await supaUser(); if (!u) throw err('auth', 'Sign in to review');
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) throw err('validation', 'Rating must be 1-5');
    const c = await sb();
    return unwrap(await c.from('reviews').upsert({ product_id, user_id: u.id, user_name: u.name, rating: r, comment: str(comment, 2000) }, { onConflict: 'product_id,user_id' }).select().single());
  },
  async subscribeNewsletter(email) {
    email = str(email, 254).toLowerCase();
    if (!emailOk(email)) throw err('validation', 'Invalid email');
    const c = await sb();
    const { error } = await c.from('newsletter_subscribers').insert({ email });
    if (error && error.code !== '23505') unwrap({ error });
    return true;
  },
  async sendContactMessage({ name, email, message } = {}) {
    if (!str(name, 120) || !emailOk(str(email, 254)) || str(message, 5000).length < 5) throw err('validation', 'Invalid message');
    const c = await sb();
    unwrap(await c.from('contact_messages').insert({ name: str(name, 120), email: str(email, 254), message: str(message, 5000) }));
    return true;
  },
  async adminListOrders({ status } = {}) {
    const c = await sb();
    let q = c.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    return unwrap(await q).map(mapOrder);
  },
  async adminUpdateOrderStatus(id, status) {
    if (!STATUSES.includes(status)) throw err('validation', 'Invalid status');
    const c = await sb();
    return unwrap(await c.rpc('admin_set_order_status', { p_order_id: id, p_status: status }));
  },
  async adminUpsertProduct(product) {
    const d = normalizeProduct(product);
    const c = await sb();
    const cat = unwrap(await c.from('categories').select('id').eq('slug', d.category_slug).maybeSingle());
    if (!cat) throw err('validation', 'Unknown category');
    const row = { slug: d.slug, name: d.name, description: d.description, price: d.price, compare_at_price: d.compare_at_price,
      category_id: cat.id, image: d.image, images: d.images, stock: d.stock, is_active: d.is_active, is_popular: d.is_popular, is_featured: d.is_featured, tags: d.tags };
    const q = d.id ? c.from('products').update(row).eq('id', d.id) : c.from('products').insert(row);
    return mapProduct(unwrap(await q.select(PRODUCT_SELECT).single()));
  },
  async adminDeleteProduct(id) { const c = await sb(); unwrap(await c.from('products').delete().eq('id', id)); return true; },
  async adminListCoupons() { const c = await sb(); return unwrap(await c.from('coupons').select('*').order('code')); },
  async adminUpsertCoupon(coupon) {
    const d = normalizeCoupon(coupon); const c = await sb();
    return unwrap(await c.from('coupons').upsert(d, { onConflict: 'code' }).select().single());
  },
  async adminStats() {
    const c = await sb();
    const orders = unwrap(await c.from('orders').select('total,status'));
    const products = unwrap(await c.from('products').select('id,name,slug,stock,is_active'));
    return {
      orders: orders.length,
      revenue: roundMoney(orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)),
      products: products.length,
      lowStock: products.filter((p) => p.is_active && p.stock <= 5).map((p) => ({ id: p.id, name: p.name, slug: p.slug, stock: p.stock }))
    };
  }
};

/* ====================================================================== */
/* MEDIA, 3D JOBS, PREFERENCES  (shared helpers + local + supabase)        */
/* ====================================================================== */
const MB = 1024 * 1024;
export function mediaLimits() {
  const l = CFG().MEDIA_LIMITS || {};
  return { image: l.image || 8 * MB, video: l.video || 50 * MB, model3d: l.model3d || 30 * MB };
}
const bucketName = () => CFG().MEDIA_BUCKET || 'product-media';

const ascii = (b, off, s) => [...s].every((ch, i) => b[off + i] === ch.charCodeAt(0));
/** Identify a file from its leading bytes (never from its name/extension). -> {type, mime, ext} | null */
export function sniffMedia(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return { type: 'image', mime: 'image/png', ext: 'png' };
  if (b.length >= 12 && ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return { type: 'image', mime: 'image/webp', ext: 'webp' };
  if (b.length >= 12 && ascii(b, 4, 'ftyp') && !ascii(b, 8, 'qt  ')) return { type: 'video', mime: 'video/mp4', ext: 'mp4' };
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { type: 'video', mime: 'video/webm', ext: 'webm' };
  if (b.length >= 12 && ascii(b, 0, 'glTF') && b[4] === 2 && b[5] === 0 && b[6] === 0 && b[7] === 0) return { type: 'model3d', mime: 'model/gltf-binary', ext: 'glb' };
  return null;
}

/** Validate a File/Blob: size, magic bytes, declared MIME consistency. -> {type, mime, ext, size}. Throws code 'validation'. */
export async function validateMediaFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || typeof file.size !== 'number') throw err('validation', 'No file provided');
  if (file.size <= 0) throw err('validation', 'File is empty');
  if (file.size > Math.max(...Object.values(mediaLimits()))) throw err('validation', 'File is too large');
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffMedia(head);
  if (!kind) throw err('validation', 'Unsupported file type (allowed: JPEG, PNG, WebP, MP4, WebM, GLB)');
  const declared = String(file.type || '').toLowerCase();
  const generic = !declared || declared === 'application/octet-stream';
  const okDeclared = generic || declared === kind.mime || (kind.type === 'model3d' && declared === 'model/gltf+binary');
  if (!okDeclared) throw err('validation', 'File content does not match its declared type');
  const max = mediaLimits()[kind.type];
  if (file.size > max) throw err('validation', `File is too large (max ${Math.round(max / MB)} MB for ${kind.type})`);
  return { ...kind, size: file.size };
}

/* ---- media list helpers (pure) ---- */
function normalizeMediaList(p) {
  const list = (Array.isArray(p.media) ? p.media : []).slice()
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
  const imgs = list.filter((m) => m.type === 'image');
  const cover = imgs.find((m) => m.is_cover) || imgs[0] || null;
  list.forEach((m, i) => { m.sort = i; m.is_cover = m === cover; });
  p.media = list;
  return p;
}
function deriveImages(p) {
  const imgs = p.media.filter((m) => m.type === 'image');
  const cover = imgs.find((m) => m.is_cover) || imgs[0];
  p.image = cover ? cover.url : null;
  p.images = cover ? [cover.url, ...imgs.filter((m) => m !== cover).map((m) => m.url)] : [];
  return p;
}
function ensureMedia(p) {
  if (!Array.isArray(p.media)) p.media = mediaFromImages(p.id, p.name, p.images && p.images.length ? p.images : (p.image ? [p.image] : []));
  normalizeMediaList(p);
  return deriveImages(p);
}
const mediaForClient = (p) => clone(p.media);

/* ---- blob store (IndexedDB 'jps_media'; in-memory Map in Node / when IDB is unavailable) ---- */
const blobMem = new Map();
const objectUrls = new Map();
let idbPromise = null;
function idb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!idbPromise) {
    idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open('jps_media', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('blobs');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return idbPromise;
}
const idbReq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function blobPut(id, blob) {
  const db = await idb();
  if (db) { try { await idbReq(db.transaction('blobs', 'readwrite').objectStore('blobs').put(blob, id)); return; } catch { /* fall back */ } }
  blobMem.set(id, blob);
}
async function blobGet(id) {
  if (blobMem.has(id)) return blobMem.get(id);
  const db = await idb();
  if (db) { try { return (await idbReq(db.transaction('blobs').objectStore('blobs').get(id))) || null; } catch { /* ignore */ } }
  return null;
}
async function blobDel(id) {
  blobMem.delete(id);
  const u = objectUrls.get(id); if (u && typeof URL !== 'undefined' && URL.revokeObjectURL) { try { URL.revokeObjectURL(u); } catch { /* ignore */ } }
  objectUrls.delete(id);
  const db = await idb();
  if (db) { try { await idbReq(db.transaction('blobs', 'readwrite').objectStore('blobs').delete(id)); } catch { /* ignore */ } }
}
async function blobUrl(id) {
  if (objectUrls.has(id)) return objectUrls.get(id);
  const blob = await blobGet(id);
  if (!blob) return null;
  let url = null;
  try { if (typeof URL !== 'undefined' && URL.createObjectURL) url = URL.createObjectURL(blob); } catch { /* ignore */ }
  if (!url) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    url = `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
  }
  objectUrls.set(id, url);
  return url;
}
const IDB_PREFIX = 'idb:';
async function resolveRef(u) {
  if (typeof u === 'string' && u.startsWith(IDB_PREFIX)) return (await blobUrl(u.slice(IDB_PREFIX.length))) || null;
  return u;
}
/** Local read path: product copy whose idb: refs are turned into object URLs; image/images derived from media. */
async function hydrate(raw) {
  const p = clone(raw);
  ensureMedia(p);
  for (const m of p.media) { m.url = await resolveRef(m.url); m.poster = await resolveRef(m.poster); }
  return deriveImages(p);
}
function loadProducts() { const l = store.get(K.products, []); l.forEach(ensureMedia); return l; }

/* ---- preferences ---- */
const PREF_VALIDATORS = { lang: (v) => (['en', 'fr', 'ht'].includes(v) ? v : undefined) };
const rawLang = {
  get() { try { if (typeof localStorage !== 'undefined') return localStorage.getItem('jps_lang'); } catch { /* ignore */ } return mem.get('jps_lang') ?? null; },
  set(v) { try { if (typeof localStorage !== 'undefined') { localStorage.setItem('jps_lang', v); return; } } catch { /* ignore */ } mem.set('jps_lang', v); }
};
function cleanPrefs(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw err('validation', 'Invalid preferences');
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (!PREF_VALIDATORS[k]) throw err('validation', `Unknown preference: ${k}`);
    const val = PREF_VALIDATORS[k](v);
    if (val === undefined) throw err('validation', `Invalid value for ${k}`);
    out[k] = val;
  }
  return out;
}
const prefDefaults = () => ({ lang: 'en' });
function localPrefs() {
  const lang = rawLang.get();
  return { ...prefDefaults(), ...store.get('jps_prefs', {}), ...(PREF_VALIDATORS.lang(lang) ? { lang } : {}) };
}

/* ---- 3D job helpers ---- */
const JOB_STATUSES = ['queued', 'processing', 'succeeded', 'failed'];
const K3D = 'jps_3d_jobs';
const mapJob = (r) => ({
  id: r.id, product_id: r.product_id, source_media_id: r.source_media_id, result_media_id: r.result_media_id || null,
  status: r.status, progress: Number(r.progress) || 0, provider: r.provider || null, error: r.error || null,
  created_at: r.created_at, updated_at: r.updated_at
});

/* ---------------- local implementation ---------------- */
Object.assign(local, {
  async uploadMedia(productId, file, { alt, onProgress } = {}) {
    await ensureSeeded(); requireAdminLocal();
    const info = await validateMediaFile(file);
    const products = loadProducts();
    const p = products.find((x) => x.id === productId || x.slug === productId);
    if (!p) throw err('not_found', 'Product not found');
    if (typeof onProgress === 'function') onProgress(0);
    const id = uuid();
    await blobPut(id, file);
    const item = { id, type: info.type, url: `${IDB_PREFIX}${id}`, poster: null, alt: str(alt, 300) || p.name, sort: p.media.length,
      is_cover: false, source: 'upload', status: 'ready', mime: info.mime, size: info.size };
    p.media.push(item);
    ensureMedia(p); store.set(K.products, products);
    if (typeof onProgress === 'function') onProgress(1);
    const out = clone(p.media.find((m) => m.id === id));
    out.url = await resolveRef(out.url);
    if (info.type === 'image' && CFG().AUTO_3D !== false) {
      try { out.job = await local.request3D(p.id, id); } catch { /* upload succeeded; 3D can be requested later */ }
    }
    return out;
  },
  async deleteMedia(productId, mediaId) {
    await ensureSeeded(); requireAdminLocal();
    const products = loadProducts();
    const p = products.find((x) => x.id === productId || x.slug === productId);
    if (!p) throw err('not_found', 'Product not found');
    const m = p.media.find((x) => x.id === mediaId);
    if (!m) throw err('not_found', 'Media not found');
    const gone = new Set([mediaId, ...p.media.filter((x) => x.source_media_id === mediaId).map((x) => x.id)]); // cascade generated 3D
    for (const x of p.media.filter((y) => gone.has(y.id))) if (String(x.url || '').startsWith(IDB_PREFIX)) await blobDel(x.url.slice(IDB_PREFIX.length));
    p.media = p.media.filter((x) => !gone.has(x.id));
    ensureMedia(p); store.set(K.products, products);
    store.set(K3D, store.get(K3D, []).filter((j) => !(j.product_id === p.id && gone.has(j.source_media_id))));
    return mediaForClient(await hydrate(p));
  },
  async reorderMedia(productId, ids) {
    await ensureSeeded(); requireAdminLocal();
    const products = loadProducts();
    const p = products.find((x) => x.id === productId || x.slug === productId);
    if (!p) throw err('not_found', 'Product not found');
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some((i) => !p.media.some((m) => m.id === i))) throw err('validation', 'Invalid media order');
    const rank = new Map(ids.map((id, i) => [id, i]));
    const rest = p.media.filter((m) => !rank.has(m.id));
    const ordered = [...p.media.filter((m) => rank.has(m.id)).sort((a, b) => rank.get(a.id) - rank.get(b.id)), ...rest];
    ordered.forEach((m, i) => { m.sort = i; });
    p.media = ordered; ensureMedia(p); store.set(K.products, products);
    return mediaForClient(await hydrate(p));
  },
  async setCover(productId, mediaId) {
    await ensureSeeded(); requireAdminLocal();
    const products = loadProducts();
    const p = products.find((x) => x.id === productId || x.slug === productId);
    if (!p) throw err('not_found', 'Product not found');
    const m = p.media.find((x) => x.id === mediaId);
    if (!m) throw err('not_found', 'Media not found');
    if (m.type !== 'image') throw err('validation', 'Cover must be an image');
    p.media.forEach((x) => { x.is_cover = x.id === mediaId; });
    ensureMedia(p); store.set(K.products, products);
    return mediaForClient(await hydrate(p));
  },
  async request3D(productId, mediaId) {
    await ensureSeeded(); requireAdminLocal();
    const products = loadProducts();
    const p = products.find((x) => x.id === productId || x.slug === productId);
    if (!p) throw err('not_found', 'Product not found');
    const src = p.media.find((x) => x.id === mediaId);
    if (!src) throw err('not_found', 'Media not found');
    if (src.type !== 'image') throw err('validation', 'Only images can be converted to 3D');
    // regenerate = replace the previous generated model of this image
    p.media = p.media.filter((x) => !(x.type === 'model3d' && x.source === 'generated' && x.source_media_id === mediaId));
    const jobId = uuid(); const resultId = uuid(); const now = new Date().toISOString();
    p.media.push({ id: resultId, type: 'model3d', url: null, poster: src.url, alt: `${p.name} (3D)`, sort: p.media.length, is_cover: false,
      source: 'generated', status: 'ready', fallback: 'tilt', source_media_id: mediaId, job_id: jobId });
    ensureMedia(p); store.set(K.products, products);
    const jobs = store.get(K3D, []).filter((j) => !(j.product_id === p.id && j.source_media_id === mediaId));
    const job = { id: jobId, product_id: p.id, source_media_id: mediaId, result_media_id: resultId, status: 'succeeded', progress: 100,
      provider: 'local', error: null, created_at: now, updated_at: now };
    jobs.push(job); store.set(K3D, jobs);
    return clone(job);
  },
  async get3DJob(jobId) { await ensureSeeded(); requireAdminLocal(); const j = store.get(K3D, []).find((x) => x.id === jobId); return j ? clone(j) : null; },
  async list3DJobs(productId) {
    await ensureSeeded(); requireAdminLocal();
    const p = loadProducts().find((x) => x.id === productId || x.slug === productId);
    if (!p) return [];
    return clone(store.get(K3D, []).filter((j) => j.product_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },
  async getPreferences() { return localPrefs(); },
  async setPreferences(patch) {
    const c = cleanPrefs(patch);
    if (c.lang) rawLang.set(c.lang);
    const { lang, ...rest } = c;
    if (Object.keys(rest).length) store.set('jps_prefs', { ...store.get('jps_prefs', {}), ...rest });
    return localPrefs();
  }
});

/* ---------------- supabase implementation ---------------- */
async function requireAdminSupa() {
  const u = await supaUser();
  if (!u) throw err('auth', 'Sign in required');
  if (!u.is_admin) throw err('forbidden', 'Admin only');
  return u;
}
async function supaProductRow(c, productId) {
  const col = UUID_RE.test(productId) ? 'id' : 'slug';
  const r = unwrap(await c.from('products').select('id,name,media,image,images').eq(col, productId).maybeSingle());
  if (!r) throw err('not_found', 'Product not found');
  const p = { id: r.id, name: r.name, image: r.image, images: r.images || [], media: Array.isArray(r.media) ? r.media : [] };
  if (!p.media.length) p.media = mediaFromImages(p.id, p.name, p.images.length ? p.images : (p.image ? [p.image] : []));
  return ensureMedia(p);
}
async function supaSaveMedia(c, p) {
  ensureMedia(p);
  unwrap(await c.from('products').update({ media: p.media, image: p.image, images: p.images }).eq('id', p.id).select('id').single());
  return clone(p.media);
}
const storagePathOf = (m) => m.path || null;
const jobNudge = new Map();
async function nudgeJob(c, job) {
  if (!['queued', 'processing'].includes(job.status)) return job;
  const last = jobNudge.get(job.id) || 0;
  if (Date.now() - last < 5000) return job;
  jobNudge.set(job.id, Date.now());
  try {
    await c.functions.invoke(CFG().FUNCTION_3D || 'generate-3d', { body: { action: 'advance', job_id: job.id } });
    const r = unwrap(await c.from('product_3d_jobs').select('*').eq('id', job.id).maybeSingle());
    return r ? mapJob(r) : job;
  } catch { return job; }
}

Object.assign(supa, {
  async uploadMedia(productId, file, { alt, onProgress } = {}) {
    await requireAdminSupa();
    const info = await validateMediaFile(file);
    const c = await sb();
    const p = await supaProductRow(c, productId);
    if (typeof onProgress === 'function') onProgress(0);
    const id = uuid();
    const path = `products/${p.id}/${id}.${info.ext}`;
    const up = await c.storage.from(bucketName()).upload(path, file, { contentType: info.mime, cacheControl: '31536000', upsert: false });
    if (up.error) unwrap({ error: up.error });
    const url = c.storage.from(bucketName()).getPublicUrl(path).data.publicUrl;
    if (typeof onProgress === 'function') onProgress(1);
    const item = { id, type: info.type, url, poster: null, alt: str(alt, 300) || p.name, sort: p.media.length, is_cover: false,
      source: 'upload', status: 'ready', path, mime: info.mime, size: info.size };
    p.media.push(item);
    try { await supaSaveMedia(c, p); } catch (e) { await c.storage.from(bucketName()).remove([path]); throw e; }
    const out = clone(item);
    if (info.type === 'image' && CFG().AUTO_3D !== false) {
      try { out.job = await supa.request3D(p.id, id); } catch { /* upload succeeded; 3D can be requested later */ }
    }
    return out;
  },
  async deleteMedia(productId, mediaId) {
    await requireAdminSupa();
    const c = await sb(); const p = await supaProductRow(c, productId);
    const m = p.media.find((x) => x.id === mediaId);
    if (!m) throw err('not_found', 'Media not found');
    const gone = p.media.filter((x) => x.id === mediaId || x.source_media_id === mediaId);
    p.media = p.media.filter((x) => !gone.includes(x));
    const list = await supaSaveMedia(c, p);
    const paths = gone.map(storagePathOf).filter(Boolean);
    if (paths.length) await c.storage.from(bucketName()).remove(paths); // best effort; row is already updated
    return list;
  },
  async reorderMedia(productId, ids) {
    await requireAdminSupa();
    const c = await sb(); const p = await supaProductRow(c, productId);
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some((i) => !p.media.some((m) => m.id === i))) throw err('validation', 'Invalid media order');
    const rank = new Map(ids.map((id, i) => [id, i]));
    const rest = p.media.filter((m) => !rank.has(m.id));
    p.media = [...p.media.filter((m) => rank.has(m.id)).sort((a, b) => rank.get(a.id) - rank.get(b.id)), ...rest];
    p.media.forEach((m, i) => { m.sort = i; });
    return supaSaveMedia(c, p);
  },
  async setCover(productId, mediaId) {
    await requireAdminSupa();
    const c = await sb(); const p = await supaProductRow(c, productId);
    const m = p.media.find((x) => x.id === mediaId);
    if (!m) throw err('not_found', 'Media not found');
    if (m.type !== 'image') throw err('validation', 'Cover must be an image');
    p.media.forEach((x) => { x.is_cover = x.id === mediaId; });
    return supaSaveMedia(c, p);
  },
  async request3D(productId, mediaId) {
    const u = await requireAdminSupa();
    const c = await sb(); const p = await supaProductRow(c, productId);
    const src = p.media.find((x) => x.id === mediaId);
    if (!src) throw err('not_found', 'Media not found');
    if (src.type !== 'image') throw err('validation', 'Only images can be converted to 3D');
    // persist legacy-derived media first so the Edge Function can find the source image
    await supaSaveMedia(c, p);
    const row = unwrap(await c.from('product_3d_jobs').insert({ product_id: p.id, source_media_id: mediaId, status: 'queued', created_by: u.id }).select('*').single());
    let job = mapJob(row);
    try {
      await c.functions.invoke(CFG().FUNCTION_3D || 'generate-3d', { body: { action: 'advance', job_id: job.id } });
      const r = unwrap(await c.from('product_3d_jobs').select('*').eq('id', job.id).maybeSingle());
      if (r) job = mapJob(r);
    } catch { /* stays queued; get3DJob() will nudge it again */ }
    return job;
  },
  async get3DJob(jobId) {
    await requireAdminSupa();
    const c = await sb();
    const r = unwrap(await c.from('product_3d_jobs').select('*').eq('id', jobId).maybeSingle());
    return r ? nudgeJob(c, mapJob(r)) : null;
  },
  async list3DJobs(productId) {
    await requireAdminSupa();
    const c = await sb(); const p = await supaProductRow(c, productId);
    const rows = unwrap(await c.from('product_3d_jobs').select('*').eq('product_id', p.id).order('created_at', { ascending: false }));
    return Promise.all(rows.map((r) => nudgeJob(c, mapJob(r))));
  },
  async getPreferences() {
    const base = localPrefs();
    const u = await supaUser();
    if (!u) return base;
    const c = await sb();
    const { data } = await c.from('profiles').select('preferences').eq('id', u.id).maybeSingle();
    const remote = (data && data.preferences && typeof data.preferences === 'object') ? data.preferences : {};
    const merged = { ...base };
    for (const k of Object.keys(PREF_VALIDATORS)) { const v = PREF_VALIDATORS[k](remote[k]); if (v !== undefined) merged[k] = v; }
    if (merged.lang) rawLang.set(merged.lang); // mirror
    return merged;
  },
  async setPreferences(patch) {
    const c0 = cleanPrefs(patch);
    await local.setPreferences(c0); // always mirror locally (guests, offline)
    const u = await supaUser();
    if (u) {
      const c = await sb();
      const { data } = await c.from('profiles').select('preferences').eq('id', u.id).maybeSingle();
      const next = { ...((data && data.preferences) || {}), ...c0 };
      unwrap(await c.from('profiles').update({ preferences: next }).eq('id', u.id).select('id').single());
    }
    return supa.getPreferences();
  }
});

/* ====================================================================== */
/* CATEGORIES (managed collections) + extended product queries             */
/* ====================================================================== */
// Category = {id, slug, name, description, image|null, parent_id|null, sort, is_featured, is_active}
const ensureArr = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));
function normCat(c) {
  return { ...c, description: c.description || '', image: c.image || null, parent_id: c.parent_id || null,
    sort: Number.isFinite(Number(c.sort)) ? Number(c.sort) : (Number.isFinite(Number(c.sort_order)) ? Number(c.sort_order) : 0),
    is_featured: !!c.is_featured, is_active: c.is_active !== false };
}
const catSort = (a, b) => (a.sort - b.sort) || String(a.name).localeCompare(String(b.name));
const stripCat = (c) => { const { sort_order, ...rest } = c; return rest; };
/** slugs -> those slugs plus every descendant slug (selecting a parent also lists its children's products). */
function expandSlugs(cats, slugs) {
  const out = new Set();
  const walk = (c) => { if (out.has(c.slug)) return; out.add(c.slug); cats.filter((x) => x.parent_id === c.id).forEach(walk); };
  for (const sl of slugs) { const c = cats.find((x) => x.slug === sl); if (c) walk(c); else out.add(sl); }
  return out;
}
function normalizeCategory(c) {
  c = c || {};
  const name = str(c.name, 120);
  if (!name) throw err('validation', 'Category name is required');
  const slug = slugify(c.slug || name);
  if (!slug) throw err('validation', 'Invalid category slug');
  let image = c.image == null || c.image === '' ? null : String(c.image).slice(0, 2000);
  const sortN = c.sort === undefined || c.sort === null || c.sort === '' ? undefined : Number(c.sort);
  if (sortN !== undefined && !Number.isFinite(sortN)) throw err('validation', 'Invalid sort');
  return { ...(c.id ? { id: String(c.id) } : {}), slug, name, description: str(c.description, 2000), image,
    parent_id: c.parent_id ? String(c.parent_id) : null, ...(sortN !== undefined ? { sort: Math.floor(sortN) } : {}),
    is_featured: !!c.is_featured, is_active: c.is_active !== false };
}
/** Throws when parent is missing, is the category itself, or would create a cycle. `all` = every category. */
function checkParent(all, id, parentId) {
  if (!parentId) return;
  if (id && parentId === id) throw err('validation', 'A category cannot be its own parent');
  if (!all.some((x) => x.id === parentId)) throw err('validation', 'Unknown parent category');
  for (let cur = all.find((x) => x.id === parentId), n = 0; cur && n < 100; cur = all.find((x) => x.id === cur.parent_id), n++)
    if (id && cur.id === id) throw err('validation', 'Category parent would create a loop');
}
function productFilters(o = {}) {
  const num = (v) => (v === undefined || v === null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
  return {
    slugs: [...ensureArr(o.categories), ...ensureArr(o.category)].map(String).filter(Boolean),
    q: o.q && String(o.q).trim() ? String(o.q) : '', min: num(o.minPrice), max: num(o.maxPrice),
    inStock: !!o.inStock, featured: !!o.featured, includeInactive: !!o.includeInactive,
    sort: o.newest ? 'new' : (o.sort || 'popular')
  };
}
const pageOf = (o = {}) => {
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(o.pageSize)) || 12));
  return { page: Math.max(1, Math.floor(Number(o.page)) || 1), pageSize };
};
function localProductList(o) {
  const f = productFilters(o);
  let list = loadProducts();
  if (!f.includeInactive) list = list.filter((p) => p.is_active);
  if (f.slugs.length) { const set = expandSlugs(loadCategories(), f.slugs); list = list.filter((p) => set.has(p.category_slug)); }
  if (f.q) list = list.filter((p) => matchesQuery(p, f.q));
  if (f.min !== null) list = list.filter((p) => p.price >= f.min);
  if (f.max !== null) list = list.filter((p) => p.price <= f.max);
  if (f.inStock) list = list.filter((p) => p.stock > 0);
  if (f.featured) list = list.filter((p) => p.is_featured);
  return sortProducts(list, f.sort);
}
function loadCategories() { return store.get(K.categories, []).map(normCat); }
async function hydrateCategory(c) { const o = stripCat(clone(c)); o.image = await resolveRef(o.image); return o; }
const reverseObjectUrl = (u) => { for (const [id, url] of objectUrls) if (url === u) return `${IDB_PREFIX}${id}`; return u; };

Object.assign(local, {
  async listCategories({ includeInactive = false, featured } = {}) {
    await ensureSeeded();
    let list = loadCategories();
    if (!includeInactive) list = list.filter((c) => c.is_active);
    if (featured !== undefined && featured !== null) list = list.filter((c) => c.is_featured === !!featured);
    return Promise.all(list.sort(catSort).map(hydrateCategory));
  },
  async getCategory(slugOrId) {
    await ensureSeeded();
    const c = loadCategories().find((x) => x.slug === slugOrId || x.id === slugOrId);
    if (!c) return null;
    if (!c.is_active) { const u = currentLocalUser(); if (!(u && isAdminEmail(u.email))) return null; }
    return hydrateCategory(c);
  },
  async listProducts(o = {}) {
    await ensureSeeded();
    let list = localProductList(o);
    if (o.page) { const { page, pageSize } = pageOf(o); list = list.slice((page - 1) * pageSize, page * pageSize); }
    else if (o.limit > 0) list = list.slice(0, o.limit);
    return Promise.all(list.map((p) => hydrate(p)));
  },
  async listProductsPaged(o = {}) {
    await ensureSeeded();
    const list = localProductList(o); const { page, pageSize } = pageOf(o);
    const items = await Promise.all(list.slice((page - 1) * pageSize, page * pageSize).map((p) => hydrate(p)));
    return { items, total: list.length, page, pageSize };
  },
  async adminListCategories() {
    await ensureSeeded(); requireAdminLocal();
    const products = store.get(K.products, []);
    return Promise.all(loadCategories().sort(catSort).map(async (c) => ({ ...(await hydrateCategory(c)),
      product_count: products.filter((p) => p.category_slug === c.slug).length })));
  },
  async adminUpsertCategory(input) {
    await ensureSeeded(); requireAdminLocal();
    const d = normalizeCategory(input);
    if (d.image) d.image = reverseObjectUrl(d.image);
    const cats = loadCategories();
    const existing = d.id ? cats.find((x) => x.id === d.id) : null;
    if (d.id && !existing) throw err('not_found', 'Category not found');
    if (cats.some((x) => x.slug === d.slug && x.id !== (existing && existing.id))) throw err('validation', 'Slug already used');
    checkParent(cats, existing && existing.id, d.parent_id);
    let out;
    if (existing) {
      const oldSlug = existing.slug;
      Object.assign(existing, d); out = existing;
      if (oldSlug !== d.slug) {
        const products = store.get(K.products, []);
        products.forEach((p) => { if (p.category_slug === oldSlug) p.category_slug = d.slug; });
        store.set(K.products, products);
      }
    } else {
      out = normCat({ ...d, id: uuid(), sort: d.sort !== undefined ? d.sort : (cats.reduce((m, x) => Math.max(m, x.sort), -1) + 1) });
      cats.push(out);
    }
    store.set(K.categories, cats);
    return hydrateCategory(out);
  },
  async adminDeleteCategory(id, { reassignTo } = {}) {
    await ensureSeeded(); requireAdminLocal();
    const cats = loadCategories();
    const c = cats.find((x) => x.id === id);
    if (!c) throw err('not_found', 'Category not found');
    const products = store.get(K.products, []);
    const used = products.filter((p) => p.category_slug === c.slug);
    if (used.length) {
      const target = reassignTo ? cats.find((x) => x.id === reassignTo || x.slug === reassignTo) : null;
      if (!target || target.id === c.id) {
        const e = err('validation', `Category still has ${used.length} product(s); choose a category to reassign them to`);
        e.reason = 'in_use'; e.product_count = used.length; throw e;
      }
      used.forEach((p) => { p.category_slug = target.slug; p.category_id = target.id; });
      store.set(K.products, products);
    }
    cats.filter((x) => x.parent_id === c.id).forEach((x) => { x.parent_id = null; });
    store.set(K.categories, cats.filter((x) => x.id !== id));
    if (String(c.image || '').startsWith(IDB_PREFIX)) await blobDel(c.image.slice(IDB_PREFIX.length));
    return { deleted: true, reassigned: used.length };
  },
  async adminReorderCategories(ids) {
    await ensureSeeded(); requireAdminLocal();
    if (!Array.isArray(ids)) throw err('validation', 'ids must be an array');
    const cats = loadCategories();
    const order = [...new Set(ids)].filter((id) => cats.some((c) => c.id === id));
    const rest = cats.filter((c) => !order.includes(c.id)).sort(catSort).map((c) => c.id);
    [...order, ...rest].forEach((id, i) => { cats.find((c) => c.id === id).sort = i; });
    store.set(K.categories, cats);
    return Promise.all(cats.sort(catSort).map(hydrateCategory));
  },
  // Returns {url, value}: show `url`; pass `value` as category.image to adminUpsertCategory (local: stable idb: ref).
  async uploadCategoryImage(file, { onProgress } = {}) {
    await ensureSeeded(); requireAdminLocal();
    const info = await validateMediaFile(file);
    if (info.type !== 'image') throw err('validation', 'Category image must be a JPEG, PNG or WebP');
    if (typeof onProgress === 'function') onProgress(0);
    const id = uuid(); await blobPut(id, file);
    if (typeof onProgress === 'function') onProgress(1);
    return { url: await blobUrl(id), value: `${IDB_PREFIX}${id}` };
  }
});

async function supaCategoryIds(c, slugs) {
  const all = unwrap(await c.from('categories').select('id,slug,parent_id'));
  const set = expandSlugs(all, slugs);
  return all.filter((x) => set.has(x.slug)).map((x) => x.id);
}
async function supaProductQuery(c, o, count) {
  const f = productFilters(o);
  let query = c.from('products').select(PRODUCT_SELECT, count ? { count: 'exact' } : undefined);
  if (!f.includeInactive) query = query.eq('is_active', true);
  if (f.slugs.length) {
    const ids = await supaCategoryIds(c, f.slugs);
    if (!ids.length) return null; // unknown / hidden category: nothing matches
    query = query.in('category_id', ids);
  }
  if (f.q) {
    const safe = f.q.replace(/[,()%*\\]/g, ' ').trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,tags.cs.{${safe.toLowerCase().replace(/\s+/g, '')}}`);
  }
  if (f.min !== null) query = query.gte('price', f.min);
  if (f.max !== null) query = query.lte('price', f.max);
  if (f.inStock) query = query.gt('stock', 0);
  if (f.featured) query = query.eq('is_featured', true);
  if (f.sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (f.sort === 'price_desc') query = query.order('price', { ascending: false });
  else if (f.sort === 'new') query = query.order('created_at', { ascending: false });
  else query = query.order('is_popular', { ascending: false }).order('review_count', { ascending: false }).order('created_at', { ascending: true });
  return query.order('id'); // stable tie-break so pages never overlap
}
const mapCategory = (r) => normCat({ id: r.id, slug: r.slug, name: r.name, description: r.description, image: r.image,
  parent_id: r.parent_id, sort: r.sort_order, is_featured: r.is_featured, is_active: r.is_active });

Object.assign(supa, {
  async listCategories({ includeInactive = false, featured } = {}) {
    const c = await sb();
    let q = c.from('categories').select('*').order('sort_order').order('name');
    if (!includeInactive) q = q.eq('is_active', true);
    if (featured !== undefined && featured !== null) q = q.eq('is_featured', !!featured);
    return unwrap(await q).map(mapCategory);
  },
  async getCategory(slugOrId) {
    const c = await sb();
    const r = unwrap(await c.from('categories').select('*').eq(UUID_RE.test(slugOrId) ? 'id' : 'slug', String(slugOrId)).maybeSingle());
    return r ? mapCategory(r) : null; // RLS hides inactive categories from non-admins
  },
  async listProducts(o = {}) {
    const c = await sb();
    let query = await supaProductQuery(c, o, false);
    if (!query) return [];
    if (o.page) { const { page, pageSize } = pageOf(o); query = query.range((page - 1) * pageSize, page * pageSize - 1); }
    else if (o.limit > 0) query = query.limit(o.limit);
    return unwrap(await query).map(mapProduct);
  },
  async listProductsPaged(o = {}) {
    const c = await sb(); const { page, pageSize } = pageOf(o);
    const query = await supaProductQuery(c, o, true);
    if (!query) return { items: [], total: 0, page, pageSize };
    const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
    const rows = unwrap({ data, error });
    return { items: rows.map(mapProduct), total: count == null ? rows.length : count, page, pageSize };
  },
  async adminListCategories() {
    await requireAdminSupa();
    const c = await sb();
    return unwrap(await c.from('categories').select('*, products(count)').order('sort_order').order('name'))
      .map((r) => ({ ...mapCategory(r), product_count: (r.products && r.products[0] && r.products[0].count) || 0 }));
  },
  async adminUpsertCategory(input) {
    await requireAdminSupa();
    const d = normalizeCategory(input); const c = await sb();
    const all = unwrap(await c.from('categories').select('id,slug,parent_id,sort_order'));
    if (d.id && !all.some((x) => x.id === d.id)) throw err('not_found', 'Category not found');
    if (all.some((x) => x.slug === d.slug && x.id !== d.id)) throw err('validation', 'Slug already used');
    checkParent(all, d.id, d.parent_id);
    const row = { slug: d.slug, name: d.name, description: d.description, image: d.image, parent_id: d.parent_id,
      is_featured: d.is_featured, is_active: d.is_active };
    if (d.sort !== undefined) row.sort_order = d.sort;
    else if (!d.id) row.sort_order = all.reduce((m, x) => Math.max(m, x.sort_order), -1) + 1;
    const q = d.id ? c.from('categories').update(row).eq('id', d.id) : c.from('categories').insert(row);
    return mapCategory(unwrap(await q.select('*').single()));
  },
  async adminDeleteCategory(id, { reassignTo } = {}) {
    await requireAdminSupa();
    const c = await sb();
    let target = null;
    if (reassignTo) {
      target = UUID_RE.test(reassignTo) ? reassignTo : (unwrap(await c.from('categories').select('id').eq('slug', String(reassignTo)).maybeSingle()) || {}).id;
      if (!target) throw err('validation', 'Unknown reassign target');
    }
    const r = await c.rpc('admin_delete_category', { p_id: id, p_reassign: target });
    if (r.error && /category still has/i.test(String(r.error.message))) {
      const e = err('validation', String(r.error.message)); e.reason = 'in_use'; throw e;
    }
    return { deleted: true, reassigned: Number(unwrap(r)) || 0 };
  },
  async adminReorderCategories(ids) {
    await requireAdminSupa();
    if (!Array.isArray(ids) || ids.some((i) => !UUID_RE.test(i))) throw err('validation', 'ids must be category ids');
    const c = await sb();
    unwrap(await c.rpc('admin_reorder_categories', { p_ids: ids }));
    return supa.adminListCategories();
  },
  async uploadCategoryImage(file, { onProgress } = {}) {
    await requireAdminSupa();
    const info = await validateMediaFile(file);
    if (info.type !== 'image') throw err('validation', 'Category image must be a JPEG, PNG or WebP');
    const c = await sb();
    if (typeof onProgress === 'function') onProgress(0);
    const path = `categories/${uuid()}.${info.ext}`;
    const up = await c.storage.from(bucketName()).upload(path, file, { contentType: info.mime, cacheControl: '31536000', upsert: false });
    if (up.error) unwrap({ error: up.error });
    const url = c.storage.from(bucketName()).getPublicUrl(path).data.publicUrl;
    if (typeof onProgress === 'function') onProgress(1);
    return { url, value: url };
  }
});

/* ====================================================================== */
const impl = mode === 'supabase' ? supa : local;
export const listCategories = (...a) => impl.listCategories(...a);
export const getCategory = (...a) => impl.getCategory(...a);
export const adminListCategories = (...a) => impl.adminListCategories(...a);
export const adminUpsertCategory = (...a) => impl.adminUpsertCategory(...a);
export const adminDeleteCategory = (...a) => impl.adminDeleteCategory(...a);
export const adminReorderCategories = (...a) => impl.adminReorderCategories(...a);
export const uploadCategoryImage = (...a) => impl.uploadCategoryImage(...a);
export const listProductsPaged = (...a) => impl.listProductsPaged(...a);
export const listProducts = (...a) => impl.listProducts(...a);
export const getProduct = (...a) => impl.getProduct(...a);
export const validateCoupon = (...a) => impl.validateCoupon(...a);
export const placeOrder = (...a) => impl.placeOrder(...a);
export const getOrder = (...a) => impl.getOrder(...a);
export const createCardCheckout = (...a) => impl.createCardCheckout(...a);
export const demoMarkPaid = (...a) => impl.demoMarkPaid(...a);
export const listMyOrders = (...a) => impl.listMyOrders(...a);
export const getWishlist = (...a) => impl.getWishlist(...a);
export const toggleWishlist = (...a) => impl.toggleWishlist(...a);
export const signUp = (...a) => impl.signUp(...a);
export const signIn = (...a) => impl.signIn(...a);
export const signOut = (...a) => impl.signOut(...a);
export const getUser = (...a) => impl.getUser(...a);
export const onAuthChange = (...a) => impl.onAuthChange(...a);
export const listReviews = (...a) => impl.listReviews(...a);
export const addReview = (...a) => impl.addReview(...a);
export const subscribeNewsletter = (...a) => impl.subscribeNewsletter(...a);
export const sendContactMessage = (...a) => impl.sendContactMessage(...a);
export const adminListOrders = (...a) => impl.adminListOrders(...a);
export const adminUpdateOrderStatus = (...a) => impl.adminUpdateOrderStatus(...a);
export const adminUpsertProduct = (...a) => impl.adminUpsertProduct(...a);
export const adminDeleteProduct = (...a) => impl.adminDeleteProduct(...a);
export const adminListCoupons = (...a) => impl.adminListCoupons(...a);
export const adminUpsertCoupon = (...a) => impl.adminUpsertCoupon(...a);
export const adminStats = (...a) => impl.adminStats(...a);
export const uploadMedia = (...a) => impl.uploadMedia(...a);
export const deleteMedia = (...a) => impl.deleteMedia(...a);
export const reorderMedia = (...a) => impl.reorderMedia(...a);
export const setCover = (...a) => impl.setCover(...a);
export const request3D = (...a) => impl.request3D(...a);
export const get3DJob = (...a) => impl.get3DJob(...a);
export const list3DJobs = (...a) => impl.list3DJobs(...a);
export const getPreferences = (...a) => impl.getPreferences(...a);
export const setPreferences = (...a) => impl.setPreferences(...a);
export { COUPON_DEFAULT };
