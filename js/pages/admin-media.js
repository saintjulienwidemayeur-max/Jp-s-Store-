// Admin media manager (photos, videos, 3D) for one product. Used by admin.js.
// Data layer: api.uploadMedia / deleteMedia / reorderMedia / setCover / request3D / list3DJobs (+ listProducts for the media array).
import '../i18n.media.js';
import { t } from '../i18n.js';
import { escapeHtml as E, toast } from '../layout.js';
import * as api from '../api.js';

const LIMITS = { image: 8, video: 50, model3d: 30 }; // MB
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VID_TYPES = ['video/mp4', 'video/webm'];
const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,.glb,model/gltf-binary';

export function classify(file) {
  const name = String(file.name || '').toLowerCase();
  if (IMG_TYPES.includes(file.type)) return 'image';
  if (VID_TYPES.includes(file.type)) return 'video';
  if (name.endsWith('.glb') || file.type === 'model/gltf-binary') return 'model3d';
  return null;
}
export function validateFile(file) {
  const type = classify(file);
  if (!type) return { error: t('admin.media.err_type', { name: file.name }) };
  if (file.size > LIMITS[type] * 1024 * 1024) return { error: t('admin.media.err_size', { name: file.name, max: LIMITS[type] }) };
  return { type };
}
const jobState = (j) => (j ? (j.status === 'succeeded' ? 'ready' : j.status) : null);

