import { t } from '../i18n.js';
import { api, setMeta, icon, escapeHtml, IG_URL, toast, pageReady } from '../layout.js';

const PAGES = ['about', 'contact', 'faq', 'shipping', 'returns'];
let p = new URLSearchParams(location.search).get('p') || 'about';
if (!PAGES.includes(p)) p = 'about';
const main = document.getElementById('main');
const title = t(`info.${p}.title`);
setMeta({ title, description: p === 'about' ? t('info.about.p1').slice(0, 160) : title });

const nav = `<nav class="info-nav" aria-label="${escapeHtml(t('nav.pages'))}">${PAGES.map(x => `<a class="chip" href="info.html?p=${x}" ${x === p ? 'aria-current="page"' : ''}>${escapeHtml(t('nav.' + x))}</a>`).join('')}</nav>`;
const paras = k => [1, 2, 3].map(i => `<p>${escapeHtml(t(`info.${k}.p${i}`))}</p>`).join('');
let body = '';
if (p === 'about') body = `<div class="prose">${paras('about')}<p><a class="btn btn-primary" href="shop.html" style="margin-top:8px">${escapeHtml(t('common.shop_now'))}</a></p></div>`;
else if (p === 'shipping') body = `<div class="prose">${paras('shipping')}</div>`;
else if (p === 'returns') body = `<div class="prose">${paras('returns')}</div>`;
else if (p === 'faq') body = `<div class="prose faq">${[1, 2, 3, 4, 5].map(i => `<details><summary>${escapeHtml(t(`info.faq.q${i}`))}</summary><p>${escapeHtml(t(`info.faq.a${i}`))}</p></details>`).join('')}</div>`;
else body = `<div class="contact-grid">
  <form id="cf" novalidate>
    <p class="form-msg" id="cmsg" hidden role="status"></p>
    <div class="field"><label for="c-name">${escapeHtml(t('common.name'))}</label><input id="c-name" name="name" required autocomplete="name"></div>
    <div class="field"><label for="c-email">${escapeHtml(t('common.email'))}</label><input id="c-email" name="email" type="email" required autocomplete="email"></div>
    <div class="field"><label for="c-msg">${escapeHtml(t('common.message'))}</label><textarea id="c-msg" name="message" required></textarea></div>
    <button class="btn btn-primary" type="submit">${escapeHtml(t('common.send'))}</button>
  </form>
  <aside class="note-box" style="align-self:start"><p>${escapeHtml(t('info.contact.insta'))}</p><a class="btn btn-outline btn-sm" href="${IG_URL}" target="_blank" rel="noopener">${icon('insta')} @jpslogistics</a></aside>
</div>`;

main.innerHTML = `<div class="container"><div class="page-head"><h1>${escapeHtml(title)}</h1>${p === 'contact' ? `<p>${escapeHtml(t('info.contact.intro'))}</p>` : ''}</div>${nav}${body}<div style="height:32px"></div></div>`;

pageReady();
const f = document.getElementById('cf');
if (f) f.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('cmsg'); msg.hidden = false; msg.className = 'form-msg err';
  const v = { name: f.name.value.trim(), email: f.email.value.trim(), message: f.message.value.trim() };
  if (!v.name || !/^\S+@\S+\.\S+$/.test(v.email) || !v.message) { msg.textContent = t('common.required'); (!v.name ? f.name : !v.email || !/^\S+@\S+\.\S+$/.test(v.email) ? f.email : f.message).focus(); return; }
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
  try { await api.sendContactMessage(v); msg.className = 'form-msg ok'; msg.textContent = t('info.contact.sent'); f.reset(); toast(t('info.contact.sent'), 'success'); }
  catch (err) { msg.textContent = err.message || t('common.error'); }
  btn.disabled = false;
});
