import '../i18n.commerce.js';
import '../i18n.catalog.js';
import { t } from '../i18n.js';
import { escapeHtml, toast } from '../layout.js';
import { formatMoney } from '../pricing.js';
import * as api from '../api.js';
import * as layout from '../layout.js';
import { createMediaManager } from './admin-media.js';

const root = document.getElementById('main');
const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
const E = escapeHtml;
const st = { tab: 'overview', user: null, stats: null, orders: [], filter: '', products: [], categories: [], cats: [], catFilter: '', editingCat: null, deletingCat: null, catErr: null, coupons: [], editing: null, editingCoupon: null, error: null };

const mmEl = document.createElement('section');
mmEl.className = 'c-card mm'; mmEl.id = 'media-mgr';
const mgr = createMediaManager(mmEl);
let mmFor;

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const lowOf = (x) => (typeof x === 'object' ? x : { name: String(x), stock: '' });

function guardHTML(kind) {
  return `<div class="c-empty"><img src="assets/brand/logo.png" alt="">
    <h1>${E(t('admin.title'))}</h1>
    <h2>${E(kind === 'signin' ? t('admin.need_signin') : t('admin.forbidden'))}</h2>
    <a class="btn btn-primary" href="account.html">${E(kind === 'signin' ? t('account.signin') : t('admin.back_account'))}</a></div>`;
}

function overviewHTML() {
  const s = st.stats || {};
  const low = (s.lowStock || []).map(lowOf);
  return `<div class="a-stats">
      <div class="a-stat"><b>${s.orders ?? 0}</b><span>${E(t('admin.stat_orders'))}</span></div>
      <div class="a-stat"><b>${formatMoney(s.revenue || 0)}</b><span>${E(t('admin.stat_revenue'))}</span></div>
      <div class="a-stat"><b>${s.products ?? 0}</b><span>${E(t('admin.stat_products'))}</span></div>
      <div class="a-stat ${low.length ? 'warn' : ''}"><b>${low.length}</b><span>${E(t('admin.stat_low'))}</span></div>
    </div>
    <h2>${E(t('admin.low_stock'))}</h2>
    ${low.length ? `<ul class="a-lowlist">${low.map((p) => `<li><span>${E(p.name)}</span><strong class="a-danger">${E(t('admin.units_left', { n: p.stock }))}</strong></li>`).join('')}</ul>`
      : `<p class="c-msg">${E(t('admin.no_low'))}</p>`}`;
}

