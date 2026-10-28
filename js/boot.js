/* Branded loader + failure watchdog. Classic script (not a module) so it still runs when a module fails.
   - layout.js calls window.__bootReady() through pageReady(); the overlay fades out and is removed.
   - Any script/module load failure, uncaught error or unhandled rejection is captured and shown in "Details"
     if the page is not ready in time (8s), so a broken deploy is never an endless spinner. */
(function () {
  'use strict';
  var WATCHDOG_MS = 8000, GRACE_MS = 1500;
  var started = Date.now(), errors = [], ready = false, failed = false, timer = null, graceTimer = null;
  var T = {
    en: { slow: 'This is taking longer than usual', hint: 'Check your connection, then try again. If it keeps happening, send a screenshot of the details below.', retry: 'Try again', details: 'Details' },
    fr: { slow: 'Cela prend plus de temps que d’habitude', hint: 'Vérifiez votre connexion puis réessayez. Si le problème persiste, envoyez une capture d’écran des détails ci-dessous.', retry: 'Réessayer', details: 'Détails' },
    ht: { slow: 'Sa pran plis tan pase dane', hint: 'Verifye koneksyon ou, answit eseye ankò. Si pwoblèm nan kontinye, voye yon èkran detay ki anba a ban nou.', retry: 'Eseye ankò', details: 'Detay' }
  };
  function lang() {
    var l = null;
    try { l = localStorage.getItem('jps_lang'); } catch (e) {}
    if (!T[l]) l = ((navigator.language || 'en').slice(0, 2)).toLowerCase();
    return T[l] ? l : 'en';
  }
  function short(u) { try { var x = new URL(u, location.href); return x.origin === location.origin ? x.pathname + x.search : x.href; } catch (e) { return String(u); } }
  function rec(kind, msg, where) {
    var line = kind + ': ' + msg + (where ? '  [' + where + ']' : '');
    if (errors.indexOf(line) === -1 && errors.length < 20) errors.push(line);
    window.__bootErrors = errors;
  }
  function fatalSoon(ms) {
    if (ready || failed || graceTimer) return;
    graceTimer = setTimeout(function () { graceTimer = null; show(); }, ms);
  }
  window.addEventListener('error', function (e) {
    var el = e.target;
    if (el && el !== window && el.tagName) {
      var url = el.src || el.href || '';
      if (el.tagName === 'SCRIPT') { rec('script failed to load', short(url)); fatalSoon(0); }
      else if (el.tagName === 'LINK' && el.rel === 'stylesheet' && url.indexOf(location.origin) === 0) rec('stylesheet failed to load', short(url));
      return;
    }
    rec('error', e.message || 'Script error', e.filename ? short(e.filename) + ':' + (e.lineno || 0) + ':' + (e.colno || 0) : '');
    fatalSoon(GRACE_MS);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    rec('unhandled rejection', (r && (r.message || r.toString && r.toString())) || String(r), r && r.stack ? String(r.stack).split('\n')[1] || '' : '');
    fatalSoon(GRACE_MS);
  });
  // Called by <script type="module" onerror="__bootFail(this)"> on every page: fires when the entry module or any
  // module it imports could not be fetched/parsed.
  window.__bootFail = function (el) {
    rec('module failed to load', short((el && el.src) || el || 'unknown') + ' (the file itself or one of its imports)');
    fatalSoon(0);
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function details() {
    var lines = errors.length ? errors.slice() : ['No error was reported: a script or request did not finish loading.'];
    var mods = [].slice.call(document.querySelectorAll('script[src]')).map(function (s) { return short(s.src); });
    lines.push('', 'page: ' + location.pathname + location.search, 'after: ' + Math.round((Date.now() - started) / 100) / 10 + 's',
      'online: ' + (navigator.onLine ? 'yes' : 'no'), 'scripts: ' + mods.join(', '), 'time: ' + new Date().toISOString(), 'agent: ' + navigator.userAgent);
    try {
      var slow = performance.getEntriesByType('resource').filter(function (r) { return /\.(js|css)(\?|$)/.test(r.name) && r.responseEnd - r.startTime > 3000; })
        .map(function (r) { return short(r.name) + ' (' + Math.round(r.duration) + 'ms)'; });
      if (slow.length) lines.push('slow: ' + slow.join(', '));
    } catch (e) {}
    return lines.join('\n');
  }
  function show() {
    var box = document.getElementById('boot');
    if (ready || failed || !box) return;
    failed = true;
    var s = T[lang()];
    box.classList.add('boot-failed');
    box.setAttribute('role', 'alert');
    box.setAttribute('aria-live', 'assertive');
    var inner = box.querySelector('.boot-in') || box;
    var msg = document.createElement('div');
    msg.className = 'boot-fail';
    msg.innerHTML = '<p class="boot-msg" id="boot-msg">' + esc(s.slow) + '</p><p class="boot-hint">' + esc(s.hint) + '</p>' +
      '<button type="button" class="boot-retry" id="boot-retry">' + esc(s.retry) + '</button>' +
      '<details class="boot-details"><summary>' + esc(s.details) + '</summary><pre id="boot-pre">' + esc(details()) + '</pre></details>';
    inner.appendChild(msg);
    var btn = document.getElementById('boot-retry');
    btn.addEventListener('click', function () { location.reload(); });
    try { btn.focus({ preventScroll: true }); } catch (e) {}
  }
  window.__bootReady = function () {
    if (ready) return;
    ready = true;
    clearTimeout(timer); clearTimeout(graceTimer);
    var box = document.getElementById('boot');
    if (!box) return;
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    box.classList.add('boot-out');
    var rm = function () { if (box.parentNode) box.parentNode.removeChild(box); };
    setTimeout(rm, reduce ? 0 : 220);
  };
  timer = setTimeout(show, WATCHDOG_MS);
})();
