import { t } from '../i18n.js';
import { setMeta, icon, escapeHtml, productCardHTML, bindProductCards, skeletonCards, imageHTML, ready, pageReady } from '../layout.js';
import { getCategories, getCategoryBySlug, buildTree, scopeSlugs, listPaged, FANZONE } from '../catalog.js';

const main = document.getElementById('main');
const SORTS = ['popular', 'price_asc', 'price_desc', 'new'];
const PAGE_SIZE = 12;
const num = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };

function readURL() {
  const p = new URLSearchParams(location.search);
  const sort = p.get('sort');
  return {
    category: p.get('category') || '', q: (p.get('q') || '').trim(), sort: SORTS.includes(sort) ? sort : 'popular',
    min: num(p.get('min')), max: num(p.get('max')), stock: p.get('stock') === '1', page: Math.max(1, parseInt(p.get('page'), 10) || 1),
  };
}
let state = readURL();
function qs(s = state, over = {}) {
  const o = { ...s, ...over }; const p = new URLSearchParams();
  if (o.category) p.set('category', o.category);
  if (o.q) p.set('q', o.q);
  if (o.sort !== 'popular') p.set('sort', o.sort);
  if (o.min !== null) p.set('min', o.min);
  if (o.max !== null) p.set('max', o.max);
  if (o.stock) p.set('stock', '1');
  if (o.page > 1) p.set('page', o.page);
  const s2 = p.toString();
  return 'shop.html' + (s2 ? '?' + s2 : '');
}

let cats = [], category = null, unknownCategory = false, total = 0, pages = 1, token = 0;

main.innerHTML = `<div class="container">
  <div id="banner"></div>
  <div class="shop-layout">
    <div class="scrim" id="f-scrim" hidden></div>
    <aside class="filters" id="filters" aria-label="${escapeHtml(t('shop.filters'))}" tabindex="-1">
      <div class="filters-head"><h2>${escapeHtml(t('shop.filters'))}</h2><button type="button" class="icon-btn f-close" id="f-close" aria-label="${escapeHtml(t('shop.filters_close'))}">${icon('close')}</button></div>
      <div class="f-sec"><h3 id="f-cat-h">${escapeHtml(t('shop.category'))}</h3><div class="cat-tree" id="cat-tree" role="group" aria-labelledby="f-cat-h"></div></div>
      <div class="f-sec"><h3 id="f-price-h">${escapeHtml(t('shop.price'))}</h3>
        <div class="price-range" role="group" aria-labelledby="f-price-h">
          <label for="pmin"><span class="sr-only">${escapeHtml(t('shop.price_min'))}</span><input id="pmin" type="number" inputmode="decimal" min="0" step="any" placeholder="${escapeHtml(t('shop.price_min'))}"></label>
          <span aria-hidden="true">–</span>
          <label for="pmax"><span class="sr-only">${escapeHtml(t('shop.price_max'))}</span><input id="pmax" type="number" inputmode="decimal" min="0" step="any" placeholder="${escapeHtml(t('shop.price_max'))}"></label>
        </div></div>
      <div class="f-sec"><label class="check"><input type="checkbox" id="instock"><span>${escapeHtml(t('shop.in_stock'))}</span></label></div>
      <div class="f-foot"><button type="button" class="btn btn-outline btn-block" id="f-clear">${escapeHtml(t('shop.clear_all'))}</button><button type="button" class="btn btn-primary btn-block f-apply" id="f-apply">${escapeHtml(t('shop.show_all'))}</button></div>
    </aside>
    <section class="shop-main" aria-label="${escapeHtml(t('shop.title'))}">
      <div class="shop-bar">
        <div class="chips" id="chips" role="group" aria-label="${escapeHtml(t('shop.chips'))}"></div>
        <div class="shop-meta">
          <button type="button" class="btn btn-outline btn-sm f-open" id="f-open" aria-controls="filters" aria-expanded="false">${icon('menu')}<span>${escapeHtml(t('shop.filters'))}</span><span class="f-badge" id="f-badge" hidden>0</span></button>
          <p class="result-count" id="count" role="status" aria-live="polite">&nbsp;</p>
          <div class="sort"><label for="sort">${escapeHtml(t('shop.sort'))}</label>
            <select class="select" id="sort">${SORTS.map(s => `<option value="${s}">${escapeHtml(t('shop.sort.' + s))}</option>`).join('')}</select></div>
        </div>
      </div>
      <div id="active" class="active-filters"></div>
      <div class="grid grid-products" id="grid" aria-busy="true">${skeletonCards(8)}</div>
      <nav class="pager" id="pager" aria-label="${escapeHtml(t('shop.pagination'))}" hidden></nav>
    </section>
  </div>
  <div style="height:40px"></div>
</div>`;

