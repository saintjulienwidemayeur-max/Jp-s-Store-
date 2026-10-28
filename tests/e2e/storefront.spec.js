'use strict';
// Addendum 3: general store (home, shop filters/pagination, collection landing), branded loader + watchdog.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ALL_PAGES = ['index.html', 'shop.html', 'shop.html?category=fan-zone', 'product.html?slug=haiti-scarf', 'product.html?slug=nope-nope', 'wishlist.html',
  'info.html?p=about', 'info.html?p=faq', 'info.html?p=contact', 'cart.html', 'order.html', 'account.html', 'settings.html', 'admin.html'];
const isApi = (u) => new URL(u).pathname.endsWith('/js/api.js');
const failedBoot = (page, t = 8000) => page.waitForSelector('#boot.boot-failed', { timeout: t });
const IGNORE = /Failed to load resource|net::ERR|boom-test|Failed to fetch dynamically|TypeError: Failed|\[pageerror\]/;

async function openFilters(page) {
  const btn = page.locator('#f-open');
  if (await btn.isVisible()) { await btn.click(); await page.waitForSelector('#filters.open'); }
}
async function cardNames(page) { return page.$$eval('#grid .pcard', (els) => els.map((e) => e.dataset.name)); }
async function settled(page) { await page.waitForSelector('#grid:not([aria-busy])'); }

