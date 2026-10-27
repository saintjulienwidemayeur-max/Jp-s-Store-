import '../i18n.commerce.js';
import '../i18n.payment.js';
import '../config.js';
import { t } from '../i18n.js';
import { escapeHtml } from '../layout.js';
import { formatMoney } from '../pricing.js';
import { getOrder, createCardCheckout, demoMarkPaid, mode } from '../api.js';
import { cardLogosHTML } from '../payment-ui.js';

const root = document.getElementById('main');
const STEPS = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
const qs = new URLSearchParams(location.search);
const FLAGS = { paid: qs.get('paid') === '1', cancelled: qs.get('cancelled') === '1', demo: qs.get('demo') === '1', perr: qs.get('perr') === '1' };
const isCard = (o) => o.payment_method === 'debit_card';
const isPaid = (o) => o.payment_status === 'paid' || ['paid', 'processing', 'shipped', 'delivered'].includes(o.status);
let polling = false; let payError = false;

function pmConfig(id) {
  const list = window.JPS_CONFIG?.PAYMENT_METHODS;
  if (!Array.isArray(list)) return {};
  return list.find((m) => m && (m.id === id || m.key === id || m.code === id)) || {};
}

function instructions(o) {
  const id = o.payment_method;
  if (isCard(o)) return ''; // card orders use payBlock()
  const cfg = pmConfig(id);
  const k = `order.pay.${id}`;
  const body = t(k, { total: formatMoney(o.total), number: o.order_number });
  const text = body === k ? (cfg.instructions || '') : body;
  if (!text) return '';
  const extra = '';
  return `<section class="c-card c-pay-instr" aria-label="${escapeHtml(t('order.how_to_pay'))}">
    <h3>${escapeHtml(t('order.how_to_pay'))} - ${escapeHtml(t(`checkout.pm.${id}`))}</h3>
    <p>${escapeHtml(text)}</p>
    ${extra ? `<p><strong>${escapeHtml(String(extra))}</strong></p>` : ''}
    <p>${escapeHtml(t('order.reference', { number: o.order_number }))}</p></section>`;
}

function payBlock(o) {
  if (!isCard(o) || o.status === 'cancelled') return '';
  const demoTag = o.demo_payment ? ` <span class="c-demo-tag">${escapeHtml(t('order.pay_demo_tag'))}</span>` : '';
  if (isPaid(o)) {
    return `<section class="c-card c-paystate ok" aria-live="polite"><div class="c-alert ok" role="status"><strong>${escapeHtml(t('order.paid_ok'))}</strong>${demoTag}<br>${escapeHtml(t('order.paid_ok_sub'))}</div></section>`;
  }
  if (FLAGS.paid) { // back from Stripe but the webhook has not confirmed yet
    return `<section class="c-card c-paystate" aria-live="polite"><div class="c-alert info" role="status"><strong>${escapeHtml(t('order.paid_checking'))}</strong><br>${escapeHtml(t('order.paid_checking_sub'))}</div></section>`;
  }
  const cancelled = FLAGS.cancelled;
  return `<section class="c-card c-paystate no-print">
    <div class="c-alert ${cancelled || payError ? 'err' : 'info'}" role="status"><strong>${escapeHtml(cancelled ? t('order.pay_cancelled') : t('order.pay_unpaid'))}</strong>${cancelled ? `<br>${escapeHtml(t('order.pay_cancelled_sub'))}` : ''}${payError || FLAGS.perr ? `<br>${escapeHtml(t('order.pay_err'))}` : ''}</div>
    <p>${escapeHtml(t('order.pay.debit_card', { total: formatMoney(o.total) }))}</p>
    <p>${cardLogosHTML({ secure: true })}</p>
    <button type="button" class="btn btn-primary" id="pay-again">${escapeHtml(cancelled ? t('order.try_again') : t('order.pay_now'))}</button></section>`;
}

function demoHTML(o) {
  return `<h1>${escapeHtml(t('demo.title'))}</h1>
    <section class="c-card c-demo" aria-labelledby="demo-h">
      <p><span class="c-demo-tag" id="demo-h">${escapeHtml(t('demo.badge'))}</span></p>
      <p class="c-alert info" role="note">${escapeHtml(t('demo.text'))}</p>
      <p>${escapeHtml(t('order.number'))}: <span class="c-ordnum">${escapeHtml(o.order_number)}</span></p>
      <p class="c-demo-total">${escapeHtml(t('demo.total'))}: <strong>${formatMoney(o.total)}</strong></p>
      <div class="c-actions" style="max-width:420px">
        <button type="button" class="btn btn-primary" id="demo-pay">${escapeHtml(t('demo.simulate'))}</button>
        <button type="button" class="btn btn-outline" id="demo-cancel">${escapeHtml(t('demo.cancel'))}</button>
      </div>
    </section>`;
}

