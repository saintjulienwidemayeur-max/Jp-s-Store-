'use strict';
const { placeOrderViaApi } = require('./lib');
const ADMIN = ['admin@jpslogistics.me', 'admin123'];

module.exports = [
  ['admin: guard for guests and non-admin users', async (h) => {
    const page = await h.page();
    await h.go(page, 'admin.html');
    await page.waitForSelector('.c-empty');
    h.assert.strictEqual(await page.locator('#product-form, .a-table').count(), 0);
    await h.go(page, 'account.html');
    await page.click('#tab-signup');
    await page.fill('#a-name', 'Regular'); await page.fill('#a-email', 'regular@example.com'); await page.fill('#a-pass', 'secret12');
    await page.click('#auth-form button[type=submit]'); await page.waitForSelector('#signout');
    h.assert.strictEqual(await page.locator('a[href="admin.html"]').filter({ hasText: /admin/i }).count(), 0, 'no admin link for normal user');
    await h.go(page, 'admin.html');
    await page.waitForSelector('.c-empty');
    h.assert.strictEqual(await page.locator('.a-nav').count(), 0, 'no admin UI');
    // API-level enforcement
    const code = await page.evaluate(async () => { const api = await import('/js/api.js'); try { await api.adminListOrders({}); return 'ok'; } catch (e) { return e.code; } });
    h.assert.strictEqual(code, 'forbidden');
    const code2 = await page.evaluate(async () => { const api = await import('/js/api.js'); try { await api.adminUpsertProduct({ name: 'x', price: 1, stock: 1 }); return 'ok'; } catch (e) { return e.code; } });
    h.assert.strictEqual(code2, 'forbidden');
    // a user cannot register the admin email
    await h.go(page, 'account.html');
    await page.click('#signout'); await page.waitForSelector('#auth-form');
    await page.click('#tab-signup');
    await page.fill('#a-name', 'Evil'); await page.fill('#a-email', 'admin@jpslogistics.me'); await page.fill('#a-pass', 'hacked123');
    await page.click('#auth-form button[type=submit]');
    await page.waitForSelector('.c-alert.err');
  }],

  ['admin: orders (status edit + filter), products CRUD, coupon edit, touch targets', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    const o1 = await placeOrderViaApi(page, { email: 'a@example.com', name: 'Alice' });
    const o2 = await placeOrderViaApi(page, { slug: 'haiti-headband', email: 'b@example.com', name: 'Bob' });
    await h.signIn(page, ...ADMIN);
    await h.go(page, 'admin.html');
    await page.waitForSelector('.a-stats');
    h.assert.match(await page.locator('.a-stats').innerText(), /2/);
    await page.click('[data-tab=orders]');
    await page.waitForSelector('.a-table');
    h.assert.strictEqual(await page.locator('.a-table tbody tr').count(), 2);
    // edit status
    await page.selectOption(`select[data-order="${o1.id}"]`, 'shipped');
    await page.waitForFunction((id) => document.querySelector(`select[data-order="${id}"]`).value === 'shipped', o1.id);
    // filter
    await page.selectOption('#order-filter', 'shipped');
    await page.waitForFunction(() => document.querySelectorAll('.a-table tbody tr').length === 1);
    h.assert.match(await page.locator('.a-table tbody').innerText(), new RegExp(o1.order_number));
    await page.selectOption('#order-filter', 'pending');
    await page.waitForFunction(() => document.querySelectorAll('.a-table tbody tr').length === 1);
    h.assert.match(await page.locator('.a-table tbody').innerText(), new RegExp(o2.order_number));
    // tracking page reflects status
    const tr = await h.page(await h.newContext());
    await h.go(tr, 'index.html');
    await tr.evaluate((s) => localStorage.setItem('jps_orders', s), await page.evaluate(() => localStorage.getItem('jps_orders')));
    await h.go(tr, `order.html?n=${o1.order_number}&e=a@example.com`);
    await tr.waitForSelector('.c-timeline li.current');
    h.assert.match(await tr.locator('.c-timeline li.current').innerText(), /ship/i);
    await tr.close();

    // products
    await page.click('[data-tab=products]');
    await page.click('[data-act=new-product]');
    await page.waitForSelector('#product-form');
    await page.fill('#p-name', 'Haiti Poncho');
    await page.fill('#p-price', '21.50'); await page.fill('#p-stock', '3');
    await page.fill('#p-desc', 'Rain poncho');
    await page.click('#product-form button[type=submit]');
    await page.waitForFunction(() => /Haiti Poncho/.test(document.querySelector('.a-table').textContent));
    // validation
    await page.click('[data-act=new-product]');
    await page.fill('#p-name', 'X'); await page.fill('#p-price', '1');
    await page.click('#product-form button[type=submit]');
    await page.waitForSelector('#product-form .c-alert.err');
    await page.click('[data-act=cancel-product]');
    // storefront sees it
    await h.go(page, 'product.html?slug=haiti-poncho');
    h.assert.strictEqual((await page.locator('h1').innerText()).trim(), 'Haiti Poncho');
    h.assert.match(await page.locator('.pdp-price .now').innerText(), /\$21\.50/);
    // low stock listed in overview
    await h.go(page, 'admin.html'); await page.waitForSelector('.a-stats');
    h.assert.match(await page.locator('.a-lowlist').innerText(), /Haiti Poncho/);
    // edit
    await page.click('[data-tab=products]');
    await page.locator('tr', { hasText: 'Haiti Poncho' }).locator('[data-act=edit-product]').click();
    await page.fill('#p-price', '19.99');
    await page.uncheck('input[name=is_active]');
    await page.click('#product-form button[type=submit]');
    await page.waitForFunction(() => /\$19\.99/.test(document.querySelector('.a-table').textContent));
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
    h.assert.ok(!(await page.locator('.pcard[data-slug="haiti-poncho"]').count()), 'inactive hidden from shop');
    // delete
    await h.go(page, 'admin.html'); await page.waitForSelector('.a-stats');
    await page.click('[data-tab=products]');
    await page.locator('tr', { hasText: 'Haiti Poncho' }).locator('[data-act=del-product]').click();
    await page.waitForFunction(() => !/Haiti Poncho/.test(document.querySelector('.a-table').textContent));

    // coupons: edit percent
    await page.click('[data-tab=coupons]');
    await page.locator('tr', { hasText: 'HT26' }).locator('[data-act=edit-coupon]').click();
    await page.fill('#c-pct', '20');
    await page.click('#coupon-form button[type=submit]');
    await page.waitForFunction(() => /20%/.test(document.querySelector('.a-table').textContent));
    // cart sees 20%: scarf 17.99 -> 3.60 off -> 14.39
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
    await page.click('.pcard[data-slug="haiti-scarf"] [data-add]');
    await h.go(page, 'cart.html'); await page.fill('#coupon-input', 'HT26'); await page.click('#coupon-form button');
    await page.waitForSelector('.c-discount');
    h.assert.match(await page.locator('.c-grand dd').innerText(), /\$14\.39/);
    // deactivate coupon -> rejected
    await h.go(page, 'admin.html'); await page.click('[data-tab=coupons]');
    await page.locator('tr', { hasText: 'HT26' }).locator('[data-act=edit-coupon]').click();
    await page.uncheck('input[name=is_active]');
    await page.click('#coupon-form button[type=submit]');
    await page.waitForFunction(() => /inactive|inactif|ina/i.test(document.querySelector('.a-table').textContent));
    await h.go(page, 'cart.html'); await page.waitForSelector('.c-line');
    h.assert.strictEqual(await page.locator('.c-discount').count(), 0);
  }],

  ['admin: touch targets are >= 44px on mobile', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    await placeOrderViaApi(page);
    await h.signIn(page, ...ADMIN);
    const small = [];
    for (const tab of ['overview', 'orders', 'products', 'coupons']) {
      await h.go(page, 'admin.html');
      await page.waitForSelector('.a-stats');
      await page.click(`[data-tab=${tab}]`);
      if (tab === 'products') await page.click('[data-act=new-product]');
      if (tab === 'coupons') await page.click('[data-act=new-coupon]');
      const found = await page.evaluate(() => [...document.querySelectorAll('main button, main a.btn, main select, main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main summary')]
        .filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { s: e.tagName + '.' + e.className + ' ' + (e.textContent || e.name || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter((x) => x.h < 44 || x.w < 44));
      small.push(...found.map((f) => `${tab}: ${f.s} ${f.w}x${f.h}`));
    }
    h.assert.deepStrictEqual(small, []);
  }, { viewports: ['mobile'] }],
];
