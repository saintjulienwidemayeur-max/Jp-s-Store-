import { t } from '../i18n.js';
import { api, setMeta, icon, escapeHtml, productCardHTML, bindProductCards, skeletonCards, ready } from '../layout.js';

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);
const state = { category: params.get('category') || '', q: (params.get('q') || '').trim(), sort: params.get('sort') || 'popular' };
const SORTS = ['popular', 'price_asc', 'price_desc', 'new'];
if (!SORTS.includes(state.sort)) state.sort = 'popular';

setMeta({ title: t('shop.title'), description: t('shop.desc') });
if (state.q) document.title = `“${state.q}” | ${t('shop.title')} | JP's Logistics & More`;

main.innerHTML = `<div class="container">
  <div class="page-head"><h1>${escapeHtml(t('shop.title'))}</h1></div>
  <div class="shop-bar">
    <div class="chips" id="chips" role="group" aria-label="${escapeHtml(t('shop.categories'))}"></div>
    <div class="shop-meta">
      <p class="result-count" id="count" role="status" aria-live="polite">&nbsp;</p>
      <div class="sort"><label for="sort">${escapeHtml(t('shop.sort'))}</label>
        <select class="select" id="sort">${SORTS.map(s => `<option value="${s}" ${s === state.sort ? 'selected' : ''}>${escapeHtml(t('shop.sort.' + s))}</option>`).join('')}</select></div>
    </div>
  </div>
  <div id="qpill"></div>
  <div class="grid grid-products" id="grid" aria-busy="true">${skeletonCards(8)}</div>
</div>`;

let cats = [];
function url() {
  const p = new URLSearchParams();
  if (state.category) p.set('category', state.category);
  if (state.q) p.set('q', state.q);
  if (state.sort !== 'popular') p.set('sort', state.sort);
  const s = p.toString();
  return 'shop.html' + (s ? '?' + s : '');
}
function renderChips() {
  const chips = document.getElementById('chips');
  chips.innerHTML = [{ slug: '', name: t('shop.all') }, ...cats].map(c => `<button type="button" class="chip" data-cat="${escapeHtml(c.slug)}" aria-pressed="${c.slug === state.category}">${escapeHtml(c.name)}</button>`).join('');
  document.getElementById('qpill').innerHTML = state.q
    ? `<p class="q-pill" style="margin-bottom:18px"><span>${escapeHtml(t('shop.q_label'))}: <b>${escapeHtml(state.q)}</b></span><a href="${(() => { const s = { ...state, q: '' }; const p = new URLSearchParams(); if (s.category) p.set('category', s.category); return 'shop.html' + (p.toString() ? '?' + p : ''); })()}" aria-label="${escapeHtml(t('shop.clear'))}">${icon('close')}</a></p>` : '';
}
async function load() {
  const grid = document.getElementById('grid'), count = document.getElementById('count');
  grid.setAttribute('aria-busy', 'true'); grid.innerHTML = skeletonCards(8);
  try {
    const [list] = await Promise.all([api.listProducts({ category: state.category || undefined, q: state.q || undefined, sort: state.sort }), ready()]);
    grid.removeAttribute('aria-busy');
    count.textContent = state.q ? t('shop.results_q', { n: list.length, q: state.q }) : t('shop.results', { n: list.length });
    if (!list.length) {
      grid.innerHTML = `<div class="state" style="grid-column:1/-1"><span class="state-ic">${icon('search')}</span><h2>${escapeHtml(t('shop.empty.title'))}</h2><p>${escapeHtml(t('shop.empty.text'))}</p><a class="btn btn-primary" href="shop.html">${escapeHtml(t('shop.clear'))}</a></div>`;
      return;
    }
    grid.innerHTML = list.map(productCardHTML).join('');
    bindProductCards(grid);
  } catch (e) {
    grid.removeAttribute('aria-busy'); count.textContent = '';
    grid.innerHTML = `<div class="state" style="grid-column:1/-1"><h2>${escapeHtml(t('common.error'))}</h2><button class="btn btn-outline" id="retry">${escapeHtml(t('common.retry'))}</button></div>`;
    document.getElementById('retry').onclick = load;
  }
}
document.getElementById('chips').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  state.category = b.dataset.cat; history.replaceState(null, '', url()); renderChips(); load();
});
document.getElementById('sort').addEventListener('change', e => { state.sort = e.target.value; history.replaceState(null, '', url()); load(); });

api.listCategories().then(c => { cats = c; renderChips(); }).catch(renderChips);
renderChips();
load();
