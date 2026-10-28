// Shared chrome: promo strip, header, drawer, search overlay, footer, toasts, product cards.
import { t, getLang, setLang, getLangs, LANG_NAMES } from './i18n.js';
import './i18n.media.js';
import './i18n.store.js';
import { getCategories, buildTree } from './catalog.js';
import { formatMoney, COUPON_DEFAULT } from './pricing.js';
import * as api from './api.js';
import { addItem, cartCount, onCartChange } from './cart.js';

export const IG_URL = 'https://instagram.com/jpslogistics';
export const LOGO = 'assets/brand/logo.png';

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const P = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.4 0 5.6 3.3 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
  cart: '<path d="M3 4h2.2l2.3 11h10.5l2-8H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20c0 1.5-2 2-5 2"/>',
  insta: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};
export function icon(name, cls = '') {
  const fill = name === 'insta' ? '' : '';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}${fill}</svg>`;
}

export function starsHTML(rating = 0) {
  const r = Math.round(Number(rating) || 0);
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<svg class="star ${i <= r ? 'on' : ''}" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.1 6.4 20.1l1.1-6.2L3 9.5l6.2-.9z"/></svg>`;
  return `<span class="stars" role="img" aria-label="${escapeHtml(t('common.rating', { rating: (Number(rating) || 0).toFixed(1).replace(/\.0$/, '') }))}">${s}</span>`;
}

export function imageHTML(p, { eager = false, sizes = '' } = {}) {
  if (p.image) return `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" ${eager ? '' : 'loading="lazy"'} decoding="async" ${sizes ? `sizes="${sizes}"` : ''}>`;
  return `<div class="ph" role="img" aria-label="${escapeHtml(p.name)}"><span class="ph-badge"><img src="${LOGO}" alt="" loading="lazy"></span></div>`;
}

