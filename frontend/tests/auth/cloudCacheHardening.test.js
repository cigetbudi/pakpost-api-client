import test from 'node:test';
import assert from 'node:assert/strict';
import {readWorkbenchCache,writeWorkbenchCache,clearWorkbenchCache} from '../../src/features/workspace/services/workspaceCache.js';
import {readWorkspaceCollectionDocs,writeWorkspaceCollectionDocs,clearWorkspaceCollectionDocs} from '../../src/features/collections/services/documentationStore.js';

const createStorage=()=>{
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  };
};

function storageFixture(callback){
  globalThis.sessionStorage=createStorage();
  globalThis.localStorage=createStorage();
  try { callback(); } finally {
    delete globalThis.sessionStorage;
    delete globalThis.localStorage;
  }
}

test('Cloud drafts never persist, even when editor is allowed and local recovery is enabled',()=>storageFixture(()=>{
  const tabs=[
    {id:'cloud',name:'Bank API',method:'POST',source:{scope:'workspace',workspaceId:'w'}},
    {id:'local',name:'Local',method:'GET',source:{scope:'local'}}
  ];
  writeWorkbenchCache({openTabs:tabs,activeTabId:'cloud',drafts:{local:{url:'https://local.example'}},
    active:{url:'https://cloud.internal',body:'TOP_SECRET',preScript:'PASSWORD_SECRET'},
    recent:[{url:'https://private.internal'}],envScope:'workspace'});
  for(const store of [sessionStorage,localStorage]){
    const value=[store.getItem('pakpost_workbench_v4_live'),store.getItem('pakpost_workbench_v4_recovery')].join('');
    assert.doesNotMatch(value,/TOP_SECRET|PASSWORD_SECRET|cloud\.internal|private\.internal|Bank API/);
  }
  const recovered=readWorkbenchCache();
  assert.deepEqual(recovered.openTabs.map(tab=>tab.id),['local']);
  assert.equal(recovered.activeTabId,'local');
  assert.equal(recovered.drafts.local.url,'https://local.example');
  clearWorkbenchCache();
}));

test('legacy Cloud recovery is discarded before being loaded into React state',()=>storageFixture(()=>{
  sessionStorage.setItem('pakpost_workbench_v4_live',JSON.stringify({version:1,
    openTabs:[{id:'cloud',source:{scope:'workspace'}},{id:'local',source:{scope:'local'}}],
    activeTabId:'cloud',drafts:{cloud:{body:'OLD_SECRET'},local:{url:'http://localhost:3000'}}}));
  const recovered=readWorkbenchCache();
  assert.deepEqual(recovered.openTabs.map(tab=>tab.id),['local']);
  assert.equal(recovered.drafts.cloud,undefined);
  assert.equal(sessionStorage.getItem('pakpost_workbench_v4_live'),null);
}));

test('legacy workspace docs move to session only and disappear on sign out',()=>storageFixture(()=>{
  localStorage.setItem('pakpost_workspace_collection_docs_v21',JSON.stringify({'w:c':'draft docs'}));
  assert.deepEqual(readWorkspaceCollectionDocs(localStorage),{'w:c':'draft docs'});
  assert.equal(localStorage.getItem('pakpost_workspace_collection_docs_v21'),null);
  writeWorkspaceCollectionDocs(localStorage,{'w:c':'updated docs'});
  assert.equal(localStorage.getItem('pakpost_workspace_collection_docs_v21'),null);
  assert.deepEqual(readWorkspaceCollectionDocs(localStorage),{'w:c':'updated docs'});
  clearWorkspaceCollectionDocs(localStorage);
  assert.deepEqual(readWorkspaceCollectionDocs(localStorage),{});
}));
