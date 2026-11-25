// Static Vite artifact server for the Node 24 distroless runtime.
// API and SignalR traffic never reaches this server: Caddy routes those to .NET.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.env.PAKPOST_STATIC_ROOT ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'));
const port = Number(process.env.PORT || 8080);
const contentTypes = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}));

async function serve(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  // Reject explicit dotfiles and encoded separators/traversal, including URL
  // strings normalized by WHATWG URL before they reach our path check.
  const segments = pathname.split('/');
  if (pathname.includes('\0') || pathname.includes('\\') || segments.some(
    segment => segment === '..' || segment.startsWith('.'))) {
    res.writeHead(403);
    res.end();
    return;
  }

  if (pathname === '/__frontend_health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : 'ok');
    return;
  }

  let target = path.resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }

  let file;
  try {
    file = await stat(target);
    if (file.isDirectory()) {
      target = path.join(target, 'index.html');
      file = await stat(target);
    }
  } catch { /* Check SPA fallback below. */ }

  if (!file?.isFile()) {
    // Only browser navigations fall back to the SPA. Missing assets/API paths
    // remain 404 (never silently return index.html as an asset).
    const htmlNavigation = req.headers.accept?.includes('text/html') &&
      !path.basename(pathname).includes('.') &&
      !pathname.startsWith('/api/') && !pathname.startsWith('/hubs/');
    if (!htmlNavigation) {
      res.writeHead(404);
      res.end();
      return;
    }
    target = path.join(root, 'index.html');
    try { file = await stat(target); } catch { file = null; }
    if (!file?.isFile()) {
      res.writeHead(503);
      res.end();
      return;
    }
  }

  const cache = target.endsWith('index.html') ? 'no-cache, no-store, must-revalidate' :
    pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300';
  res.writeHead(200, {
    'Content-Type': contentTypes.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
    'Content-Length': file.size,
    'Cache-Control': cache,
  });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(target);
  stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.destroy(); });
  stream.pipe(res);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = http.createServer((req, res) => {
  void serve(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});
server.listen(port, '0.0.0.0');

// Stop accepting new requests and give active static responses time to drain.
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  deadline.unref();
  server.close(error => {
    clearTimeout(deadline);
    if (error) process.exitCode = 1;
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
