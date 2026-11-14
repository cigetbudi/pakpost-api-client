import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../src/',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('native browser prompt and confirm removed from Environments',()=>{
  const env=read('features/Environments.jsx');
  assert.doesNotMatch(env,/\b(?:prompt|confirm)\s*\(/);
  assert.match(env,/EnvironmentActionModal/);
  assert.match(env,/existingNames\.some/);
});
test('selects in request toolbar, environment, body and auth use shared listbox',()=>{
  const app=read('App.jsx');
  assert.doesNotMatch(app,/<select[\s>]/);
  for(const aria of ['HTTP method','Body type','Active environment','Auth type'])assert.ok(app.includes(`ariaLabel="${aria}"`));
  assert.match(read('features/RetroSelect.jsx'),/createPortal/);
});
test('request body editor is full height and does not collapse to a single line',()=>{
  assert.match(read('App.jsx'),/placeholder="Write request body here…" allowComments fill/);
  assert.match(read('features/Editors.jsx'),/fill\?['"]100%['"]/);
  assert.match(read('v11-retro-controls.css'),/\.pp-body-code\s*\{[^}]*min-height:260px/);
});
test('all three v10 themes and Vite entry retain their identifiers',()=>{
  const css=read('v10-reference-workbench.css');
  for(const v of ['light','dark','oled'])assert.ok(css.includes(`data-theme='${v}'`));
  assert.match(read('main.jsx'),/v11-retro-controls\.css/);
});
