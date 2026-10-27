import '../i18n.commerce.js';
import { t } from '../i18n.js';
import { escapeHtml, toast } from '../layout.js';
import { formatMoney } from '../pricing.js';
import { signIn, signUp, signOut, getUser, onAuthChange, listMyOrders } from '../api.js';

const root = document.getElementById('main');
let tab = 'signin';
let error = null;
let busy = false;

function authHTML() {
  const up = tab === 'signup';
  return `<div class="c-narrow"><h1>${escapeHtml(t('account.title'))}</h1>
    <p class="c-sub">${escapeHtml(t('account.subtitle'))}</p>
    <div class="c-tabs" role="tablist">
      <button type="button" role="tab" id="tab-signin" aria-selected="${!up}" data-tab="signin">${escapeHtml(t('account.signin'))}</button>
      <button type="button" role="tab" id="tab-signup" aria-selected="${up}" data-tab="signup">${escapeHtml(t('account.signup'))}</button>
    </div>
    <section class="c-card" role="tabpanel" aria-labelledby="tab-${tab}">
      ${error ? `<div class="c-alert err" role="alert">${escapeHtml(error)}</div>` : ''}
      <form id="auth-form" class="c-form" novalidate>
        ${up ? `<div class="c-field"><label for="a-name">${escapeHtml(t('account.name'))}</label><input id="a-name" name="name" type="text" autocomplete="name" required></div>` : ''}
        <div class="c-field"><label for="a-email">${escapeHtml(t('account.email'))}</label><input id="a-email" name="email" type="email" autocomplete="email" required></div>
        <div class="c-field"><label for="a-pass">${escapeHtml(t('account.password'))}</label><input id="a-pass" name="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" required></div>
        <button class="btn btn-primary" type="submit" ${busy ? 'disabled' : ''}>${escapeHtml(up ? t('account.signup_btn') : t('account.signin_btn'))}</button>
      </form>
    </section>
    <p class="c-msg" style="text-align:center"><a href="order.html">${escapeHtml(t('account.track_guest'))}</a></p></div>`;
}

async function profileHTML(u) {
  let orders = []; let failed = false;
  try { orders = await listMyOrders(); } catch { failed = true; }
  return `<h1>${escapeHtml(t('account.hello', { name: u.name || u.email }))}</h1>
    <div class="c-layout">
      <section class="c-card"><h2>${escapeHtml(t('account.orders'))}</h2>
        ${failed ? `<div class="c-alert err">${escapeHtml(t('order.err_generic'))}</div>` :
          orders.length ? `<ul class="c-hist">${orders.map((o) => `<li>
            <a href="order.html?n=${encodeURIComponent(o.order_number)}&e=${encodeURIComponent(u.email)}">${escapeHtml(o.order_number)}</a>
            <span class="c-msg" style="margin:0">${escapeHtml(o.created_at ? new Date(o.created_at).toLocaleDateString(document.documentElement.lang || undefined) : '')}</span>
            <span class="c-status ${escapeHtml(o.status)}">${escapeHtml(t(`order.status.${o.status}`))}</span>
            <strong>${formatMoney(o.total)}</strong></li>`).join('')}</ul>`
          : `<div class="c-empty"><p>${escapeHtml(t('account.no_orders'))}</p><a class="btn btn-primary" href="shop.html">${escapeHtml(t('cart.continue'))}</a></div>`}
      </section>
      <aside class="c-card"><h2>${escapeHtml(t('account.profile'))}</h2>
        <p><strong>${escapeHtml(u.name || '')}</strong><br>${escapeHtml(u.email)}</p>
        <div class="c-actions">
          ${u.is_admin ? `<a class="btn btn-primary" href="admin.html">${escapeHtml(t('account.admin_link'))}</a>` : ''}
          <a class="btn btn-outline" href="wishlist.html">${escapeHtml(t('account.wishlist'))}</a>
          <button class="btn btn-outline" type="button" id="signout">${escapeHtml(t('account.signout'))}</button>
        </div>
      </aside>
    </div>`;
}

async function render() {
  document.title = `${t('account.title')} | JP's Logistics & More`;
  let u = null;
  try { u = await getUser(); } catch {}
  root.innerHTML = u ? await profileHTML(u) : authHTML();
}

root.addEventListener('click', async (e) => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; error = null; render(); return; }
  if (e.target.closest('#signout')) {
    try { await signOut(); toast(t('account.signed_out'), 'info'); } catch {}
    render();
  }
});

root.addEventListener('submit', async (e) => {
  if (e.target.id !== 'auth-form') return;
  e.preventDefault();
  if (busy) return;
  const fd = new FormData(e.target);
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');
  const name = String(fd.get('name') || '').trim();
  error = null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) error = t('checkout.err_email');
  else if (password.length < 6) error = t('account.err_password');
  else if (tab === 'signup' && name.length < 2) error = t('checkout.err_name');
  if (error) { render(); return; }
  busy = true;
  try {
    if (tab === 'signup') await signUp({ email, password, name }); else await signIn({ email, password });
    toast(t('account.welcome'), 'success');
    busy = false; error = null;
  } catch (err) {
    busy = false;
    error = t(err.code === 'auth' ? 'account.err_auth' : 'account.err_generic');
  }
  render();
});

render();
try { onAuthChange(() => render()); } catch {}
