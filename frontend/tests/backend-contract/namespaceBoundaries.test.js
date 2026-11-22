import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const backend = join(root, 'backend');
const application = join(backend, 'src/Pakpost.Application');
const internal = join(application, 'Internal');

const read = path => readFileSync(join(root, path), 'utf8');
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(item => {
  const path = join(directory, item.name);
  return item.isDirectory() ? walk(path) : item.name.endsWith('.cs') ? [path] : [];
});

const types = new Map();
for (const file of walk(internal)) {
  const source = readFileSync(file, 'utf8');
  const namespace = source.match(/^namespace\s+([\w.]+);/m)?.[1];
  const type = source.match(/^\s*(?:public|internal)\s+(?:(?:sealed|static|abstract|partial|readonly)\s+)*(?:class|record|interface|enum|struct)\s+(\w+)/m)?.[1];
  if (type) types.set(type, namespace);
}

test('all Application feature files declare namespaces matching their directory', () => {
  let checked = 0;

  for (const file of walk(internal)) {
    const folder = relative(application, dirname(file)).split(sep).join('.');
    const expected = `namespace Pakpost.Application.${folder};`;
    assert.ok(readFileSync(file, 'utf8').includes(expected), file);
    checked++;
  }

  assert.ok(checked >= 150);
});

test('Application references import their relocated feature types', () => {
  for (const file of walk(join(backend, 'src')).concat(walk(join(backend, 'tests')))) {
    const source = readFileSync(file, 'utf8');
    const namespace = source.match(/^namespace\s+([\w.]+);/m)?.[1];
    const imports = new Set([...source.matchAll(/^using\s+([\w.]+);/gm)].map(match => match[1]));
    const body = source.replace(/^using\s+[^;]+;/gm, '').replace(/^namespace\s+[^;]+;/gm, '');

    for (const [type, target] of types) {
      if (target === namespace || !new RegExp(`\\b${type}\\b`).test(body)) continue;
      assert.ok(imports.has(target), `Missing ${target} for ${type} in ${relative(root, file)}`);
    }
  }
});

test('API startup delegates transport policies to focused middleware and extensions', () => {
  const program = read('backend/src/Pakpost.Api/Program.cs');
  const services = read('backend/src/Pakpost.Api/Extensions/WorkbenchWebServiceExtensions.cs');
  const proxy = read('backend/src/Pakpost.Api/Middlewares/ProxyConcurrencyMiddleware.cs');
  const cache = read('backend/src/Pakpost.Api/Middlewares/PrivateApiCacheMiddleware.cs');

  assert.match(program, /AddWorkbenchWebServices\(builder\.Configuration\)/);
  assert.match(program, /UseMiddleware<ProxyConcurrencyMiddleware>\(\)/);
  assert.match(program, /UseMiddleware<PrivateApiCacheMiddleware>\(\)/);
  assert.match(services, /PermitLimit = 30/);
  assert.match(services, /PermitLimit = 10/);
  assert.match(services, /"http:\/\/localhost:5173"/);
  assert.match(proxy, /Math\.Clamp\(/);
  assert.match(proxy, /_slots\.Wait\(0\)/);
  assert.match(proxy, /_slots\.Release\(\)/);
  assert.match(cache, /"no-store, private"/);
});

test('Infrastructure continues to register all existing service lifetimes', () => {
  const db = read('backend/src/Pakpost.Infrastructure/Extensions/PersistenceServiceExtensions.cs');
  const external = read('backend/src/Pakpost.Infrastructure/Extensions/ExternalServiceExtensions.cs');

  for (const item of ['IUnitOfWork', 'ICollectionFolderRepository', 'ISavedRequestRevisionRepository', 'IRequestEnvironmentRepository']) {
    assert.ok(db.includes(item), item);
  }
  for (const item of ['AddSingleton<IEnvironmentValueCipher', 'AddTransient<IHttpRequestRunner', 'AddScoped<IJwtTokenService']) {
    assert.ok(external.includes(item), item);
  }
});
