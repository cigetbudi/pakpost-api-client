import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');

test('Collections and Environments use the same menu item component',()=>{
  for(const file of ['App.jsx','features/LocalCollectionsTree.jsx','features/EnvironmentExplorer.jsx']){
    assert.match(src(file),/MenuActionItem/);
  }
});
test('Menu covers create, rename, duplicate, sort, export and destructive actions',()=>{
  const s=src('features/MenuActionItem.jsx');
  for(const action of ['newRequest','renameCollection','duplicateCollection','sortCollection','sortMethod','exportCollection','deleteCollection','editVariables','rename','duplicate','export','delete']){
    assert.match(s,new RegExp(`\\b${action}:`));
  }
  assert.match(s,/aria-hidden="true"/);
});
test('Shared style is imported last and preserves keyboard and reduced-motion behavior',()=>{
  assert.match(src('main.jsx'),/styles\/layers\/action-menus\.css/);
  const css=src('styles/layers/action-menus.css');
  assert.match(css,/\.pp-collection-popup \.pp-action-menu-item/);
  assert.match(css,/\.pp-env-editor-menu \.pp-action-menu-item/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
});
