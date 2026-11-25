import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8');
test('Tauri release CSP blocks remote scripts and preserves WASM',()=>{
  const {app}=JSON.parse(read('desktop/src-tauri/tauri.conf.json'));
  const policy=app.security.csp;
  assert.match(policy,/object-src 'none'/);
  assert.match(policy,/frame-src 'none'/);
  assert.match(policy,/script-src 'self' 'wasm-unsafe-eval';/);
  assert.doesNotMatch(policy,/script-src[^;]*'(?:unsafe-inline|unsafe-eval)'/);
  assert.match(app.security.devCsp,/script-src[^;]*'unsafe-inline'/);
});
test('desktop capability does not authorize remote pages or filesystem/shell plugins',()=>{
  const cap=JSON.parse(read('desktop/src-tauri/capabilities/default.json'));
  assert.deepEqual(cap.windows,['main']);
  assert.equal(cap.remote,undefined);
  assert.deepEqual(cap.permissions,['core:default']);
});
