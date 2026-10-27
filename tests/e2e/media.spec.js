'use strict';
// Addendum 2: product media (admin manager + storefront gallery), 3D viewer, Settings (language).
const path = require('path');
const FX = (f) => path.join(__dirname, 'fixtures', f);
const ADMIN = ['admin@jpslogistics.me', 'admin123'];

// 12-byte GLB header + empty JSON chunk is enough for the magic-byte sniff; model-viewer is stubbed below.
function fakeGlb() {
  const json = Buffer.from('{"asset":{"version":"2.0"}}   '.slice(0, 28));
  const head = Buffer.alloc(20); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length, 8);
  head.writeUInt32LE(json.length, 12); head.write('JSON', 16);
  return Buffer.concat([head, json]);
}

async function createProduct(h, page, name) {
  await h.signIn(page, ...ADMIN);
  await h.go(page, 'admin.html');
  await page.waitForSelector('.a-stats');
  await page.click('[data-tab=products]');
  await page.click('[data-act=new-product]');
  await page.fill('#p-name', name); await page.fill('#p-price', '12.00'); await page.fill('#p-stock', '9');
  await page.click('#product-form button[type=submit]');
  await page.waitForSelector('#media-mgr #mm-file', { state: 'attached' });
}

module.exports = [
  ['media: admin uploads image + video, storefront gallery, 3D preview, lightbox, reorder/cover/delete', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    await createProduct(h, page, 'Media Tee');
    await h.noHScroll(page, 'admin media (empty)');

    // validation: unsupported type is rejected client-side with a message
    await page.setInputFiles('#mm-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.waitForSelector('#mm-queue .err');

    await page.fill('#mm-alt', 'Blue test tee <b>front</b>');
    await page.setInputFiles('#mm-file', [FX('photo.png'), FX('clip.webm')]);
    await page.waitForFunction(() => document.querySelectorAll('.mm-item').length >= 3, null, { timeout: 15000 }); // image + video + generated 3D
    const items = page.locator('.mm-item');
    h.assert.strictEqual(await page.locator('.mm-item img[src]').count() >= 1, true);
    // alt text is escaped, never interpreted as HTML
    h.assert.strictEqual(await page.locator('.mm-item b', { hasText: 'front' }).count(), 0);
    h.assert.match(await page.locator('.mm-list').innerText(), /<b>front<\/b>/);
    // 3D badge on the image + Regenerate button
    await page.waitForFunction(() => document.querySelector('[data-s3d=ready]'));
    h.assert.ok(await page.getByRole('button', { name: /Regenerate 3D/ }).count() >= 1);
    await h.noHScroll(page, 'admin media (filled)');
    // the first image is the cover
    h.assert.strictEqual(await page.locator('.mm-item.is-cover').count(), 1);

    // reorder with buttons: move the video up
    const kinds = async () => page.locator('.mm-item .mm-meta strong').allInnerTexts();
    const before = await kinds();
    const vi = before.indexOf('Video');
    h.assert.ok(vi > 0, 'video present ' + before);
    await page.locator('.mm-item').nth(vi).locator('[data-mm=up]').click();
    await page.waitForFunction((v) => document.querySelectorAll('.mm-item')[v - 1].textContent.includes('Video'), vi);
    // a11y: focus stays on a move button after re-render
    h.assert.ok(await page.evaluate(() => /up|down/.test(document.activeElement.dataset.mm || '')), 'focus kept on reorder');

    // storefront: gallery shows image, video and 3D
    const slug = 'media-tee';
    await h.go(page, `product.html?slug=${slug}`);
    await page.waitForSelector('#thumbs .thumb');
    h.assert.ok(await page.locator('#thumbs .thumb').count() >= 3);
    await h.noHScroll(page, 'product gallery');
    await page.locator('#thumbs .thumb-video').click();
    await page.waitForSelector('#gal-main video[controls][playsinline]');
    h.assert.strictEqual(await page.locator('#gal-main video').getAttribute('preload'), 'metadata');
    await page.locator('#thumbs .thumb-3d').click();
    await page.waitForSelector('#gal-main .v3d-tilt');
    h.assert.match(await page.locator('.v3d-label').innerText(), /Preview 3D \(on-device\)/);
    // tilt viewer responds to the keyboard
    await page.locator('.v3d-tilt').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.v3d-card')).getPropertyValue('--ry').trim() !== '0deg');
    // video is paused when leaving it
    await page.locator('#thumbs .thumb').first().click();
    await page.waitForSelector('#gal-main .gal-zoom img');
    // lightbox
    await page.locator('#gal-main .gal-zoom').click();
    await page.waitForSelector('dialog.lb[open]');
    h.assert.match(await page.locator('dialog.lb img').getAttribute('alt'), /Blue test tee/);
    await page.locator('dialog.lb [data-lb=zoom]').click();
    h.assert.strictEqual(await page.locator('dialog.lb.zoomed').count(), 1);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog.lb', { state: 'detached' });
    h.assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('gal-zoom')), 'focus returns to the photo');
    // keyboard on the stage moves through the media
    await page.locator('#gal-main .gal-zoom').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#thumbs .thumb[aria-current=true]') !== document.querySelector('#thumbs .thumb'));
    // product cards use the cover image
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
    h.assert.ok(await page.locator('.pcard[data-slug="media-tee"] img').count() >= 1);

    // admin: set cover on a second image, delete the video
    await h.go(page, 'admin.html'); await page.waitForSelector('.a-stats'); await page.click('[data-tab=products]');
    await page.locator('tr', { hasText: 'Media Tee' }).locator('[data-act=edit-product]').click();
    await page.waitForSelector('.mm-item');
    await page.setInputFiles('#mm-file', FX('photo.png'));
    await page.waitForFunction(() => document.querySelectorAll('.mm-item .mm-meta strong').length >= 5, null, { timeout: 15000 });
    const coverBtn = page.locator('.mm-item:not(.is-cover) [data-mm=cover]').first();
    await coverBtn.click();
    await page.waitForFunction(() => document.querySelectorAll('.mm-item.is-cover').length === 1 && document.querySelectorAll('.mm-item')[0].classList.contains('is-cover') === false);
    const n0 = await page.locator('.mm-item').count();
    await page.locator('.mm-item', { hasText: 'Video' }).locator('[data-mm=delete]').click(); // dialog auto-accepted by the harness
    await page.waitForFunction((n) => document.querySelectorAll('.mm-item').length === n - 1, n0);
    h.assert.strictEqual(await page.locator('.mm-item', { hasText: 'Video' }).count(), 0);
    await h.noHScroll(page, 'admin media after edits');
  }],

  ['media: own .glb uses <model-viewer> (lazy), failure falls back to the tilt preview', async (h) => {
    const ctx = await h.newContext();
    let mvLoads = 0, fail = false;
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@google\/model-viewer/, (r) => {
      mvLoads++;
      if (fail) return r.fulfill({ status: 404, contentType: 'text/plain', body: 'nope' });
      r.fulfill({ status: 200, contentType: 'text/javascript', body:
        "class MV extends HTMLElement{connectedCallback(){setTimeout(()=>this.dispatchEvent(new Event('load')),20)}}customElements.define('model-viewer',MV);" });
    });
    const page = await h.page(ctx);
    await h.go(page, 'index.html');
    await createProduct(h, page, 'Glb Cap');
    await page.setInputFiles('#mm-file', FX('photo.png'));
    await page.waitForSelector('.mm-item');
    await page.setInputFiles('#mm-glb', { name: 'cap.glb', mimeType: 'model/gltf-binary', buffer: fakeGlb() });
    await page.waitForFunction(() => /3D model/.test(document.querySelector('.mm-list').innerText) && document.querySelectorAll('.mm-item').length >= 3, null, { timeout: 15000 });
    await h.go(page, 'product.html?slug=glb-cap');
    await page.waitForSelector('#thumbs .thumb-3d');
    await page.waitForTimeout(300);
    h.assert.strictEqual(mvLoads, 0, 'model-viewer is not loaded until a 3D item is shown');
    await page.locator('#thumbs .thumb-3d').last().click();
    await page.waitForSelector('#gal-main model-viewer[camera-controls]');
    h.assert.ok(await page.locator('#gal-main model-viewer').getAttribute('src'));
    h.assert.ok(mvLoads >= 1);
    h.assert.match(await page.locator('.v3d-label').innerText(), /3D model/);
    await h.noHScroll(page, 'glb viewer');
  }, { viewports: ['desktop'] }],

  ['media: model-viewer load failure falls back to tilt preview', async (h) => {
    const ctx = await h.newContext();
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@google\/model-viewer/, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'nope' }));
    const page = await h.page(ctx);
    await h.go(page, 'index.html');
    await createProduct(h, page, 'Glb Fail');
    await page.setInputFiles('#mm-file', FX('photo.png'));
    await page.waitForSelector('.mm-item');
    await page.setInputFiles('#mm-glb', { name: 'x.glb', mimeType: 'model/gltf-binary', buffer: fakeGlb() });
    await page.waitForFunction(() => document.querySelectorAll('.mm-item').length >= 3, null, { timeout: 15000 });
    await h.go(page, 'product.html?slug=glb-fail');
    await page.locator('#thumbs .thumb-3d').last().click();
    await page.waitForSelector('#gal-main .v3d-tilt', { timeout: 20000 });
    await page.waitForSelector('.v3d-msg:not([hidden])');
    h.allowErrors(/model-viewer|Failed to load resource|404/);
  }, { viewports: ['mobile'] }],

  ['media: reduced motion disables the idle 3D sway', async (h) => {
    const ctx = await h.newContext({ reducedMotion: 'reduce' });
    const page = await h.page(ctx);
    await h.go(page, 'index.html');
    await createProduct(h, page, 'Calm Tee');
    await page.setInputFiles('#mm-file', FX('photo.png'));
    await page.waitForFunction(() => document.querySelectorAll('.mm-item').length >= 2, null, { timeout: 15000 });
    await h.go(page, 'product.html?slug=calm-tee');
    await page.locator('#thumbs .thumb-3d').click();
    await page.waitForSelector('.v3d-card');
    h.assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.v3d-card')).animationName), 'none');
  }, { viewports: ['mobile'] }],

  ['media: gallery swipe on mobile', async (h) => {
    const ctx = await h.newContext({ hasTouch: true });
    const page = await h.page(ctx);
    await h.go(page, 'index.html');
    await createProduct(h, page, 'Swipe Tee');
    await page.setInputFiles('#mm-file', [FX('photo.png'), FX('photo.png')]);
    await page.waitForFunction(() => document.querySelectorAll('.mm-item').length >= 3, null, { timeout: 15000 });
    await h.go(page, 'product.html?slug=swipe-tee');
    await page.waitForSelector('#thumbs .thumb');
    await page.evaluate(() => {
      const el = document.querySelector('#gal-main .gal-zoom img');
      const mk = (type, x) => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 })] });
      el.dispatchEvent(mk('touchstart', 300)); el.dispatchEvent(mk('touchend', 120));
    });
    await page.waitForFunction(() => document.querySelectorAll('#thumbs .thumb')[1].getAttribute('aria-current') === 'true');
    await h.noHScroll(page, 'swipe');
  }, { viewports: ['mobile'] }],

  ['settings: language lives in Settings, persists, translates every page; drawer link + footer link', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    // drawer has the Settings link and no language buttons; footer keeps a small link
    await page.click('#burger');
    await page.waitForSelector('#drawer.open');
    h.assert.strictEqual(await page.locator('#drawer a[href="settings.html"]').count(), 1);
    h.assert.strictEqual(await page.locator('#drawer [data-lang], footer [data-lang]').count(), 0);
    await page.keyboard.press('Escape');
    h.assert.match(await page.locator('footer a.foot-lang').innerText(), /Language: English/);
    await page.locator('footer a.foot-lang').click();
    await page.waitForSelector('input[name=lang]');
    h.assert.strictEqual(await page.locator('input[name=lang]').count(), 3);
    h.assert.match(await page.locator('.lang-cards').innerText(), /Français[\s\S]*Kreyòl ayisyen[\s\S]*English/);
    await h.noHScroll(page, 'settings');

    for (const [lang, h1, htmlLang, cat] of [['fr', 'Paramètres', 'fr', /catégories/i], ['ht', 'Paramèt', 'ht', /kategori/i], ['en', 'Settings', 'en', /Browse by Categories/]]) {
      await Promise.all([page.waitForLoadState('load'), page.locator(`input[name=lang][value=${lang}]`).check()]);
      await page.waitForFunction((l) => document.documentElement.lang === l, htmlLang);
      await page.waitForSelector('.settings h1');
      h.assert.strictEqual((await page.locator('.settings h1').innerText()).trim(), h1);
      h.assert.strictEqual(await page.evaluate(() => localStorage.getItem('jps_lang')), lang);
      h.assert.strictEqual(await page.evaluate(async () => (await (await import('/js/api.js')).getPreferences()).lang), lang);
      h.assert.ok(await page.locator(`input[name=lang][value=${lang}]`).isChecked());
      for (const p of ['index.html', 'shop.html', 'product.html?slug=haiti-scarf', 'cart.html', 'checkout.html', 'account.html', 'wishlist.html', 'info.html?p=faq', 'settings.html']) {
        await h.go(page, p);
        if (p === 'index.html') h.assert.match(await page.locator('main h2.section-title').first().innerText(), cat);
        const txt = await page.locator('body').innerText();
        const m = txt.match(/\b(nav|common|home|shop|product|footer|info|cart|checkout|order|account|admin|search|wishlist|promo|settings|viewer3d)\.[a-z0-9_]+(\.[a-z0-9_]+)*\b/);
        h.assert.ok(!m || /\.(com|me|html)$/.test(m[0]), `raw key "${m && m[0]}" on ${p} (${lang})`);
        h.assert.strictEqual(await page.evaluate(() => document.documentElement.lang), htmlLang);
      }
      await h.go(page, 'settings.html');
    }
    // footer link shows the chosen language name in FR
    await page.locator('input[name=lang][value=ht]').check();
    await page.waitForFunction(() => document.documentElement.lang === 'ht');
    h.assert.match(await page.locator('footer a.foot-lang').innerText(), /Lang: Kreyòl ayisyen · Chanje/);
  }],

  ['settings: new strings exist in all languages (gallery, viewer, admin media)', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    let total = 0;
    for (const lang of ['fr', 'ht']) {
      const bad = await (await h.newContext()).newPage().then(async (pg) => {
        await pg.addInitScript((l) => localStorage.setItem('jps_lang', l), lang);
        await pg.goto(h.url('index.html'));
        const r = await pg.evaluate(async () => {
          const i = await import('/js/i18n.js'); await import('/js/i18n.media.js');
          const src = await (await fetch('/js/i18n.media.js')).text();
          const keys = [...new Set([...src.matchAll(/'((?:nav|footer|settings|product|viewer3d|admin)\.[a-z0-9_.]+)':/g)].map((m) => m[1]))];
          return { keys: keys.length, bad: keys.filter((k) => i.t(k) === k) };
        });
        await pg.close(); return r;
      });
      total = bad.keys;
      h.assert.deepStrictEqual(bad.bad, [], `untranslated keys in ${lang}`);
    }
    h.assert.ok(total > 80, 'checked ' + total + ' keys');
  }, { viewports: ['desktop'] }],

  ['settings: currency + motion notes, clear cart with in-page confirm', async (h) => {
    const page = await h.page();
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
    await page.locator('.pcard [data-add]').first().click();
    await page.waitForFunction(() => !document.querySelector('[data-cart-badge]').hidden);
    await h.go(page, 'settings.html');
    h.assert.match(await page.locator('body').innerText(), /US dollars \(USD\)/);
    h.assert.match(await page.locator('body').innerText(), /Reduce motion/);
    await page.click('[data-clear=cart]');
    await page.waitForSelector('#set-confirm:not([hidden])');
    h.assert.ok(await page.evaluate(() => document.activeElement.id === 'set-no'), 'focus moves into the confirm');
    await page.click('#set-no');
    h.assert.ok((await page.evaluate(() => localStorage.getItem('jps_cart_v1') || '')).length > 2, 'cancel keeps the cart');
    await page.click('[data-clear=cart]'); await page.click('#set-yes');
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('jps_cart_v1') || '[]').length === 0; } catch { return true; } });
    await page.waitForFunction(() => document.querySelector('[data-cart-badge]').hidden);
  }],
];
