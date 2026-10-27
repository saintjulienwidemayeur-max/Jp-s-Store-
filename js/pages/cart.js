import '../i18n.commerce.js';
import { t } from '../i18n.js';
import { escapeHtml, toast } from '../layout.js';
import { getCart, setQty, removeItem, onCartChange } from '../cart.js';
import { computeTotals, formatMoney } from '../pricing.js';
import { validateCoupon } from '../api.js';

const root = document.getElementById('main');
const KEY = 'jps_coupon_code';
let coupon = null; // coupon object from validateCoupon
let msg = null; // {type, text}
let focusSel = null;

const store = {
  get() { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} },
};
const subtotalOf = (lines) => computeTotals(lines.map((l) => ({ unit_price: l.price, qty: l.qty })), null).subtotal;

function lineHTML(l) {
  const img = l.image
    ? `<img class="c-thumb" src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" loading="lazy" width="72" height="72">`
    : `<img class="c-thumb ph" src="assets/brand/logo.png" alt="" width="72" height="72">`;
  const id = escapeHtml(String(l.product_id));
  return `<li class="c-line" data-pid="${id}">
    <a href="product.html?slug=${encodeURIComponent(l.slug || l.product_id)}">${img}</a>
    <div class="c-line-main">
      <a class="c-line-name" href="product.html?slug=${encodeURIComponent(l.slug || l.product_id)}">${escapeHtml(l.name)}</a>
      <span class="c-line-price">${formatMoney(l.price)}</span>
      <div class="c-line-row">
        <div class="c-stepper" role="group" aria-label="${escapeHtml(t('cart.quantity'))}">
          <button type="button" data-act="dec" data-pid="${id}" aria-label="${escapeHtml(t('cart.decrease'))}">&minus;</button>
          <output aria-live="polite">${l.qty}</output>
          <button type="button" data-act="inc" data-pid="${id}" aria-label="${escapeHtml(t('cart.increase'))}">+</button>
        </div>
        <span class="c-line-total">${formatMoney(l.price * l.qty)}</span>
      </div>
      <button type="button" class="c-link-btn" data-act="rm" data-pid="${id}">${escapeHtml(t('cart.remove'))}</button>
    </div>
  </li>`;
}