export function setMeta({ title, description, image, type = 'website' } = {}) {
  const full = title ? `${title} | JP's Logistics & More` : "JP's Logistics & More";
  document.title = full;
  const set = (sel, attr, val) => {
    if (!val) return;
    let el = document.head.querySelector(sel);
    if (!el) { el = document.createElement('meta'); const m = sel.match(/\[(\w+(?::\w+)?)="([^"]+)"\]/); el.setAttribute(m[1], m[2]); document.head.appendChild(el); }
    el.setAttribute(attr, val);
  };
  set('meta[name="description"]', 'content', description);
  set('meta[property="og:title"]', 'content', full);
  set('meta[property="og:description"]', 'content', description);
  set('meta[property="og:type"]', 'content', type);
  set('meta[property="og:site_name"]', 'content', "JP's Logistics & More");
  set('meta[property="og:url"]', 'content', location.href);
  set('meta[property="og:image"]', 'content', new URL(image || 'assets/brand/icon-512.png', location.href).href);
  set('meta[name="twitter:card"]', 'content', 'summary_large_image');
}

export function skeletonCards(n = 4) {
  return Array.from({ length: n }, () => `<div class="pcard skel" aria-hidden="true"><div class="pcard-media skeleton"></div><div class="pcard-body"><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div></div>`).join('');
}

// ---------- wishlist state ----------
const wl = new Set();
let wlReady = false;
async function loadWishlist() {
  try { (await api.getWishlist()).forEach(id => wl.add(id)); } catch {}
  wlReady = true;
  syncHearts(); syncBadges();
}
export function isWished(id) { return wl.has(id); }
function syncHearts(root = document) {
  root.querySelectorAll('[data-wish]').forEach(b => {
    const on = wl.has(b.dataset.wish);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', t(on ? 'common.wishlist_remove' : 'common.wishlist_add'));
    b.classList.toggle('on', on);
  });
}
export async function toggleWish(id) {
  try {
    const now = await api.toggleWishlist(id);
    now ? wl.add(id) : wl.delete(id);
    syncHearts(); syncBadges();
    toast(t(now ? 'common.wishlist_added' : 'common.wishlist_removed'), 'success');
    window.dispatchEvent(new CustomEvent('jps:wishlist', { detail: { id, on: now } }));
    return now;
  } catch (e) { toast(t('common.error'), 'error'); return wl.has(id); }
}

// ---------- product card ----------
export function productCardHTML(p) {
  const out = p.stock !== undefined && p.stock <= 0;
  const href = `product.html?slug=${encodeURIComponent(p.slug || p.id)}`;
  const disc = p.compare_at_price && p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
  return `<article class="pcard" data-id="${escapeHtml(p.id)}" data-slug="${escapeHtml(p.slug)}" data-name="${escapeHtml(p.name)}" data-price="${p.price}" data-image="${escapeHtml(p.image || '')}" data-stock="${p.stock ?? ''}">
  <div class="pcard-media">
    <a href="${href}" class="pcard-link" tabindex="-1" aria-hidden="true">${imageHTML(p)}</a>
    <button type="button" class="heart ${isWished(p.id) ? 'on' : ''}" data-wish="${escapeHtml(p.id)}" aria-pressed="${isWished(p.id)}" aria-label="${escapeHtml(t(isWished(p.id) ? 'common.wishlist_remove' : 'common.wishlist_add'))}">${icon('heart')}</button>
    ${out ? `<span class="badge badge-dark">${escapeHtml(t('common.sold_out'))}</span>` : disc ? `<span class="badge">-${disc}%</span>` : ''}
  </div>
  <div class="pcard-body">
    <h3 class="pcard-name"><a href="${href}">${escapeHtml(p.name)}</a></h3>
    ${starsHTML(p.rating)}
    <div class="pcard-row">
      <p class="price">${formatMoney(p.price)}${p.compare_at_price > p.price ? ` <s>${formatMoney(p.compare_at_price)}</s>` : ''}</p>
      <button type="button" class="pcard-add" data-add ${out ? 'disabled' : ''} aria-label="${escapeHtml(t('common.add_to_cart'))}: ${escapeHtml(p.name)}">${icon('plus')}</button>
    </div>
  </div>
</article>`;
}
export function bindProductCards(root = document) { syncHearts(root); }

function cardProduct(card) {
  const d = card.dataset;
  return { id: d.id, slug: d.slug, name: d.name, price: Number(d.price), image: d.image || null, stock: d.stock === '' ? undefined : Number(d.stock) };
}
document.addEventListener('click', e => {
  const h = e.target.closest('[data-wish]');
  if (h) { e.preventDefault(); toggleWish(h.dataset.wish); return; }
  const a = e.target.closest('.pcard [data-add]');
  if (a) {
    e.preventDefault();
    const card = a.closest('.pcard');
    addItem(cardProduct(card), 1);
    toast(t('common.added'), 'success');
    a.classList.add('pop'); setTimeout(() => a.classList.remove('pop'), 500);
  }
});

// ---------- toasts ----------
let toastBox;
export function toast(msg, type = 'info') {
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.className = 'toasts'; toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastBox);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  toastBox.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
}