function timeline(status) {
  if (status === 'cancelled') return `<div class="c-alert err" role="status">${escapeHtml(t('order.cancelled_note'))}</div>`;
  const idx = Math.max(0, STEPS.indexOf(status));
  return `<ol class="c-timeline" aria-label="${escapeHtml(t('order.progress'))}">${STEPS.map((s, i) =>
    `<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}" ${i === idx ? 'aria-current="step"' : ''}>${escapeHtml(t(`order.status.${s}`))}</li>`).join('')}</ol>`;
}

function trackForm(err, n = '', e = '') {
  return `<section class="c-card c-narrow no-print"><h2>${escapeHtml(t('order.track_title'))}</h2>
    <p class="c-sub">${escapeHtml(t('order.track_hint'))}</p>
    ${err ? `<div class="c-alert err" role="alert">${escapeHtml(err)}</div>` : ''}
    <form id="track-form" class="c-form" novalidate>
      <div class="c-field"><label for="t-n">${escapeHtml(t('order.number'))}</label><input id="t-n" name="n" type="text" value="${escapeHtml(n)}" placeholder="JPS-260101-ABCD" required autocomplete="off"></div>
      <div class="c-field"><label for="t-e">${escapeHtml(t('order.email'))}</label><input id="t-e" name="e" type="email" value="${escapeHtml(e)}" required autocomplete="email"></div>
      <button class="btn btn-primary" type="submit">${escapeHtml(t('order.track_btn'))}</button>
    </form></section>`;
}

function orderHTML(o, fresh) {
  const c = o.customer || {};
  const date = o.created_at ? new Date(o.created_at).toLocaleString(document.documentElement.lang || undefined) : '';
  return `<div class="c-order-head">
      <div><h1>${escapeHtml(fresh ? t('order.thanks') : t('order.details'))}</h1>
      <p class="c-sub">${escapeHtml(fresh ? t('order.thanks_sub') : '')}</p></div>
      <button type="button" class="btn btn-outline no-print" id="print-btn">${escapeHtml(t('order.print'))}</button></div>
    <div class="c-layout">
      <div>
        <section class="c-card">
          <div class="c-order-head"><span>${escapeHtml(t('order.number'))}: <span class="c-ordnum">${escapeHtml(o.order_number)}</span></span>
          <span class="c-status ${escapeHtml(o.status)}">${escapeHtml(t(`order.status.${o.status}`))}</span></div>
          <p class="c-msg">${escapeHtml(date)}</p>
          ${timeline(o.status)}
        </section>
        ${payBlock(o)}
        ${instructions(o)}
        <section class="c-card"><h2>${escapeHtml(t('order.ship_to'))}</h2>
          <p>${escapeHtml(c.name || '')}<br>${escapeHtml(c.address || '')}<br>${escapeHtml([c.city, c.country].filter(Boolean).join(', '))}<br>${escapeHtml(c.phone || '')}<br>${escapeHtml(c.email || '')}</p>
          ${c.notes ? `<p class="c-msg">${escapeHtml(t('checkout.notes'))}: ${escapeHtml(c.notes)}</p>` : ''}
        </section>
      </div>
      <aside class="c-card"><h2>${escapeHtml(t('checkout.summary'))}</h2>
        ${(o.items || []).map((i) => `<div class="c-sum-line"><span>${escapeHtml(i.name || i.product_name || i.product_id)} &times; ${i.qty}</span><span>${formatMoney((i.unit_price ?? i.price ?? 0) * i.qty)}</span></div>`).join('')}
        <dl class="c-totals" style="margin-top:12px">
          <div><dt>${escapeHtml(t('cart.subtotal'))}</dt><dd>${formatMoney(o.subtotal)}</dd></div>
          ${o.discount > 0 ? `<div class="c-discount"><dt>${escapeHtml(t('cart.discount'))}${o.coupon_code ? ` (${escapeHtml(o.coupon_code)})` : ''}</dt><dd>&minus;${formatMoney(o.discount)}</dd></div>` : ''}
          <div><dt>${escapeHtml(t('cart.shipping'))}</dt><dd><span class="c-badge-ship">${escapeHtml(t('cart.shipping_included'))}</span></dd></div>
          <div class="c-grand"><dt>${escapeHtml(t('cart.total'))}</dt><dd>${formatMoney(o.total)}</dd></div>
        </dl>
        <p class="c-msg">${escapeHtml(t('order.payment'))}: ${escapeHtml(t(`checkout.pm.${o.payment_method}`))}${isCard(o) ? ` ${cardLogosHTML()}` : ''}</p>
      </aside>
    </div>
    <div class="c-actions no-print" style="max-width:320px"><a class="btn btn-primary" href="shop.html">${escapeHtml(t('cart.continue'))}</a></div>`;
}