function ordersHTML() {
  const rows = st.orders.map((o) => `<tr>
      <td><a href="order.html?n=${encodeURIComponent(o.order_number)}&e=${encodeURIComponent(o.customer?.email || '')}"><strong>${E(o.order_number)}</strong></a>
        <div class="a-muted">${E(o.created_at ? new Date(o.created_at).toLocaleDateString() : '')}</div>
        <ul class="a-items">${(o.items || []).map((i) => `<li>${E(i.name || i.product_name || i.product_id)} &times; ${i.qty}</li>`).join('')}</ul></td>
      <td>${E(o.customer?.name || '')}<div class="a-muted">${E(o.customer?.email || '')}<br>${E(o.customer?.phone || '')}<br>${E([o.customer?.city, o.customer?.country].filter(Boolean).join(', '))}</div></td>
      <td>${E(t(`checkout.pm.${o.payment_method}`))}</td>
      <td><strong>${formatMoney(o.total)}</strong>${o.coupon_code ? `<div class="a-muted">${E(o.coupon_code)}</div>` : ''}</td>
      <td><select data-order="${E(String(o.id))}" aria-label="${E(t('admin.status'))} ${E(o.order_number)}">${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${E(t(`order.status.${s}`))}</option>`).join('')}</select></td>
    </tr>`).join('');
  return `<div class="a-toolbar"><h2 style="margin:0">${E(t('admin.orders'))}</h2>
      <select id="order-filter" aria-label="${E(t('admin.filter_status'))}"><option value="">${E(t('admin.all'))}</option>
        ${STATUSES.map((s) => `<option value="${s}" ${st.filter === s ? 'selected' : ''}>${E(t(`order.status.${s}`))}</option>`).join('')}</select></div>
    ${st.orders.length ? `<div class="a-tablewrap"><table class="a-table"><thead><tr><th>${E(t('admin.order'))}</th><th>${E(t('admin.customer'))}</th><th>${E(t('admin.payment'))}</th><th>${E(t('cart.total'))}</th><th>${E(t('admin.status'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="c-msg">${E(t('admin.no_orders'))}</p>`}`;
}

function productFormHTML() {
  const p = st.editing;
  if (!p) return '';
  const cats = st.cats.length ? [...st.cats] : [{ slug: 'fan-zone', name: 'Fan Zone' }];
  if (p.category_slug && !cats.some((c) => c.slug === p.category_slug)) cats.push({ slug: p.category_slug, name: p.category_slug });
  return `<form id="product-form" class="c-card c-form" novalidate>
    <h2>${E(p.id ? t('admin.edit_product') : t('admin.new_product'))}</h2>
    <div class="c-field"><label for="p-name">${E(t('admin.p_name'))}</label><input id="p-name" name="name" type="text" value="${E(p.name || '')}" required></div>
    <div class="c-field"><label for="p-slug">${E(t('admin.p_slug'))}</label><input id="p-slug" name="slug" type="text" value="${E(p.slug || '')}" placeholder="${E(t('admin.p_slug_hint'))}"></div>
    <div class="c-field"><label for="p-desc">${E(t('admin.p_desc'))}</label><textarea id="p-desc" name="description" rows="3">${E(p.description || '')}</textarea></div>
    <div class="c-grid2">
      <div class="c-field"><label for="p-price">${E(t('admin.p_price'))}</label><input id="p-price" name="price" type="number" step="0.01" min="0" value="${p.price ?? ''}" required></div>
      <div class="c-field"><label for="p-cmp">${E(t('admin.p_compare'))}</label><input id="p-cmp" name="compare_at_price" type="number" step="0.01" min="0" value="${p.compare_at_price ?? ''}"></div>
      <div class="c-field"><label for="p-stock">${E(t('admin.p_stock'))}</label><input id="p-stock" name="stock" type="number" step="1" min="0" value="${p.stock ?? 0}" required></div>
      <div class="c-field"><label for="p-cat">${E(t('admin.p_category'))}</label><select id="p-cat" name="category_slug">${cats.map((c) => `<option value="${E(c.slug)}" ${c.slug === (p.category_slug || cats[0].slug) ? 'selected' : ''}>${E(c.name)}</option>`).join('')}</select></div>
    </div>
    <div class="c-field"><label for="p-img">${E(t('admin.p_image'))}</label>
      <div class="c-row"><input id="p-img" name="image" type="text" style="flex:1" value="${E(p.image || '')}" placeholder="assets/img/..."><img class="a-preview" id="p-prev" src="${E(p.image || 'assets/brand/logo.png')}" alt=""></div></div>
    <div class="c-field"><label for="p-tags">${E(t('admin.p_tags'))}</label><input id="p-tags" name="tags" type="text" value="${E((p.tags || []).join(', '))}"></div>
    <div class="a-check"><label><input type="checkbox" name="is_active" ${p.is_active !== false ? 'checked' : ''}> ${E(t('admin.p_active'))}</label>
      <label><input type="checkbox" name="is_popular" ${p.is_popular ? 'checked' : ''}> ${E(t('admin.p_popular'))}</label>
      <label><input type="checkbox" name="is_featured" ${p.is_featured ? 'checked' : ''}> ${E(t('admin.p_featured'))}</label></div>
    ${st.error ? `<div class="c-alert err" role="alert">${E(st.error)}</div>` : ''}
    <div class="c-row"><button class="btn btn-primary" type="submit">${E(t('admin.save'))}</button>
      <button class="btn btn-outline" type="button" data-act="cancel-product">${E(t('admin.cancel'))}</button></div></form>`;
}

function productsHTML() {
  const shown = st.catFilter ? st.products.filter((p) => p.category_slug === st.catFilter) : st.products;
  const rows = shown.map((p) => `<tr>
      <td><img src="${E(p.image || 'assets/brand/logo.png')}" alt="" loading="lazy"></td>
      <td><strong>${E(p.name)}</strong><div class="a-muted">${E(p.slug)}</div>
        <span class="a-pill ${p.is_active ? '' : 'off'}">${E(p.is_active ? t('admin.active') : t('admin.inactive'))}</span>${p.is_popular ? ` <span class="a-pill">${E(t('admin.popular'))}</span>` : ''}${p.is_featured ? ` <span class="a-pill">${E(t('admin.featured'))}</span>` : ''}
        <div class="a-muted">${E(catName(p.category_slug))}</div></td>
      <td>${formatMoney(p.price)}</td>
      <td class="${p.stock <= 5 ? 'a-danger' : ''}">${p.stock}</td>
      <td><div class="c-row"><button class="btn btn-outline a-small" data-act="edit-product" data-id="${E(String(p.id))}">${E(t('admin.edit'))}</button>
        <button class="btn btn-outline a-small a-danger" data-act="del-product" data-id="${E(String(p.id))}">${E(t('admin.delete'))}</button></div></td></tr>`).join('');
  return `<div class="a-toolbar"><h2 style="margin:0">${E(t('admin.products'))}</h2>
      <div class="a-tools"><select id="cat-filter" aria-label="${E(t('admin.filter_category'))}"><option value="">${E(t('admin.all_categories'))}</option>
        ${st.cats.map((c) => `<option value="${E(c.slug)}" ${c.slug === st.catFilter ? 'selected' : ''}>${E(c.name)}</option>`).join('')}</select>
      <button class="btn btn-primary a-small" data-act="new-product">+ ${E(t('admin.new_product'))}</button></div></div>
    <div class="a-split"><div class="a-tablewrap"><table class="a-table"><thead><tr><th></th><th>${E(t('admin.p_name'))}</th><th>${E(t('admin.p_price'))}</th><th>${E(t('admin.p_stock'))}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      ${shown.length ? '' : `<p class="c-msg" style="padding:0 12px">${E(t('admin.no_products_filter'))}</p>`}</div>
    <div>${productFormHTML()}${st.editing ? '<div id="media-slot"></div>' : ''}</div></div>`;
}

function catName(slug) { const c = st.cats.find((x) => x.slug === slug); return c ? c.name : (slug || t('admin.no_category')); }
const catCount = (c) => st.products.filter((p) => p.category_slug === c.slug).length;

function catFormHTML() {
  const c = st.editingCat;
  if (!c) return '';
  return `<form id="cat-form" class="c-card c-form" novalidate aria-labelledby="cat-form-h">
    <h2 id="cat-form-h">${E(c.id ? t('admin.cat.edit') : t('admin.cat.new'))}</h2>
    <div class="c-field"><label for="k-name">${E(t('admin.cat.name'))}</label><input id="k-name" name="name" type="text" value="${E(c.name || '')}" required></div>
    <div class="c-field"><label for="k-slug">${E(t('admin.cat.slug'))}</label><input id="k-slug" name="slug" type="text" value="${E(c.slug || '')}" placeholder="${E(t('admin.p_slug_hint'))}"></div>
    <div class="c-field"><label for="k-desc">${E(t('admin.cat.desc'))}</label><textarea id="k-desc" name="description" rows="3">${E(c.description || '')}</textarea></div>
    <div class="c-field"><label for="k-img">${E(t('admin.cat.image'))}</label>
      <div class="c-row"><img class="a-preview" id="k-prev" src="${E(c.image || 'assets/brand/logo.png')}" alt="${E(t('admin.cat.image_preview'))}">
        <div><input id="k-img" type="file" accept="image/jpeg,image/png,image/webp" class="a-file">
          <button type="button" class="btn btn-outline a-small" data-act="cat-img-remove" ${c.image ? '' : 'hidden'} id="k-rm">${E(t('admin.cat.image_remove'))}</button></div></div>
      <small class="a-muted" id="k-hint">${E(t('admin.cat.image_hint'))}</small>
      <div class="c-alert err" role="alert" id="k-img-err" ${st.catErr ? '' : 'hidden'}>${E(st.catErr || '')}</div></div>
    <div class="a-check"><label><input type="checkbox" name="is_featured" ${c.is_featured ? 'checked' : ''}> ${E(t('admin.cat.featured'))}</label>
      <label><input type="checkbox" name="is_active" ${c.is_active !== false ? 'checked' : ''}> ${E(t('admin.cat.active'))}</label></div>
    ${st.error ? `<div class="c-alert err" role="alert">${E(st.error)}</div>` : ''}
    <div class="c-row"><button class="btn btn-primary" type="submit">${E(t('admin.save'))}</button>
      <button class="btn btn-outline" type="button" data-act="cancel-cat">${E(t('admin.cancel'))}</button></div></form>`;
}

function catDeleteHTML() {
  const d = st.deletingCat;
  if (!d) return '';
  const others = st.cats.filter((c) => c.id !== d.cat.id);
  const body = d.n === 0 ? `<p>${E(t('admin.cat.delete_plain'))}</p>`
    : `<p>${E(t('admin.cat.delete_reassign', { n: d.n }))}</p>${others.length
      ? `<div class="c-field"><label for="k-target">${E(t('admin.cat.reassign_to'))}</label><select id="k-target">${others.map((c) => `<option value="${E(c.slug)}" ${c.slug === d.target ? 'selected' : ''}>${E(c.name)}</option>`).join('')}</select></div>`
      : `<p class="a-danger" role="alert">${E(t('admin.cat.no_target'))}</p>`}`;
  const blocked = d.n > 0 && !others.length;
  return `<div class="c-card a-confirm" id="cat-delete" role="alertdialog" aria-labelledby="cat-del-h" tabindex="-1">
    <h2 id="cat-del-h">${E(t('admin.cat.delete_title', { name: d.cat.name }))}</h2>${body}
    ${d.err ? `<div class="c-alert err" role="alert">${E(d.err)}</div>` : ''}
    <div class="c-row"><button class="btn btn-primary a-small a-danger-btn" type="button" data-act="cat-del-confirm" ${blocked ? 'disabled' : ''}>${E(t('admin.cat.delete_confirm'))}</button>
      <button class="btn btn-outline a-small" type="button" data-act="cat-del-cancel">${E(t('admin.cancel'))}</button></div></div>`;
}

function categoriesHTML() {
  const n = st.cats.length;
  const rows = st.cats.map((c, i) => `<li class="a-cat" data-id="${E(String(c.id))}">
      <img src="${E(c.image || 'assets/brand/logo.png')}" alt="" loading="lazy">
      <div class="a-cat-main"><strong>${E(c.name)}</strong><div class="a-muted">${E(c.slug)} &middot; ${E(t('admin.cat.products_n', { n: catCount(c) }))}</div>
        <span class="a-pill ${c.is_active === false ? 'off' : ''}">${E(c.is_active === false ? t('admin.inactive') : t('admin.active'))}</span>${c.is_featured ? ` <span class="a-pill">${E(t('admin.cat.is_featured'))}</span>` : ''}</div>
      <div class="a-cat-act">
        <button type="button" class="btn btn-outline a-small a-icon" data-act="cat-up" data-id="${E(String(c.id))}" aria-label="${E(t('admin.cat.up', { name: c.name }))}" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
        <button type="button" class="btn btn-outline a-small a-icon" data-act="cat-down" data-id="${E(String(c.id))}" aria-label="${E(t('admin.cat.down', { name: c.name }))}" ${i === n - 1 ? 'disabled' : ''}>&darr;</button>
        <button type="button" class="btn btn-outline a-small" data-act="edit-cat" data-id="${E(String(c.id))}">${E(t('admin.edit'))}</button>
        <button type="button" class="btn btn-outline a-small a-danger" data-act="del-cat" data-id="${E(String(c.id))}">${E(t('admin.delete'))}</button></div></li>`).join('');
  return `<div class="a-toolbar"><h2 style="margin:0">${E(t('admin.cat.title'))}</h2>
      <button class="btn btn-primary a-small" data-act="new-cat">+ ${E(t('admin.cat.new'))}</button></div>
    <p class="sr-only a-sr" id="cat-live" role="status" aria-live="polite"></p>
    ${catDeleteHTML()}
    <div class="a-split"><div>${n ? `<ol class="a-cats" aria-label="${E(t('admin.cat.list'))}">${rows}</ol>` : `<p class="c-msg">${E(t('admin.cat.empty'))}</p>`}</div>
    <div>${catFormHTML()}</div></div>`;
}

function couponsHTML() {
  const c = st.editingCoupon;
  const rows = st.coupons.map((x) => `<tr><td><strong>${E(x.code)}</strong></td><td>${x.percent}%</td><td>${formatMoney(x.min_subtotal ?? 0)}</td>
      <td><span class="a-pill ${x.is_active === false || x.active === false ? 'off' : ''}">${E(x.is_active === false || x.active === false ? t('admin.inactive') : t('admin.active'))}</span></td>
      <td><button class="btn btn-outline a-small" data-act="edit-coupon" data-code="${E(x.code)}">${E(t('admin.edit'))}</button></td></tr>`).join('');
  return `<div class="a-toolbar"><h2 style="margin:0">${E(t('admin.coupons'))}</h2>
      <button class="btn btn-primary a-small" data-act="new-coupon">+ ${E(t('admin.new_coupon'))}</button></div>
    <div class="a-split"><div class="a-tablewrap"><table class="a-table" style="min-width:420px"><thead><tr><th>${E(t('admin.c_code'))}</th><th>${E(t('admin.c_percent'))}</th><th>${E(t('admin.c_min'))}</th><th>${E(t('admin.status'))}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div>${c ? `<form id="coupon-form" class="c-card c-form" novalidate><h2>${E(c._new ? t('admin.new_coupon') : t('admin.edit'))}</h2>
      <div class="c-field"><label for="c-code">${E(t('admin.c_code'))}</label><input id="c-code" name="code" type="text" value="${E(c.code || '')}" ${c._new ? '' : 'readonly'} required style="text-transform:uppercase"></div>
      <div class="c-grid2"><div class="c-field"><label for="c-pct">${E(t('admin.c_percent'))}</label><input id="c-pct" name="percent" type="number" min="1" max="100" step="1" value="${c.percent ?? 15}" required></div>
      <div class="c-field"><label for="c-min">${E(t('admin.c_min'))}</label><input id="c-min" name="min_subtotal" type="number" min="0" step="0.01" value="${c.min_subtotal ?? 10}"></div></div>
      <div class="a-check"><label><input type="checkbox" name="is_active" ${c.is_active !== false && c.active !== false ? 'checked' : ''}> ${E(t('admin.p_active'))}</label></div>
      ${st.error ? `<div class="c-alert err" role="alert">${E(st.error)}</div>` : ''}
      <div class="c-row"><button class="btn btn-primary" type="submit">${E(t('admin.save'))}</button><button class="btn btn-outline" type="button" data-act="cancel-coupon">${E(t('admin.cancel'))}</button></div></form>` : ''}</div></div>`;
}

function render() {
  document.title = `${t('admin.title')} | JP's Logistics & More`;
  if (!st.user) { root.innerHTML = guardHTML('signin'); return; }
  if (!st.user.is_admin) { root.innerHTML = guardHTML('forbidden'); return; }
  const tabs = ['overview', 'orders', 'products', 'categories', 'coupons'];
  const body = { overview: overviewHTML, orders: ordersHTML, products: productsHTML, categories: categoriesHTML, coupons: couponsHTML }[st.tab]();
  root.innerHTML = `<h1>${E(t('admin.title'))}</h1><p class="c-sub">${E(st.user.email)}</p>
    <div class="a-nav" role="tablist">${tabs.map((k) => `<button type="button" role="tab" aria-selected="${st.tab === k}" data-tab="${k}">${E(t(`admin.tab_${k}`))}</button>`).join('')}</div>
    <section>${body}</section>`;
  const slot = root.querySelector('#media-slot');
  if (slot && st.editing) {
    const key = st.editing.id || '';
    if (mmFor !== key) { mmFor = key; mgr.open(st.editing); }
    slot.replaceWith(mmEl);
  } else if (mmFor !== undefined) { mmFor = undefined; mgr.close(); }
}

