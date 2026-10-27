import { t } from '../i18n.js';
import { COUPON_DEFAULT } from '../pricing.js';
import { api, setMeta, icon, escapeHtml, productCardHTML, bindProductCards, skeletonCards, toast, imageHTML, IG_URL, ready } from '../layout.js';

setMeta({ title: null, description: t('home.desc') });
document.title = t('home.title');
const main = document.getElementById('main');
const c = COUPON_DEFAULT;

const vps = [['tag', 1], ['truck', 2], ['shield', 3], ['headset', 4]];
main.innerHTML = `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-in">
    <span class="hero-frame" aria-hidden="true"></span>
    <div class="hero-copy">
      <span class="hero-eyebrow">${escapeHtml(t('home.hero.eyebrow'))}</span>
      <h1 id="hero-title">${escapeHtml(t('home.hero.title'))}</h1>
      <p class="sub">${escapeHtml(t('home.hero.sub'))}</p>
      <div class="hero-cta">
        <a class="btn btn-red" href="shop.html">${escapeHtml(t('home.hero.cta'))}</a>
        <a class="btn btn-outline" href="#offer" data-scroll>${escapeHtml(t('home.hero.cta2'))}</a>
      </div>
      <div class="hero-stripe" aria-hidden="true"></div>
    </div>
    <div class="hero-art" role="img" aria-label="${escapeHtml(t('home.hero.alt'))}">
      <figure><img src="assets/img/headband.jpg" alt="" fetchpriority="high"></figure>
      <figure><img src="assets/img/scarf.jpg" alt="" fetchpriority="high"></figure>
      <figure><img src="assets/img/thunder-stick.jpg" alt=""></figure>
    </div>
  </div>
</section>

<section class="section container" aria-labelledby="cats-t">
  <div class="section-head"><h2 class="section-title" id="cats-t">${escapeHtml(t('home.categories'))}</h2></div>
  <div class="cat-grid" id="cats"><div class="cat-card"><div class="cat-img skeleton"></div><span class="skeleton sk-line" style="width:60%"></span></div></div>
</section>

<section class="section container" aria-labelledby="pop-t" style="padding-top:8px">
  <div class="section-head"><h2 class="section-title" id="pop-t">${escapeHtml(t('home.popular'))}</h2><a class="link-more" href="shop.html">${escapeHtml(t('common.view_all'))}${icon('chevron')}</a></div>
  <div class="grid grid-products" id="popular" aria-busy="true">${skeletonCards(4)}</div>
</section>

<section class="container" id="offer" aria-labelledby="coupon-t">
  <div class="coupon">
    <div>
      <p class="eyebrow">${escapeHtml(t('home.coupon.eyebrow'))}</p>
      <h2 id="coupon-t">${escapeHtml(t('home.coupon.title', { pct: c.percent }))}</h2>
      <p>${escapeHtml(t('home.coupon.text', { code: c.code, min: c.min_subtotal }))}</p>
    </div>
    <div class="code-box"><code aria-label="${escapeHtml(c.code)}">${escapeHtml(c.code)}</code><button type="button" id="copy-code">${icon('copy')}<span>${escapeHtml(t('common.copy'))}</span></button></div>
  </div>
</section>

<section class="section container" aria-label="${escapeHtml(t('home.vp.1.t'))}">
  <div class="vp-grid">${vps.map(([ic, n]) => `<div class="vp"><span class="vp-ic">${icon(ic)}</span><h3>${escapeHtml(t(`home.vp.${n}.t`))}</h3><p>${escapeHtml(t(`home.vp.${n}.d`))}</p></div>`).join('')}</div>
</section>

<section class="container"><div class="ig-cta">${icon('insta')}<div class="grow"><h2>${escapeHtml(t('home.ig.title'))}</h2><p>${escapeHtml(t('home.ig.text'))}</p></div><a class="btn btn-white" href="${IG_URL}" target="_blank" rel="noopener">${escapeHtml(t('home.ig.cta'))}</a></div></section>`;

document.querySelector('[data-scroll]').addEventListener('click', e => {
  e.preventDefault(); document.getElementById('offer').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.getElementById('copy-code').addEventListener('click', async e => {
  const btn = e.currentTarget;
  try { await navigator.clipboard.writeText(c.code); }
  catch {
    const ta = document.createElement('textarea'); ta.value = c.code; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {} ta.remove();
  }
  toast(t('common.copied'), 'success');
  btn.querySelector('span').textContent = t('common.copied');
  setTimeout(() => { btn.querySelector('span').textContent = t('common.copy'); }, 2000);
});

(async () => {
  const [cats, pops] = await Promise.allSettled([api.listCategories(), api.listProducts({ sort: 'popular', limit: 8 }).then(l => l.filter(p => p.is_popular).length ? l.filter(p => p.is_popular) : l)]);
  const catBox = document.getElementById('cats');
  if (cats.status === 'fulfilled' && cats.value.length) {
    catBox.innerHTML = cats.value.map(k => `<a class="cat-card" href="shop.html?category=${encodeURIComponent(k.slug)}"><span class="cat-img">${imageHTML({ image: k.image, name: k.name })}</span><span>${escapeHtml(k.name)}</span></a>`).join('');
  } else catBox.innerHTML = '';
  const box = document.getElementById('popular');
  box.removeAttribute('aria-busy');
  await ready();
  if (pops.status === 'fulfilled') {
    box.innerHTML = pops.value.slice(0, 8).map(productCardHTML).join('');
    bindProductCards(box);
  } else {
    box.innerHTML = `<div class="state" style="grid-column:1/-1"><p>${escapeHtml(t('common.error'))}</p><button class="btn btn-outline" onclick="location.reload()">${escapeHtml(t('common.retry'))}</button></div>`;
  }
})();
