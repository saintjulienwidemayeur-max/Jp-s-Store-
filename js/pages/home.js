import { t, getLang } from '../i18n.js';
import { COUPON_DEFAULT } from '../pricing.js';
import { api, setMeta, icon, escapeHtml, productCardHTML, bindProductCards, toast, imageHTML, IG_URL, LOGO, ready, pageReady } from '../layout.js';
import { getCategories, listFeatured, listNewest, FANZONE } from '../catalog.js';

const main = document.getElementById('main');
const c = COUPON_DEFAULT;

setMeta({ title: null, description: t('home.desc') });
document.title = t('home.title');

// ---- hero slides: JPS_CONFIG.HOME_SLIDES = [{kind:'brand'|'offer'|'collection', category?, eyebrow?, title?, text?, cta?, href?, image?, enabled?}]
// Text fields may be a string or {en, fr, ht}. Default: brand promise, HT26 offer, Fan Zone collection.
const DEFAULT_SLIDES = [{ kind: 'brand' }, { kind: 'offer' }, { kind: 'collection', category: FANZONE }];
const pick = (v) => (v && typeof v === 'object' ? (v[getLang()] ?? v.en ?? '') : (v ?? ''));
const safeHref = (h, d) => (typeof h === 'string' && /^(?:[\w./?=&%#-]+|https?:\/\/\S+)$/.test(h) && !/^(javascript|data):/i.test(h) ? h : d);

function slideModel(s, i, catMap) {
  const k = s.kind || s.type || 'brand';
  if (s.enabled === false) return null;
  if (k === 'collection') {
    const cat = catMap.get(s.category || FANZONE);
    if (!cat) return null;
    const fz = cat.slug === FANZONE;
    return { kind: fz ? 'fanzone' : 'coll', cat,
      eyebrow: pick(s.eyebrow) || (fz ? t('fanzone.eyebrow') : t('slide.coll.eyebrow')),
      title: pick(s.title) || (fz ? t('fanzone.title') : cat.name),
      text: pick(s.text) || (fz ? t('fanzone.sub') : (cat.description || '')),
      cta: pick(s.cta) || (fz ? t('fanzone.cta') : t('slide.coll.cta')),
      href: safeHref(s.href, `shop.html?category=${encodeURIComponent(cat.slug)}`), image: s.image || cat.image || null };
  }
  if (k === 'offer') return { kind: 'offer', eyebrow: pick(s.eyebrow) || t('slide.offer.eyebrow'), title: pick(s.title) || t('slide.offer.title', { pct: c.percent, code: c.code }),
    text: pick(s.text) || t('slide.offer.text', { code: c.code, min: c.min_subtotal }), cta: pick(s.cta) || t('slide.offer.cta'), href: safeHref(s.href, 'shop.html') };
  return { kind: 'brand', eyebrow: pick(s.eyebrow) || t('slide.brand.eyebrow'), title: pick(s.title) || t('slide.brand.title'), text: pick(s.text) || t('slide.brand.text'),
    cta: pick(s.cta) || t('slide.brand.cta'), href: safeHref(s.href, 'shop.html'), cta2: t('slide.brand.cta2') };
}

function artHTML(m) {
  if (m.kind === 'fanzone') return `<div class="hero-art" role="img" aria-label="${escapeHtml(t('fanzone.alt'))}"><figure><img src="assets/img/headband.jpg" alt=""></figure><figure><img src="assets/img/scarf.jpg" alt=""></figure><figure><img src="assets/img/thunder-stick.jpg" alt=""></figure></div>`;
  if (m.kind === 'offer') return `<div class="hero-art hero-art-offer" aria-hidden="true"><div class="offer-badge"><span>${escapeHtml(t('slide.offer.off', { pct: c.percent }))}</span><code>${escapeHtml(c.code)}</code></div></div>`;
  if (m.kind === 'coll') return `<div class="hero-art hero-art-coll" aria-hidden="true"><div class="coll-tile">${imageHTML({ image: m.image, name: m.cat.name }, { eager: true })}</div></div>`;
  return `<div class="hero-art hero-art-brand" aria-hidden="true"><div class="brand-card"><img src="${LOGO}" alt="" width="200" height="97"></div>
    <ul class="pills"><li>${icon('truck')}${escapeHtml(t('slide.pill.delivery'))}</li><li>${icon('shield')}${escapeHtml(t('slide.pill.secure'))}</li><li>${icon('tag')}${escapeHtml(t('slide.pill.ship'))}</li></ul></div>`;
}
function slideHTML(m, i, total) {
  const H = i === 0 ? 'h1' : 'h2';
  return `<div class="hero-in hslide v-${m.kind}${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${escapeHtml(t('carousel.slide', { n: i + 1, total }))}" data-i="${i}" ${i === 0 ? '' : 'aria-hidden="true" inert'}>
    <span class="hero-frame" aria-hidden="true"></span>
    <div class="hero-copy">
      <span class="hero-eyebrow">${escapeHtml(m.eyebrow)}</span>
      <${H} class="hero-t">${escapeHtml(m.title)}</${H}>
      ${m.text ? `<p class="sub">${escapeHtml(m.text)}</p>` : ''}
      <div class="hero-cta">
        <a class="btn btn-red" href="${escapeHtml(m.href)}">${escapeHtml(m.cta)}</a>
        ${m.cta2 ? `<a class="btn btn-outline" href="#cats-t" data-scroll="cats">${escapeHtml(m.cta2)}</a>` : ''}
      </div>
      <div class="hero-stripe" aria-hidden="true"></div>
    </div>
    ${artHTML(m)}
  </div>`;
}

function setupCarousel(root) {
  const slides = [...root.querySelectorAll('.hslide')];
  if (slides.length < 2) return;
  const dots = [...root.querySelectorAll('.hero-dot')];
  const live = root.querySelector('.hero-slides');
  const pauseBtn = root.querySelector('[data-pause]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = 0, timer = null, userPaused = reduce, hovering = false;
  const go = (n, focus) => {
    cur = (n + slides.length) % slides.length;
    slides.forEach((s, i) => {
      const on = i === cur;
      s.classList.toggle('is-active', on);
      s.toggleAttribute('inert', !on);
      on ? s.removeAttribute('aria-hidden') : s.setAttribute('aria-hidden', 'true');
    });
    dots.forEach((d, i) => { d.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    if (focus) dots[cur] && dots[cur].focus();
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => { stop(); if (!userPaused && !hovering) timer = setInterval(() => go(cur + 1), 6500); live.setAttribute('aria-live', timer ? 'off' : 'polite'); };
  const syncPause = () => {
    pauseBtn.setAttribute('aria-label', t(userPaused ? 'carousel.play' : 'carousel.pause'));
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.classList.toggle('is-paused', userPaused);
  };
  root.querySelector('[data-prev]').addEventListener('click', () => { go(cur - 1); start(); });
  root.querySelector('[data-next]').addEventListener('click', () => { go(cur + 1); start(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));
  pauseBtn.addEventListener('click', () => { userPaused = !userPaused; syncPause(); start(); });
  root.addEventListener('mouseenter', () => { hovering = true; start(); });
  root.addEventListener('mouseleave', () => { hovering = false; start(); });
  root.addEventListener('focusin', () => { hovering = true; start(); });
  root.addEventListener('focusout', () => { hovering = false; start(); });
  root.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { go(cur - 1, true); start(); } else if (e.key === 'ArrowRight') { go(cur + 1, true); start(); } });
  let x0 = null;
  live.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  live.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) { go(dx < 0 ? cur + 1 : cur - 1); start(); } });
  live.addEventListener('pointercancel', () => { x0 = null; });
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  syncPause(); start();
}

function carouselHTML(models) {
  const n = models.length;
  const ctrl = n < 2 ? '' : `<div class="hero-ctrl">
    <button type="button" class="hero-btn" data-prev aria-label="${escapeHtml(t('carousel.prev'))}">${icon('chevron', 'flip')}</button>
    <div class="hero-dots" role="group" aria-label="${escapeHtml(t('carousel.label'))}">${models.map((m, i) => `<button type="button" class="hero-dot" aria-label="${escapeHtml(t('carousel.go', { n: i + 1 }))}" aria-current="${i === 0}"></button>`).join('')}</div>
    <button type="button" class="hero-btn" data-next aria-label="${escapeHtml(t('carousel.next'))}">${icon('chevron')}</button>
    <button type="button" class="hero-btn hero-pause" data-pause aria-pressed="false"><svg class="ic i-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg><svg class="ic i-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
  </div>`;
  return `<section class="hero hero-carousel" aria-roledescription="carousel" aria-label="${escapeHtml(t('carousel.label'))}">
    <div class="hero-wrap"><div class="hero-slides" aria-live="off">${models.map((m, i) => slideHTML(m, i, n)).join('')}</div>${ctrl}</div>
  </section>`;
}

function catSection(cats) {
  if (!cats.length) return '';
  return `<section class="section container" id="cats" aria-labelledby="cats-t">
  <div class="section-head"><h2 class="section-title" id="cats-t">${escapeHtml(t('home.categories'))}</h2><a class="link-more" href="shop.html">${escapeHtml(t('common.view_all'))}${icon('chevron')}</a></div>
  <div class="cat-grid">${cats.map(k => `<a class="cat-card" href="shop.html?category=${encodeURIComponent(k.slug)}"><span class="cat-img">${imageHTML({ image: k.image, name: k.name })}</span><span>${escapeHtml(k.name)}</span></a>`).join('')}</div>
</section>`;
}
function productSection(id, titleKey, items, withMore) {
  if (!items.length) return '';
  return `<section class="section container" id="${id}-sec" aria-labelledby="${id}-t" style="padding-top:8px">
  <div class="section-head"><h2 class="section-title" id="${id}-t">${escapeHtml(t(titleKey))}</h2>${withMore ? `<a class="link-more" href="shop.html">${escapeHtml(t('common.view_all'))}${icon('chevron')}</a>` : ''}</div>
  <div class="grid grid-products" id="${id}">${items.map(productCardHTML).join('')}</div>
</section>`;
}
function fanzoneBanner(cat) {
  if (!cat) return '';
  return `<section class="container" id="fanzone" aria-labelledby="fz-t"><div class="fz-banner">
    <div class="fz-copy"><span class="hero-eyebrow">${escapeHtml(t('fanzone.eyebrow'))}</span><h2 id="fz-t" class="fz-title">${escapeHtml(t('fanzone.title'))}</h2><p>${escapeHtml(t('fanzone.sub'))}</p>
      <a class="btn btn-red" href="shop.html?category=${encodeURIComponent(cat.slug)}">${escapeHtml(t('fanzone.cta'))}</a></div>
    <div class="fz-art" role="img" aria-label="${escapeHtml(t('fanzone.alt'))}"><figure><img src="assets/img/headband.jpg" alt="" loading="lazy"></figure><figure><img src="assets/img/scarf.jpg" alt="" loading="lazy"></figure><figure><img src="assets/img/thunder-stick.jpg" alt="" loading="lazy"></figure></div>
  </div></section>`;
}

async function render() {
  const [allR, featCatR, featR, newR] = await Promise.allSettled([getCategories(), getCategories({ featured: true }), listFeatured(8), listNewest(8), ready()]);
  const all = allR.status === 'fulfilled' ? allR.value : [];
  const catMap = new Map(all.map(k => [k.slug, k]));
  let featCats = featCatR.status === 'fulfilled' ? featCatR.value : [];
  if (!featCats.length) featCats = all.filter(k => !k.parent_id).slice(0, 8);
  const featured = featR.status === 'fulfilled' ? featR.value : [];
  const featIds = new Set(featured.map(p => p.id));
  const newest = newR.status === 'fulfilled' ? newR.value.filter(p => !featIds.has(p.id)).slice(0, 4) : [];
  const cfg = window.JPS_CONFIG && Array.isArray(window.JPS_CONFIG.HOME_SLIDES) && window.JPS_CONFIG.HOME_SLIDES.length ? window.JPS_CONFIG.HOME_SLIDES : DEFAULT_SLIDES;
  let models = cfg.map((s, i) => slideModel(s || {}, i, catMap)).filter(Boolean).slice(0, 3);
  if (!models.length) models = [slideModel({ kind: 'brand' }, 0, catMap)];

  const productsFailed = featR.status === 'rejected';
  main.innerHTML = `${carouselHTML(models)}
${catSection(featCats)}
${productsFailed ? `<section class="section container"><div class="state"><p>${escapeHtml(t('common.error'))}</p><button class="btn btn-outline" id="home-retry" type="button">${escapeHtml(t('common.retry'))}</button></div></section>`
    : featured.length ? productSection('featured', 'home.featured', featured, true)
    : `<section class="section container"><div class="state"><span class="state-ic">${icon('bag')}</span><p>${escapeHtml(t('home.empty'))}</p></div></section>`}
${productSection('newest', 'home.new', newest, false)}
${fanzoneBanner(catMap.get(FANZONE))}
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
  <div class="vp-grid">${[['tag', 1], ['truck', 2], ['shield', 3], ['headset', 4]].map(([ic, n]) => `<div class="vp"><span class="vp-ic">${icon(ic)}</span><h3>${escapeHtml(t(`home.vp.${n}.t`))}</h3><p>${escapeHtml(t(`home.vp.${n}.d`))}</p></div>`).join('')}</div>
</section>
<section class="container"><div class="ig-cta">${icon('insta')}<div class="grow"><h2>${escapeHtml(t('home.ig.title'))}</h2><p>${escapeHtml(t('home.ig.text'))}</p></div><a class="btn btn-white" href="${IG_URL}" target="_blank" rel="noopener">${escapeHtml(t('home.ig.cta'))}</a></div></section>`;

  bindProductCards(main);
  setupCarousel(main.querySelector('.hero-carousel'));
  main.querySelectorAll('[data-scroll]').forEach(a => a.addEventListener('click', e => {
    const tgt = document.getElementById(a.dataset.scroll) || document.getElementById('offer');
    if (tgt) { e.preventDefault(); tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }));
  const retry = document.getElementById('home-retry'); if (retry) retry.onclick = () => location.reload();
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
}

render().catch((e) => {
  main.innerHTML = `<div class="container"><div class="state"><h1>${escapeHtml(t('common.error'))}</h1><button class="btn btn-outline" id="home-retry" type="button">${escapeHtml(t('common.retry'))}</button></div></div>`;
  document.getElementById('home-retry').onclick = () => location.reload();
  console.warn('home render failed', e);
}).finally(pageReady);
