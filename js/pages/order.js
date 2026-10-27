import '../i18n.commerce.js';
import '../config.js';
import { t } from '../i18n.js';
import { escapeHtml } from '../layout.js';
import { formatMoney } from '../pricing.js';
import { getOrder } from '../api.js';

const root = document.getElementById('main');
const STEPS = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
const qs = new URLSearchParams(location.search);

function pmConfig(id) {
  const list = window.JPS_CONFIG?.PAYMENT_METHODS;
  if (!Array.isArray(list)) return {};
  return list.find((m) => m && (m.id === id || m.key === id || m.code === id)) || {};
}

function instructions(o) {
  const id = o.payment_method;
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
        <p class="c-msg">${escapeHtml(t('order.payment'))}: ${escapeHtml(t(`checkout.pm.${o.payment_method}`))}</p>
      </aside>
    </div>
    <div class="c-actions no-print" style="max-width:320px"><a class="btn btn-primary" href="shop.html">${escapeHtml(t('cart.continue'))}</a></div>`;
}

async function load(n, e, fresh) {
  document.title = `${t('order.title')} | JP's Logistics & More`;
  root.innerHTML = `<div class="c-loading" role="status">${escapeHtml(t('common.loading') === 'common.loading' ? '...' : t('common.loading'))}</div>`;
  let o = null; let err = null;
  try { o = await getOrder(n, e); } catch (x) { err = t('order.err_generic'); }
  if (o) { root.innerHTML = orderHTML(o, fresh); return; }
  root.innerHTML = `<h1>${escapeHtml(t('order.title'))}</h1>${trackForm(err || t('order.err_notfound'), n, e)}`;
}

root.addEventListener('click', (ev) => { if (ev.target.closest('#print-btn')) window.print(); });
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
