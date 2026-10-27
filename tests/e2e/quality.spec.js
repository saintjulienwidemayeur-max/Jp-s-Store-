'use strict';
const { placeOrderViaApi, fillCheckout } = require('./lib');

const AUDIT = () => {
  const out = [];
  const name = (el) => (el.getAttribute('aria-label') || '').trim()
    || (el.getAttribute('aria-labelledby') ? el.getAttribute('aria-labelledby').split(/\s+/).map((i) => document.getElementById(i)?.textContent || '').join(' ').trim() : '')
    || (el.textContent || '').trim() || (el.getAttribute('title') || '').trim()
    || [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join('').trim();
  const vis = (el) => !el.closest('[hidden],[inert]') && el.getClientRects().length > 0;
  document.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('alt')) out.push('img without alt: ' + i.src); });
  document.querySelectorAll('input,select,textarea').forEach((el) => {
    if (['hidden', 'submit', 'button'].includes(el.type)) return;
    const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label');
    if (!labelled) out.push(`unlabelled <${el.tagName.toLowerCase()}> name=${el.name} id=${el.id}`);
  });
  document.querySelectorAll('button,[role=button]').forEach((b) => { if (!name(b)) out.push('button without name: ' + b.outerHTML.slice(0, 100)); });
  document.querySelectorAll('a[href]').forEach((a) => { if (!a.closest('[aria-hidden=true]') && !name(a)) out.push('link without name: ' + a.outerHTML.slice(0, 100)); });
  document.querySelectorAll('[id]').forEach((el) => { if (document.querySelectorAll(`[id="${CSS.escape(el.id)}"]`).length > 1) out.push('duplicate id ' + el.id); });
  document.querySelectorAll('[aria-controls]').forEach((el) => { el.getAttribute('aria-controls').split(/\s+/).forEach((i) => { if (!document.getElementById(i)) out.push('aria-controls target missing: ' + i); }); });
  if (!document.documentElement.lang) out.push('html lang missing');
  if (document.querySelectorAll('h1').length !== 1) out.push('h1 count = ' + document.querySelectorAll('h1').length);
  if (!document.querySelector('main')) out.push('no <main>');
  document.querySelectorAll('a[target=_blank]').forEach((a) => { if (!/noopener/.test(a.rel)) out.push('target=_blank without noopener'); });
  return out;
};