// ---------- chrome ----------
const page = location.pathname.split('/').pop() || 'index.html';
const qp = new URLSearchParams(location.search);
function navLink(href, label, match) {
  const cur = match ? match(page, qp) : page === href.split('?')[0];
  return `<a href="${href}" ${cur ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
}
const pLinks = ['about', 'contact', 'faq', 'shipping', 'returns'];

function chromeHTML() {
  const c = COUPON_DEFAULT;
  return `
<a class="skip" href="#main">${escapeHtml(t('nav.skip'))}</a>
<div class="promo" role="region" aria-label="Promo"><div class="container promo-in"><span class="promo-text">${t('promo.text', { code: c.code, pct: c.percent, min: c.min_subtotal })}</span><span class="promo-ship">${icon('truck')} ${escapeHtml(t('promo.ship'))}</span></div></div>
<header class="site-header" id="site-header">
  <div class="container hdr">
    <button type="button" class="icon-btn burger" id="burger" aria-label="${escapeHtml(t('nav.menu'))}" aria-controls="drawer" aria-expanded="false">${icon('menu')}</button>
    <a class="brand" href="index.html" aria-label="JP's Logistics & More"><img src="${LOGO}" alt="JP's Logistics & More" width="110" height="53"></a>
    <nav class="dnav" aria-label="${escapeHtml(t('nav.main'))}">
      ${navLink('index.html', t('nav.home'))}
      ${navLink('shop.html', t('nav.shop'), (p, q) => p === 'shop.html' || p === 'product.html')}
      ${navLink('info.html?p=about', t('nav.about'), (p, q) => p === 'info.html' && (q.get('p') || 'about') === 'about')}
      ${navLink('info.html?p=contact', t('nav.contact'), (p, q) => p === 'info.html' && q.get('p') === 'contact')}
    </nav>
    <div class="hdr-actions">
      <button type="button" class="icon-btn" id="search-btn" aria-label="${escapeHtml(t('nav.search'))}" aria-controls="search-overlay" aria-expanded="false">${icon('search')}</button>
      <a class="icon-btn hide-sm" href="account.html" aria-label="${escapeHtml(t('nav.account'))}">${icon('user')}</a>
      <a class="icon-btn" href="wishlist.html" aria-label="${escapeHtml(t('nav.wishlist'))}">${icon('heart')}<span class="badge-count" data-wl-badge hidden>0</span></a>
      <a class="icon-btn" href="cart.html" aria-label="${escapeHtml(t('nav.cart'))}">${icon('cart')}<span class="badge-count" data-cart-badge hidden>0</span></a>
    </div>
  </div>
</header>

<div class="scrim" id="scrim" hidden></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('nav.menu'))}" aria-hidden="true" tabindex="-1">
  <div class="drawer-head"><img src="${LOGO}" alt="JP's Logistics & More" width="96" height="46"><button type="button" class="icon-btn" data-close-drawer aria-label="${escapeHtml(t('nav.close'))}">${icon('close')}</button></div>
  <nav class="drawer-nav" aria-label="${escapeHtml(t('nav.main'))}">
    <a href="index.html">${icon('bag')}${escapeHtml(t('nav.home'))}</a>
    <a href="shop.html">${icon('tag')}${escapeHtml(t('nav.all_products'))}</a>
    <a href="wishlist.html">${icon('heart')}${escapeHtml(t('nav.wishlist'))}</a>
    <a href="cart.html">${icon('cart')}${escapeHtml(t('nav.cart'))}</a>
    <a href="account.html">${icon('user')}${escapeHtml(t('nav.account'))}</a>
    <h2 class="drawer-h">${escapeHtml(t('nav.categories'))}</h2>
    <div id="drawer-cats" class="drawer-sub"></div>
    <h2 class="drawer-h">${escapeHtml(t('nav.pages'))}</h2>
    <div class="drawer-sub">${pLinks.map(p => `<a href="info.html?p=${p}">${escapeHtml(t('nav.' + p))}</a>`).join('')}</div>
    <a href="settings.html" ${page === 'settings.html' ? 'aria-current="page"' : ''}>${icon('gear')}${escapeHtml(t('nav.settings'))}</a>
  </nav>
  <a class="drawer-ig" href="${IG_URL}" target="_blank" rel="noopener">${icon('insta')} @jpslogistics</a>
</aside>

<div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('search.label'))}" hidden>
  <div class="container so-in">
    <form class="so-form" id="search-form" role="search" action="shop.html">
      ${icon('search')}
      <input type="search" name="q" id="search-input" placeholder="${escapeHtml(t('search.placeholder'))}" aria-label="${escapeHtml(t('search.label'))}" autocomplete="off" enterkeyhint="search">
      <button type="button" class="icon-btn" data-close-search aria-label="${escapeHtml(t('nav.close'))}">${icon('close')}</button>
    </form>
    <div class="so-results" id="search-results" aria-live="polite"><p class="so-hint">${escapeHtml(t('search.hint'))}</p></div>
  </div>
