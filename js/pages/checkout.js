import '../i18n.commerce.js';
import '../i18n.payment.js';
import '../config.js';
import { t } from '../i18n.js';
import { escapeHtml, toast } from '../layout.js';
import { getCart, clearCart, setQty, removeItem } from '../cart.js';
import { computeTotals, formatMoney } from '../pricing.js';
import { validateCoupon, placeOrder, getUser, getProduct, createCardCheckout } from '../api.js';
import { cardLogosHTML, securePaymentHTML } from '../payment-ui.js';

const root = document.getElementById('main');
const KEY = 'jps_coupon_code';
const store = {
  get() { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} },
};

const DEFAULT_PM = [{ id: 'debit_card', default: true }, { id: 'moncash' }, { id: 'zelle' }, { id: 'cash_on_delivery' }];
function paymentMethods() {
  const raw = window.JPS_CONFIG?.PAYMENT_METHODS;
  const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_PM;
  return list.map((m) => {
    if (typeof m === 'string') return { id: m };
    const id = m.id || m.key || m.code || m.value;
    return { id, label: m.label || m.name, isDefault: !!m.default, disabled: !!(m.disabled || m.coming_soon || m.enabled === false) };
  }).filter((m) => m.id && m.id !== 'card_soon');
}
function defaultMethod() {
  const pms = paymentMethods().filter((m) => !m.disabled);
  return (pms.find((m) => m.isDefault) || pms.find((m) => m.id === 'debit_card') || pms[0] || {}).id;
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

const STEPS = ['contact', 'address', 'payment', 'review'];
const FORM_KEY = 'jps_checkout_v1'; // sessionStorage; contact/delivery/payment-method choice only. NEVER card data.
const STEP_FIELDS = { contact: ['name', 'email', 'phone'], address: ['address', 'city', 'country', 'notes'] };
const FIELD_META = {
  name: ['text', 'name'], email: ['email', 'email'], phone: ['tel', 'tel'],
  address: ['text', 'street-address'], city: ['text', 'address-level2'], country: ['text', 'country-name'],
};

let coupon = null;
let values = { name: '', email: '', phone: '', address: '', city: '', country: 'Haiti', notes: '', payment: 'debit_card' };
let errors = {};
let banner = null; // {type,text}
let stockIssues = {}; // pid -> available
let busy = false;
let step = 'contact';
let first = true;

function loadSaved() {
  try {
    const o = JSON.parse(sessionStorage.getItem(FORM_KEY) || 'null');
    if (o && typeof o === 'object') for (const k of Object.keys(values)) if (typeof o[k] === 'string') values[k] = o[k];
  } catch { /* ignore */ }
}
function save() {
  try { sessionStorage.setItem(FORM_KEY, JSON.stringify(values)); } catch { /* ignore */ }
}
function clearSaved() { try { sessionStorage.removeItem(FORM_KEY); } catch { /* ignore */ } }

function validateStep(id, v = values) {
  const e = {};
  if (id === 'contact') {
    if (v.name.trim().length < 2) e.name = t('checkout.err_name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = t('checkout.err_email');
    if (v.phone.replace(/\D/g, '').length < 7) e.phone = t('checkout.err_phone');
  } else if (id === 'address') {
    if (v.address.trim().length < 4) e.address = t('checkout.err_address');
    if (!v.city.trim()) e.city = t('checkout.err_city');
    if (!v.country.trim()) e.country = t('checkout.err_country');
  } else if (id === 'payment') {
    const pm = paymentMethods().find((m) => m.id === v.payment);
    if (!pm || pm.disabled) e.payment = t('checkout.err_payment');
  }
  return e;
}
const firstIncomplete = (upTo = STEPS.length) => STEPS.slice(0, upTo).find((id) => Object.keys(validateStep(id)).length) || null;

function fieldHTML(name) {
  const [type, ac] = FIELD_META[name];
  const err = errors[name];
  return `<div class="c-field">
    <label for="f-${name}">${escapeHtml(t(`checkout.${name}`))}</label>
    <input id="f-${name}" name="${name}" type="${type}" autocomplete="${ac}" value="${escapeHtml(values[name])}"
      ${name === 'country' ? 'list="country-list"' : ''} required aria-invalid="${err ? 'true' : 'false'}" ${err ? `aria-describedby="e-${name}"` : ''}>
    ${err ? `<p class="c-err" id="e-${name}" role="alert">${escapeHtml(err)}</p>` : ''}
  </div>`;
}

function summaryHTML(lines, tot) {
  const sumLines = lines.map((l) => `<div class="c-sum-line"><span>${escapeHtml(l.name)} &times; ${l.qty}</span><span>${formatMoney(l.price * l.qty)}</span></div>`).join('');
  return `${sumLines}
    <dl class="c-totals" style="margin-top:12px">
      <div><dt>${escapeHtml(t('cart.subtotal'))}</dt><dd>${formatMoney(tot.subtotal)}</dd></div>
      ${tot.discount > 0 ? `<div class="c-discount"><dt>${escapeHtml(t('cart.discount'))} (${escapeHtml(coupon.code)})</dt><dd>&minus;${formatMoney(tot.discount)}</dd></div>` : ''}
      <div><dt>${escapeHtml(t('cart.shipping'))}</dt><dd><span class="c-badge-ship">${escapeHtml(t('cart.shipping_included'))}</span></dd></div>
      <div class="c-grand"><dt>${escapeHtml(t('cart.total'))}</dt><dd>${formatMoney(tot.total)}</dd></div>
    </dl>
    ${coupon && !tot.couponApplied ? `<p class="c-msg warn">${escapeHtml(t('cart.coupon_min', { code: coupon.code, min: formatMoney(coupon.min_subtotal ?? 10), percent: coupon.percent }))}</p>` : ''}`;
}

function stepperHTML() {
  const cur = STEPS.indexOf(step);
  return `<nav aria-label="${escapeHtml(t('checkout.steps_label'))}"><ol class="c-steps">${STEPS.map((id, i) => {
    const label = escapeHtml(t(`checkout.step.${id}`));
    const inner = `<span class="c-step-n" aria-hidden="true">${i < cur ? '&#10003;' : i + 1}</span><span class="c-step-l">${label}</span>`;
    const state = i < cur ? 'done' : i === cur ? 'current' : '';
    return `<li class="${state}" ${i === cur ? 'aria-current="step"' : ''}>${i < cur ? `<a href="#${id}">${inner}</a>` : inner}</li>`;
  }).join('')}</ol></nav>`;
}

function paymentStepHTML() {
  const pms = paymentMethods();
  const cardSelected = values.payment === 'debit_card';
  const pmHTML = pms.map((m) => {
    const card = m.id === 'debit_card';
    return `<label class="${m.disabled ? 'disabled' : ''}${card ? ' c-pay-card' : ''}">
      <input type="radio" name="payment" value="${escapeHtml(m.id)}" ${m.disabled ? 'disabled' : ''} ${values.payment === m.id ? 'checked' : ''}>
      <span class="c-pay-body"><span class="c-pay-name">${escapeHtml(pmLabel(m))}${card ? ` <em class="c-reco">${escapeHtml(t('checkout.recommended'))}</em>` : ''}${m.disabled ? ` <em>(${escapeHtml(t('checkout.coming_soon'))})</em>` : ''}</span>${pmHint(m) ? `<small>${escapeHtml(pmHint(m))}</small>` : ''}${card ? cardLogosHTML({ secure: true }) : ''}</span></label>`;
  }).join('');
  return `<fieldset class="c-pay"><legend class="sr-only">${escapeHtml(t('checkout.payment'))}</legend>${pmHTML}
      ${errors.payment ? `<p class="c-err" role="alert">${escapeHtml(errors.payment)}</p>` : ''}</fieldset>
    ${cardSelected ? `<p class="c-msg c-debit-note">${escapeHtml(t('checkout.debit_note'))}</p>` : ''}
    <p class="c-msg">${escapeHtml(t('checkout.no_card'))}</p>`;
}

function reviewCard(id, bodyHTML) {
  return `<div class="c-rev"><div class="c-rev-h"><h3>${escapeHtml(t(`checkout.step.${id}`))}</h3>
    <a class="c-link-btn" href="#${id}" data-edit="${id}">${escapeHtml(t('checkout.edit'))}<span class="sr-only"> ${escapeHtml(t(`checkout.step.${id}`))}</span></a></div>${bodyHTML}</div>`;
}
function reviewStepHTML(lines) {
  const pm = paymentMethods().find((m) => m.id === values.payment);
  const e = escapeHtml;
  return `<p class="c-sub">${e(t('checkout.review_hint'))}</p>
    ${reviewCard('contact', `<p>${e(values.name)}<br>${e(values.email)}<br>${e(values.phone)}</p>`)}
    ${reviewCard('address', `<p>${e(values.address)}<br>${e([values.city, values.country].filter(Boolean).join(', '))}</p>${values.notes.trim() ? `<p class="c-msg">${e(t('checkout.notes'))}: ${e(values.notes)}</p>` : ''}`)}
    ${reviewCard('payment', `<p>${e(pm ? pmLabel(pm) : values.payment)}${values.payment === 'debit_card' ? ` ${cardLogosHTML()}` : ''}</p>`)}
    <div class="c-rev"><div class="c-rev-h"><h3>${e(t('checkout.items'))}</h3><a class="c-link-btn" href="cart.html">${e(t('checkout.edit'))}</a></div>
      ${lines.map((l) => {
        const avail = stockIssues[l.product_id];
        return `<div class="c-sum-line"><span>${e(l.name)} &times; ${l.qty}${avail !== undefined ? `<br><span class="c-stock-warn">${e(t('checkout.only_left', { n: avail }))}</span> <button type="button" class="c-link-btn" data-fix="${e(String(l.product_id))}">${e(avail > 0 ? t('checkout.adjust') : t('cart.remove'))}</button>` : ''}</span><span>${formatMoney(l.price * l.qty)}</span></div>`;
      }).join('')}
      ${coupon ? `<p class="c-msg">${e(t('checkout.coupon_label'))}: ${e(coupon.code)}</p>` : ''}</div>`;
}

function render() {
  document.title = `${t('checkout.title')} | JP's Logistics & More`;
  const lines = getCart();
  const tot = computeTotals(lines.map((l) => ({ unit_price: l.price, qty: l.qty })), coupon);
  const idx = STEPS.indexOf(step);
  const cardSelected = values.payment === 'debit_card';
  let body = '';
  if (step === 'contact') body = `<div class="c-grid2">${fieldHTML('name')}${fieldHTML('email')}</div>${fieldHTML('phone')}`;
  else if (step === 'address') body = `<p class="c-ship-banner">${escapeHtml(t('checkout.ship_banner'))}</p>${fieldHTML('address')}<div class="c-grid2">${fieldHTML('city')}${fieldHTML('country')}</div>
      <datalist id="country-list"><option>Haiti</option><option>United States</option><option>Canada</option><option>France</option><option>Dominican Republic</option></datalist>
      <div class="c-field"><label for="f-notes">${escapeHtml(t('checkout.notes'))}</label><textarea id="f-notes" name="notes" rows="3">${escapeHtml(values.notes)}</textarea></div>`;
  else if (step === 'payment') body = paymentStepHTML();
  else body = reviewStepHTML(lines);
  const last = step === 'review';
  const nextLabel = last ? (busy ? (cardSelected ? t('checkout.redirecting') : t('checkout.placing')) : (cardSelected ? t('checkout.pay_card') : t('checkout.place_order'))) : t('checkout.next');
  const mobileSum = `<details class="c-sum-mobile c-card"><summary>${escapeHtml(t('checkout.show_summary'))} <strong>${formatMoney(tot.total)}</strong></summary>${summaryHTML(lines, tot)}</details>`;
  root.innerHTML = `<h1>${escapeHtml(t('checkout.title'))}</h1>
    <p class="c-sub">${escapeHtml(t('checkout.subtitle'))}</p>
    ${stepperHTML()}
    ${mobileSum}
    ${banner ? `<div class="c-alert ${banner.type}" role="alert">${escapeHtml(banner.text)}</div>` : ''}
    <div class="c-layout">
      <form id="checkout-form" class="c-card c-form c-step-card" data-step="${step}" novalidate>
        <h2 id="step-h" tabindex="-1">${escapeHtml(t(`checkout.h.${step}`))}</h2>
        ${body}
        <div class="c-actions c-step-actions">
          ${idx > 0 ? `<button class="btn btn-outline" type="button" data-back>${escapeHtml(t('checkout.back'))}</button>` : `<a class="btn btn-outline" href="cart.html">${escapeHtml(t('checkout.back_cart'))}</a>`}
          <button class="btn btn-primary" type="submit" ${busy ? 'disabled' : ''}>${escapeHtml(nextLabel)}</button>
        </div>
      </form>
      <aside class="c-card c-sticky c-sum-side" aria-label="${escapeHtml(t('checkout.summary'))}">
        <h2>${escapeHtml(t('checkout.summary'))}</h2>
        ${summaryHTML(lines, tot)}
        ${securePaymentHTML({ compact: true })}
      </aside>
    </div>`;
}

function announce() {
  const live = document.getElementById('step-live');
  if (live) live.textContent = t('checkout.step_of', { n: STEPS.indexOf(step) + 1, total: STEPS.length, name: t(`checkout.step.${step}`) });
}

function goto(id, { replace = false } = {}) {
  const url = `${location.pathname}${location.search}#${id}`;
  if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
  route();
}

// Resolve the hash to a step; a hash pointing past an incomplete step is redirected to that step.
function route() {
  if (!getCart().length) { location.replace('cart.html'); return; }
  let id = location.hash.replace('#', '');
  if (!STEPS.includes(id)) id = 'contact';
  const bad = firstIncomplete(STEPS.indexOf(id));
  if (bad) id = bad;
  if (location.hash !== `#${id}`) history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  step = id;
  if (!errors._keep) errors = {}; delete errors._keep;
  render();
  announce();
  if (!first) {
    const bad1 = root.querySelector('[aria-invalid=true]');
    (bad1 || root.querySelector('#step-h'))?.focus();
  }
  first = false;
}

function readForm(form) {
  const fd = new FormData(form);
  for (const k of Object.keys(values)) if (fd.has(k)) values[k] = String(fd.get(k));
  save();
}

root.addEventListener('input', (e) => { const f = e.target.closest('form'); if (f) readForm(f); });
root.addEventListener('change', (e) => {
  if (e.target.name === 'payment') {
    readForm(e.target.form); values.payment = e.target.value; save(); errors = {}; render();
    root.querySelector('input[name=payment]:checked')?.focus();
  }
});
root.addEventListener('click', (e) => {
  if (e.target.closest('[data-back]')) { const i = STEPS.indexOf(step); if (i > 0) goto(STEPS[i - 1]); return; }
  const b = e.target.closest('[data-fix]'); if (!b) return;
  const pid = b.dataset.fix;
  const avail = stockIssues[pid];
  const line = getCart().find((l) => String(l.product_id) === pid);
  if (!line) return;
  delete stockIssues[pid];
  if (avail > 0) setQty(line.product_id, avail); else removeItem(line.product_id);
  banner = null;
  if (!getCart().length) { location.replace('cart.html'); return; }
  render();
});
window.addEventListener('hashchange', () => { banner = null; route(); });

async function placeNow() {
  const lines = getCart();
  busy = true; render();
  try {
    const order = await placeOrder({
      customer: { name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), address: values.address.trim(), city: values.city.trim(), country: values.country.trim(), notes: values.notes.trim() },
      items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
      coupon_code: coupon?.code || undefined,
      payment_method: values.payment,
    });
    clearCart(); store.set(''); clearSaved();
    try { sessionStorage.setItem('jps_fresh_' + order.order_number, '1'); } catch {}
    const q = `n=${encodeURIComponent(order.order_number)}&e=${encodeURIComponent(values.email.trim())}`;
    if (order.payment_method === 'debit_card') {
      // Hosted payment: Stripe (or the DEMO screen in local mode). No card data is ever handled on this site.
      try {
        const r = await createCardCheckout({ order_number: order.order_number, email: values.email.trim() });
        location.href = r.url;
      } catch { location.href = `order.html?${q}&cancelled=1&perr=1`; } // order is saved; the order page offers "Try again"
      return;
    }
    location.href = `order.html?${q}`;
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
}

root.addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy) return;
  readForm(e.target);
  banner = null;
  const i = STEPS.indexOf(step);
  if (step !== 'review') {
    errors = validateStep(step);
    if (Object.keys(errors).length) {
      render();
      (root.querySelector('[aria-invalid=true]') || root.querySelector('.c-pay input'))?.focus();
      return;
    }
    errors = {};
    goto(STEPS[i + 1]);
    return;
  }
  const bad = firstIncomplete();
  if (bad) { errors = { ...validateStep(bad), _keep: true }; goto(bad); return; }
  placeNow();
});

async function init() {
  if (!getCart().length) { location.replace('cart.html'); return; }
  loadSaved();
  const saved = store.get();
  if (saved) {
    try { const v = await validateCoupon(saved, 1e9); if (v.valid && v.coupon) coupon = v.coupon; else store.set(''); } catch { store.set(''); }
  }
  try {
    const u = await getUser();
    if (u) { if (!values.name.trim()) values.name = u.name || ''; if (!values.email.trim()) values.email = u.email || ''; }
  } catch {}
  const pm = paymentMethods().find((m) => m.id === values.payment && !m.disabled);
  if (!pm) values.payment = defaultMethod() || values.payment;
  route();
}
init();