const $ = (id) => document.getElementById(id);

function activeList() {
  const a = [];
  if (state.category && category) a.push({ k: 'category', label: category.name });
  if (state.q) a.push({ k: 'q', label: `“${state.q}”` });
  if (state.min !== null || state.max !== null) {
    a.push({ k: 'price', label: state.min !== null && state.max !== null ? t('shop.price_chip', { min: state.min, max: state.max }) : state.min !== null ? t('shop.price_from', { min: state.min }) : t('shop.price_upto', { max: state.max }) });
  }
  if (state.stock) a.push({ k: 'stock', label: t('shop.in_stock') });
  return a;
}
function treeHTML() {
  const mk = (n, depth) => `<button type="button" class="cat-opt${depth ? ' sub' : ''}" data-cat="${escapeHtml(n.slug)}" aria-pressed="${n.slug === state.category}" style="--d:${depth}">${escapeHtml(n.name)}</button>${n.children.map(ch => mk(ch, depth + 1)).join('')}`;
  return `<button type="button" class="cat-opt" data-cat="" aria-pressed="${!state.category}" style="--d:0">${escapeHtml(t('shop.all_categories'))}</button>` + buildTree(cats).map(n => mk(n, 0)).join('');
}
function renderChrome() {
  $('cat-tree').innerHTML = treeHTML();
  const roots = buildTree(cats);
  $('chips').innerHTML = [{ slug: '', name: t('shop.all') }, ...roots].map(c => `<button type="button" class="chip" data-cat="${escapeHtml(c.slug)}" aria-pressed="${c.slug === '' ? !state.category : scopeSlugs(cats, c.slug).includes(state.category)}">${escapeHtml(c.name)}</button>`).join('');
  $('sort').value = state.sort;
  if (document.activeElement !== $('pmin')) $('pmin').value = state.min ?? '';
  if (document.activeElement !== $('pmax')) $('pmax').value = state.max ?? '';
  $('instock').checked = state.stock;
  const act = activeList();
  $('f-badge').textContent = act.length; $('f-badge').hidden = !act.length;
  $('f-clear').hidden = !act.length;
  $('active').innerHTML = act.length ? `<ul class="pills-row" aria-label="${escapeHtml(t('shop.active'))}">${act.map(x => `<li class="q-pill"><span>${escapeHtml(x.label)}</span><button type="button" data-rm="${x.k}" aria-label="${escapeHtml(t('shop.remove', { f: x.label }))}">${icon('close')}</button></li>`).join('')}<li><button type="button" class="link-btn" data-rm="all">${escapeHtml(t('shop.clear_all'))}</button></li></ul>` : '';
}
function bannerHTML() {
  if (unknownCategory) {
    return `<div class="page-head"><h1>${escapeHtml(t('shop.title'))}</h1></div><p class="notice" role="status"><b>${escapeHtml(t('coll.not_found.title'))}.</b> ${escapeHtml(t('coll.not_found.text'))}</p>`;
  }
  if (!category) return `<div class="page-head"><h1>${escapeHtml(t('shop.title'))}</h1></div>`;
  const crumbs = `<ol class="crumbs" aria-label="${escapeHtml(t('coll.crumbs'))}"><li><a href="index.html">${escapeHtml(t('nav.home'))}</a></li><li><a href="shop.html">${escapeHtml(t('nav.shop'))}</a></li><li aria-current="page">${escapeHtml(category.name)}</li></ol>`;
  if (category.slug === FANZONE) {
    return `${crumbs}<section class="hero hero-in-page" aria-labelledby="coll-h"><div class="hero-in hslide v-fanzone is-active"><span class="hero-frame" aria-hidden="true"></span>
      <div class="hero-copy"><span class="hero-eyebrow">${escapeHtml(t('fanzone.eyebrow'))}</span><h1 id="coll-h" class="hero-t">${escapeHtml(category.name === 'Fan Zone' ? t('fanzone.title') : category.name)}</h1><p class="sub">${escapeHtml(category.description || t('fanzone.sub'))}</p><div class="hero-stripe" aria-hidden="true"></div></div>
      <div class="hero-art" role="img" aria-label="${escapeHtml(t('fanzone.alt'))}"><figure><img src="assets/img/headband.jpg" alt=""></figure><figure><img src="assets/img/scarf.jpg" alt=""></figure><figure><img src="assets/img/thunder-stick.jpg" alt=""></figure></div></div></section>`;
  }
  return `${crumbs}<section class="coll-banner" aria-labelledby="coll-h"><div class="coll-img">${imageHTML({ image: category.image, name: category.name }, { eager: true })}</div>
    <div class="coll-copy"><p class="hero-eyebrow">${escapeHtml(t('slide.coll.eyebrow'))}</p><h1 id="coll-h">${escapeHtml(category.name)}</h1>${category.description ? `<p>${escapeHtml(category.description)}</p>` : ''}</div></section>`;
}
function pagerHTML() {
  if (pages <= 1) return '';
  const cur = state.page, items = [];
  const add = (n) => items.push(n);
  const set = new Set([1, pages, cur - 1, cur, cur + 1]);
  [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n, i, arr) => { if (i && n - arr[i - 1] > 1) add('…'); add(n); });
  const link = (n, label, cls = '', extra = '') => `<a class="pg ${cls}" href="${qs(state, { page: n })}" data-page="${n}" ${extra}>${label}</a>`;
  return `<ul>${cur > 1 ? `<li>${link(cur - 1, `${icon('chevron', 'flip')}<span>${escapeHtml(t('shop.prev'))}</span>`, 'pg-nav', 'rel="prev"')}</li>` : ''}
    ${items.map(n => n === '…' ? '<li class="pg-gap" aria-hidden="true">…</li>' : `<li>${n === cur ? `<span class="pg on" aria-current="page" aria-label="${escapeHtml(t('shop.current_page', { n }))}">${n}</span>` : link(n, n, '', `aria-label="${escapeHtml(t('shop.page_n', { n }))}"`)}</li>`).join('')}
    ${cur < pages ? `<li>${link(cur + 1, `<span>${escapeHtml(t('shop.next'))}</span>${icon('chevron')}`, 'pg-nav', 'rel="next"')}</li>` : ''}</ul>`;
}

