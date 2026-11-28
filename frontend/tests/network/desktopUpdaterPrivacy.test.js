import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../../../${p}`,import.meta.url),'utf8');
test('updater retains the application identifier, signed version and official endpoint',()=>{
  const config=JSON.parse(read('desktop/src-tauri/tauri.conf.json'));
  assert.equal(config.identifier,'app.pakpost.desktop');
  assert.equal(config.plugins.updater.requireSignedVersion,true);
  assert.deepEqual(config.plugins.updater.endpoints,['https://github.com/cigetbudi/pakpost-api-client/releases/latest/download/latest.json']);
  assert.ok(config.plugins.updater.pubkey);
});
test('updates are initiated through explicit desktop UI actions',()=>{
  const ui=read('frontend/src/features/settings/components/DesktopUpdates.jsx');
  assert.doesNotMatch(ui,/\b(?:useEffect|setInterval|setTimeout)\s*\(/);
  assert.match(ui,/onClick=\{check\}/);assert.match(ui,/onClick=\{install\}/);
  const native=read('desktop/src-tauri/src/updates.rs');
  assert.match(native,/update\.version != version/);assert.match(native,/download_and_install/);
});
