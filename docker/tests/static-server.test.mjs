import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';

let child, root, base;
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'pakpost-static-'));
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), '<h1>PakPost</h1>');
  await writeFile(path.join(root, 'assets', 'index-abc.js'), 'export default 1;');
  await writeFile(path.join(root, '.env'), 'SECRET');
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  child = spawn(process.execPath, [new URL('../frontend/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), PAKPOST_STATIC_ROOT: root },
    stdio: 'pipe'
  });
  base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode != null) throw new Error('Static server exited unexpectedly');
    try { if ((await fetch(`${base}/__frontend_health`)).ok) return; } catch { /* still starting */ }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Static server startup timeout');
});
after(async () => {
  child?.kill('SIGTERM');
  if (root) await rm(root, { recursive: true, force: true });
});

test('serves SPA root without caching credentials', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /PakPost/);
  assert.match(response.headers.get('cache-control'), /no-store/);
});
test('serves hashed Vite assets immutable and with correct MIME', async () => {
  const response = await fetch(`${base}/assets/index-abc.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.match(response.headers.get('cache-control'), /immutable/);
});
test('SPA fallback works for client-side navigation only', async () => {
  const page = await fetch(`${base}/settings/security`, { headers: { Accept: 'text/html' } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PakPost/);
  assert.equal((await fetch(`${base}/assets/not-found.js`)).status, 404);
  assert.equal((await fetch(`${base}/api/auth/session`, { headers: { Accept: 'text/html' } })).status, 404);
});
test('blocks dotfiles and unsafe methods', async () => {
  assert.equal((await fetch(`${base}/.env`)).status, 403);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});
test('supports HEAD without content', async () => {
  const response = await fetch(`${base}/assets/index-abc.js`, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