</div>`;
}

function footerHTML() {
  return `<footer class="site-footer">
  <div class="container foot-grid">
    <div class="foot-brand">
      <img src="${LOGO}" alt="JP's Logistics & More" width="120" height="58" class="foot-logo">
      <p>${escapeHtml(t('footer.tagline'))}</p>
      <a class="foot-ig" href="${IG_URL}" target="_blank" rel="noopener">${icon('insta')} @jpslogistics</a>
    </div>
    <div><h2 class="foot-h">${escapeHtml(t('footer.shop'))}</h2><ul class="foot-list">
      <li><a href="shop.html">${escapeHtml(t('nav.all_products'))}</a></li><span id="foot-cats" hidden></span><li><a href="wishlist.html">${escapeHtml(t('nav.wishlist'))}</a></li><li><a href="cart.html">${escapeHtml(t('nav.cart'))}</a></li><li><a href="account.html">${escapeHtml(t('nav.account'))}</a></li></ul></div>
    <div><h2 class="foot-h">${escapeHtml(t('footer.help'))}</h2><ul class="foot-list">${pLinks.map(p => `<li><a href="info.html?p=${p}">${escapeHtml(t('nav.' + p))}</a></li>`).join('')}</ul></div>
    <div class="foot-news">
      <h2 class="foot-h">${escapeHtml(t('footer.newsletter'))}</h2>
      <p>${escapeHtml(t('footer.newsletter_text'))}</p>
      <form id="news-form" class="news-form" novalidate>
        <label class="sr-only" for="news-email">${escapeHtml(t('common.email'))}</label>
        <input id="news-email" type="email" name="email" required autocomplete="email" placeholder="${escapeHtml(t('footer.email_ph'))}">
        <button class="btn btn-primary" type="submit">${escapeHtml(t('footer.subscribe'))}</button>
      </form>
      <p class="news-msg" id="news-msg" role="status"></p>
    </div>
  </div>
  <div class="container foot-bar">
    <p>${escapeHtml(t('footer.rights', { year: new Date().getFullYear() }))}</p>
    <a class="foot-lang" href="settings.html" data-foot-lang>${escapeHtml(t('footer.language_link', { lang: LANG_NAMES[getLang()] }))}</a>
  </div>
</footer>`;
}

// ---------- behaviours ----------
const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
let lastFocus = null;
function trap(container, e) {
  if (e.key !== 'Tab') return;
  const els = [...container.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
  if (!els.length) return;
  const first = els[0], last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function setupDrawer() {
  const drawer = document.getElementById('drawer'), scrim = document.getElementById('scrim'), burger = document.getElementById('burger');
  const open = () => {
    lastFocus = document.activeElement;
    drawer.inert = false; drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('show'));
    burger.setAttribute('aria-expanded', 'true'); document.body.classList.add('no-scroll');
    drawer.focus();
  };
  const close = () => {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); scrim.classList.remove('show');
    setTimeout(() => { if (!drawer.classList.contains('open')) scrim.hidden = true; }, 250);
    burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll');
    if (lastFocus) lastFocus.focus();
  };
  burger.addEventListener('click', open);
  scrim.addEventListener('click', close);
  drawer.querySelector('[data-close-drawer]').addEventListener('click', close);
  drawer.addEventListener('keydown', e => { if (e.key === 'Escape') close(); trap(drawer, e); });
  drawer.inert = true;
  new MutationObserver(() => { drawer.inert = !drawer.classList.contains('open'); }).observe(drawer, { attributes: true, attributeFilter: ['class'] });
  getCategories().then(cats => {
    const link = (c, depth) => `<a href="shop.html?category=${encodeURIComponent(c.slug)}"${depth ? ' class="sub"' : ''}>${escapeHtml(c.name)}</a>`;
    const walk = (nodes, depth) => nodes.map(n => link(n, depth) + walk(n.children, depth + 1)).join('');
    const tree = buildTree(cats);
    document.getElementById('drawer-cats').innerHTML = walk(tree, 0);
    const fc = document.getElementById('foot-cats');
    if (fc) fc.innerHTML = tree.slice(0, 6).map(c => `<li><a href="shop.html?category=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a></li>`).join('');
  }).catch(() => {});
}

function setupSearch() {
  const ov = document.getElementById('search-overlay'), btn = document.getElementById('search-btn');
  const input = document.getElementById('search-input'), res = document.getElementById('search-results'), form = document.getElementById('search-form');
  let timer, seq = 0;
  const open = () => {
    lastFocus = document.activeElement; ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('open'));
    btn.setAttribute('aria-expanded', 'true'); document.body.classList.add('no-scroll');
    setTimeout(() => input.focus(), 50);
  };
  const close = () => {
    ov.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll');
    setTimeout(() => { if (!ov.classList.contains('open')) ov.hidden = true; }, 250);
    if (lastFocus) lastFocus.focus();
  };
  btn.addEventListener('click', open);
  ov.querySelector('[data-close-search]').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    trap(ov, e);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...res.querySelectorAll('a')]; if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') (items[i + 1] || items[0]).focus();
      else if (i <= 0) input.focus(); else items[i - 1].focus();
    }
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { res.innerHTML = `<p class="so-hint">${escapeHtml(t('search.hint'))}</p>`; return; }
    timer = setTimeout(async () => {
      const my = ++seq;
      try {
        const list = await api.listProducts({ q, limit: 6 });
        if (my !== seq) return;
        res.innerHTML = list.length
          ? `<p class="so-title">${escapeHtml(t('search.suggestions'))}</p><ul class="so-list">${list.map(p => `<li><a href="product.html?slug=${encodeURIComponent(p.slug || p.id)}"><span class="so-thumb">${imageHTML(p)}</span><span class="so-name">${escapeHtml(p.name)}</span><span class="so-price">${formatMoney(p.price)}</span></a></li>`).join('')}</ul><a class="so-all" href="shop.html?q=${encodeURIComponent(q)}">${escapeHtml(t('search.all', { q }))} ${icon('chevron')}</a>`
          : `<p class="so-hint">${escapeHtml(t('search.none', { q }))}</p>`;
      } catch { res.innerHTML = `<p class="so-hint">${escapeHtml(t('common.error'))}</p>`; }
    }, 200);
  });
  form.addEventListener('submit', e => { if (!input.value.trim()) e.preventDefault(); });
}

