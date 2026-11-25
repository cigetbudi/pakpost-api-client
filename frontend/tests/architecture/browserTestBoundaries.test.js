import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../',import.meta.url);
const read = name => readFileSync(new URL(name,root),'utf8');

test('unit tests stay scoped to tests/ so the Node runner never treats Playwright specs as unit tests', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts.test, 'node --test tests/*/*.test.js');
  assert.equal(manifest.scripts['test:e2e'], 'playwright test');
  assert.ok(manifest.devDependencies['@playwright/test']);
});
test('browser suite runs against built production preview and checks real lazy editor chunk', () => {
  const config = read('playwright.config.js');
  const smoke = read('e2e/workbench.smoke.spec.js');
  assert.match(config, /bun run preview --port 4173 --strictPort/);
  assert.match(smoke, /Editors-\[\^\/\]/);
  assert.match(smoke, /pageerror/);
  assert.doesNotMatch(smoke,/fetch\(|\.click\(\s*\{.*Send/);
});