async function loadAll() {
  const listCats = typeof api.adminListCategories === 'function' ? api.adminListCategories : api.listCategories;
  const [stats, orders, products, coupons, cats] = await Promise.all([
    api.adminStats(), api.adminListOrders(st.filter ? { status: st.filter } : {}),
    api.listProducts({ includeInactive: true, sort: 'new' }), api.adminListCoupons(), Promise.resolve().then(() => listCats({ includeInactive: true })).catch(() => []),
  ]);
  const sorted = [...cats].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  Object.assign(st, { stats, orders, products, coupons, categories: sorted, cats: sorted });
}

async function refresh() {
  try { await loadAll(); } catch (e) { toast(t('admin.err_load'), 'error'); }
  render();
}

root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-tab],[data-act]');
  if (!b) return;
  if (b.dataset.tab) { st.tab = b.dataset.tab; st.error = null; render(); return; }
  const act = b.dataset.act;
  st.error = null;
  if (act === 'new-product') { st.editing = { is_active: true, stock: 10 }; render(); }
  else if (act === 'cancel-product') { st.editing = null; render(); }
  else if (act === 'edit-product') { st.editing = { ...st.products.find((p) => String(p.id) === b.dataset.id) }; render(); document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if (act === 'del-product') {
    const p = st.products.find((x) => String(x.id) === b.dataset.id);
    if (!confirm(t('admin.confirm_delete', { name: p?.name || '' }))) return;
    try { await api.adminDeleteProduct(p.id); toast(t('admin.deleted'), 'success'); } catch (err) { toast(err.message, 'error'); }
    await refresh();
  }
  else if (act === 'new-cat') { st.editingCat = { is_active: true, is_featured: false }; st.catErr = null; st.deletingCat = null; render(); focusId('k-name'); }
  else if (act === 'edit-cat') { st.editingCat = { ...st.cats.find((c) => String(c.id) === b.dataset.id) }; st.catErr = null; st.deletingCat = null; render(); focusId('k-name'); }
  else if (act === 'cancel-cat') { st.editingCat = null; st.catErr = null; render(); }
  else if (act === 'cat-img-remove') { st.editingCat.image = null; st.editingCat.imageValue = null; paintCatImg(); }
  else if (act === 'cat-up' || act === 'cat-down') await moveCat(b.dataset.id, act === 'cat-up' ? -1 : 1);
  else if (act === 'del-cat') {
    const cat = st.cats.find((c) => String(c.id) === b.dataset.id);
    const others = st.cats.filter((c) => c.id !== cat.id);
    st.editingCat = null; st.deletingCat = { cat, n: catCount(cat), target: others[0]?.slug || '', err: null };
    render(); document.getElementById('cat-delete')?.focus();
  }
  else if (act === 'cat-del-cancel') { const id = st.deletingCat?.cat.id; st.deletingCat = null; render(); focusSel(`[data-act=del-cat][data-id="${id}"]`); }
  else if (act === 'cat-del-confirm') {
    const d = st.deletingCat;
    try {
      await api.adminDeleteCategory(d.cat.id, d.n > 0 ? { reassignTo: d.target } : undefined);
      st.deletingCat = null; toast(t('admin.cat.deleted'), 'success'); await refresh(); focusSel('[data-act=new-cat]');
    } catch (err) { d.err = err.message || t('admin.err_save'); render(); document.getElementById('cat-delete')?.focus(); }
  }
  else if (act === 'new-coupon') { st.editingCoupon = { _new: true, percent: 15, min_subtotal: 10 }; render(); }
  else if (act === 'edit-coupon') { st.editingCoupon = { ...st.coupons.find((c) => c.code === b.dataset.code) }; render(); }
  else if (act === 'cancel-coupon') { st.editingCoupon = null; render(); }
});

