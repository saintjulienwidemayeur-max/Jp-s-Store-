// Shared payment UI: card-brand logo row + secure-payment blurb. No card data is ever handled here.
import './config.js';
import { t, addMessages } from './i18n.js';
import './i18n.payment.js';

// Make sure the logo styles exist on every page that shows them (footer included).
try {
  if (typeof document !== 'undefined' && !document.querySelector('link[data-pay-css]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/payments.css'; l.dataset.payCss = '';
    document.head.append(l);
  }
} catch { /* styles are optional */ }

export const CARD_BRANDS = [
  { id: 'visa', name: 'Visa' },
  { id: 'mastercard', name: 'Mastercard' },
  { id: 'amex', name: 'American Express' },
  { id: 'discover', name: 'Discover' },
];
const LOGO_DIR = 'assets/payments/';

// Row of 40x26 brand marks (plain <img> so they are cacheable and carry alt text).
export function cardLogosHTML({ secure = false, brands = ['visa', 'mastercard', 'amex', 'discover'], className = '' } = {}) {
  const imgs = CARD_BRANDS.filter((b) => brands.includes(b.id))
    .map((b) => `<img class="pay-logo" src="${LOGO_DIR}${b.id}.svg" alt="${b.name}" width="40" height="26" loading="lazy">`);
  if (secure) imgs.push(`<img class="pay-logo pay-logo-secure" src="${LOGO_DIR}secure.svg" alt="${t('payment.secure_alt')}" width="40" height="26" loading="lazy">`);
  return `<span class="pay-logos ${className}" role="group" aria-label="${t('payment.logos_label')}">${imgs.join('')}</span>`;
}

// "Secure payment" blurb with logos (cart / checkout / footer).
export function securePaymentHTML({ compact = false } = {}) {
  return `<div class="pay-secure${compact ? ' compact' : ''}">
    <p class="pay-secure-text"><strong>${t('payment.secure_title')}</strong> ${t('payment.secure_text')}</p>
    ${cardLogosHTML({ secure: true })}</div>`;
}

// Footer + value-prop hook (js/layout.js is owned by another agent). Add ONE line to layout.js, right after the
// footer is mounted (e.g. after `f.innerHTML = footerHTML();`):
//   import('./payment-ui.js').then((m) => m.mountPaymentChrome());
// It (1) inserts the secure-payment logo block above `.foot-bar` and (2) appends the card logos to the 3rd
// value-prop ("Secure Payment") on pages that have one, even if it renders later. Idempotent. Importing the module
// also registers js/i18n.payment.js, which updates home.vp.3.d / info.faq.a3 ("card coming soon" copy).
export function mountFooterPayments(doc = document) {
  const footer = doc.querySelector('.site-footer');
  if (!footer || footer.querySelector('.pay-footer')) return;
  const bar = footer.querySelector('.foot-bar');
  const wrap = doc.createElement('div');
  wrap.className = 'container pay-footer';
  wrap.innerHTML = securePaymentHTML({ compact: true });
  if (bar) bar.before(wrap); else footer.append(wrap);
}
export function mountValuePropLogos(doc = document) {
  const vp = doc.querySelectorAll('.vp-grid .vp')[2];
  if (!vp) return false;
  if (!vp.querySelector('.pay-logos')) vp.insertAdjacentHTML('beforeend', cardLogosHTML());
  return true;
}
export function mountPaymentChrome(doc = document) {
  mountFooterPayments(doc);
  if (mountValuePropLogos(doc) || typeof MutationObserver === 'undefined') return;
  const mo = new MutationObserver(() => { if (mountValuePropLogos(doc)) mo.disconnect(); });
  mo.observe(doc.body, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 8000);
}

export { addMessages };