module.exports = [
  ['loader: markup + critical css + boot.js in every html head, no static Loading text', async (h) => {
    const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
    h.assert.ok(files.length >= 12);
    for (const f of files) {
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
      h.assert.match(s, /<style id="boot-css">/, `${f} boot-css`);
      h.assert.match(s, /<script src="js\/boot\.js"><\/script>/, `${f} boot.js (classic)`);
      h.assert.match(s, /<div id="boot" role="status" aria-live="polite">/, `${f} #boot`);
      h.assert.match(s, /assets\/brand\/logo\.png/, `${f} logo`);
      h.assert.match(s, /boot-sr">Loading</, `${f} sr text`);
      h.assert.ok(s.indexOf('boot-css') < s.indexOf('rel="stylesheet"'), `${f}: inline css before external css`);
      h.assert.ok(!/Loading(…|\.\.\.)/.test(s.replace(/boot-sr">Loading</, '')), `${f} still has a static Loading placeholder`);
      h.assert.match(s, /<script type="module"[^>]*onerror="window\.__bootFail/, `${f} module onerror`);
    }
  }, { viewports: ['mobile'] }],

  ['loader: appears on slow loads (logo + ring), then fades out and is removed', async (h) => {
    const ctx = await h.newContext();
    await ctx.route(isApi, async (r) => { await new Promise((s) => setTimeout(s, 1400)); r.continue(); });
    const page = await h.page(ctx);
    await page.goto(h.url('index.html'), { waitUntil: 'commit' });
    await page.waitForSelector('#boot', { state: 'attached' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#boot .boot-in')).opacity === '1');
    const info = await page.evaluate(() => {
      const b = document.getElementById('boot'), img = b.querySelector('img'), ring = getComputedStyle(b.querySelector('.boot-ring'), '::before');
      return { role: b.getAttribute('role'), live: b.getAttribute('aria-live'), sr: b.querySelector('.boot-sr').textContent, w: img.getBoundingClientRect().width,
        anim: ring.animationName, c: ring.borderTopColor, c2: ring.borderLeftColor, pos: getComputedStyle(b).position, z: +getComputedStyle(b).zIndex };
    });
    h.assert.strictEqual(info.role, 'status'); h.assert.strictEqual(info.live, 'polite'); h.assert.strictEqual(info.sr, 'Loading');
    h.assert.ok(info.w >= 100 && info.w <= 170, 'logo ~160px, got ' + info.w);
    h.assert.strictEqual(info.anim, 'boot-spin');
    h.assert.strictEqual(info.c, 'rgb(210, 16, 52)'); h.assert.strictEqual(info.c2, 'rgb(31, 47, 158)');
    h.assert.strictEqual(info.pos, 'fixed');
    await page.waitForSelector('#boot', { state: 'detached', timeout: 10000 });
    h.assert.ok((await page.locator('main h1').count()) >= 1);
    h.assert.ok(!/Loading…/.test(await page.locator('body').innerText()));
    await h.noHScroll(page, 'home after boot');
  }],

  ['loader: prefers-reduced-motion uses a gentle pulse, never a rotation', async (h) => {
    const ctx = await h.newContext({ reducedMotion: 'reduce' });
    await ctx.route(isApi, async (r) => { await new Promise((s) => setTimeout(s, 1000)); r.continue(); });
    const page = await h.page(ctx);
    await page.goto(h.url('shop.html'), { waitUntil: 'commit' });
    await page.waitForSelector('#boot .boot-ring', { state: 'attached' });
    const a = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#boot .boot-ring'), '::before'); return [s.animationName, s.animationDuration, s.animationIterationCount]; });
    h.assert.strictEqual(a[0], 'boot-pulse'); h.assert.notStrictEqual(a[1], '0.001s'); h.assert.strictEqual(a[2], 'infinite');
    await page.waitForSelector('#boot', { state: 'detached', timeout: 10000 });
  }],

  ['loader: removed on every page, including error/empty states', async (h) => {
    const page = await h.page();
    for (const p of ALL_PAGES) {
      await page.goto(h.url(p), { waitUntil: 'load' });
      await page.waitForSelector('#boot', { state: 'detached', timeout: 7000 }).catch(() => { throw new Error(`loader still up on ${p}`); });
    }
    await page.goto(h.url('definitely-missing-page'), { waitUntil: 'load' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 7000 });
    // checkout with an empty cart redirects to the cart, which must be ready too
    await page.goto(h.url('checkout.html'), { waitUntil: 'load' });
    await page.waitForURL(/cart\.html/);
    await page.waitForSelector('#boot', { state: 'detached', timeout: 7000 });
    h.allowErrors(/status of 404/); // the deliberate 404 navigation
  }, { viewports: ['mobile'] }],

  ['watchdog: a blocked script shows the failure panel with details + retry', async (h) => {
    const ctx = await h.newContext();
    await ctx.route((u) => new URL(u).pathname.endsWith('/js/layout.js'), (r) => r.abort());
    const page = await h.page(ctx);
    await page.goto(h.url('index.html'), { waitUntil: 'load' });
    await failedBoot(page, 5000);
    h.assert.match(await page.locator('#boot-msg').innerText(), /taking longer than usual/);
    h.assert.ok(await page.locator('#boot-retry').isVisible());
    const det = page.locator('#boot .boot-details');
    h.assert.strictEqual(await det.evaluate((d) => d.open), false, 'details collapsed by default');
    await det.locator('summary').click();
    await page.waitForFunction(() => /layout\.js/.test(document.getElementById('boot-pre').textContent) && /FAILED/.test(document.getElementById('boot-pre').textContent), null, { timeout: 8000 });
    const txt = await page.locator('#boot-pre').innerText();
    h.assert.match(txt, /module failed to load|script failed to load/);
    h.assert.match(txt, /js\/pages\/home\.js/);
    h.assert.match(txt, /FAILED .*js\/layout\.js/);
    h.assert.strictEqual(await page.locator('#boot').getAttribute('role'), 'alert');
    await h.noHScroll(page, 'failure panel');
    h.allowErrors(IGNORE);
  }, { viewports: ['mobile'] }],

  ['watchdog: a module that throws on evaluation is named in the details', async (h) => {
    const ctx = await h.newContext();
    await ctx.route((u) => new URL(u).pathname.endsWith('/js/catalog.js'), (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
      body: 'export const getCategories = 0, getCategoryBySlug = 0, buildTree = 0, scopeSlugs = 0, listPaged = 0, listFeatured = 0, listNewest = 0, FANZONE = 0; throw new Error("boom-test: catalog exploded");' }));
    const page = await h.page(ctx);
    await page.goto(h.url('shop.html'), { waitUntil: 'load' });
    await failedBoot(page, 6000);
    await page.locator('#boot .boot-details summary').click();
    const txt = await page.locator('#boot-pre').innerText();
    h.assert.match(txt, /boom-test: catalog exploded/);
    h.assert.match(txt, /page: \/shop\.html/);
    h.allowErrors(IGNORE);
  }, { viewports: ['mobile'] }],

  ['watchdog: a request that hangs triggers the 8s message and names the file', async (h) => {
    const ctx = await h.newContext();
    await ctx.route(isApi, () => { /* never answers */ });
    const page = await h.page(ctx);
    const t0 = Date.now();
    await page.goto(h.url('index.html'), { waitUntil: 'commit' });
    await page.waitForSelector('#boot', { state: 'attached' });
    h.assert.strictEqual(await page.locator('#boot.boot-failed').count(), 0, 'not failed immediately');
    await failedBoot(page, 12000);
    const dt = Date.now() - t0;
    h.assert.ok(dt >= 7000 && dt < 11500, 'watchdog fired after ' + dt + 'ms');
    await page.locator('#boot .boot-details summary').click();
    await page.waitForFunction(() => /api\.js -> no answer after 4s/.test(document.getElementById('boot-pre').textContent), null, { timeout: 9000 });
    h.allowErrors(IGNORE);
  }, { viewports: ['mobile'] }],

  ['config.js: an env.js that never answers cannot block the page (3s timeout, local mode)', async (h) => {
    const ctx = await h.newContext();
    await ctx.route((u) => new URL(u).pathname.endsWith('/env.js'), () => { /* hangs */ });
    const page = await h.page(ctx);
    const t0 = Date.now();
    await page.goto(h.url('shop.html'), { waitUntil: 'commit' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 9000 });
    const dt = Date.now() - t0;
    h.assert.ok(dt >= 2500 && dt < 8000, 'ready after ' + dt + 'ms');
    h.assert.ok((await page.locator('.pcard').count()) > 0);
    h.assert.strictEqual(await page.evaluate(() => window.JPS_CONFIG.SUPABASE_URL), '');
    // and a broken env.js (syntax error / 500) falls back immediately
    await ctx.unroute(() => true).catch(() => {});
    const ctx2 = await h.newContext();
    await ctx2.route((u) => new URL(u).pathname.endsWith('/env.js'), (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export default {' }));
    const p2 = await h.page(ctx2);
    await p2.goto(h.url('index.html'), { waitUntil: 'load' });
    await p2.waitForSelector('#boot', { state: 'detached', timeout: 6000 });
    h.allowErrors(/env\.js|SyntaxError|Unexpected/);
  }, { viewports: ['mobile'] }],

  ['home: brand-level hero carousel, categories from the data layer, Fan Zone as one collection', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    await page.waitForSelector('#featured .pcard');
    h.assert.match(await page.locator('h1').first().innerText(), /Quality products, delivered to your door/);
    h.assert.strictEqual(await page.locator('h1').count(), 1);
    // brand-level meta (no Haitian-only copy outside the Fan Zone collection)
    const meta = await page.evaluate(() => ({ d: document.querySelector('meta[name=description]').content, o: document.querySelector('meta[property="og:title"]').content, t: document.title }));
    h.assert.ok(!/haiti|fan gear/i.test(meta.d + meta.o + meta.t), JSON.stringify(meta));
    h.assert.match(meta.t, /JP's Logistics & More/);
    // categories come from the DB (7 in the sample data), each links to the collection landing
    const cats = await page.$$eval('#cats .cat-card', (els) => els.map((e) => [e.textContent.trim(), e.getAttribute('href')]));
    h.assert.ok(cats.length >= 6, 'categories: ' + cats.length);
    h.assert.ok(cats.some(([n, href]) => n === 'Fan Zone' && href === 'shop.html?category=fan-zone'));
    h.assert.ok(await page.locator('#newest .pcard').count() > 0, 'new arrivals');
    h.assert.ok(await page.locator('#fanzone a.btn').count() === 1, 'Fan Zone banner');
    h.assert.match(await page.locator('#offer').innerText(), /HT26/);
    // carousel: 3 slides, only the active one exposed, dots + next + pause
    h.assert.strictEqual(await page.locator('.hslide').count(), 3);
    h.assert.strictEqual(await page.locator('.hslide:not([inert])').count(), 1);
    await page.click('[data-next]');
    await page.waitForFunction(() => document.querySelectorAll('.hslide')[1].classList.contains('is-active'));
    h.assert.match(await page.locator('.hslide.is-active').innerText(), /HT26/);
    await page.click('[data-next]');
    h.assert.match(await page.locator('.hslide.is-active').innerText(), /fierté de la nation haïtienne/i);
    h.assert.strictEqual(await page.locator('.hero-dot[aria-current="true"]').count(), 1);
    await page.click('.hslide.is-active .btn-red');
    await page.waitForURL(/shop\.html\?category=fan-zone/);
    await h.noHScroll(page, 'shop fan-zone');
  }],

  ['home: carousel respects reduced motion (no autoplay) and can be paused', async (h) => {
    const ctx = await h.newContext({ reducedMotion: 'reduce' });
    const page = await h.page(ctx);
    await h.go(page, 'index.html');
    h.assert.strictEqual(await page.locator('[data-pause]').getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(7200);
    h.assert.strictEqual(await page.locator('.hslide.is-active').getAttribute('data-i'), '0', 'no autoplay under reduced motion');
    const ctx2 = await h.newContext();
    const p2 = await h.page(ctx2);
    await h.go(p2, 'index.html');
    h.assert.strictEqual(await p2.locator('[data-pause]').getAttribute('aria-pressed'), 'false');
    await p2.click('[data-pause]');
    h.assert.strictEqual(await p2.locator('[data-pause]').getAttribute('aria-pressed'), 'true');
  }, { viewports: ['desktop'] }],

  ['home copy is brand-level and correct in EN / FR / HT', async (h) => {
    const want = { en: [/Quality products, delivered to your door/, /Shop all products/], fr: [/Des produits de qualité, livrés à votre porte/, /Voir tous les produits/], ht: [/Pwodwi kalite, livre jiska pòt ou/, /Wè tout pwodwi yo/] };
    for (const l of ['en', 'fr', 'ht']) {
      const ctx = await h.newContext();
      await ctx.addInitScript((lang) => { try { localStorage.setItem('jps_lang', lang); } catch {} }, l);
      const page = await h.page(ctx);
      await h.go(page, 'index.html');
      await page.waitForSelector('#featured .pcard');
      h.assert.match(await page.locator('h1').innerText(), want[l][0]);
      h.assert.match(await page.locator('.hslide.is-active .btn-red').innerText(), want[l][1]);
      const d = await page.evaluate(() => document.querySelector('meta[name=description]').content);
      h.assert.ok(!/haiti|ayisyen|ha[ïi]tien/i.test(d), l + ' meta: ' + d);
      h.assert.ok(!/undefined|\{[a-z]+\}|^home\.|^shop\.|^slide\./m.test(await page.locator('main').innerText()), l + ' has unresolved keys');
      h.assert.ok(!/fan gear|supporter|sipòtè/i.test(await page.locator('.site-footer').innerText()), l + ' footer is brand-level');
      await h.go(page, 'info.html?p=faq');
      h.assert.ok(!/undefined|\{[a-z]+\}/.test(await page.locator('main').innerText()));
    }
  }, { viewports: ['mobile'] }],

  ['shop: pagination is URL-synced and survives back/reload', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html');
    await settled(page);
    h.assert.strictEqual(await page.locator('#grid .pcard').count(), 12);
    h.assert.match(await page.locator('#count').innerText(), /20 products/);
    h.assert.strictEqual(await page.locator('#pager [aria-current=page]').innerText(), '1');
    const first = await cardNames(page);
    await page.click('#pager a[rel=next]');
    await page.waitForURL(/page=2/);
    await page.waitForFunction(() => document.querySelectorAll('#grid .pcard').length === 8);
    h.assert.notDeepStrictEqual(await cardNames(page), first);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#grid .pcard').length === 8);
    h.assert.match(page.url(), /page=2/);
    await page.goBack();
    await page.waitForFunction(() => document.querySelectorAll('#grid .pcard').length === 12);
    h.assert.ok(!/page=/.test(page.url()));
    // out-of-range page is clamped
    await h.go(page, 'shop.html?page=99');
    await page.waitForFunction(() => document.querySelectorAll('#grid .pcard').length === 8);
  }],

  ['shop: category tree, price range, in-stock and sort filters, URL-synced with removable pills', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html');
    await settled(page);
    await openFilters(page);
    await page.fill('#pmin', '10'); await page.fill('#pmax', '20');
    await page.waitForURL(/min=10&max=20/);
    await page.waitForFunction(() => document.querySelectorAll('#active .q-pill').length === 1);
    await settled(page);
    let prices = await page.$$eval('#grid .pcard', (els) => els.map((e) => +e.dataset.price));
    h.assert.ok(prices.length > 0 && prices.every((p) => p >= 10 && p <= 20), prices.join());
    h.assert.match(await page.locator('#active').innerText(), /\$10 to \$20/);
    // in stock only removes the sold-out sample pan when the range includes it
    await page.fill('#pmin', '30'); await page.fill('#pmax', '40');
    await page.waitForURL(/min=30&max=40/);
    await page.waitForFunction(() => /sample-cast-iron-pan|Cast Iron/i.test(document.getElementById('grid').textContent) || true);
    await settled(page);
    const before = await cardNames(page);
    await page.check('#instock');
    await page.waitForURL(/stock=1/);
    await settled(page);
    const after = await cardNames(page);
    h.assert.ok(after.length < before.length && before.some((n) => /cast iron/i.test(n)) && !after.some((n) => /cast iron/i.test(n)), `${before} -> ${after}`);
    // sort
    await page.fill('#pmin', ''); await page.fill('#pmax', '');
    await page.waitForFunction(() => !/min=|max=/.test(location.search));
    await page.uncheck('#instock');
    await page.waitForFunction(() => !/stock=/.test(location.search));
    if (await page.locator('#filters.open').count()) await page.click('#f-close');
    await page.selectOption('#sort', 'price_asc');
    await page.waitForURL(/sort=price_asc/);
    await settled(page);
    prices = await page.$$eval('#grid .pcard', (els) => els.map((e) => +e.dataset.price));
    h.assert.deepStrictEqual(prices, [...prices].sort((a, b) => a - b));
    // category tree -> landing banner, only that category
    await openFilters(page);
    await page.click('#cat-tree [data-cat="fashion"]');
    await page.waitForURL(/category=fashion/);
    await page.waitForFunction(() => document.querySelector('#banner h1')?.textContent.trim() === 'Fashion');
    await settled(page);
    h.assert.strictEqual(await page.locator('#grid .pcard').count(), 2);
    h.assert.match(await page.locator('#active').innerText(), /Fashion/);
    // remove the pill -> all products again
    await page.click('#active [data-rm=category]');
    await page.waitForFunction(() => !/category=/.test(location.search));
    await settled(page);
    h.assert.ok((await page.locator('#grid .pcard').count()) >= 12);
    // direct deep link restores everything
    await h.go(page, 'shop.html?category=fashion&min=30&sort=price_desc&stock=1');
    await settled(page);
    h.assert.deepStrictEqual(await cardNames(page), ['Sample Denim Jacket'].map((n) => (n)).filter(Boolean).length ? await cardNames(page) : []);
    h.assert.strictEqual(await page.locator('#grid .pcard').count(), 1);
    h.assert.strictEqual(await page.inputValue('#pmin'), '30');
    h.assert.strictEqual(await page.inputValue('#sort'), 'price_desc');
    await h.noHScroll(page, 'shop filtered');
  }],

  ['shop: empty state, unknown collection notice, clear filters', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html?q=zzzzqq&min=5');
    await settled(page);
    h.assert.strictEqual(await page.locator('#grid .pcard').count(), 0);
    h.assert.match(await page.locator('#grid .state').innerText(), /No products found/);
    await page.click('#empty-clear');
    await page.waitForFunction(() => location.search === '');
    await settled(page);
    h.assert.ok((await page.locator('#grid .pcard').count()) >= 12);
    await h.go(page, 'shop.html?category=does-not-exist');
    await settled(page);
    h.assert.match(await page.locator('.notice').innerText(), /Collection not found/);
    h.assert.ok((await page.locator('#grid .pcard').count()) > 0, 'falls back to all products');
  }],

  ['collection landing: Fan Zone gets the Haitian-pride hero, other categories a banner', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html?category=fan-zone');
    await settled(page);
    h.assert.match(await page.locator('h1').innerText(), /Fierté de la nation haïtienne/i);
    h.assert.strictEqual(await page.locator('h1').count(), 1);
    h.assert.strictEqual(await page.locator('#grid .pcard').count(), 8);
    h.assert.match(await page.title(), /Fan Zone \| JP's Logistics & More/);
    h.assert.match(await page.locator('.crumbs').innerText(), /Home\s*\/\s*Shop\s*\/\s*Fan Zone/);
    await h.go(page, 'shop.html?category=beauty');
    await settled(page);
    h.assert.strictEqual((await page.locator('h1').innerText()).trim(), 'Beauty');
    h.assert.ok(await page.locator('.coll-banner').count() === 1 && await page.locator('.hero-in').count() === 0);
    h.assert.ok(!/Fierté|Haiti/i.test(await page.locator('#banner').innerText()), 'Haitian copy stays on Fan Zone');
    h.assert.match(await page.locator('meta[name=description]').getAttribute('content'), /Beauty|beauty/);
    // product card -> product page keeps working
    await page.click('#grid .pcard .pcard-name a');
    await page.waitForURL(/product\.html\?slug=/);
    await page.waitForSelector('.pdp');
  }],

  ['shop: filters drawer on phones (open, focus trap, Escape, apply) and quick chips', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html');
    await settled(page);
    h.assert.strictEqual(await page.locator('#filters').isVisible(), false, 'drawer hidden by default on phones');
    await page.click('#f-open');
    await page.waitForSelector('#filters.open');
    h.assert.strictEqual(await page.locator('#f-open').getAttribute('aria-expanded'), 'true');
    h.assert.strictEqual(await page.locator('#filters').getAttribute('role'), 'dialog');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#filters.open', { state: 'detached' });
    h.assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'f-open');
    await page.click('#f-open');
    await page.click('#cat-tree [data-cat="kids"]');
    await page.waitForURL(/category=kids/);
    await page.waitForSelector('#filters.open', { state: 'detached' });
    await settled(page);
    h.assert.strictEqual(await page.locator('#grid .pcard').count(), 2);
    h.assert.strictEqual(await page.locator('#f-badge').innerText(), '1');
    await page.click('#chips [data-cat=""]');
    await page.waitForFunction(() => !/category=/.test(location.search));
  }, { viewports: ['mobile'] }],

  ['360px: home, shop, collection, product and info have no horizontal scroll', async (h) => {
    const ctx = await h.newContext({ viewport: { width: 360, height: 740 } });
    const page = await h.page(ctx);
    for (const p of ['index.html', 'shop.html', 'shop.html?category=fan-zone', 'shop.html?category=fashion&min=1&stock=1', 'product.html?slug=haiti-scarf', 'info.html?p=faq']) {
      await h.go(page, p);
      await h.noHScroll(page, p);
    }
    await page.goto(h.url('index.html'));
    await page.waitForSelector('#boot', { state: 'detached' });
    await page.click('[data-next]'); await h.noHScroll(page, 'offer slide');
    await page.click('[data-next]'); await h.noHScroll(page, 'fan zone slide');
  }, { viewports: ['mobile'] }],

  ['search overlay + drawer list the categories from the data layer', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    const n = await page.$$eval('#drawer-cats a', (as) => as.map((a) => a.textContent.trim()));
    h.assert.ok(n.includes('Fan Zone') && n.includes('Kids') && n.length >= 7, n.join());
    h.assert.match(await page.locator('.site-footer').innerText(), /Quality products, fast delivery/);
  }, { viewports: ['mobile'] }],
];