function setHead() {
  const base = category ? category.name : t('shop.title');
  if (category) setMeta({ title: base, description: category.description || t('coll.desc', { name: category.name }), image: category.image || undefined });
  else setMeta({ title: base, description: t('shop.desc') });
  if (state.q) document.title = `“${state.q}” | ${base} | JP's Logistics & More`;
}

async function load({ first = false } = {}) {
  const my = ++token;
  const grid = $('grid'), count = $('count');
  grid.setAttribute('aria-busy', 'true'); grid.innerHTML = skeletonCards(8);
  try {
    const scope = state.category && category ? scopeSlugs(cats, state.category) : undefined;
    const [res] = await Promise.all([listPaged({
      categories: scope, q: state.q || undefined, sort: state.sort, minPrice: state.min ?? undefined, maxPrice: state.max ?? undefined,
      inStock: state.stock || undefined, page: state.page, pageSize: PAGE_SIZE }), ready()]);
    if (my !== token) return;
    total = res.total; pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages && total > 0) { state.page = pages; history.replaceState(null, '', qs()); return load({ first }); }
    grid.removeAttribute('aria-busy');
    count.textContent = state.q ? t('shop.results_q', { n: total, q: state.q }) : t('shop.results', { n: total }) + (pages > 1 ? ' · ' + t('shop.page_of', { page: state.page, pages }) : '');
    $('f-apply').textContent = t('shop.show_n', { n: total });
    if (!res.items.length) {
      const msg = category && !activeList().filter(a => a.k !== 'category').length ? t('coll.empty') : t('shop.empty.text');
      grid.innerHTML = `<div class="state" style="grid-column:1/-1"><span class="state-ic">${icon('search')}</span><h2>${escapeHtml(t('shop.empty.title'))}</h2><p>${escapeHtml(msg)}</p><a class="btn btn-primary" href="shop.html" id="empty-clear">${escapeHtml(t('shop.clear'))}</a></div>`;
      $('pager').hidden = true;
    } else {
      grid.innerHTML = res.items.map(productCardHTML).join('');
      bindProductCards(grid);
      const pg = $('pager'); pg.innerHTML = pagerHTML(); pg.hidden = pages <= 1;
    }
  } catch (e) {
    if (my !== token) return;
    grid.removeAttribute('aria-busy'); count.textContent = ''; $('pager').hidden = true;
    grid.innerHTML = `<div class="state" style="grid-column:1/-1"><h2>${escapeHtml(t('shop.error'))}</h2><p>${escapeHtml(t('common.error'))}</p><button class="btn btn-outline" id="retry" type="button">${escapeHtml(t('common.retry'))}</button></div>`;
    $('retry').onclick = () => load();
  } finally {
    if (first) pageReady();
  }
}

