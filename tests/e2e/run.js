'use strict';
// E2E runner: starts `node server.js` on a free port, runs every tests/e2e/*.spec.js scenario at
// mobile (390x844) and desktop (1280x800), prints PASS/FAIL, exits non-zero on any failure.
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { makeHarness } = require('./lib');

const ROOT = path.resolve(__dirname, '..', '..');
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); });
    s.on('error', rej);
  });
}
async function waitUp(base) {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(base + '/index.html'); if (r.ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

(async () => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let browser; let failed = 0; let passed = 0;
  const only = process.argv[2];
  try {
    await waitUp(base);
    browser = await chromium.launch();
    const specs = fs.readdirSync(__dirname).filter((f) => f.endsWith('.spec.js')).sort();
    const tests = [];
    for (const f of specs) for (const [name, fn, opts] of require(path.join(__dirname, f))) tests.push({ file: f, name, fn, opts: opts || {} });
    for (const tc of tests) {
      if (only && !tc.name.includes(only)) continue;
      const vps = tc.opts.viewports || Object.keys(VIEWPORTS);
      for (const vp of vps) {
        const h = makeHarness(browser, base, VIEWPORTS[vp], vp);
        const label = `${tc.name} [${vp}]`;
        const t0 = Date.now();
        try {
          await Promise.race([tc.fn(h), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 90s')), 90000))]);
          h.assertNoConsoleErrors();
          passed++; console.log(`PASS ${label} (${Date.now() - t0}ms)`);
        } catch (e) {
          failed++; console.log(`FAIL ${label}\n     ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n     ')}`);
        } finally { await h.close(); }
      }
    }
  } catch (e) {
    failed++; console.error('RUNNER ERROR', e);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
