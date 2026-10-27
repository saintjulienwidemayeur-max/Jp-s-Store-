'use strict';
const assert = require('assert');

function makeHarness(browser, base, viewport, vpName) {
  const contexts = [];
  const errors = [];
  const h = {
    base, vpName, isMobile: vpName === 'mobile', assert,
    url: (p) => base + '/' + p.replace(/^\//, ''),
    async newContext(opts = {}) {
      const ctx = await browser.newContext({ viewport, serviceWorkers: 'allow', ...opts });
      // The sandbox has no internet: answer third-party requests (Google Fonts) with empty 200s.
      await ctx.route((u) => new URL(u).origin !== base, (r) => {
        const u = r.request().url();
        r.fulfill({ status: 200, contentType: u.includes('.css') || u.includes('css2') ? 'text/css' : 'text/plain', body: '' });
      });
      contexts.push(ctx);
      return ctx;
    },
    async page(ctx) {
      ctx = ctx || await h.newContext();
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()} @ ${page.url()}`); });
      page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message} @ ${page.url()}`));
      page.on('dialog', (d) => d.accept());
      return page;
    },
    allowErrors(re) { for (let i = errors.length - 1; i >= 0; i--) if (re.test(errors[i])) errors.splice(i, 1); },
    assertNoConsoleErrors() { assert.strictEqual(errors.length, 0, 'console errors:\n' + errors.join('\n')); },
    async noHScroll(page, label) {
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(r.sw <= r.cw + 1, `horizontal scroll on ${label || page.url()}: scrollWidth ${r.sw} > ${r.cw}`);
    },
    // go to a page and wait until its module has rendered something into #main
    async go(page, p) {
      await page.goto(h.url(p), { waitUntil: 'load' });
      await page.waitForSelector('#site-header');
      await page.waitForLoadState('networkidle');
    },
    async signIn(page, email, password) {
      await h.go(page, 'account.html');
      await page.fill('#a-email', email); await page.fill('#a-pass', password);
      await page.click('#auth-form button[type=submit]');
      await page.waitForSelector('#signout');
    },
    async close() { for (const c of contexts) await c.close().catch(() => {}); },
  };
  return h;
}
async function fillCheckout(page, over = {}) {
  const v = { name: 'Marie Jean', email: 'marie@example.com', phone: '+509 3700 1234', address: '12 Rue Capois', city: 'Port-au-Prince', country: 'Haiti', notes: 'Call first', ...over };
  for (const k of ['name', 'email', 'phone', 'address', 'city', 'country']) await page.fill(`#f-${k}`, v[k]);
  await page.fill('#f-notes', v.notes);
  return v;
}
// place an order straight through the data layer (setup helper)
async function placeOrderViaApi(page, { slug = 'haiti-scarf', qty = 1, email = 'buyer@example.com', name = 'Buyer', notes = '', payment = 'moncash', coupon } = {}) {
  return page.evaluate(async (a) => {
    const api = await import('/js/api.js');
    const p = await api.getProduct(a.slug);
    return api.placeOrder({ customer: { name: a.name, email: a.email, phone: '5551234567', address: '1 Main St', city: 'Miami', country: 'USA', notes: a.notes },
      items: [{ product_id: p.id, qty: a.qty }], coupon_code: a.coupon, payment_method: a.payment });
  }, { slug, qty, email, name, notes, payment, coupon });
}
module.exports = { makeHarness, fillCheckout, placeOrderViaApi };