async function resolveCategory() {
  category = null; unknownCategory = false;
  if (!state.category) return;
  category = cats.find(c => c.slug === state.category) || null;
  if (!category) { try { category = await getCategoryBySlug(state.category); } catch { category = null; } }
  if (!category) unknownCategory = true;
}
async function apply({ push = true, scroll = false } = {}) {
  if (push) history.pushState(null, '', qs());
  await resolveCategory();
  $('banner').innerHTML = bannerHTML();
  renderChrome(); setHead();
  await load();
  if (scroll) $('grid').scrollIntoView({ block: 'start' });
}
function set(patch, opts) { state = { ...state, page: 1, ...patch }; return apply(opts); }

// ---- events
document.addEventListener('click', (e) => {
  const cat = e.target.closest('#cat-tree [data-cat], #chips [data-cat]');
  if (cat) { set({ category: cat.dataset.cat }); if (cat.closest('#cat-tree') && matchMedia('(max-width: 899px)').matches) closeFilters(); return; }
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    const k = rm.dataset.rm;
    set(k === 'all' ? { category: '', q: '', min: null, max: null, stock: false } : k === 'category' ? { category: '' } : k === 'q' ? { q: '' } : k === 'price' ? { min: null, max: null } : { stock: false });
    return;
  }
  const pg = e.target.closest('#pager [data-page]');
  if (pg) { e.preventDefault(); state = { ...state, page: Number(pg.dataset.page) }; apply({ scroll: true }); return; }
  if (e.target.closest('#f-clear')) { set({ category: '', q: '', min: null, max: null, stock: false }); return; }
  if (e.target.closest('#empty-clear')) { e.preventDefault(); set({ category: '', q: '', min: null, max: null, stock: false }); }
});
$('sort').addEventListener('change', (e) => set({ sort: e.target.value }));
$('instock').addEventListener('change', (e) => set({ stock: e.target.checked }));
let priceTimer;
function onPrice() {
  clearTimeout(priceTimer);
  priceTimer = setTimeout(() => {
    let min = num($('pmin').value), max = num($('pmax').value);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    if (min !== state.min || max !== state.max) set({ min, max });
  }, 450);
}
['pmin', 'pmax'].forEach((id) => { $(id).addEventListener('input', onPrice); $(id).addEventListener('change', () => { onPrice(); }); });
window.addEventListener('popstate', () => { state = readURL(); apply({ push: false }); });

// filters drawer (mobile); static sidebar on desktop
const fEl = $('filters'), scrim = $('f-scrim'), openBtn = $('f-open');
let lastFocus = null;
function openFilters() {
  lastFocus = document.activeElement; fEl.classList.add('open'); scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('show'));
  openBtn.setAttribute('aria-expanded', 'true'); document.body.classList.add('no-scroll'); fEl.setAttribute('role', 'dialog'); fEl.setAttribute('aria-modal', 'true'); fEl.focus();
}
function closeFilters() {
  if (!fEl.classList.contains('open')) return;
  fEl.classList.remove('open'); scrim.classList.remove('show'); setTimeout(() => { if (!fEl.classList.contains('open')) scrim.hidden = true; }, 250);
  openBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll'); fEl.removeAttribute('role'); fEl.removeAttribute('aria-modal');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
openBtn.addEventListener('click', openFilters);
$('f-close').addEventListener('click', closeFilters); $('f-apply').addEventListener('click', closeFilters); scrim.addEventListener('click', closeFilters);
fEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeFilters(); return; }
  if (e.key !== 'Tab' || !fEl.classList.contains('open')) return;
  const els = [...fEl.querySelectorAll('button,input,select,a[href]')].filter(x => x.offsetParent !== null);
  if (!els.length) return;
  const first = els[0], last = els[els.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === fEl)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) closeFilters(); });

// ---- boot
(async () => {
  try { cats = await getCategories(); } catch { cats = []; }
  await resolveCategory();
  $('banner').innerHTML = bannerHTML();
  renderChrome(); setHead();
  await load({ first: true });
})().catch((e) => { console.warn('shop init failed', e); pageReady(); });
