import { t, getLang, getLangs, setLang, LANG_NAMES } from '../i18n.js';
import { api, escapeHtml, toast, setMeta } from '../layout.js';
import { clearCart } from '../cart.js';

const main = document.getElementById('main');
const E = escapeHtml;
const ENGLISH = { en: 'English', fr: 'French', ht: 'Haitian Creole' };

function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }

function render() {
  const cur = getLang();
  setMeta({ title: t('settings.title'), description: t('settings.desc') });
  main.innerHTML = `<div class="container settings">
  <h1>${E(t('settings.title'))}</h1>
  <p class="lead">${E(t('settings.desc'))}</p>

  <section class="set-card" aria-labelledby="s-lang">
    <h2 id="s-lang">${E(t('settings.lang.title'))}</h2>
    <p id="s-lang-help">${E(t('settings.lang.help'))}</p>
    <fieldset class="lang-cards" aria-describedby="s-lang-help">
      <legend class="sr-only">${E(t('settings.lang.title'))}</legend>
      ${getLangs().map(l => `<label class="lang-card"><input type="radio" name="lang" value="${l}" ${l === cur ? 'checked' : ''}><span><b lang="${l}">${E(LANG_NAMES[l])}</b><small>${l.toUpperCase()} · ${E(ENGLISH[l])}</small></span></label>`).join('')}
    </fieldset>
    <div class="set-preview" aria-live="polite"><b>${E(t('settings.preview.title'))}</b>
      <span>${E(t('settings.preview.sample'))} ${E(t('home.popular'))} · ${E(t('common.free_shipping'))} · ${E(t('common.add_to_cart'))}</span></div>
  </section>

  <section class="set-card" aria-labelledby="s-cur">
    <h2 id="s-cur">${E(t('settings.currency.title'))}</h2>
    <p style="margin:0">${E(t('settings.currency.note'))}</p>
  </section>

  <section class="set-card" aria-labelledby="s-mot">
    <h2 id="s-mot">${E(t('settings.motion.title'))}</h2>
    <p style="margin:0">${E(t('settings.motion.note', { state: t(reduced() ? 'settings.motion.on' : 'settings.motion.off') }))}</p>
  </section>

  <section class="set-card" aria-labelledby="s-data">
    <h2 id="s-data">${E(t('settings.data.title'))}</h2>
    <p>${E(t('settings.data.help'))}</p>
    <div class="set-actions">
      <button type="button" class="btn btn-outline" data-clear="cart">${E(t('settings.data.clear_cart'))}</button>
      <button type="button" class="btn btn-outline" data-clear="wishlist">${E(t('settings.data.clear_wishlist'))}</button>
    </div>
    <div id="set-confirm" class="set-confirm" role="alertdialog" aria-labelledby="set-confirm-q" hidden>
      <p id="set-confirm-q"></p>
      <div class="set-actions">
        <button type="button" class="btn btn-primary" id="set-yes">${E(t('settings.data.confirm'))}</button>
        <button type="button" class="btn btn-outline" id="set-no">${E(t('settings.data.cancel'))}</button>
      </div>
    </div>
  </section>
</div>`;
  wire();
}

function wire() {
  main.querySelectorAll('input[name=lang]').forEach(r => r.addEventListener('change', async () => {
    const l = r.value;
    try { if (typeof api.setPreferences === 'function') await api.setPreferences({ lang: l }); } catch {}
    try { sessionStorage.setItem('jps_lang_saved', '1'); } catch {}
    setLang(l); // stores jps_lang, updates <html lang> and reloads so every string is re-rendered
  }));

  const box = document.getElementById('set-confirm'), q = document.getElementById('set-confirm-q');
  let kind = null, opener = null;
  main.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
    kind = b.dataset.clear; opener = b;
    q.textContent = t(kind === 'cart' ? 'settings.data.confirm_cart' : 'settings.data.confirm_wishlist');
    box.hidden = false; document.getElementById('set-no').focus();
  }));
  const hide = () => { box.hidden = true; if (opener) opener.focus(); };
  document.getElementById('set-no').addEventListener('click', hide);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.getElementById('set-yes').addEventListener('click', async () => {
    try {
      if (kind === 'cart') { clearCart(); }
      else {
        const ids = await api.getWishlist();
        for (const id of ids) await api.toggleWishlist(id);
        window.dispatchEvent(new CustomEvent('jps:wishlist', { detail: { cleared: true } }));
      }
      toast(t(kind === 'cart' ? 'settings.data.cart_cleared' : 'settings.data.wishlist_cleared'), 'success');
    } catch { toast(t('common.error'), 'error'); }
    hide();
    // wishlist badge lives in layout.js state; a soft reload keeps header counts truthful
    if (kind === 'wishlist') setTimeout(() => location.reload(), 600);
  });
}

render();
try {
  if (sessionStorage.getItem('jps_lang_saved')) {
    sessionStorage.removeItem('jps_lang_saved');
    toast(t('settings.lang.saved'), 'success');
    main.querySelector('input[name=lang]:checked')?.focus();
  }
} catch {}