export function createMediaManager(el) {
  const S = { id: null, name: '', media: [], jobs: [], queue: [], busy: false, poll: 0, alt: '' };
  let alive = true;

  const sorted = (list) => list.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  async function load() {
    if (!S.id) return;
    const [list, jobs] = await Promise.all([
      api.listProducts({ includeInactive: true }),
      (api.list3DJobs ? api.list3DJobs(S.id) : Promise.resolve([])).catch(() => []),
    ]);
    const p = list.find(x => String(x.id) === String(S.id));
    S.media = sorted((p && p.media) || []);
    S.name = (p && p.name) || S.name;
    S.jobs = jobs || [];
    schedulePoll();
  }
  function schedulePoll() {
    clearTimeout(S.poll);
    if (S.jobs.some(j => j.status === 'queued' || j.status === 'processing')) {
      S.poll = setTimeout(async () => { if (!alive || !el.isConnected || !S.id) return; try { await refresh(); } catch {} }, 2000);
    }
  }

  function badge3d(m) {
    if (m.type !== 'image') return '';
    const job = S.jobs.find(j => j.source_media_id === m.id);
    let st = jobState(job);
    if (!st && S.media.some(x => x.type === 'model3d' && x.source_media_id === m.id)) st = 'ready';
    st = st || 'none';
    const busy = st === 'queued' || st === 'processing';
    return `<span class="mm-badge s3d-${st}" data-s3d="${st}">${busy ? '<span class="mm-spinner" aria-hidden="true"></span>' : ''}${E(t('admin.media.s3d.' + st))}</span>`;
  }
  function itemHTML(m, i, n) {
    const alt = m.alt || '';
    const job = S.jobs.find(j => j.source_media_id === m.id);
    const hasModel = S.media.some(x => x.type === 'model3d' && x.source_media_id === m.id) || jobState(job) === 'ready';
    const busy = job && (job.status === 'queued' || job.status === 'processing');
    const thumb = m.type === 'image' ? `<img src="${E(m.url)}" alt="" loading="lazy">`
      : m.type === 'video' ? `<video src="${E(m.url)}" ${m.poster ? `poster="${E(m.poster)}"` : ''} muted preload="metadata" aria-hidden="true" tabindex="-1"></video>`
      : (m.poster || m.url_poster) ? `<img src="${E(m.poster)}" alt="" loading="lazy">` : '3D';
    const editable = typeof api.updateMedia === 'function';
    const label = t('admin.media.t.' + m.type);
    return `<li class="mm-item ${m.is_cover ? 'is-cover' : ''}" data-id="${E(m.id)}">
      <div class="mm-thumb">${thumb}</div>
      <div class="mm-body">
        <div class="mm-meta"><strong>${E(label)}</strong>
          <span class="mm-badge">${E(t('admin.media.src.' + (m.source === 'generated' ? 'generated' : 'upload')))}</span>
          ${m.type === 'model3d' ? `<span class="mm-badge">${E(t(m.url ? 'admin.media.model_ai' : 'admin.media.model_tilt'))}</span>` : ''}
          ${m.is_cover ? `<span class="mm-badge cover">${E(t('admin.media.is_cover'))}</span>` : ''}
          ${badge3d(m)}
          <span class="sr-only">${E(t('admin.media.position', { i: i + 1, n }))}</span></div>
        ${m.type !== 'model3d' ? `<div class="mm-alt">${editable
          ? `<label for="mm-alt-${E(m.id)}">${E(t('admin.media.alt'))}</label><input id="mm-alt-${E(m.id)}" type="text" maxlength="300" value="${E(alt)}" data-alt="${E(m.id)}" placeholder="${E(t('admin.media.alt_ph'))}">`
          : `<span class="a-muted"><b>${E(t('admin.media.alt'))}:</b> ${E(alt || '—')}</span>`}</div>` : ''}
        <div class="mm-actions">
          <button type="button" class="btn btn-outline" data-mm="up" data-id="${E(m.id)}" ${i === 0 ? 'disabled' : ''} aria-label="${E(t('admin.media.up'))}: ${E(label)} ${i + 1}"><span aria-hidden="true">&uarr;</span></button>
          <button type="button" class="btn btn-outline" data-mm="down" data-id="${E(m.id)}" ${i === n - 1 ? 'disabled' : ''} aria-label="${E(t('admin.media.down'))}: ${E(label)} ${i + 1}"><span aria-hidden="true">&darr;</span></button>
          ${m.type === 'image' ? `<button type="button" class="btn btn-outline" data-mm="cover" data-id="${E(m.id)}" aria-pressed="${!!m.is_cover}" ${m.is_cover ? 'disabled' : ''}>${E(m.is_cover ? t('admin.media.is_cover') : t('admin.media.cover'))}</button>` : ''}
          ${m.type === 'image' ? `<button type="button" class="btn btn-outline" data-mm="gen3d" data-id="${E(m.id)}" ${busy ? 'disabled' : ''}>${E(hasModel ? t('admin.media.regen3d') : t('admin.media.gen3d'))}</button>` : ''}
          <button type="button" class="btn btn-outline danger" data-mm="delete" data-id="${E(m.id)}" aria-label="${E(t('admin.media.delete'))}: ${E(label)} ${i + 1}">${E(t('admin.media.delete'))}</button>
        </div>
      </div>
    </li>`;
  }

  function queueHTML() {
    return S.queue.map(q => `<li class="${q.state === 'err' ? 'err' : ''}"><span>${E(q.state === 'err' ? q.msg : q.state === 'done' ? q.name : t('admin.media.uploading', { name: q.name }))}</span>
      <span>${q.state === 'done' ? '&#10003;' : q.state === 'err' ? '!' : Math.round(q.p * 100) + '%'}</span>
      ${q.state === 'up' ? `<progress max="100" value="${Math.round(q.p * 100)}" aria-label="${E(t('admin.media.uploading', { name: q.name }))}"></progress>` : ''}</li>`).join('');
  }

  function render() {
    if (!S.id) { el.innerHTML = `<h2>${E(t('admin.media.title'))}</h2><p class="mm-hint">${E(t('admin.media.save_first'))}</p>`; return; }
    const ae = document.activeElement;
    const keep = el.contains(ae) && ae.dataset ? { mm: ae.dataset.mm, id: ae.dataset.id, tag: ae.id } : null;
    const hadAlt = el.querySelector('#mm-alt');
    const n = S.media.length;
    el.innerHTML = `<h2>${E(t('admin.media.title'))}</h2>
      <div class="c-field"><label for="mm-alt">${E(t('admin.media.alt'))}</label><input id="mm-alt" type="text" maxlength="300" value="${E(S.alt)}" placeholder="${E(t('admin.media.alt_ph'))}"></div>
      <div class="mm-drop" id="mm-drop">
        <p>${E(t('admin.media.drop'))}</p>
        <div class="mm-pick">
          <input type="file" id="mm-file" class="mm-file" multiple accept="${ACCEPT}"><label for="mm-file" class="btn btn-primary a-small">${E(t('admin.media.browse'))}</label>
          <input type="file" id="mm-glb" class="mm-file" accept=".glb,model/gltf-binary"><label for="mm-glb" class="btn btn-outline a-small">${E(t('admin.media.glb'))}</label>
        </div>
        <p class="mm-limits">${E(t('admin.media.limits'))}</p>
      </div>
      <ul class="mm-queue" id="mm-queue" aria-live="polite">${queueHTML()}</ul>
      <p class="sr-only" id="mm-status" role="status"></p>
      ${n ? `<ol class="mm-list" aria-label="${E(t('admin.media.list'))}">${S.media.map((m, i) => itemHTML(m, i, n)).join('')}</ol>` : `<p class="mm-hint" style="margin-top:12px">${E(t('admin.media.empty'))}</p>`}`;
    if (keep && keep.tag === 'mm-alt') el.querySelector('#mm-alt')?.focus();
    else if (keep && keep.mm) {
      let b = el.querySelector(`[data-mm="${keep.mm}"][data-id="${CSS.escape(keep.id)}"]`);
      if (!b || b.disabled) b = el.querySelector(`[data-mm="${keep.mm === 'up' ? 'down' : keep.mm === 'down' ? 'up' : keep.mm}"][data-id="${CSS.escape(keep.id)}"]:not(:disabled)`)
        || el.querySelector(`[data-id="${CSS.escape(keep.id)}"]:not(:disabled)`);
      b?.focus();
    }
  }
  const say = (msg) => { const s = el.querySelector('#mm-status'); if (s) s.textContent = msg; };
  const paintQueue = () => { const q = el.querySelector('#mm-queue'); if (q) q.innerHTML = queueHTML(); };

  async function refresh() { await load(); render(); }
  async function guard(fn, okMsg) {
    try { await fn(); await refresh(); if (okMsg) { toast(okMsg, 'success'); say(okMsg); } }
    catch (e) { toast(e && e.message ? e.message : t('admin.media.err'), 'error'); try { await refresh(); } catch {} }
  }

  async function upload(files) {
    files = [...files];
    if (!files.length || S.busy) return;
    S.busy = true;
    S.queue = [];
    const jobs = files.map(f => {
      const v = validateFile(f);
      const q = { name: f.name, p: 0, state: v.error ? 'err' : 'up', msg: v.error || '' };
      S.queue.push(q); return { f, q, ok: !v.error };
    });
    paintQueue();
    let added = 0;
    for (const j of jobs) {
      if (!j.ok) continue;
      say(t('admin.media.progress', { done: added + 1, total: jobs.filter(x => x.ok).length }));
      try {
        await api.uploadMedia(S.id, j.f, { alt: S.alt.trim() || undefined, onProgress: (p) => { j.q.p = Math.max(0, Math.min(1, Number(p) || 0)); paintQueue(); } });
        j.q.state = 'done'; j.q.p = 1; added++;
      } catch (e) { j.q.state = 'err'; j.q.msg = t('admin.media.err_upload', { name: j.f.name }) + (e && e.message ? ` (${e.message})` : ''); }
      paintQueue();
    }
    S.busy = false;
    try { await refresh(); } catch {}
    paintQueue();
    if (added) { toast(t('admin.media.uploaded', { n: added }), 'success'); say(t('admin.media.uploaded', { n: added })); }
    else if (jobs.some(j => !j.ok || j.q.state === 'err')) toast(jobs.find(j => j.q.state === 'err').q.msg, 'error');
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mm]');
    if (!b || !S.id) return;
    const id = b.dataset.id, act = b.dataset.mm;
    const idx = S.media.findIndex(m => m.id === id);
    if (act === 'up' || act === 'down') {
      const to = idx + (act === 'up' ? -1 : 1);
      if (idx < 0 || to < 0 || to >= S.media.length) return;
      const ids = S.media.map(m => m.id); [ids[idx], ids[to]] = [ids[to], ids[idx]];
      guard(() => api.reorderMedia(S.id, ids), t('admin.media.moved'));
    } else if (act === 'cover') guard(() => api.setCover(S.id, id), t('admin.media.cover_set'));
    else if (act === 'delete') { if (confirm(t('admin.media.confirm_delete'))) guard(() => api.deleteMedia(S.id, id), t('admin.media.deleted')); }
    else if (act === 'gen3d') guard(() => api.request3D(S.id, id), t('admin.media.gen_started'));
  });
  el.addEventListener('change', (e) => {
    if (e.target.id === 'mm-file' || e.target.id === 'mm-glb') { const f = e.target.files; upload(f).finally(() => { try { e.target.value = ''; } catch {} }); }
    else if (e.target.dataset && e.target.dataset.alt && typeof api.updateMedia === 'function') {
      guard(() => api.updateMedia(S.id, e.target.dataset.alt, { alt: e.target.value.trim() }), t('admin.media.alt_saved'));
    }
  });
  el.addEventListener('input', (e) => { if (e.target.id === 'mm-alt') S.alt = e.target.value; });
  const over = (on) => el.querySelector('#mm-drop')?.classList.toggle('over', on);
  el.addEventListener('dragover', (e) => { if (e.target.closest('#mm-drop')) { e.preventDefault(); over(true); } });
  el.addEventListener('dragleave', (e) => { if (e.target.closest('#mm-drop') && !e.relatedTarget?.closest?.('#mm-drop')) over(false); });
  el.addEventListener('drop', (e) => { if (e.target.closest('#mm-drop')) { e.preventDefault(); over(false); upload(e.dataTransfer.files); } });

  return {
    async open(product) {
      clearTimeout(S.poll);
      Object.assign(S, { id: product && product.id ? product.id : null, name: product?.name || '', media: [], jobs: [], queue: [], alt: '' });
      render();
      if (S.id) { try { await refresh(); } catch { toast(t('admin.media.err'), 'error'); } }
    },
    close() { clearTimeout(S.poll); S.id = null; },
    destroy() { alive = false; clearTimeout(S.poll); },
    rerender() { if (S.id) render(); },
  };
}
