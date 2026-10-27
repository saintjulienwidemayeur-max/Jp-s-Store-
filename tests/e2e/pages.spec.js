'use strict';
const PAGES = ['index.html', 'shop.html', 'product.html?slug=haiti-scarf', 'wishlist.html', 'info.html?p=about', 'info.html?p=contact',
  'info.html?p=faq', 'info.html?p=shipping', 'info.html?p=returns', 'cart.html', 'checkout.html', 'order.html', 'account.html', 'admin.html'];

module.exports = [
  ['every page loads with zero console errors and no horizontal scroll', async (h) => {
    const page = await h.page();
    for (const p of PAGES) {
      await h.go(page, p);
      await h.noHScroll(page, p);
      h.assert.ok((await page.locator('h1').count()) >= 1, `${p} has an h1`);
      h.assert.ok((await page.locator('main').innerText()).trim().length > 0, `${p} main not empty`);
    }
    // missing URL -> 404 page
    const res = await page.goto(h.url('definitely-missing-page'), { waitUntil: 'load' });
    h.assert.strictEqual(res.status(), 404);
    await page.waitForSelector('.nf');
    h.assert.match(await page.locator('h1').innerText(), /not found|page|introuvable|pa jwenn/i);
    await h.noHScroll(page, '404');
    h.allowErrors(/status of 404.*definitely-missing-page/); // browser logs the 404 navigation itself
  }],

  ['home shows the 4 video products with exact prices', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    await page.waitForSelector('#popular .pcard');
    const cards = await page.$$eval('#popular .pcard', (els) => els.map((e) => ({ n: e.dataset.name, p: e.querySelector('.price').textContent.trim() })));
    const want = { 'Haiti Face Tattoo': '$7.99', 'Haiti Headband': '$9.99', 'Haiti Scarf': '$17.99', 'Haiti Thunder Stick': '$14.99' };
    h.assert.strictEqual(cards.length, 4);
    for (const c of cards) h.assert.strictEqual(c.p, want[c.n], c.n);
    h.assert.ok(await page.locator('.promo').innerText().then((s) => /HT26/.test(s) && /15%/.test(s)));
    // all images loaded
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.src));
    h.assert.deepStrictEqual(broken, []);
  }],

  ['shop: category filter, sort, search and overlay suggestions', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html');
    await page.waitForSelector('.pcard');
    h.assert.ok((await page.locator('.pcard').count()) >= 8);
    await page.click('.chip[data-cat="fan-zone"]');
    await page.waitForSelector('.pcard');
    h.assert.match(page.url(), /category=fan-zone/);
    h.assert.strictEqual(await page.locator('.chip[data-cat="fan-zone"]').getAttribute('aria-pressed'), 'true');
    await page.selectOption('#sort', 'price_asc');
    await page.waitForFunction(() => document.querySelector('.pcard .price')?.textContent.includes('5.99'));
    let prices = await page.$$eval('.pcard', (els) => els.map((e) => +e.dataset.price));
    h.assert.deepStrictEqual(prices, [...prices].sort((a, b) => a - b));
    await page.selectOption('#sort', 'price_desc');
    await page.waitForFunction(() => document.querySelector('.pcard .price')?.textContent.includes('24.99'));
    prices = await page.$$eval('.pcard', (els) => els.map((e) => +e.dataset.price));
    h.assert.deepStrictEqual(prices, [...prices].sort((a, b) => b - a));
    // ?q=
    await h.go(page, 'shop.html?q=scarf');
    await page.waitForSelector('.pcard');
    const names = await page.$$eval('.pcard', (els) => els.map((e) => e.dataset.name));
    h.assert.deepStrictEqual(names, ['Haiti Scarf']);
    await h.go(page, 'shop.html?q=zzzzqq');
    await page.waitForSelector('.state');
    h.assert.strictEqual(await page.locator('.pcard').count(), 0);
    // overlay suggestions
    await h.go(page, 'index.html');
    await page.click('#search-btn');
    await page.waitForSelector('#search-overlay.open');
    await page.fill('#search-input', 'scarf');
    await page.waitForSelector('#search-results .so-list a');
    h.assert.match(await page.locator('#search-results .so-list').innerText(), /Haiti Scarf/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#search-overlay', { state: 'hidden' });
    await page.click('#search-btn');
    await page.fill('#search-input', 'thunder');
    await page.keyboard.press('Enter');
    await page.waitForURL(/shop\.html\?q=thunder/);
  }],

  ['product page renders, qty stepper and 404 for unknown slug', async (h) => {
    const page = await h.page();
    await h.go(page, 'product.html?slug=haiti-scarf');
    h.assert.strictEqual((await page.locator('h1').innerText()).trim(), 'Haiti Scarf');
    h.assert.match(await page.locator('.pdp-price .now').innerText(), /\$17\.99/);
    await page.click('#q-inc'); await page.click('#q-inc');
    h.assert.strictEqual((await page.locator('#q-val').innerText()).trim(), '3');
    await h.go(page, 'product.html?slug=nope-nope');
    h.assert.ok(await page.locator('.state').count());
  }],
];
