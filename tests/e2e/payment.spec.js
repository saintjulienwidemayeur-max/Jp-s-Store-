'use strict';
// Debit-card payment (Stripe-hosted; DEMO screen in local mode) and the multi-step checkout.
const addScarf = async (h, page) => {
  await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
  await page.click('.pcard[data-slug="haiti-scarf"] [data-add]');
};
const stepOf = (page) => page.locator('#checkout-form').getAttribute('data-step');
const next = (page) => page.click('#checkout-form button[type=submit]');
const V = { name: 'Marie Jean', email: 'marie@example.com', phone: '+509 3700 1234', address: '12 Rue Capois', city: 'Port-au-Prince', country: 'Haiti' };

module.exports = [
  ['checkout steps: stepper, per-step validation, Back, hash deep-link redirect, refresh persistence', async (h) => {
    const page = await h.page();
    await h.go(page, 'checkout.html'); // empty cart -> cart page
    await page.waitForURL(/cart\.html/);
    await addScarf(h, page);
    await h.go(page, 'checkout.html'); await page.waitForSelector('#checkout-form');
    h.assert.strictEqual(await stepOf(page), 'contact');
    h.assert.match(page.url(), /#contact$/);
    h.assert.strictEqual(await page.locator('.c-steps li[aria-current=step]').count(), 1);
    h.assert.match(await page.locator('.c-steps li[aria-current=step]').innerText(), /Contact/);
    h.assert.match(await page.locator('#step-live').innerText(), /Step 1 of 4/);
    await h.noHScroll(page, 'checkout contact');
    // step 1 validation: stays, inline errors, focus on first bad field
    await next(page);
    await page.waitForSelector('.c-err');
    h.assert.strictEqual(await stepOf(page), 'contact');
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'f-name');
    await page.fill('#f-name', V.name); await page.fill('#f-email', 'nope'); await page.fill('#f-phone', V.phone);
    await next(page);
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'f-email');
    await page.fill('#f-email', V.email);
    await next(page);
    await page.waitForSelector('#f-address');
    h.assert.strictEqual(await stepOf(page), 'address');
    h.assert.match(page.url(), /#address$/);
    h.assert.match(await page.locator('#step-live').innerText(), /Step 2 of 4/);
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'step-h', 'focus moves to the step heading');
    h.assert.match(await page.locator('.c-ship-banner').innerText(), /Shipping included/i);
    // step 2 validation
    await page.fill('#f-country', '');
    await next(page);
    await page.waitForSelector('.c-err');
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'f-address');
    // Back keeps values; browser Back works through the hash history
    await page.click('[data-back]');
    await page.waitForSelector('#f-name');
    h.assert.strictEqual(await page.inputValue('#f-email'), V.email);
    await page.goBack(); // browser Back returns to the Delivery step
    await page.waitForSelector('#f-address');
    // refresh persistence (sessionStorage)
    await page.fill('#f-address', V.address); await page.fill('#f-city', V.city); await page.fill('#f-country', V.country);
    await page.reload(); await page.waitForSelector('#checkout-form');
    h.assert.strictEqual(await stepOf(page), 'address');
    h.assert.strictEqual(await page.inputValue('#f-city'), V.city);
    // deep link to a later step redirects to the first incomplete one
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('about:blank'); await page.goto(h.url('checkout.html#review'));
    await page.waitForSelector('#checkout-form[data-step=contact]');
    h.assert.match(page.url(), /#contact$/);
    h.assert.strictEqual(await page.inputValue('#f-name'), '');
    // no card number / cvc inputs anywhere in checkout
    h.assert.strictEqual(await page.locator('input[autocomplete^="cc-"], input[name*="card" i], input[name*="cvc" i]').count(), 0);
  }],

  ['debit card checkout (demo): default method with logos, review edit, demo pay, cancel + try again', async (h) => {
    const page = await h.page();
    await addScarf(h, page);
    await h.go(page, 'cart.html'); await page.fill('#coupon-input', 'HT26'); await page.click('#coupon-form button'); await page.waitForSelector('.c-discount');
    h.assert.ok(await page.locator('.pay-logos img[alt="Visa"]').count(), 'secure-payment logos on cart');
    await h.go(page, 'checkout.html'); await page.waitForSelector('#checkout-form');
    for (const k of ['name', 'email', 'phone']) await page.fill(`#f-${k}`, V[k]);
    await next(page); await page.waitForSelector('#f-address');
    for (const k of ['address', 'city', 'country']) await page.fill(`#f-${k}`, V[k]);
    await next(page); await page.waitForSelector('input[name=payment]');
    h.assert.strictEqual(await stepOf(page), 'payment');
    h.assert.strictEqual(await page.locator('input[name=payment][value=debit_card]').isChecked(), true, 'debit card default');
    h.assert.strictEqual(await page.locator('input[name=payment]').first().getAttribute('value'), 'debit_card', 'debit card listed first');
    for (const b of ['Visa', 'Mastercard', 'American Express', 'Discover']) h.assert.ok(await page.locator(`.c-pay-card img[alt="${b}"]`).count(), b + ' logo');
    h.assert.deepStrictEqual(await page.$$eval('input[name=payment]', (e) => e.map((x) => x.value)), ['debit_card', 'moncash', 'zelle', 'cash_on_delivery']);
    await h.noHScroll(page, 'checkout payment');
    await next(page); await page.waitForSelector('#checkout-form[data-step=review]');
    const review = await page.locator('#checkout-form').innerText();
    h.assert.match(review, /Marie Jean/); h.assert.match(review, /12 Rue Capois/); h.assert.match(review, /Debit card/);
    h.assert.ok(await page.locator('[data-edit=contact]').count());
    h.assert.match(await page.locator('#checkout-form button[type=submit]').innerText(), /pay by card/i);
    // Edit link goes back, and returning keeps state
    await page.click('[data-edit=address]'); await page.waitForSelector('#f-address');
    h.assert.strictEqual(await page.inputValue('#f-address'), V.address);
    await next(page); await next(page); await page.waitForSelector('#checkout-form[data-step=review]');
    await h.noHScroll(page, 'checkout review');
    await next(page);
    // demo payment screen (local mode / no Stripe)
    await page.waitForURL(/order\.html\?n=JPS-\d{6}-[A-Z0-9]{4}&e=.*&demo=1/);
    await page.waitForSelector('#demo-pay');
    const demo = await page.locator('main').innerText();
    h.assert.match(demo, /DEMO/); h.assert.match(demo, /\$15\.29/);
    h.assert.match(await page.locator('#demo-pay').innerText(), /Simulate successful payment \(demo\)/);
    h.assert.strictEqual(await page.locator('main input').count(), 0, 'demo screen has NO inputs, certainly no card form');
    h.assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jps_cart_v1') || '[]').length), 0);
    await h.noHScroll(page, 'demo screen');
    // cancel -> payment cancelled + Try again -> demo again
    await page.click('#demo-cancel');
    await page.waitForSelector('#pay-again');
    h.assert.match(await page.locator('.c-paystate').innerText(), /Payment cancelled/);
    h.assert.match(await page.locator('.c-status').innerText(), /pending/i);
    await page.click('#pay-again');
    await page.waitForSelector('#demo-pay');
    await page.click('#demo-pay');
    await page.waitForSelector('.c-paystate.ok');
    h.assert.match(await page.locator('.c-paystate').innerText(), /Payment received/);
    h.assert.match(await page.locator('.c-status').innerText(), /paid/i);
    h.assert.strictEqual(await page.locator('#pay-again').count(), 0);
    const o = await page.evaluate(() => JSON.parse(localStorage.getItem('jps_orders'))[0]);
    h.assert.strictEqual(o.payment_status, 'paid'); h.assert.strictEqual(o.payment_method, 'debit_card');
    h.assert.strictEqual(o.total, 15.29);
    await h.noHScroll(page, 'order paid');
    // reloading the demo URL of a paid order does not show the demo screen again
    await page.goto(page.url().replace(/&paid=1/, '') + '&demo=1');
    await page.waitForSelector('.c-ordnum');
    h.assert.strictEqual(await page.locator('#demo-pay').count(), 0);
  }],

  ['order page shows Paid after returning from Stripe (?paid=1) once the order is paid, Try again when unpaid', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    const o = await page.evaluate(async () => {
      const api = await import('/js/api.js'); const p = await api.getProduct('haiti-scarf');
      return api.placeOrder({ customer: { name: 'A B', email: 'ab@example.com', phone: '5551234567', address: '1 Main', city: 'Miami', country: 'USA', notes: '' }, items: [{ product_id: p.id, qty: 1 }], payment_method: 'debit_card' });
    });
    const q = `n=${o.order_number}&e=ab%40example.com`;
    await h.go(page, `order.html?${q}&cancelled=1`);
    await page.waitForSelector('#pay-again');
    h.assert.match(await page.locator('#pay-again').innerText(), /Try again/);
    // webhook lands while the customer is back on ?paid=1: the page polls and flips to paid
    await h.go(page, `order.html?${q}&paid=1`);
    await page.waitForSelector('.c-paystate');
    h.assert.match(await page.locator('.c-paystate').innerText(), /Confirming/);
    await page.evaluate((num) => { const l = JSON.parse(localStorage.getItem('jps_orders')); const x = l.find((r) => r.order_number === num); x.payment_status = 'paid'; x.status = 'paid'; localStorage.setItem('jps_orders', JSON.stringify(l)); }, o.order_number);
    await page.waitForSelector('.c-paystate.ok', { timeout: 8000 });
    h.assert.match(await page.locator('.c-status').innerText(), /paid/i);
  }],
];
