// 3D viewer for the product gallery.
//  - media item with a GLB url  -> <model-viewer> (lazy loaded from the CDN, only when needed)
//  - fallback 'tilt' / no url    -> on-device pseudo-3D tilt card (CSS 3D + shine) built from the cover photo
// Respects prefers-reduced-motion (no auto-rotate, no idle sway, no transitions).
import { t } from './i18n.js';

const MODEL_VIEWER_SRC = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
let loader = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function loadModelViewer(timeoutMs = 15000) {
  if (typeof customElements !== 'undefined' && customElements.get('model-viewer')) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.type = 'module'; s.src = MODEL_VIEWER_SRC; s.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    s.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
    s.onload = () => customElements.whenDefined('model-viewer').then(() => { clearTimeout(timer); resolve(); }, reject);
    document.head.appendChild(s);
  }).catch((e) => { loader = null; throw e; });
  return loader;
}

export function hasGlb(item) { return !!(item && item.url && item.fallback !== 'tilt'); }

// Label shown on the viewer so people know what they are looking at.
export function viewerLabel(item) {
  if (!hasGlb(item)) return t('viewer3d.label_tilt');
  return t(item.source === 'generated' ? 'viewer3d.label_ai' : 'viewer3d.label_own');
}

function tiltHTML(poster, name) {
  const img = poster
    ? `<img src="${esc(poster)}" alt="" draggable="false" decoding="async">`
    : `<div class="v3d-ph" aria-hidden="true"></div>`;
  return `<div class="v3d-tilt" tabindex="0" role="group" aria-label="${esc(t('viewer3d.aria', { name }))}" aria-describedby="v3d-hint">
    <div class="v3d-card">${img}<span class="v3d-shine" aria-hidden="true"></span></div>
  </div>`;
}

function mountTilt(stage, poster, name) {
  stage.innerHTML = tiltHTML(poster, name);
  const el = stage.querySelector('.v3d-tilt');
  const card = el.querySelector('.v3d-card');
  const MAX = 18;
  let raf = 0, pending = null;
  const apply = () => {
    raf = 0; if (!pending) return;
    const { rx, ry, sx, sy } = pending;
    card.style.setProperty('--rx', rx.toFixed(2) + 'deg');
    card.style.setProperty('--ry', ry.toFixed(2) + 'deg');
    card.style.setProperty('--sx', sx.toFixed(1) + '%');
    card.style.setProperty('--sy', sy.toFixed(1) + '%');
  };
  const set = (px, py) => { // px,py in 0..1
    pending = { rx: (0.5 - py) * 2 * MAX, ry: (px - 0.5) * 2 * MAX, sx: px * 100, sy: py * 100 };
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const pos = (e) => { const r = el.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  let dragging = false;
  const reset = () => { el.classList.remove('active'); set(0.5, 0.5); };
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') el.classList.add('active'); });
  el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || dragging) set(...pos(e)); });
  el.addEventListener('pointerleave', (e) => { if (!dragging) reset(); });
  el.addEventListener('pointerdown', (e) => { dragging = true; el.classList.add('active'); try { el.setPointerCapture(e.pointerId); } catch {} set(...pos(e)); });
  const end = () => { dragging = false; reset(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  let kx = 0.5, ky = 0.5;
  el.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (e.key === 'Escape' || e.key === 'Home') { kx = ky = 0.5; set(kx, ky); return; }
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    kx = Math.min(1, Math.max(0, kx + d[0])); ky = Math.min(1, Math.max(0, ky + d[1])); el.classList.add('active'); set(kx, ky);
  });
  return () => { if (raf) cancelAnimationFrame(raf); };
}

// container: element to fill. item: media item. opts: {poster, name, onError}
export function mountViewer(container, item, { poster = null, name = '' } = {}) {
  const label = viewerLabel(item);
  container.classList.add('v3d');
  container.innerHTML = `<div class="v3d-stage"></div>
    <span class="v3d-label">${esc(label)}</span>
    <p class="v3d-hint" id="v3d-hint">${esc(t('viewer3d.hint'))}</p>
    <p class="v3d-msg" role="status" hidden></p>`;
  const stage = container.querySelector('.v3d-stage');
  const msg = container.querySelector('.v3d-msg');
  let cleanup = () => {}, dead = false;

  const useTilt = (note) => {
    if (dead) return;
    cleanup(); cleanup = mountTilt(stage, poster, name);
    container.querySelector('.v3d-label').textContent = t('viewer3d.label_tilt');
    if (note) { msg.textContent = note; msg.hidden = false; }
  };

  if (!hasGlb(item)) { useTilt(); return { destroy() { dead = true; cleanup(); container.classList.remove('v3d'); } }; }

  stage.innerHTML = `<div class="v3d-loading" role="status"><span class="v3d-spin" aria-hidden="true"></span>${esc(t('viewer3d.loading'))}</div>`;
  loadModelViewer().then(() => {
    if (dead) return;
    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', item.url);
    mv.setAttribute('alt', t('viewer3d.aria', { name }));
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('touch-action', 'pan-y');
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    mv.setAttribute('shadow-intensity', '1');
    if (poster) mv.setAttribute('poster', poster);
    if (!reducedMotion()) mv.setAttribute('auto-rotate', '');
    mv.className = 'v3d-mv';
    const ar = document.createElement('button');
    ar.slot = 'ar-button'; ar.type = 'button'; ar.className = 'btn btn-outline v3d-ar'; ar.textContent = t('viewer3d.ar');
    mv.appendChild(ar);
    mv.addEventListener('error', () => useTilt(t('viewer3d.error')));
    mv.addEventListener('load', () => { stage.querySelector('.v3d-loading')?.remove(); });
    stage.innerHTML = ''; stage.appendChild(mv);
    // a model-viewer that never reports load still shows its poster; drop the spinner after a while
    cleanup = () => { try { mv.remove(); } catch {} };
  }).catch(() => useTilt(t('viewer3d.error')));

  return { destroy() { dead = true; cleanup(); container.classList.remove('v3d'); } };
}
