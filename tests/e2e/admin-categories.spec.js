'use strict';
const path = require('path');
const ADMIN = ['admin@jpslogistics.me', 'admin123'];
const PHOTO = path.join(__dirname, 'fixtures', 'photo.png');

async function openCats(h, page) {
  await h.signIn(page, ...ADMIN);
  await h.go(page, 'admin.html');
  await page.waitForSelector('.a-stats');
  await page.click('[data-tab=categories]');
  await page.waitForSelector('.a-cats, [data-act=new-cat]');
}
const names = (page) => page.locator('.a-cat .a-cat-main strong').allInnerTexts();

module.exports = [
  ['admin categories: create with image, edit, toggles, XSS-safe, storefront sees it', async (h) => {
    const page = await h.page();
    await openCats(h, page);
    const before = (await names(page)).length;
    await page.click('[data-act=new-cat]');
    await page.waitForSelector('#cat-form');
    // validation
    await page.fill('#k-name', 'X');
    await page.click('#cat-form button[type=submit]');
    await page.waitForSelector('#cat-form .c-alert.err:not([hidden])');
    await page.fill('#k-name', 'Garden <b>& Tools</b>');
    await page.fill('#k-desc', 'Outdoor things');
    await page.setInputFiles('#k-img', PHOTO);
    await page.waitForFunction(() => !document.getElementById('k-prev').src.includes('logo.png'));
    await page.check('input[name=is_featured]');
    await page.click('#cat-form button[type=submit]');
    await page.waitForFunction((n) => document.querySelectorAll('.a-cat').length === n + 1, before);
    const row = page.locator('.a-cat', { hasText: 'Garden' });
    h.assert.strictEqual(await row.locator('b').count(), 0, 'user text must be escaped');
    h.assert.match(await row.innerText(), /Garden <b>& Tools<\/b>/);
    h.assert.match(await row.innerText(), /Featured/i);
    h.assert.ok(!(await row.locator('img').getAttribute('src')).includes('logo.png'), 'uploaded image shown');
    // edit: deactivate, rename
    await row.locator('[data-act=edit-cat]').click();
    await page.waitForSelector('#cat-form');
    await page.fill('#k-name', 'Garden'); await page.fill('#k-slug', 'garden');
    await page.uncheck('input[name=is_active]');
    await page.click('#cat-form button[type=submit]');
    await page.waitForFunction(() => /Garden/.test(document.querySelector('.a-cats').textContent) && /Inactive/i.test(document.querySelector('.a-cats').textContent));
    // inactive category hidden in storefront, active one visible
    const cats = await page.evaluate(async () => { const api = await import('/js/api.js'); return (await api.listCategories()).map((c) => c.slug); });
    h.assert.ok(!cats.includes('garden'), 'inactive hidden from storefront');
    await h.go(page, 'admin.html'); await page.click('[data-tab=categories]');
    await page.locator('.a-cat', { hasText: 'Garden' }).locator('[data-act=edit-cat]').click();
    await page.check('input[name=is_active]');
    await page.click('#cat-form button[type=submit]');
    await page.waitForFunction(() => !/Inactive/i.test(document.querySelector('.a-cats').textContent));
    const cats2 = await page.evaluate(async () => { const api = await import('/js/api.js'); return (await api.listCategories()).map((c) => c.slug); });
    h.assert.ok(cats2.includes('garden'), 'active shows in storefront');
    await h.noHScroll(page);
  }],

  ['admin categories: reorder with buttons persists', async (h) => {
    const page = await h.page();
    await openCats(h, page);
    const a = await names(page);
    h.assert.ok(a.length >= 3, 'needs seeded categories');
    h.assert.ok(await page.locator('.a-cat').first().locator('[data-act=cat-up]').isDisabled());
    await page.locator('.a-cat').nth(1).locator('[data-act=cat-up]').click();
    await page.waitForFunction((first) => document.querySelector('.a-cat .a-cat-main strong').textContent !== first, a[0]);
    const b = await names(page);
    h.assert.deepStrictEqual(b.slice(0, 2), [a[1], a[0]]);
    // focus stays inside the moved item's row (it is now first, so 'up' is disabled and focus falls to 'down')
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.closest('.a-cat')?.querySelector('strong').textContent), a[1]);
    await page.locator('.a-cat').first().locator('[data-act=cat-down]').click();
    await page.waitForFunction((n) => document.querySelector('.a-cat .a-cat-main strong').textContent === n, a[0]);
    await page.reload(); await page.waitForSelector('.a-stats'); await page.click('[data-tab=categories]');
    h.assert.deepStrictEqual((await names(page)).slice(0, 2), a.slice(0, 2));
    // storefront order follows
    const order = await page.evaluate(async () => { const api = await import('/js/api.js'); return (await api.listCategories()).map((c) => c.name); });
    h.assert.strictEqual(order[0], a[0]);
  }],

  ['admin categories: delete with in-page reassign, product category change shown in shop', async (h) => {
    const page = await h.page();
    h.allowErrors(/Failed to load resource/);
    await openCats(h, page);
    // create a category and move a product into it via the product form
    await page.click('[data-act=new-cat]');
    await page.fill('#k-name', 'Temp Stuff');
    await page.click('#cat-form button[type=submit]');
    await page.waitForSelector('.a-cat:has-text("Temp Stuff")');
    await page.click('[data-tab=products]');
    await page.locator('tr', { hasText: 'Haiti Scarf' }).locator('[data-act=edit-product]').click();
    await page.selectOption('#p-cat', 'temp-stuff');
    await page.check('input[name=is_featured]');
    await page.click('#product-form button[type=submit]');
    await page.waitForFunction(() => /Temp Stuff/.test(document.querySelector('.a-table').textContent));
    // quick filter
    await page.selectOption('#cat-filter', 'temp-stuff');
    await page.waitForFunction(() => document.querySelectorAll('.a-table tbody tr').length === 1);
    h.assert.match(await page.locator('.a-table tbody').innerText(), /Haiti Scarf/);
    h.assert.match(await page.locator('.a-table tbody').innerText(), /Featured/);
    await page.selectOption('#cat-filter', '');
    // shop shows the scarf under the new category
    await h.go(page, 'shop.html?category=temp-stuff');
    await page.waitForSelector('.pcard[data-slug="haiti-scarf"]');
    // delete: must prompt in page (no native dialog) and offer reassign
    let native = 0; page.on('dialog', () => { native++; });
    await h.go(page, 'admin.html'); await page.waitForSelector('.a-stats'); await page.click('[data-tab=categories]');
    await page.locator('.a-cat', { hasText: 'Temp Stuff' }).locator('[data-act=del-cat]').click();
    await page.waitForSelector('#cat-delete #k-target');
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'cat-delete');
    h.assert.match(await page.locator('#cat-delete').innerText(), /1 product/);
    await page.selectOption('#k-target', 'fan-zone');
    await page.click('[data-act=cat-del-confirm]');
    await page.waitForFunction(() => !document.querySelector('#cat-delete') && !/Temp Stuff/.test(document.querySelector('.a-cats').textContent));
    h.assert.strictEqual(native, 0, 'no native dialogs');
    const cat = await page.evaluate(async () => { const api = await import('/js/api.js'); return (await api.getProduct('haiti-scarf')).category_slug; });
    h.assert.strictEqual(cat, 'fan-zone');
    await h.go(page, 'shop.html?category=fan-zone');
    await page.waitForSelector('.pcard[data-slug="haiti-scarf"]');
    // cancel keeps the category
    await h.go(page, 'admin.html'); await page.click('[data-tab=categories]');
    await page.locator('.a-cat', { hasText: 'Fan Zone' }).locator('[data-act=del-cat]').click();
    await page.click('[data-act=cat-del-cancel]');
    h.assert.strictEqual(await page.locator('#cat-delete').count(), 0);
    h.assert.strictEqual(await page.locator('.a-cat', { hasText: 'Fan Zone' }).count(), 1);
  }],

  ['admin categories: touch targets >= 44px, no horizontal scroll', async (h) => {
    const page = await h.page();
    await openCats(h, page);
    await page.click('[data-act=new-cat]');
    await page.waitForSelector('#cat-form');
    await page.locator('.a-cat').first().locator('[data-act=del-cat]').click();
    await page.waitForSelector('#cat-delete');
    const small = await page.evaluate(() => [...document.querySelectorAll('main button, main select, main input:not([type=hidden]):not([type=checkbox]):not([type=radio])')]
      .filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { s: e.tagName + '.' + e.className + ' ' + (e.textContent || e.id).trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter((x) => x.h < 44 || x.w < 44));
    h.assert.deepStrictEqual(small, []);
    await h.noHScroll(page);
  }, { viewports: ['mobile'] }],
];