function focusId(id) { document.getElementById(id)?.focus(); }
function focusSel(sel) { root.querySelector(sel)?.focus(); }
function paintCatImg() {
  const c = st.editingCat; if (!c) return;
  const im = document.getElementById('k-prev'); if (im) im.src = c.image || 'assets/brand/logo.png';
  const rm = document.getElementById('k-rm'); if (rm) rm.hidden = !c.image;
  const er = document.getElementById('k-img-err'); if (er) { er.hidden = !st.catErr; er.textContent = st.catErr || ''; }
}
async function moveCat(id, dir) {
  const i = st.cats.findIndex((c) => String(c.id) === id), j = i + dir;
  if (i < 0 || j < 0 || j >= st.cats.length) return;
  const order = st.cats.map((c) => c.id);
  [order[i], order[j]] = [order[j], order[i]];
  try { await api.adminReorderCategories(order); } catch (err) { toast(err.message || t('admin.err_save'), 'error'); return; }
  await refresh();
  const ni = st.cats.findIndex((c) => String(c.id) === id);
  let btn = root.querySelector(`[data-act=${dir < 0 ? 'cat-up' : 'cat-down'}][data-id="${id}"]`);
  if (!btn || btn.disabled) btn = root.querySelector(`[data-act=${dir < 0 ? 'cat-down' : 'cat-up'}][data-id="${id}"]`);
  btn?.focus();
  const live = document.getElementById('cat-live');
  if (live) live.textContent = `${t('admin.cat.moved')}: ${st.cats[ni]?.name || ''}, ${t('admin.cat.position', { i: ni + 1, n: st.cats.length })}`;
}
// Read an image file, validate, downscale and return a compact data URL (stored on the category).
async function imageToDataURL(file) {
  if (typeof api.validateMediaFile === 'function') {
    const info = await api.validateMediaFile(file);
    if (info.type !== 'image') throw new Error(t('admin.media.err_type', { name: file.name }));
  } else if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1048576) throw new Error(t('admin.media.err_type', { name: file.name }));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(t('admin.media.err_type', { name: file.name }))); i.src = url; });
    const k = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    let out = cv.toDataURL('image/webp', 0.82);
    if (!out.startsWith('data:image/webp')) out = cv.toDataURL('image/jpeg', 0.85);
    return out;
  } finally { URL.revokeObjectURL(url); }
}

