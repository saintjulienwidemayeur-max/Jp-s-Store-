import { t } from '../i18n.js';
import { api, setMeta, icon, escapeHtml, productCardHTML, bindProductCards, skeletonCards, ready, pageReady } from '../layout.js';

setMeta({ title: t('wishlist.title'), description: t('wishlist.desc') });
const main = document.getElementById('main');
main.innerHTML = `<div class="container"><div class="page-head"><h1>${escapeHtml(t('wishlist.title'))}</h1><p id="wl-count" role="status">&nbsp;</p></div><div class="grid grid-products" id="wl-grid" style="margin-top:20px;margin-bottom:40px" aria-busy="true">${skeletonCards(4)}</div></div>`;

const grid = document.getElementById('wl-grid'), count = document.getElementById('wl-count');
let products = [];
function render() {
  grid.removeAttribute('aria-busy');
  if (!products.length) {
    count.textContent = '';
    grid.innerHTML = `<div class="state" style="grid-column:1/-1"><span class="state-ic">${icon('heart')}</span><h2>${escapeHtml(t('wishlist.empty.title'))}</h2><p>${escapeHtml(t('wishlist.empty.text'))}</p><a class="btn btn-primary" href="shop.html">${escapeHtml(t('home.hero.cta'))}</a></div>`;
    return;
  }
  count.textContent = t('wishlist.count', { n: products.length });
  grid.innerHTML = products.map(productCardHTML).join('');
  bindProductCards(grid);
}
(async () => {
  try {
    await ready();
    const ids = await api.getWishlist();
    const all = await api.listProducts({});
    products = ids.map(id => all.find(p => p.id === id)).filter(Boolean);
    render();
  } catch { grid.removeAttribute('aria-busy'); grid.innerHTML = `<div class="state" style="grid-column:1/-1"><h2>${escapeHtml(t('common.error'))}</h2></div>`; }
  finally { pageReady(); }
})();
// un-hearting removes the card from this page
window.addEventListener('jps:wishlist', e => {
  if (!e.detail.on) { products = products.filter(p => p.id !== e.detail.id); render(); }
});
