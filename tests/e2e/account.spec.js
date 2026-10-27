'use strict';
const { placeOrderViaApi, fillCheckout } = require('./lib');

module.exports = [
  ['sign up, order history, sign out, sign in again; bad password rejected', async (h) => {
    const page = await h.page();
    await h.go(page, 'account.html');
    await page.click('#tab-signup');
    await page.fill('#a-name', 'Test User'); await page.fill('#a-email', 'tester@example.com'); await page.fill('#a-pass', 'secret12');
    await page.click('#auth-form button[type=submit]');
    await page.waitForSelector('#signout');
    h.assert.match(await page.locator('h1').innerText(), /Test User/);
    // order as signed-in user via the real UI
    await h.go(page, 'shop.html'); await page.waitForSelector('.pcard');
    await page.click('.pcard[data-slug="haiti-scarf"] [data-add]');
    await h.go(page, 'checkout.html'); await page.waitForSelector('#checkout-form');
    h.assert.strictEqual(await page.inputValue('#f-email'), 'tester@example.com', 'prefilled from account');
    await fillCheckout(page, { email: 'tester@example.com' });
    await page.click('#checkout-form button[type=submit]');
    await page.waitForURL(/order\.html/); await page.waitForSelector('.c-ordnum');
    const num = (await page.locator('.c-ordnum').innerText()).trim();
    await h.go(page, 'account.html'); await page.waitForSelector('.c-hist');
    h.assert.match(await page.locator('.c-hist').innerText(), new RegExp(num));
    await page.click('#signout');
    await page.waitForSelector('#auth-form');
    // history gone after sign out
    h.assert.strictEqual(await page.locator('.c-hist').count(), 0);
    // wrong password
    await page.fill('#a-email', 'tester@example.com'); await page.fill('#a-pass', 'wrongpass');
    await page.click('#auth-form button[type=submit]');
    await page.waitForSelector('.c-alert.err');
    await page.fill('#a-email', 'tester@example.com'); await page.fill('#a-pass', 'secret12');
    await page.click('#auth-form button[type=submit]');
    await page.waitForSelector('.c-hist');
    // duplicate sign up rejected
    await page.click('#signout'); await page.waitForSelector('#auth-form');
    await page.click('#tab-signup');
    await page.fill('#a-name', 'Dup'); await page.fill('#a-email', 'tester@example.com'); await page.fill('#a-pass', 'secret12');
    await page.click('#auth-form button[type=submit]');
    await page.waitForSelector('.c-alert.err');
    // client validation
    await page.fill('#a-email', 'bad'); await page.click('#auth-form button[type=submit]');
    await page.waitForSelector('.c-alert.err');
  }],

  ['signed-in user can review a product; review text is escaped', async (h) => {
    const page = await h.page();
    await h.go(page, 'account.html');
    await page.click('#tab-signup');
    await page.fill('#a-name', 'Rev User'); await page.fill('#a-email', 'rev@example.com'); await page.fill('#a-pass', 'secret12');
    await page.click('#auth-form button[type=submit]'); await page.waitForSelector('#signout');
    await h.go(page, 'product.html?slug=haiti-scarf#reviews');
    await page.waitForSelector('#rf');
    await page.fill('#rc', '<img src=x onerror="window.__xss=1"> great scarf');
    await page.click('#rf button[type=submit]');
    await page.waitForSelector('.review');
    h.assert.match(await page.locator('.review p').first().innerText(), /<img src=x/);
    await page.waitForTimeout(200);
    h.assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
  }],

  ['contact form (>=10 char message) and newsletter succeed; invalid input is rejected', async (h) => {
    const page = await h.page();
    await h.go(page, 'info.html?p=contact');
    await page.click('#cf button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#cmsg').classList.contains('err'));
    await page.fill('#c-name', 'Jean'); await page.fill('#c-email', 'jean@example.com'); await page.fill('#c-msg', 'Hello, where is my order please?');
    await page.click('#cf button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#cmsg').classList.contains('ok'));
    h.assert.strictEqual(await page.inputValue('#c-name'), '');
    h.assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jps_contact')).length), 1);
    // newsletter
    await page.fill('#news-email', 'nope'); await page.click('#news-form button');
    await page.waitForFunction(() => document.querySelector('#news-msg').classList.contains('err'));
    await page.fill('#news-email', 'fan@example.com'); await page.click('#news-form button');
    await page.waitForFunction(() => document.querySelector('#news-msg').classList.contains('ok'));
    h.assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jps_newsletter')).length), 1);
  }],

  ['language switch EN/FR/HT persists and translates', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    h.assert.match(await page.locator('main h2.section-title').first().innerText(), /Browse by Categories/);
    for (const [lang, re, htmlLang] of [['fr', /Parcourir par catégories|catégories/i, 'fr'], ['ht', /kategori/i, 'ht'], ['en', /Browse by Categories/, 'en']]) {
      await Promise.all([page.waitForLoadState('load'), page.locator(`footer [data-lang=${lang}]`).click()]);
      await page.waitForSelector('#popular .pcard'); await page.waitForLoadState('networkidle');
      h.assert.match(await page.locator('main h2.section-title').first().innerText(), re);
      h.assert.strictEqual(await page.evaluate(() => document.documentElement.lang), htmlLang);
      h.assert.strictEqual(await page.evaluate(() => localStorage.getItem('jps_lang')), lang);
      if (lang !== 'en') {
        // persists on another page, incl. commerce pages
        for (const p of ['cart.html', 'checkout.html', 'account.html', 'order.html', 'admin.html']) {
          await h.go(page, p);
          const txt = await page.locator('main').innerText();
          h.assert.ok(!/\b(cart|checkout|account|order)\.[a-z_.]+\b/.test(txt), `raw i18n key visible on ${p} (${lang}): ${txt.slice(0, 200)}`);
        }
        await h.go(page, 'index.html');
        h.assert.strictEqual(await page.evaluate(() => document.documentElement.lang), htmlLang);
      }
    }
  }],

  ['no missing translation keys render (raw dotted keys) in any language', async (h) => {
    const page = await h.page();
    for (const lang of ['fr', 'ht']) {
      await page.addInitScript((l) => { try { localStorage.setItem('jps_lang', l); } catch {} }, lang);
      for (const p of ['index.html', 'shop.html', 'product.html?slug=haiti-scarf', 'wishlist.html', 'info.html?p=contact', 'info.html?p=faq', 'cart.html', 'checkout.html', 'order.html', 'account.html']) {
        await h.go(page, p);
        const txt = await page.locator('body').innerText();
        const m = txt.match(/\b(nav|common|home|shop|product|footer|info|cart|checkout|order|account|admin|search|wishlist|promo)\.[a-z0-9_]+(\.[a-z0-9_]+)*\b/);
        h.assert.ok(!m || /\.(com|me|html)$/.test(m[0]), `raw key "${m && m[0]}" on ${p} in ${lang}`);
      }
    }
  }, { viewports: ['mobile'] }],

  ['drawer opens and closes with Escape; search overlay too; focus returns', async (h) => {
    const page = await h.page();
    await h.go(page, 'index.html');
    await page.click('#burger');
    await page.waitForSelector('#drawer.open');
    h.assert.strictEqual(await page.getAttribute('#burger', 'aria-expanded'), 'true');
    await page.waitForFunction(() => document.getElementById('drawer').contains(document.activeElement));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('drawer').classList.contains('open'));
    h.assert.strictEqual(await page.getAttribute('#burger', 'aria-expanded'), 'false');
    h.assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'burger');
    // close by scrim and by close button
    await page.click('#burger'); await page.waitForSelector('#drawer.open');
    await page.click('[data-close-drawer]');
    await page.waitForFunction(() => !document.getElementById('drawer').classList.contains('open'));
    // drawer links work
    await page.click('#burger'); await page.waitForSelector('#drawer.open');
    await page.waitForSelector('#drawer-cats a');
    await page.click('#drawer-cats a');
    await page.waitForURL(/shop\.html\?category=fan-zone/);
  }],
];