function syncBadges() {
  const c = cartCount(), w = wl.size;
  document.querySelectorAll('[data-cart-badge]').forEach(b => { b.textContent = c > 99 ? '99+' : c; b.hidden = c === 0; });
  document.querySelectorAll('[data-wl-badge]').forEach(b => { b.textContent = w; b.hidden = w === 0; });
}

function setupNewsletter() {
  const f = document.getElementById('news-form'), msg = document.getElementById('news-msg');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const email = f.email.value.trim();
    msg.className = 'news-msg';
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = t('common.required'); msg.classList.add('err'); f.email.focus(); return; }
    const btn = f.querySelector('button'); btn.disabled = true;
    try { await api.subscribeNewsletter(email); msg.textContent = t('footer.subscribed'); msg.classList.add('ok'); f.reset(); }
    catch (err) { msg.textContent = err.message || t('common.error'); msg.classList.add('err'); }
    btn.disabled = false;
  });
}

// Language is a preference (api.getPreferences). If it differs from what this page rendered (e.g. saved on the
// account from another device), adopt it once: setLang stores jps_lang so this cannot loop.
async function syncPreferredLang() {
  try {
    if (typeof api.getPreferences !== 'function') return;
    const pref = await api.getPreferences();
    const l = pref && pref.lang;
    let stored = null; try { stored = localStorage.getItem('jps_lang'); } catch {}
    // 'en' with nothing stored is just the unset default: do not override the browser-derived language with it
    if (l && l !== getLang() && getLangs().includes(l) && (stored || l !== 'en')) setLang(l);
  } catch {}
}

function mount() {
  if (document.getElementById('site-header')) return;
  const holder = document.createElement('div');
  holder.innerHTML = chromeHTML();
  const frag = document.createDocumentFragment();
  while (holder.firstChild) frag.appendChild(holder.firstChild);
  document.body.prepend(frag);
  const main = document.getElementById('main') || document.querySelector('main');
  if (main && !main.id) main.id = 'main';
  if (main) main.setAttribute('tabindex', '-1');
  const f = document.createElement('div'); f.innerHTML = footerHTML();
  document.body.appendChild(f.firstElementChild);
  import('./payment-ui.js').then((m) => m.mountPaymentChrome()).catch(() => {});
  setupDrawer(); setupSearch(); setupNewsletter();
  syncPreferredLang();
  onCartChange(syncBadges);
  syncBadges();
  loadWishlist();
  window.addEventListener('scroll', () => document.getElementById('site-header').classList.toggle('scrolled', scrollY > 4), { passive: true });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

export { api };
export const ready = () => (wlReady ? Promise.resolve() : loadWishlistOnce());
function loadWishlistOnce() { return new Promise(r => { const i = setInterval(() => { if (wlReady) { clearInterval(i); r(); } }, 30); setTimeout(() => { clearInterval(i); r(); }, 1500); }); }

// Every page module calls pageReady() once its main content (or its error state) is rendered. It removes the
// branded #boot overlay; js/boot.js owns the fade-out and the failure watchdog.
export function pageReady() {
  try {
    if (typeof window.__bootReady === 'function') window.__bootReady();
    else { const b = document.getElementById('boot'); if (b) b.remove(); }
  } catch { /* never block a page on the loader */ }
}