root.addEventListener('change', async (e) => {
  if (e.target.id === 'cat-filter') { st.catFilter = e.target.value; render(); focusId('cat-filter'); return; }
  if (e.target.id === 'k-target') { st.deletingCat.target = e.target.value; return; }
  if (e.target.id === 'k-img') {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      if (typeof api.uploadCategoryImage === 'function') { const r = await api.uploadCategoryImage(f); st.editingCat.image = r.url; st.editingCat.imageValue = r.value; }
      else { st.editingCat.image = await imageToDataURL(f); st.editingCat.imageValue = st.editingCat.image; }
      st.catErr = null;
    }
    catch (err) { st.catErr = t('admin.cat.err_image', { why: err.message }); }
    e.target.value = ''; paintCatImg(); return;
  }
  if (e.target.id === 'order-filter') { st.filter = e.target.value; await refresh(); return; }
  if (e.target.dataset.order) {
    try { await api.adminUpdateOrderStatus(e.target.dataset.order, e.target.value); toast(t('admin.status_updated'), 'success'); }
    catch (err) { toast(err.message || t('admin.err_save'), 'error'); }
    await refresh();
  }
});
root.addEventListener('input', (e) => {
  if (e.target.id === 'p-img') { const im = document.getElementById('p-prev'); if (im) im.src = e.target.value || 'assets/brand/logo.png'; }
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    if (e.target.id === 'product-form') {
      const name = String(fd.get('name')).trim();
      const price = parseFloat(fd.get('price'));
      const stock = parseInt(fd.get('stock'), 10);
      if (name.length < 2 || !(price >= 0) || !(stock >= 0)) { st.error = t('admin.err_validation'); render(); return; }
      const cmp = fd.get('compare_at_price');
      const prod = {
        ...st.editing, name, slug: String(fd.get('slug')).trim() || slugify(name), description: String(fd.get('description')).trim(),
        price, compare_at_price: cmp === '' ? null : parseFloat(cmp), stock, category_slug: fd.get('category_slug'),
        image: String(fd.get('image')).trim() || null, tags: String(fd.get('tags')).split(',').map((x) => x.trim()).filter(Boolean),
        is_active: fd.has('is_active'), is_popular: fd.has('is_popular'), is_featured: fd.has('is_featured'),
      };
      const saved = await api.adminUpsertProduct(prod);
      st.editing = prod.id || !saved || !saved.id ? null : { ...saved }; st.error = null; toast(t('admin.saved'), 'success');
    } else if (e.target.id === 'cat-form') {
      const name = String(fd.get('name')).trim();
      if (name.length < 2) { st.error = t('admin.cat.err_name'); render(); focusId('k-name'); return; }
      const { imageValue, ...c } = st.editingCat;
      await api.adminUpsertCategory({ ...c, name, slug: String(fd.get('slug')).trim() || slugify(name), description: String(fd.get('description')).trim(),
        image: c.image ? (imageValue || c.image) : null, is_featured: fd.has('is_featured'), is_active: fd.has('is_active') });
      st.editingCat = null; st.error = null; toast(t('admin.cat.saved'), 'success');
    } else if (e.target.id === 'coupon-form') {
      const code = String(fd.get('code')).trim().toUpperCase();
      const percent = parseInt(fd.get('percent'), 10);
      if (!code || !(percent > 0 && percent <= 100)) { st.error = t('admin.err_validation'); render(); return; }
      const { _new, ...rest } = st.editingCoupon;
      await api.adminUpsertCoupon({ ...rest, code, percent, min_subtotal: parseFloat(fd.get('min_subtotal')) || 0, is_active: fd.has('is_active'), active: fd.has('is_active') });
      st.editingCoupon = null; st.error = null; toast(t('admin.saved'), 'success');
    } else return;
  } catch (err) {
    st.error = err.message || t('admin.err_save'); render(); return;
  }
  await refresh();
});

(async function init() {
  render0();
  try { st.user = await api.getUser(); } catch { st.user = null; }
  if (st.user?.is_admin) { await refresh(); } else render();
  if (typeof layout.pageReady === 'function') layout.pageReady();
  try { api.onAuthChange(async (u) => { st.user = u || null; if (u?.is_admin) await refresh(); else render(); }); } catch {}
})();
function render0() { root.innerHTML = ''; }