module.exports = [
  ['a11y audit: alt text, labels, button/link names, unique ids, landmarks on every page', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html'); await page.waitForSelector('#popular .pcard');
    await page.click('.pcard[data-slug="haiti-scarf"] [data-add]');
    await placeOrderViaApi(page);
    const problems = [];
    for (const p of ['index.html', 'shop.html', 'product.html?slug=haiti-scarf', 'product.html?slug=haiti-flag', 'wishlist.html', 'info.html?p=about', 'info.html?p=contact',
      'info.html?p=faq', 'info.html?p=shipping', 'info.html?p=returns', 'cart.html', 'checkout.html', 'order.html', 'account.html', 'admin.html', 'nope-404']) {
      if (p === 'nope-404') { await page.goto(h.url(p)); await page.waitForSelector('.nf'); h.allowErrors(/404/); } else await h.go(page, p);
      problems.push(...(await page.evaluate(AUDIT)).map((x) => `${p}: ${x}`));
    }
    await h.signIn(page, 'admin@jpslogistics.me', 'admin123');
    for (const tab of ['overview', 'orders', 'products', 'coupons']) {
      await h.go(page, 'admin.html'); await page.waitForSelector('.a-stats'); await page.click(`[data-tab=${tab}]`);
      if (tab === 'products') await page.click('[data-act=new-product]');
      if (tab === 'coupons') await page.click('[data-act=new-coupon]');
      problems.push(...(await page.evaluate(AUDIT)).map((x) => `admin/${tab}: ${x}`));
    }
    // overlay + drawer + validation errors state
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard'); await page.click('.pcard[data-slug="haiti-scarf"] [data-add]');
    await h.go(page, 'checkout.html'); await page.waitForSelector('#checkout-form');
    await page.click('#checkout-form button[type=submit]'); await page.waitForSelector('.c-err');
    problems.push(...(await page.evaluate(AUDIT)).map((x) => `checkout-errors: ${x}`));
    await h.go(page, 'index.html'); await page.click('#search-btn'); await page.fill('#search-input', 'sc'); await page.waitForSelector('.so-list a');
    problems.push(...(await page.evaluate(AUDIT)).map((x) => `search-overlay: ${x}`));
    h.assert.deepStrictEqual([...new Set(problems)], []);
  }],

  ['keyboard: skip link first, focus is visible on links/buttons/inputs', async (h) => {
    const page = await h.page();
    const visible = () => page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return { ok: false, desc: 'body' };
      const s = getComputedStyle(el);
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const shadow = s.boxShadow && s.boxShadow !== 'none';
      return { ok: outline || shadow, desc: el.tagName + '.' + el.className + '#' + el.id };
    });
    for (const p of ['index.html', 'shop.html', 'checkout.html', 'account.html']) {
      await h.go(page, p);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press('Tab');
      h.assert.ok(await page.evaluate(() => document.activeElement.classList.contains('skip')), 'first tab stop is the skip link on ' + p);
      const bad = [];
      for (let i = 0; i < 14; i++) { const v = await visible(); if (!v.ok) bad.push(v.desc); await page.keyboard.press('Tab'); }
      h.assert.deepStrictEqual(bad, [], 'elements with no visible focus indicator on ' + p);
    }
    await h.go(page, 'checkout.html');
  }],

  ['PWA: service worker registers, manifest and icons valid, offline shell works', async (h) => {
    const ctx = await h.newContext();
    const page = await h.page(ctx);
    await h.go(page, 'index.html');
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 15000 });
    const href = await page.getAttribute('link[rel=manifest]', 'href');
    const res = await page.request.get(h.url(href));
    h.assert.strictEqual(res.status(), 200);
    const m = await res.json();
    for (const k of ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color', 'background_color']) h.assert.ok(m[k], 'manifest.' + k);
    for (const ic of m.icons) { const r = await page.request.get(h.url(ic.src)); h.assert.strictEqual(r.status(), 200, ic.src); h.assert.match(r.headers()['content-type'], /image\/png/); }
    h.assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512'));
    // offline: pages previously visited (and the shell) still load
    await h.go(page, 'shop.html'); await h.go(page, 'cart.html'); await h.go(page, 'admin.html'); await h.go(page, 'account.html'); await h.go(page, 'checkout.html'); await h.go(page, 'order.html');
    await page.reload(); await page.waitForLoadState('networkidle');
    await ctx.setOffline(true);
    for (const p of ['index.html', 'shop.html', 'cart.html', 'account.html', 'checkout.html', 'order.html', 'admin.html']) {
      await page.goto(h.url(p), { waitUntil: 'load' });
      await page.waitForSelector('#site-header', { timeout: 8000 });
      h.assert.ok((await page.locator('main').innerText()).trim().length > 0, 'offline render ' + p);
    }
    await ctx.setOffline(false);
    h.allowErrors(/./); // offline navigations log failed fetches by design
  }, { viewports: ['mobile'] }],

  ['security: user/product/order text is never executed (XSS) and URLs params are inert', async (h) => {
    const X = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
    const page = await h.page();
    await h.go(page, 'index.html');
    // 1. malicious product via admin
    await h.signIn(page, 'admin@jpslogistics.me', 'admin123');
    await page.evaluate(async (x) => {
      const api = await import('/js/api.js');
      await api.adminUpsertProduct({ name: 'Evil ' + x, slug: 'evil', description: 'd ' + x, price: 5, stock: 2, category_slug: 'fan-zone', image: 'x" onerror="window.__xss=9', tags: [x], is_active: true, is_popular: true });
      await api.adminUpsertCoupon({ code: 'XSS' + x.slice(0, 0) + 'A', percent: 5, min_subtotal: 0, is_active: true, active: true });
    }, X);
    await page.evaluate(async (x) => {
      const api = await import('/js/api.js');
      const p = await api.getProduct('evil');
      await api.placeOrder({ customer: { name: 'N ' + x, email: 'e@example.com', phone: '5551234567', address: 'A ' + x, city: 'C ' + x, country: 'K ' + x, notes: 'NT ' + x }, items: [{ product_id: p.id, qty: 1 }], payment_method: 'zelle' });
    }, X);
    const pages = ['index.html', 'shop.html', 'shop.html?q=evil', 'product.html?slug=evil', 'wishlist.html', 'cart.html', 'account.html'];
    await page.evaluate(async () => { const api = await import('/js/api.js'); const p = await api.getProduct('evil'); await api.toggleWishlist(p.id); });
    await page.evaluate(() => { const c = [{ product_id: 'x', slug: 'evil', name: '<img src=x onerror="window.__xss=7">', price: 1, image: null, qty: 1 }]; localStorage.setItem('jps_cart_v1', JSON.stringify(c)); });
    for (const p of pages) {
      await h.go(page, p);
      await page.waitForTimeout(150);
      h.assert.strictEqual(await page.evaluate(() => window.__xss), undefined, 'XSS executed on ' + p);
    }
    await page.click('#search-btn'); await page.fill('#search-input', 'evil'); await page.waitForSelector('.so-list a'); await page.waitForTimeout(100);
    h.assert.strictEqual(await page.evaluate(() => window.__xss), undefined, 'XSS in search overlay');
    // 2. admin views
    for (const tab of ['orders', 'products', 'coupons']) {
      await h.go(page, 'admin.html'); await page.waitForSelector('.a-stats'); await page.click(`[data-tab=${tab}]`); await page.waitForTimeout(150);
      if (tab === 'products') { await page.locator('tr', { hasText: 'Evil' }).locator('[data-act=edit-product]').click(); await page.waitForTimeout(150); }
      h.assert.strictEqual(await page.evaluate(() => window.__xss), undefined, 'XSS in admin ' + tab);
    }
    // 3. order page + tracking with hostile params
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('jps_orders')));
    await h.go(page, `order.html?n=${encodeURIComponent(orders[0].order_number)}&e=e@example.com`);
    await page.waitForSelector('.c-ordnum'); await page.waitForTimeout(150);
    h.assert.strictEqual(await page.evaluate(() => window.__xss), undefined, 'XSS on order page');
    for (const p of [`order.html?n=${encodeURIComponent(X)}&e=${encodeURIComponent(X)}`, `shop.html?q=${encodeURIComponent(X)}`, `shop.html?category=${encodeURIComponent(X)}`,
      `info.html?p=${encodeURIComponent(X)}`, `product.html?slug=${encodeURIComponent(X)}`, `product.html?id=${encodeURIComponent(X)}`]) {
      await h.go(page, p); await page.waitForTimeout(150);
      h.assert.strictEqual(await page.evaluate(() => window.__xss), undefined, 'XSS via URL ' + p);
    }
    // 4. no injected elements from product text
    await h.go(page, 'shop.html?q=evil'); await page.waitForSelector('.pcard');
    h.assert.strictEqual(await page.locator('.pcard img[src="x"]').count(), 0);
    h.assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
    h.allowErrors(/status of 404/); // hostile image URL legitimately 404s
  }],

  ['security: no secrets in localStorage; passwords never stored in clear; no open redirect', async (h) => {
    const page = await h.page();
    await h.go(page, 'account.html');
    await page.click('#tab-signup');
    await page.fill('#a-name', 'Sec'); await page.fill('#a-email', 'sec@example.com'); await page.fill('#a-pass', 'Sup3rSecret!');
    await page.click('#auth-form button[type=submit]'); await page.waitForSelector('#signout');
    const dump = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    h.assert.ok(!dump.includes('Sup3rSecret!'), 'plain password stored');
    h.assert.ok(!dump.includes('admin123'), 'admin password stored in clear');
    h.assert.ok(!/service_role|sk_live|secret_key/i.test(dump));
    // redirect-ish params are never followed
    for (const p of ['account.html?next=https://evil.example', 'account.html?redirect=//evil.example', 'checkout.html?return=https://evil.example', 'order.html?n=a&e=b&next=https://evil.example']) {
      await h.go(page, p);
      h.assert.strictEqual(new URL(page.url()).origin, h.base, p);
    }
    // security headers on static server
    const r = await page.request.get(h.url('index.html'));
    h.assert.strictEqual(r.headers()['x-content-type-options'], 'nosniff');
    for (const blocked of ['server.js', 'package.json', 'sql/schema.sql', 'tests/e2e/run.js', '.git/config', '..%2fserver.js']) {
      const b = await page.request.get(h.url(blocked));
      h.assert.strictEqual(b.status(), 404, blocked);
    }
  }],
];
