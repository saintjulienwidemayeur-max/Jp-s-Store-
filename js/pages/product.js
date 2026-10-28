import { t } from '../i18n.js';
import { formatMoney, COUPON_DEFAULT } from '../pricing.js';
import { api, setMeta, icon, escapeHtml, productCardHTML, bindProductCards, starsHTML, imageHTML, toast, isWished, toggleWish, ready, pageReady } from '../layout.js';
import { addItem } from '../cart.js';
import '../i18n.media.js';
import { mountViewer } from '../viewer3d.js';

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);
const key = params.get('slug') || params.get('id') || '';
const c = COUPON_DEFAULT;

main.innerHTML = `<div class="container"><div class="pdp"><div class="gallery"><div class="gal-main skeleton"></div></div><div class="pdp-info"><div class="skeleton sk-line" style="height:36px;width:70%"></div><div class="skeleton sk-line" style="width:30%"></div><div class="skeleton sk-line" style="height:90px;margin-top:24px"></div></div></div></div>`;

function notFound() {
  setMeta({ title: t('product.not_found'), description: t('product.not_found_text') });
  main.innerHTML = `<div class="container"><div class="state"><span class="state-ic">${icon('search')}</span><h1 style="font-size:1.6rem">${escapeHtml(t('product.not_found'))}</h1><p>${escapeHtml(t('product.not_found_text'))}</p><a class="btn btn-primary" href="shop.html">${escapeHtml(t('nav.all_products'))}</a></div></div>`;
}

// ---------- media gallery ----------
function buildItems(p) {
  const legacy = (p.images && p.images.length ? p.images : p.image ? [p.image] : []);
  let media = Array.isArray(p.media) && p.media.length ? p.media.slice()
    : legacy.map((url, i) => ({ id: 'legacy-' + i, type: 'image', url, alt: '', sort: i, is_cover: i === 0, source: 'upload' }));
  media = media.filter(m => m && (m.type !== 'model3d' || !m.status || m.status === 'ready') && (m.url || m.type === 'model3d'));
  media = media.map((m, i) => ({ m, i })).sort((a, b) => ((a.m.sort ?? a.i) - (b.m.sort ?? b.i)) || a.i - b.i).map(x => x.m);
  const ci = media.findIndex(m => m.is_cover && m.type === 'image');
  if (ci > 0) media.unshift(media.splice(ci, 1)[0]);
  return media;
}
const altOf = (m, p) => (m.alt && String(m.alt).trim()) || p.name;
function thumbHTML(m, i, p) {
  const n = i + 1;
  if (m.type === 'video') {
    const lbl = t('product.media.thumb_video', { n });
    return `<button type="button" class="thumb thumb-video" data-i="${i}" aria-current="${i === 0}" aria-label="${escapeHtml(lbl)}">${m.poster ? `<img src="${escapeHtml(m.poster)}" alt="" loading="lazy">` : ''}<span class="thumb-ic" aria-hidden="true">${icon('chevron')}</span></button>`;
  }
  if (m.type === 'model3d') return `<button type="button" class="thumb thumb-3d" data-i="${i}" aria-current="${i === 0}" aria-label="${escapeHtml(t('product.media.thumb_3d'))}"><span aria-hidden="true">${escapeHtml(t('product.media.tab3d'))}</span></button>`;
  return `<button type="button" class="thumb" data-i="${i}" aria-current="${i === 0}" aria-label="${escapeHtml(t('product.media.thumb_image', { n, alt: altOf(m, p) }))}"><img src="${escapeHtml(m.url)}" alt="" loading="lazy"></button>`;
}

