import { t } from '../i18n.js';
import { formatMoney, COUPON_DEFAULT } from '../pricing.js';
import { api, setMeta, icon, escapeHtml, productCardHTML, bindProductCards, starsHTML, imageHTML, toast, isWished, toggleWish, ready } from '../layout.js';
import { addItem } from '../cart.js';

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);
const key = params.get('slug') || params.get('id') || '';
const c = COUPON_DEFAULT;

main.innerHTML = `<div class="container"><div class="pdp"><div class="gallery"><div class="gal-main skeleton"></div></div><div class="pdp-info"><div class="skeleton sk-line" style="height:36px;width:70%"></div><div class="skeleton sk-line" style="width:30%"></div><div class="skeleton sk-line" style="height:90px;margin-top:24px"></div></div></div></div>`;

function notFound() {
  setMeta({ title: t('product.not_found'), description: t('product.not_found_text') });
  main.innerHTML = `<div class="container"><div class="state"><span class="state-ic">${icon('search')}</span><h1 style="font-size:1.6rem">${escapeHtml(t('product.not_found'))}</h1><p>${escapeHtml(t('product.not_found_text'))}</p><a class="btn btn-primary" href="shop.html">${escapeHtml(t('nav.all_products'))}</a></div></div>`;
}

async function init() {
  let p;
  try { p = key ? await api.getProduct(key) : null; } catch { p = null; }
  if (!p) return notFound();
  await ready();
  const imgs = (p.images && p.images.length ? p.images : p.image ? [p.image] : []);
  const out = p.stock <= 0, low = p.stock > 0 && p.stock <= 5;
  const disc = p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
  setMeta({ title: p.name, description: (p.description || '').slice(0, 160), image: p.image || undefined, type: 'product' });
  let qty = 1;

  main.innerHTML = `<div class="container">
  <nav aria-label="${escapeHtml(t('product.breadcrumb'))}"><ol class="crumbs"><li><a href="index.html">${escapeHtml(t('nav.home'))}</a></li><li><a href="shop.html">${escapeHtml(t('nav.shop'))}</a></li><li aria-current="page">${escapeHtml(p.name)}</li></ol></nav>
  <div class="pdp">
    <div class="gallery" role="group" aria-label="${escapeHtml(t('product.gallery'))}">
      <div class="gal-main" id="gal-main">${imageHTML({ image: imgs[0] || null, name: p.name }, { eager: true })}</div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((s, i) => `<button type="button" class="thumb" data-i="${i}" aria-current="${i === 0}" aria-label="${escapeHtml(t('product.image_n', { n: i + 1 }))}"><img src="${escapeHtml(s)}" alt=""></button>`).join('')}</div>` : ''}
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

  // gallery
  main.querySelectorAll('.thumb').forEach(b => b.addEventListener('click', () => {
    main.querySelectorAll('.thumb').forEach(x => x.setAttribute('aria-current', 'false')); b.setAttribute('aria-current', 'true');
    document.getElementById('gal-main').innerHTML = imageHTML({ image: imgs[+b.dataset.i], name: p.name }, { eager: true });
  }));
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
init();