function render() {
  document.title = `${t('cart.title')} | JP's Logistics & More`;
  const lines = getCart();
  if (!lines.length) {
    root.innerHTML = `<h1>${escapeHtml(t('cart.title'))}</h1>
      <div class="c-empty"><img src="assets/brand/logo.png" alt="">
      <h2>${escapeHtml(t('cart.empty'))}</h2><p>${escapeHtml(t('cart.empty_hint'))}</p>
      <a class="btn btn-primary" href="shop.html">${escapeHtml(t('cart.continue'))}</a></div>`;
    return;
  }
  const tot = computeTotals(lines.map((l) => ({ unit_price: l.price, qty: l.qty })), coupon);
  const min = coupon?.min_subtotal ?? 10;
  let note = msg;
  if (coupon && !tot.couponApplied && tot.couponReason === 'min_subtotal') {
    note = { type: 'warn', text: t('cart.coupon_min', { code: coupon.code, min: formatMoney(min) }) };
  } else if (!note && coupon && tot.couponApplied) {
    note = { type: 'ok', text: t('cart.coupon_ok', { code: coupon.code, percent: coupon.percent }) };
  }
  const count = lines.reduce((n, l) => n + l.qty, 0);
  root.innerHTML = `<h1>${escapeHtml(t('cart.title'))}</h1>
    <p class="c-sub">${escapeHtml(t('cart.items', { n: count }))}</p>
    <div class="c-layout">
      <section class="c-card" aria-label="${escapeHtml(t('cart.title'))}"><ul class="c-lines">${lines.map(lineHTML).join('')}</ul></section>
      <aside class="c-card c-sticky" aria-label="${escapeHtml(t('cart.summary'))}">
        <h2>${escapeHtml(t('cart.summary'))}</h2>
        <form class="c-coupon" id="coupon-form" novalidate>
          <input id="coupon-input" type="text" autocomplete="off" aria-label="${escapeHtml(t('cart.coupon_label'))}" placeholder="${escapeHtml(t('cart.coupon_placeholder'))}" value="${escapeHtml(coupon?.code || '')}">
          ${coupon ? `<button type="button" class="btn btn-outline" data-act="unapply">${escapeHtml(t('cart.coupon_remove'))}</button>`
                   : `<button type="submit" class="btn btn-outline">${escapeHtml(t('cart.coupon_apply'))}</button>`}
        </form>
        <p class="c-msg ${note ? note.type : ''}" id="coupon-msg" role="status">${note ? escapeHtml(note.text) : ''}</p>
        <dl class="c-totals">
          <div><dt>${escapeHtml(t('cart.subtotal'))}</dt><dd>${formatMoney(tot.subtotal)}</dd></div>
          ${tot.discount > 0 ? `<div class="c-discount"><dt>${escapeHtml(t('cart.discount'))} (${escapeHtml(coupon.code)})</dt><dd>&minus;${formatMoney(tot.discount)}</dd></div>` : ''}
          <div><dt>${escapeHtml(t('cart.shipping'))}</dt><dd><span class="c-badge-ship">${escapeHtml(t('cart.shipping_included'))}</span></dd></div>
          <div class="c-grand"><dt>${escapeHtml(t('cart.total'))}</dt><dd>${formatMoney(tot.total)}</dd></div>
        </dl>
        <div class="c-actions">
          <a class="btn btn-primary" href="checkout.html">${escapeHtml(t('cart.checkout'))}</a>
          <a class="btn btn-outline" href="shop.html">${escapeHtml(t('cart.continue'))}</a>
        </div>
      </aside>
    </div>`;
  if (focusSel) { root.querySelector(focusSel)?.focus(); focusSel = null; }
}

root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  const pid = b.dataset.pid;
  const line = getCart().find((l) => String(l.product_id) === pid);
  if (act === 'unapply') { coupon = null; msg = null; store.set(''); render(); return; }
  if (!line) return;
  msg = null;
  if (act === 'inc') { focusSel = `[data-act=inc][data-pid="${pid}"]`; setQty(line.product_id, line.qty + 1); }
  if (act === 'dec') { focusSel = `[data-act=dec][data-pid="${pid}"]`; if (line.qty <= 1) removeItem(line.product_id); else setQty(line.product_id, line.qty - 1); }
  if (act === 'rm') { removeItem(line.product_id); toast(t('cart.removed'), 'info'); }
});

root.addEventListener('submit', async (e) => {
  if (e.target.id !== 'coupon-form') return;
  e.preventDefault();
  const code = root.querySelector('#coupon-input').value.trim();
  if (!code) { msg = { type: 'err', text: t('cart.coupon_empty') }; render(); return; }
  try {
    const sub = subtotalOf(getCart());
    const v = await validateCoupon(code, sub);
    if (v.valid && v.coupon) {
      coupon = v.coupon; store.set(coupon.code); msg = null;
    } else {
      coupon = null; store.set('');
      const min = v.coupon?.min_subtotal ?? 10;
      msg = v.reason === 'min_subtotal'
        ? { type: 'warn', text: t('cart.coupon_min', { code: v.coupon?.code || code.toUpperCase(), min: formatMoney(min) }) }
        : { type: 'err', text: t(v.reason === 'expired' ? 'cart.coupon_expired' : 'cart.coupon_invalid') };
    }
  } catch (err) {
    msg = { type: 'err', text: t('cart.coupon_invalid') };
  }
  render();
});

async function init() {
  const saved = store.get();
  if (saved && getCart().length) {
    try {
      const v = await validateCoupon(saved, 1e9);
      if (v.valid && v.coupon) coupon = v.coupon; else store.set('');
    } catch { store.set(''); }
  }
  render();
  onCartChange(render);
}
init();