function initGallery(p, items) {
  const stage = document.getElementById('gal-main');
  const status = document.getElementById('gal-status');
  const thumbs = [...main.querySelectorAll('.thumb')];
  const poster = (items.find(m => m.type === 'image') || {}).url || p.image || null;
  let cur = -1, viewer = null;

  const stop = () => { if (viewer) { viewer.destroy(); viewer = null; } stage.querySelectorAll('video').forEach(v => { try { v.pause(); } catch {} }); };
  function show(i, { focus = false } = {}) {
    if (!items.length) { stage.innerHTML = imageHTML({ image: null, name: p.name }, { eager: true }); return; }
    i = (i + items.length) % items.length;
    if (i === cur) return;
    stop(); cur = i;
    const m = items[i];
    const nav = items.length > 1 ? `<button type="button" class="gal-nav gal-prev" aria-label="${escapeHtml(t('product.media.prev'))}">${icon('chevron')}</button><button type="button" class="gal-nav gal-next" aria-label="${escapeHtml(t('product.media.next'))}">${icon('chevron')}</button><span class="gal-count" aria-hidden="true">${escapeHtml(t('product.media.counter', { i: i + 1, n: items.length }))}</span>` : '';
    stage.dataset.type = m.type;
    if (m.type === 'video') {
      stage.innerHTML = `<video controls playsinline preload="metadata" ${m.poster ? `poster="${escapeHtml(m.poster)}"` : ''} src="${escapeHtml(m.url)}" aria-label="${escapeHtml(altOf(m, p))}"></video>${nav}`;
    } else if (m.type === 'model3d') {
      stage.innerHTML = `<div class="gal-3d"></div>${nav}`;
      viewer = mountViewer(stage.querySelector('.gal-3d'), m, { poster, name: p.name });
    } else {
      stage.innerHTML = `<button type="button" class="gal-zoom" aria-haspopup="dialog" aria-label="${escapeHtml(t('product.media.zoom'))}"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(altOf(m, p))}" decoding="async"></button>${nav}`;
    }
    thumbs.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
    const tb = thumbs[i]; if (tb && tb.scrollIntoView) { try { tb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); } catch {} }
    status.textContent = t('product.media.counter', { i: i + 1, n: items.length }) + ' — ' + (m.type === 'model3d' ? t('product.media.thumb_3d') : altOf(m, p));
    if (focus) stage.querySelector('.gal-zoom, video, .v3d-tilt')?.focus?.();
  }
  show(0);

  thumbs.forEach(b => {
    b.addEventListener('click', () => show(+b.dataset.i));
    b.addEventListener('keydown', e => {
      const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!k) return; e.preventDefault();
      const n = (thumbs.indexOf(b) + k + thumbs.length) % thumbs.length; thumbs[n].focus(); show(n);
    });
  });
  stage.addEventListener('click', e => {
    if (e.target.closest('.gal-prev')) return show(cur - 1);
    if (e.target.closest('.gal-next')) return show(cur + 1);
    if (e.target.closest('.gal-zoom')) openLightbox(p, items, cur);
  });
  stage.addEventListener('keydown', e => {
    if (e.target.closest('video, model-viewer, .v3d-tilt')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
  });
  // swipe (images and videos' poster area only; never over the 3D viewer or video controls)
  let sx = 0, sy = 0, tracking = false;
  stage.addEventListener('touchstart', e => {
    tracking = items.length > 1 && !e.target.closest('video, model-viewer, .v3d-tilt, .gal-nav') && e.touches.length === 1;
    if (tracking) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) { stage._swiped = Date.now(); show(cur + (dx < 0 ? 1 : -1)); }
  }, { passive: true });
  stage.addEventListener('click', e => { if (stage._swiped && Date.now() - stage._swiped < 400) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

// ---------- lightbox (native <dialog>: focus trap + Esc for free) ----------
function openLightbox(p, items, startAt) {
  const imgsIdx = items.map((m, i) => (m.type === 'image' ? i : -1)).filter(i => i >= 0);
  if (!imgsIdx.length) return;
  let pos = Math.max(0, imgsIdx.indexOf(startAt));
  const opener = document.activeElement;
  const dlg = document.createElement('dialog');
  dlg.className = 'lb';
  dlg.setAttribute('aria-label', t('product.lb.label'));
  dlg.innerHTML = `<div class="lb-bar"><span class="lb-count" aria-live="polite"></span>
      <button type="button" class="lb-btn" data-lb="zoom" aria-pressed="false" aria-label="${escapeHtml(t('product.lb.zoom_in'))}">${icon('plus')}</button>
      <button type="button" class="lb-btn" data-lb="close" aria-label="${escapeHtml(t('product.lb.close'))}">${icon('close')}</button></div>
    <div class="lb-stage" tabindex="0"><img alt="" draggable="false"></div>
    ${imgsIdx.length > 1 ? `<button type="button" class="lb-btn lb-prev" data-lb="prev" aria-label="${escapeHtml(t('product.media.prev'))}">${icon('chevron')}</button><button type="button" class="lb-btn lb-next" data-lb="next" aria-label="${escapeHtml(t('product.media.next'))}">${icon('chevron')}</button>` : ''}`;
  document.body.appendChild(dlg);
  const img = dlg.querySelector('img'), zb = dlg.querySelector('[data-lb=zoom]'), stageEl = dlg.querySelector('.lb-stage');
  const setZoom = on => {
    dlg.classList.toggle('zoomed', on); zb.setAttribute('aria-pressed', String(on));
    zb.setAttribute('aria-label', t(on ? 'product.lb.zoom_out' : 'product.lb.zoom_in'));
    zb.innerHTML = icon(on ? 'minus' : 'plus');
    if (!on) { stageEl.scrollLeft = 0; stageEl.scrollTop = 0; }
  };
  const draw = () => {
    const m = items[imgsIdx[pos]];
    img.src = m.url; img.alt = altOf(m, p);
    dlg.querySelector('.lb-count').textContent = t('product.media.counter', { i: pos + 1, n: imgsIdx.length });
    setZoom(false);
  };
  const step = d => { pos = (pos + d + imgsIdx.length) % imgsIdx.length; draw(); };
  dlg.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]');
    if (b) { const a = b.dataset.lb; if (a === 'close') dlg.close(); else if (a === 'prev') step(-1); else if (a === 'next') step(1); else if (a === 'zoom') setZoom(!dlg.classList.contains('zoomed')); return; }
    if (e.target === img) setZoom(!dlg.classList.contains('zoomed'));
    else if (e.target === dlg || e.target === stageEl) dlg.close();
  });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' && imgsIdx.length > 1 && !dlg.classList.contains('zoomed')) step(1);
    else if (e.key === 'ArrowLeft' && imgsIdx.length > 1 && !dlg.classList.contains('zoomed')) step(-1);
    else if ((e.key === '+' || e.key === '=') ) setZoom(true); else if (e.key === '-') setZoom(false);
  });
  dlg.addEventListener('close', () => { dlg.remove(); document.body.classList.remove('no-scroll'); try { opener && opener.focus(); } catch {} });
  draw();
  document.body.classList.add('no-scroll');
  dlg.showModal();
}

