'use strict';
// Zero-dependency static server. Usage: node server.js  (PORT env, default 8080)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.map': 'application/json'
};
const BLOCKED = new Set(['node_modules', 'tests', 'sql', 'server.js', 'package.json', 'package-lock.json']);

function resolveFile(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  const parts = p.split(/[\\/]+/).filter(Boolean);
  if (parts.some((s) => s === '..' || s.startsWith('.') || BLOCKED.has(s))) return null;
  const abs = path.join(ROOT, ...parts);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  const candidates = [abs];
  if (!path.extname(abs)) candidates.push(abs + '.html');
  candidates.push(path.join(abs, 'index.html'));
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* next */ }
  }
  return null;
}

function send(res, status, file, method) {
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  fs.stat(file, (e, st) => {
    if (e) { res.writeHead(500); return res.end('Server error'); }
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff' });
    if (method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end('Method not allowed'); }
    const file = resolveFile(req.url || '/');
    if (file) return send(res, 200, file, req.method);
    const nf = path.join(ROOT, '404.html');
    if (fs.existsSync(nf)) return send(res, 404, nf, req.method);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not found');
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => console.log(`JP's store running at http://localhost:${port}`));
}
module.exports = { createServer, resolveFile };
