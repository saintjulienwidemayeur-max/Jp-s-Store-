import '../i18n.commerce.js';
import '../config.js';
import { t } from '../i18n.js';
import { escapeHtml, toast } from '../layout.js';
import { getCart, clearCart, setQty, removeItem } from '../cart.js';
import { computeTotals, formatMoney } from '../pricing.js';
import { validateCoupon, placeOrder, getUser, getProduct } from '../api.js';

const root = document.getElementById('main');
const KEY = 'jps_coupon_code';
const store = {
  get() { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} },
};

const DEFAULT_PM = [
  { id: 'moncash' }, { id: 'zelle' }, { id: 'cash_on_delivery' }, { id: 'card_soon', disabled: true },
];
function paymentMethods() {
  const raw = window.JPS_CONFIG?.PAYMENT_METHODS;
  const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_PM;
  return list.map((m) => {
    if (typeof m === 'string') return { id: m, disabled: m === 'card_soon' };
    const id = m.id || m.key || m.code || m.value;
    return { id, label: m.label || m.name, disabled: !!(m.disabled || m.coming_soon || m.enabled === false || id === 'card_soon') };
  }).filter((m) => m.id);
}
function pmLabel(m) {
  const k = `checkout.pm.${m.id}`;
  const v = t(k);
  return v !== k ? v : (m.label || m.id);
}
function pmHint(m) {
  const k = `checkout.pm.${m.id}_hint`;
  const v = t(k);
  return v !== k ? v : '';
}

let coupon = null;
let values = { name: '', email: '', phone: '', address: '', city: '', country: 'Haiti', notes: '', payment: 'moncash' };
let errors = {};
let banner = null; // {type,text}
let stockIssues = {}; // pid -> available
let busy = false;

const FIELDS = [
  ['name', 'text', 'name'], ['email', 'email', 'email'], ['phone', 'tel', 'tel'],
  ['address', 'text', 'street-address'], ['city', 'text', 'address-level2'], ['country', 'text', 'country-name'],
];