async function init() {
  let p;
  try { p = key ? await api.getProduct(key) : null; } catch { p = null; }
  if (!p) return notFound();
  await ready();
  const items = buildItems(p);
  const imgs = (p.images && p.images.length ? p.images : p.image ? [p.image] : []);
  const out = p.stock <= 0, low = p.stock > 0 && p.stock <= 5;
  const disc = p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
  setMeta({ title: p.name, description: (p.description || '').slice(0, 160), image: p.image || undefined, type: 'product' });
  let qty = 1;

  main.innerHTML = `<div class="container">
  <nav aria-label="${escapeHtml(t('product.breadcrumb'))}"><ol class="crumbs"><li><a href="index.html">${escapeHtml(t('nav.home'))}</a></li><li><a href="shop.html">${escapeHtml(t('nav.shop'))}</a></li><li aria-current="page">${escapeHtml(p.name)}</li></ol></nav>
  <div class="pdp">
    <div class="gallery" role="group" aria-label="${escapeHtml(t('product.gallery'))}">
      <div class="gal-main" id="gal-main"></div>
      <p class="sr-only" id="gal-status" role="status" aria-live="polite"></p>
      ${items.length > 1 ? `<div class="thumbs" id="thumbs">${items.map((m, i) => thumbHTML(m, i, p)).join('')}</div>` : ''}
    </div>
    <div class="pdp-info">
      <h1>${escapeHtml(p.name)}</h1>
      <div class="pdp-rate">${starsHTML(p.rating)}<span>${escapeHtml(t('product.reviews_count', { n: p.review_count || 0 }))}</span></div>
      <div class="pdp-price"><span class="now">${formatMoney(p.price)}</span>${disc ? `<s>${formatMoney(p.compare_at_price)}</s><span class="save">${escapeHtml(t('product.save', { pct: disc }))}</span>` : ''}</div>
      <p class="stock ${out ? 'out' : low ? 'low' : ''}">${escapeHtml(out ? t('product.out_of_stock') : low ? t('product.low_stock', { n: p.stock }) : t('product.in_stock'))}</p>
      <div class="buy">
        <div class="qty" role="group" aria-label="${escapeHtml(t('product.qty'))}">
          <button type="button" id="q-dec" aria-label="${escapeHtml(t('product.qty_dec'))}">${icon('minus')}</button>
          <output id="q-val" aria-live="polite">1</output>
          <button type="button" id="q-inc" aria-label="${escapeHtml(t('product.qty_inc'))}">${icon('plus')}</button>
        </div>
        <button type="button" class="btn btn-primary" id="add" ${out ? 'disabled' : ''}>${icon('cart')} ${escapeHtml(out ? t('common.sold_out') : t('common.add_to_cart'))}</button>
        <button type="button" class="wish ${isWished(p.id) ? 'on' : ''}" data-wish="${escapeHtml(p.id)}" aria-pressed="${isWished(p.id)}" aria-label="${escapeHtml(t('common.wishlist_add'))}">${icon('heart')}</button>
      </div>
      <div class="note-box">
        <div>${icon('truck')}<span><b>${escapeHtml(t('product.free_ship'))}</b></span></div>
        <div>${icon('tag')}<span>${escapeHtml(t('product.code_note', { code: c.code, pct: c.percent, min: c.min_subtotal }))}</span></div>
      </div>
    </div>
  </div>
  <div class="tabs">
    <div class="tablist" role="tablist" aria-label="${escapeHtml(p.name)}">
      <button class="tab" role="tab" id="t-desc" aria-controls="p-desc" aria-selected="true">${escapeHtml(t('product.tab.desc'))}</button>
      <button class="tab" role="tab" id="t-ship" aria-controls="p-ship" aria-selected="false" tabindex="-1">${escapeHtml(t('product.tab.ship'))}</button>
      <button class="tab" role="tab" id="t-rev" aria-controls="p-rev" aria-selected="false" tabindex="-1">${escapeHtml(t('product.tab.reviews', { n: p.review_count || 0 }))}</button>
    </div>
    <div class="tabpanel" role="tabpanel" id="p-desc" aria-labelledby="t-desc" tabindex="0"><p>${escapeHtml(p.description || '')}</p></div>
    <div class="tabpanel" role="tabpanel" id="p-ship" aria-labelledby="t-ship" tabindex="0" hidden><p>${escapeHtml(t('product.ship_text'))}</p></div>
    <div class="tabpanel" role="tabpanel" id="p-rev" aria-labelledby="t-rev" tabindex="0" hidden><div id="reviews">${escapeHtml(t('common.loading'))}</div></div>
  </div>
  <section class="section" id="related-sec" aria-labelledby="rel-t" hidden style="padding-bottom:16px"><h2 class="section-title" id="rel-t" style="margin-bottom:20px">${escapeHtml(t('product.related'))}</h2><div class="grid grid-products" id="related"></div></section>
</div>`;

  initGallery(p, items);
  // qty
  const max = out ? 0 : Math.min(p.stock || 99, 99), val = document.getElementById('q-val'), dec = document.getElementById('q-dec'), inc = document.getElementById('q-inc');
  const upd = () => { val.textContent = qty; dec.disabled = qty <= 1; inc.disabled = qty >= max; };
  dec.onclick = () => { qty = Math.max(1, qty - 1); upd(); };
  inc.onclick = () => { qty = Math.min(max, qty + 1); upd(); };
  upd();
  document.getElementById('add').onclick = () => {
    addItem(p, qty); toast(t('common.added') + (qty > 1 ? ` (×${qty})` : ''), 'success');
  };
  // wishlist state label
  const wb = main.querySelector('.wish');
  const syncW = () => { const on = isWished(p.id); wb.classList.toggle('on', on); wb.setAttribute('aria-label', t(on ? 'common.wishlist_remove' : 'common.wishlist_add')); };
  syncW();
  window.addEventListener('jps:wishlist', syncW);
  // tabs
  const tabs = [...main.querySelectorAll('.tab')];
  const select = tab => tabs.forEach(x => {
    const on = x === tab; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
  });
  tabs.forEach((tb, i) => {
    tb.addEventListener('click', () => select(tb));
    tb.addEventListener('keydown', e => {
      const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : -1;
      if (n >= 0) { e.preventDefault(); tabs[n].focus(); select(tabs[n]); }
    });
  });
  if (location.hash === '#reviews') select(tabs[2]);
  loadReviews(p);
  // related
  try {
    const rel = (await api.listProducts({ category: p.category_slug, limit: 5 })).filter(x => x.id !== p.id).slice(0, 4);
    if (rel.length) { document.getElementById('related-sec').hidden = false; const box = document.getElementById('related'); box.innerHTML = rel.map(productCardHTML).join(''); bindProductCards(box); }
  } catch {}
}

