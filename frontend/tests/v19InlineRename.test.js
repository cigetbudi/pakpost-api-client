import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshRequest,requestFingerprint,hasUnsavedChanges,needsCloseConfirmation,tabSaved} from '../src/features/draftLifecycle.js';

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/v19-inline-name.css',import.meta.url),'utf8');
test('renaming a saved collection request is dirty until Save completes',()=>{
  const draft=freshRequest('Original');
  const tab={id:'t1',name:'Original',savedName:'Original',source:{scope:'workspace',workspaceId:'w',collectionId:'c',requestId:'r'},savedFingerprint:requestFingerprint(draft,'Original')};
  const renamed={...tab,name:'New name'};
  assert.equal(hasUnsavedChanges(tab,draft),false);
  assert.equal(hasUnsavedChanges(renamed,draft),true);
  assert.equal(needsCloseConfirmation(renamed,draft),true);
  const after=tabSaved(renamed,renamed.source,draft,'New name');
  assert.equal(after.name,'New name');
  assert.equal(after.savedName,'New name');
  assert.equal(after.source.requestId,'r');
  assert.equal(hasUnsavedChanges(after,draft),false);
});
test('legacy tabs do not falsely appear renamed upon upgrade',()=>{
  const draft=freshRequest('Old Request');
  const tab={name:'Old Request',savedFingerprint:requestFingerprint(draft,'Old Request')};
  assert.equal(hasUnsavedChanges(tab,draft),false);
});
test('request name supports in-place edit and keyboard save with existing request PUT',()=>{
  assert.match(app,/className="pp-editable-request-name"/);
  assert.match(app,/aria-label="Request name"/);
  assert.match(app,/onChange=\{event=>setCurrentRequestName\(event.target.value\)\}/);
  assert.match(app,/if\(event.key==='Escape'\)/);
  assert.match(app,/if\(event.key==='Enter'\)/);
  assert.match(app,/function createCollectionDraft/);
  assert.match(app,/addTab\(draft,source,\{focusName:true\}\)/);
  assert.match(app,/if \(\(e.ctrlKey \|\| e.metaKey\) && e.key.toLowerCase\(\) === 's'\)/);
  assert.match(app,/await api\(`\$\{base\}\/\$\{origin.requestId\}`,'PUT'/);
  assert.match(css,/pp-inline-request-name/);
});