function validate(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = t('checkout.err_name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = t('checkout.err_email');
  if (v.phone.replace(/\D/g, '').length < 7) e.phone = t('checkout.err_phone');
  if (v.address.trim().length < 4) e.address = t('checkout.err_address');
  if (!v.city.trim()) e.city = t('checkout.err_city');
  if (!v.country.trim()) e.country = t('checkout.err_country');
  const pm = paymentMethods().find((m) => m.id === v.payment);
  if (!pm || pm.disabled) e.payment = t('checkout.err_payment');
  return e;
}

function fieldHTML([name, type, ac]) {
  const err = errors[name];
  return `<div class="c-field">
    <label for="f-${name}">${escapeHtml(t(`checkout.${name}`))}</label>
    <input id="f-${name}" name="${name}" type="${type}" autocomplete="${ac}" value="${escapeHtml(values[name])}"
      ${name === 'country' ? 'list="country-list"' : ''} required aria-invalid="${err ? 'true' : 'false'}" ${err ? `aria-describedby="e-${name}"` : ''}>
    ${err ? `<p class="c-err" id="e-${name}" role="alert">${escapeHtml(err)}</p>` : ''}
  </div>`;
}

function render() {
  document.title = `${t('checkout.title')} | JP's Logistics & More`;
  const lines = getCart();
  if (!lines.length) {
    root.innerHTML = `<h1>${escapeHtml(t('checkout.title'))}</h1><div class="c-empty"><img src="assets/brand/logo.png" alt="">
      <h2>${escapeHtml(t('cart.empty'))}</h2><a class="btn btn-primary" href="shop.html">${escapeHtml(t('cart.continue'))}</a></div>`;
    return;
  }
  const tot = computeTotals(lines.map((l) => ({ unit_price: l.price, qty: l.qty })), coupon);
  const pms = paymentMethods();
  const pmHTML = pms.map((m) => `<label class="${m.disabled ? 'disabled' : ''}">
      <input type="radio" name="payment" value="${escapeHtml(m.id)}" ${m.disabled ? 'disabled' : ''} ${values.payment === m.id ? 'checked' : ''}>
      <span>${escapeHtml(pmLabel(m))}${m.disabled ? ` <em>(${escapeHtml(t('checkout.coming_soon'))})</em>` : ''}${pmHint(m) ? `<small>${escapeHtml(pmHint(m))}</small>` : ''}</span></label>`).join('');
  const sumLines = lines.map((l) => {
    const avail = stockIssues[l.product_id];
    return `<div class="c-sum-line"><span>${escapeHtml(l.name)} &times; ${l.qty}${avail !== undefined ? `<br><span class="c-stock-warn">${escapeHtml(t('checkout.only_left', { n: avail }))}</span> <button type="button" class="c-link-btn" data-fix="${escapeHtml(String(l.product_id))}">${escapeHtml(avail > 0 ? t('checkout.adjust') : t('cart.remove'))}</button>` : ''}</span><span>${formatMoney(l.price * l.qty)}</span></div>`;
  }).join('');
  root.innerHTML = `<h1>${escapeHtml(t('checkout.title'))}</h1>
    <p class="c-sub">${escapeHtml(t('checkout.subtitle'))}</p>
    ${banner ? `<div class="c-alert ${banner.type}" role="alert">${escapeHtml(banner.text)}</div>` : ''}
    <form id="checkout-form" class="c-layout" novalidate>
      <div>
        <section class="c-card c-form">
          <h2>${escapeHtml(t('checkout.contact'))}</h2>
          <div class="c-grid2">${FIELDS.slice(0, 3).map(fieldHTML).join('')}</div>
          ${fieldHTML(FIELDS[3])}
          <div class="c-grid2">${FIELDS.slice(4).map(fieldHTML).join('')}</div>
          <datalist id="country-list"><option>Haiti</option><option>United States</option><option>Canada</option><option>France</option><option>Dominican Republic</option></datalist>
          <div class="c-field"><label for="f-notes">${escapeHtml(t('checkout.notes'))}</label>
            <textarea id="f-notes" name="notes" rows="3">${escapeHtml(values.notes)}</textarea></div>
        </section>
        <section class="c-card"><fieldset class="c-pay"><legend>${escapeHtml(t('checkout.payment'))}</legend>${pmHTML}
          ${errors.payment ? `<p class="c-err" role="alert">${escapeHtml(errors.payment)}</p>` : ''}</fieldset>
          <p class="c-msg">${escapeHtml(t('checkout.no_card'))}</p></section>
      </div>
      <aside class="c-card c-sticky" aria-label="${escapeHtml(t('checkout.summary'))}">
        <h2>${escapeHtml(t('checkout.summary'))}</h2>
        ${sumLines}
        <dl class="c-totals" style="margin-top:12px">
          <div><dt>${escapeHtml(t('cart.subtotal'))}</dt><dd>${formatMoney(tot.subtotal)}</dd></div>
          ${tot.discount > 0 ? `<div class="c-discount"><dt>${escapeHtml(t('cart.discount'))} (${escapeHtml(coupon.code)})</dt><dd>&minus;${formatMoney(tot.discount)}</dd></div>` : ''}
          <div><dt>${escapeHtml(t('cart.shipping'))}</dt><dd><span class="c-badge-ship">${escapeHtml(t('cart.shipping_included'))}</span></dd></div>
          <div class="c-grand"><dt>${escapeHtml(t('cart.total'))}</dt><dd>${formatMoney(tot.total)}</dd></div>
        </dl>
        ${coupon && !tot.couponApplied ? `<p class="c-msg warn">${escapeHtml(t('cart.coupon_min', { code: coupon.code, min: formatMoney(coupon.min_subtotal ?? 10), percent: coupon.percent }))}</p>` : ''}
        <div class="c-actions">
          <button class="btn btn-primary" type="submit" ${busy ? 'disabled' : ''}>${escapeHtml(busy ? t('checkout.placing') : t('checkout.place_order'))}</button>
          <a class="btn btn-outline" href="cart.html">${escapeHtml(t('checkout.back_cart'))}</a>
        </div>
      </aside>
    </form>`;
}

function readForm(form) {
  const fd = new FormData(form);
  for (const k of Object.keys(values)) if (fd.has(k)) values[k] = String(fd.get(k));
}

root.addEventListener('input', (e) => {
  const f = e.target.closest('form'); if (!f) return;
  readForm(f);
});
root.addEventListener('change', (e) => { if (e.target.name === 'payment') { values.payment = e.target.value; } });
root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-fix]'); if (!b) return;
  const pid = b.dataset.fix;
  const avail = stockIssues[pid];
  const line = getCart().find((l) => String(l.product_id) === pid);
  if (!line) return;
  delete stockIssues[pid];
  if (avail > 0) setQty(line.product_id, avail); else removeItem(line.product_id);
  banner = null;
  render();
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  readForm(e.target);
  errors = validate(values);
  banner = null;
  if (Object.keys(errors).length) {
    render();
    banner = null;
    root.querySelector('[aria-invalid=true]')?.focus();
    return;
  }
  busy = true; render();
  const lines = getCart();
  try {
    const order = await placeOrder({
      customer: { name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), address: values.address.trim(), city: values.city.trim(), country: values.country.trim(), notes: values.notes.trim() },
      items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
      coupon_code: coupon?.code || undefined,
      payment_method: values.payment,
    });
    clearCart(); store.set('');
    try { sessionStorage.setItem('jps_fresh_' + order.order_number, '1'); } catch {}
    location.href = `order.html?n=${encodeURIComponent(order.order_number)}&e=${encodeURIComponent(values.email.trim())}`;
    return;
  } catch (err) {
    busy = false;
    if (err.code === 'out_of_stock') {
      banner = { type: 'err', text: t('checkout.err_stock') };
      stockIssues = {};
      await Promise.all(lines.map(async (l) => {
        try { const p = await getProduct(l.product_id); if (p && p.stock < l.qty) stockIssues[l.product_id] = Math.max(0, p.stock); } catch {}
      }));
    } else if (err.code === 'invalid_coupon') {
      coupon = null; store.set('');
      banner = { type: 'err', text: t('checkout.err_coupon') };
    } else if (err.code === 'validation') {
      banner = { type: 'err', text: err.message || t('checkout.err_generic') };
    } else {
      banner = { type: 'err', text: t('checkout.err_generic') };
    }
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

async function init() {
  const saved = store.get();
  if (saved && getCart().length) {
    try { const v = await validateCoupon(saved, 1e9); if (v.valid && v.coupon) coupon = v.coupon; else store.set(''); } catch { store.set(''); }
  }
  try {
    const u = await getUser();
    if (u) { values.name = u.name || ''; values.email = u.email || ''; }
  } catch {}
  const pm = paymentMethods().find((m) => !m.disabled);
  if (pm) values.payment = pm.id;
  render();
}
init();
