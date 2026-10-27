'use strict';
const addFromCard = async (page, slug) => { await page.click(`.pcard[data-slug="${slug}"] [data-add]`); };
const cartCount = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jps_cart_v1') || '[]').reduce((n, l) => n + l.qty, 0));

const { fillCheckout, placeFromPayment } = require('./lib');

module.exports = [
  ['wishlist toggle persists across reloads and shows on wishlist page', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    await page.waitForSelector('#popular .pcard');
    const heart = page.locator('.pcard[data-slug="haiti-scarf"] [data-wish]');
    await heart.click();
    await page.waitForFunction(() => document.querySelector('.pcard[data-slug="haiti-scarf"] [data-wish]').getAttribute('aria-pressed') === 'true');
    await page.reload(); await page.waitForSelector('#popular .pcard'); await page.waitForLoadState('networkidle');
    h.assert.strictEqual(await page.locator('.pcard[data-slug="haiti-scarf"] [data-wish]').getAttribute('aria-pressed'), 'true');
    await h.go(page, 'wishlist.html');
    await page.waitForSelector('.pcard');
    h.assert.deepStrictEqual(await page.$$eval('.pcard', (e) => e.map((x) => x.dataset.slug)), ['haiti-scarf']);
    await page.click('.pcard [data-wish]');
    await page.waitForSelector('.state');
    // product page heart
    await h.go(page, 'product.html?slug=haiti-headband');
    await page.click('.wish');
    await page.waitForFunction(() => document.querySelector('.wish').classList.contains('on'));
  }],

  ['add to cart from card and product page; qty and remove in cart', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    await page.waitForSelector('#popular .pcard');
    await addFromCard(page, 'haiti-headband');
    h.assert.strictEqual(await cartCount(page), 1);
    await page.waitForFunction(() => document.querySelector('[data-cart-badge]').textContent === '1' && !document.querySelector('[data-cart-badge]').hidden);
    await h.go(page, 'product.html?slug=haiti-scarf');
    await page.click('#q-inc'); await page.click('#add');
    h.assert.strictEqual(await cartCount(page), 3);
    await h.go(page, 'cart.html');
    await page.waitForSelector('.c-line');
    h.assert.strictEqual(await page.locator('.c-line').count(), 2);
    // subtotal 9.99 + 2*17.99 = 45.97
    h.assert.match(await page.locator('.c-grand dd').innerText(), /\$45\.97/);
    await page.click('.c-line[data-pid] [data-act=inc] >> nth=0');
    await page.waitForFunction(() => /\$55\.96/.test(document.querySelector('.c-grand dd').textContent));
    await page.click('[data-act=dec] >> nth=0');
    await page.waitForFunction(() => /\$45\.97/.test(document.querySelector('.c-grand dd').textContent));
    await page.click('.c-line [data-act=rm] >> nth=0');
    await page.waitForFunction(() => document.querySelectorAll('.c-line').length === 1);
    h.assert.strictEqual(await cartCount(page), 2);
    await page.click('.c-line [data-act=rm]');
    await page.waitForSelector('.c-empty');
    h.assert.strictEqual(await page.locator('[data-cart-badge]').isHidden(), true);
  }],

  ['coupon HT26: not applied at/below $10, applied (15%) above $10, shipping $0', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html'); await page.waitForSelector('#popular .pcard');
    await addFromCard(page, 'haiti-headband'); // $9.99
    await h.go(page, 'cart.html'); await page.waitForSelector('.c-line');
    await page.fill('#coupon-input', 'ht26'); await page.click('#coupon-form button');
    await page.waitForFunction(() => document.querySelector('#coupon-msg').textContent.trim().length > 0);
    h.assert.strictEqual(await page.locator('.c-discount').count(), 0, 'no discount at $9.99');
    h.assert.match(await page.locator('#coupon-msg').innerText(), /\$10/);
    h.assert.match(await page.locator('.c-grand dd').innerText(), /\$9\.99/);
    await page.click('[data-act=inc]');
    await page.fill('#coupon-input', 'HT26'); await page.click('#coupon-form button');
    await page.waitForSelector('.c-discount');
    // 19.98 -> discount 3.00 (2.997 rounded), total 16.98
    h.assert.match(await page.locator('.c-discount dd').innerText(), /\$3\.00/);
    h.assert.match(await page.locator('.c-grand dd').innerText(), /\$16\.98/);
    h.assert.match(await page.locator('.c-totals').innerText(), /Shipping[\s\S]*included/i);
    // scarf alone: 17.99 -> 2.70 off -> 15.29
    await page.click('[data-act=rm]');
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
    await addFromCard(page, 'haiti-scarf');
    await h.go(page, 'cart.html'); await page.waitForSelector('.c-line');
    await page.waitForSelector('.c-discount'); // coupon persisted in session
    h.assert.match(await page.locator('.c-grand dd').innerText(), /\$15\.29/);
    // unknown code
    await page.click('[data-act=unapply]');
    await page.fill('#coupon-input', 'NOPE'); await page.click('#coupon-form button');
    await page.waitForFunction(() => document.querySelector('#coupon-msg').classList.contains('err'));
  }],

  ['checkout out_of_stock path and invalid coupon path', async (h) => {
    const page = await h.page();
    await h.go(page, 'product.html?slug=haiti-scarf');
    await page.click('#q-inc'); await page.click('#q-inc'); await page.click('#add'); // qty 3
    await h.go(page, 'cart.html'); await page.fill('#coupon-input', 'HT26'); await page.click('#coupon-form button'); await page.waitForSelector('.c-discount');
    await h.go(page, 'checkout.html'); await page.waitForSelector('#checkout-form');
    await fillCheckout(page);
    // stock drops to 1 behind our back
    await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('jps_products')); l.find((p) => p.slug === 'haiti-scarf').stock = 1; localStorage.setItem('jps_products', JSON.stringify(l)); });
    await placeFromPayment(page, 'moncash');
    await page.waitForSelector('.c-alert.err');
    await page.waitForSelector('.c-stock-warn');
    h.assert.match(await page.locator('.c-stock-warn').innerText(), /1/);
    await page.click('[data-fix]');
    await page.waitForFunction(() => !document.querySelector('.c-stock-warn'));
    // form values survived
    h.assert.match(await page.locator('#checkout-form').innerText(), /marie@example\.com/);
    // now deactivate coupon behind our back -> invalid_coupon
    await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('jps_coupons')); l[0].active = false; localStorage.setItem('jps_coupons', JSON.stringify(l)); });
    await page.click('#checkout-form button[type=submit]');
    await page.waitForFunction(() => document.querySelector('.c-alert.err') && /coupon/i.test(document.querySelector('.c-alert.err').textContent));
    // retry without coupon succeeds
    await page.click('#checkout-form button[type=submit]');
    await page.waitForURL(/order\.html\?n=JPS-/);
  }],

  ['checkout validation errors are shown and focus moves to first invalid field', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
    await addFromCard(page, 'haiti-scarf');
    await h.go(page, 'checkout.html'); await page.waitForSelector('#checkout-form');
    await page.click('#checkout-form button[type=submit]');
    await page.waitForSelector('.c-err');
    h.assert.ok((await page.locator('.c-err').count()) >= 3);
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'f-name');
    // per-step validation keeps us on step 1; debit card is the default payment, card_soon is gone
    h.assert.strictEqual(await page.locator('#checkout-form').getAttribute('data-step'), 'contact');
    await fillCheckout(page);
    h.assert.strictEqual(await page.locator('input[name=payment][value=card_soon]').count(), 0);
    h.assert.strictEqual(await page.locator('input[name=payment][value=debit_card]').isChecked(), true);
  }],

  ['full checkout for every enabled payment method, order page and guest tracking', async (h) => {
    const methods = await (async () => { const cfg = require('fs').readFileSync(require('path').join(__dirname, '../../js/config.js'), 'utf8'); return [...cfg.matchAll(/id: '(\w+)', label: '[^']*', enabled: true/g)].map((m) => m[1]); })();
    h.assert.deepStrictEqual(methods, ['debit_card', 'moncash', 'zelle', 'cash_on_delivery']);
    const page = await h.page();
    for (const m of methods.filter((x) => x !== 'debit_card')) { // debit_card has its own spec (payment.spec.js)
      await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
      await addFromCard(page, 'haiti-scarf');
      await h.go(page, 'cart.html'); await page.fill('#coupon-input', 'HT26'); await page.click('#coupon-form button'); await page.waitForSelector('.c-discount');
      await h.go(page, 'checkout.html'); await page.waitForSelector('#checkout-form');
      const v = await fillCheckout(page);
      await placeFromPayment(page, m);
      await page.waitForURL(/order\.html\?n=JPS-\d{6}-[A-Z0-9]{4}&e=/);
      await page.waitForSelector('.c-ordnum');
      const num = (await page.locator('.c-ordnum').innerText()).trim();
      h.assert.match(num, /^JPS-\d{6}-[A-Z0-9]{4}$/);
      const body = await page.locator('main').innerText();
      h.assert.match(body, /\$15\.29/); h.assert.match(body, /Haiti Scarf/); h.assert.match(body, /HT26/);
      h.assert.ok(await page.locator('.c-pay-instr').count(), 'payment instructions shown for ' + m);
      h.assert.match(await page.locator('.c-pay-instr').innerText(), new RegExp(num));
      h.assert.strictEqual(await cartCount(page), 0, 'cart cleared');
      await h.noHScroll(page, 'order');
      // guest tracking: new anonymous context
      const g = await h.page(await h.newContext());
      await h.go(g, 'index.html');
      // orders live in this browser's localStorage in local mode: copy them over
      const orders = await page.evaluate(() => localStorage.getItem('jps_orders'));
      await g.evaluate((o) => localStorage.setItem('jps_orders', o), orders);
      await h.go(g, 'order.html');
      await g.fill('#t-n', num.toLowerCase()); await g.fill('#t-e', 'wrong@example.com');
      await g.click('#track-form button');
      await g.waitForSelector('.c-alert.err');
      await g.fill('#t-n', num); await g.fill('#t-e', v.email.toUpperCase());
      await g.click('#track-form button');
      await g.waitForSelector('.c-ordnum');
      h.assert.strictEqual((await g.locator('.c-ordnum').innerText()).trim(), num);
      await g.close();
    }
    // wrong email through direct URL shows track form, not the order
    await h.go(page, 'order.html?n=JPS-000000-AAAA&e=x@y.zz');
    await page.waitForSelector('#track-form');
  }],
];
