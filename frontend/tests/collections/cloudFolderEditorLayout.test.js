import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const component = read('../../src/features/collections/components/CloudFolderTree.jsx');
const css = read('../../src/styles/layers/cloud-folder-polish.css');

test('Cloud folder editor hides the untouched required warning without weakening validation', () => {
  assert.match(component, /const visibleFolderNameError=editing\?\.touched\?folderNameError:''/);
  assert.match(component, /onChange=\{e=>setEditing\(x=>\(\{\.\.\.x,name:e\.target\.value,touched:true\}\)\)\}/);
  assert.match(component, /disabled=\{busy\|\|!!folderNameError\}/);
  assert.match(component, /if\(!editing\|\|cloudFolderNameError\(folders,editing\)\)return/);
  assert.match(component, /\{visibleFolderNameError&&<span className="pp-cloud-folder-validation"/);
});

test('Cloud folder validation occupies a separate grid row instead of shrinking input or buttons', () => {
  assert.match(component, /className="pp-local-create pp-cloud-folder-editor"/);
  assert.match(css, /\.pp-cloud-folders > \.pp-cloud-folder-editor\s*\{[^}]*display:\s*grid/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) 28px 28px/);
  assert.match(css, /\.pp-cloud-folder-editor > \.pp-cloud-folder-validation\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.doesNotMatch(css, /\.pp-cloud-folder-validation\s*\{[^}]*flex-basis:\s*100%/);
});

test('Cancel keeps its quiet styling with and without a validation message', () => {
  assert.match(css, /\.pp-cloud-folder-editor > button\[type="button"\]\s*\{[^}]*background:\s*transparent/);
  assert.match(component, /onClick=\{\(\)=>setEditing\(null\)\} aria-label="Cancel folder edit"/);
});

test('Root folder and nested subfolder creation use the same compact editor', () => {
  assert.match(component, /setEditing\(\{mode:'create',parentId:null,name:''\}\)/);
  assert.match(component, /setEditing\(\{mode:'create',parentId:menu\.folder\.id,name:''\}\)/);
  assert.equal((component.match(/className="pp-local-create pp-cloud-folder-editor"/g)||[]).length,1);
});
