import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createServer } = createRequire(import.meta.url)('../../server.js');

test('static server: mime, traversal, 404', async () => {
  const s = createServer(); await new Promise((r) => s.listen(0, r));
  const base = `http://127.0.0.1:${s.address().port}`;
  try {
    const css = await fetch(`${base}/js/config.js`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/javascript/);
    assert.equal((await fetch(`${base}/assets/img/scarf.jpg`)).headers.get('content-type'), 'image/jpeg');
    assert.equal((await fetch(`${base}/nope-page`)).status, 404);
    assert.equal((await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`)).status, 404);
    assert.equal((await fetch(`${base}/sql/schema.sql`)).status, 404);
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
  } finally { s.close(); }
});