async function loadReviews(p) {
  const box = document.getElementById('reviews');
  const draw = async () => {
    let list = [], user = null;
    try { list = await api.listReviews(p.id); } catch {}
    try { user = await api.getUser(); } catch {}
    box.innerHTML = (list.length ? list.map(r => `<div class="review"><div>${starsHTML(r.rating)} <span class="who">${escapeHtml(r.author || r.name || r.user_name || '')}</span>${r.created_at ? `<time datetime="${escapeHtml(r.created_at)}">${new Date(r.created_at).toLocaleDateString()}</time>` : ''}</div><p>${escapeHtml(r.comment || '')}</p></div>`).join('') : `<p>${escapeHtml(t('product.reviews_none'))}</p>`)
      + (user ? `<form class="review-form" id="rf" novalidate><h3>${escapeHtml(t('product.review.write'))}</h3>
        <fieldset class="star-input"><legend>${escapeHtml(t('product.review.rating'))}</legend>${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="rating" value="${n}" ${n === 5 ? 'checked' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.1 6.4 20.1l1.1-6.2L3 9.5l6.2-.9z"/></svg><span class="sr-only">${escapeHtml(t('product.review.stars', { n }))}</span></label>`).join('')}</fieldset>
        <div class="field"><label for="rc">${escapeHtml(t('product.review.comment'))}</label><textarea id="rc" name="comment" required></textarea></div>
        <p class="form-msg err" id="rmsg" hidden></p>
        <button class="btn btn-primary" type="submit">${escapeHtml(t('product.review.submit'))}</button></form>`
        : `<p class="note-box" style="margin-top:20px">${escapeHtml(t('product.review.login'))} <a class="link-more" href="account.html">${escapeHtml(t('product.review.signin'))}</a></p>`);
    const f = document.getElementById('rf');
    if (f) {
      const paint = () => f.querySelectorAll('.star-input label').forEach((l, i) => l.classList.toggle('on', i < +f.rating.value));
      f.addEventListener('change', paint); paint();
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const msg = document.getElementById('rmsg'); msg.hidden = true;
        if (!f.comment.value.trim()) { msg.textContent = t('common.required'); msg.hidden = false; return; }
        try { await api.addReview({ product_id: p.id, rating: +f.rating.value, comment: f.comment.value.trim() }); toast(t('product.review.thanks'), 'success'); draw(); }
        catch (err) { msg.textContent = err.code === 'auth' ? t('product.review.login') : (err.message || t('common.error')); msg.hidden = false; }
      });
    }
  };
  draw();
}
init().finally(pageReady);