async function load(n, e, fresh) {
  document.title = `${t('order.title')} | JP's Logistics & More`;
  root.innerHTML = `<div class="c-loading" role="status">${escapeHtml(t('common.loading') === 'common.loading' ? '...' : t('common.loading'))}</div>`;
  let o = null; let err = null;
  try { o = await getOrder(n, e); } catch (x) { err = t('order.err_generic'); }
  if (o) {
    if (FLAGS.demo && isCard(o) && !isPaid(o) && mode === 'local') { root.innerHTML = demoHTML(o); root.querySelector('#demo-pay')?.focus(); return; }
    root.innerHTML = orderHTML(o, fresh);
    if (FLAGS.paid && isCard(o) && !isPaid(o)) poll(n, e, fresh);
    return;
  }
  root.innerHTML = `<h1>${escapeHtml(t('order.title'))}</h1>${trackForm(err || t('order.err_notfound'), n, e)}`;
}

// After returning from Stripe the webhook may land a moment later: poll the order until it is paid (max ~60s).
async function poll(n, e, fresh) {
  if (polling) return; polling = true;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let o = null;
    try { o = await getOrder(n, e); } catch { /* keep trying */ }
    if (o && isPaid(o)) { polling = false; root.innerHTML = orderHTML(o, fresh); return; }
  }
  polling = false; FLAGS.paid = false; // give up quietly: show the unpaid state with a retry button
  try { const o = await getOrder(n, e); if (o) root.innerHTML = orderHTML(o, fresh); } catch { /* ignore */ }
}

async function startPayment(btn) {
  const n = qs.get('n'); const e = qs.get('e');
  btn.disabled = true; payError = false;
  try {
    const r = await createCardCheckout({ order_number: n, email: e });
    location.href = r.url;
  } catch { payError = true; btn.disabled = false; FLAGS.perr = true; load(n, e, false); }
}

root.addEventListener('click', async (ev) => {
  if (ev.target.closest('#print-btn')) window.print();
  const again = ev.target.closest('#pay-again'); if (again) startPayment(again);
  const dp = ev.target.closest('#demo-pay');
  if (dp) {
    dp.disabled = true;
    try { await demoMarkPaid(qs.get('n'), qs.get('e')); } catch { dp.disabled = false; return; }
    location.href = `order.html?n=${encodeURIComponent(qs.get('n'))}&e=${encodeURIComponent(qs.get('e'))}&paid=1`;
  }
  if (ev.target.closest('#demo-cancel')) location.href = `order.html?n=${encodeURIComponent(qs.get('n'))}&e=${encodeURIComponent(qs.get('e'))}&cancelled=1`;
});
root.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'track-form') return;
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const n = String(fd.get('n') || '').trim().toUpperCase();
  const e = String(fd.get('e') || '').trim();
  if (!n || !e) { root.innerHTML = `<h1>${escapeHtml(t('order.title'))}</h1>${trackForm(t('order.err_missing'), n, e)}`; return; }
  history.replaceState(null, '', `order.html?n=${encodeURIComponent(n)}&e=${encodeURIComponent(e)}`);
  load(n, e, false);
});

const n = qs.get('n'); const e = qs.get('e');
if (n && e) {
  let fresh = false;
  try { fresh = sessionStorage.getItem('jps_fresh_' + n) === '1'; sessionStorage.removeItem('jps_fresh_' + n); } catch {}
  load(n, e, fresh);
}
else {
  document.title = `${t('order.title')} | JP's Logistics & More`;
  root.innerHTML = `<h1>${escapeHtml(t('order.title'))}</h1>${trackForm(null, n || '', e || '')}`;
}
