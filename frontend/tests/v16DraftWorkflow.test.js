import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_REQUEST_URL,freshRequest,pendingSource,requestFingerprint,
  needsCloseConfirmation,hasUnsavedChanges,hasUnsavedMarker,tabSaved
} from '../src/features/draftLifecycle.js';
import {sameSource,findBoundTab} from '../src/features/sourceTabs.js';
import {planTabClose} from '../src/features/tabActions.js';
import {readWorkbenchCache,writeWorkbenchCache} from '../src/features/workspaceCache.js';

const source=(file)=>readFileSync(new URL(file,import.meta.url),'utf8');
test('new collection draft starts GET with a usable public default URL',()=>{
  const draft=freshRequest();
  assert.equal(draft.method,'GET');
  assert.equal(draft.url,'https://httpbin.org/get');
  assert.equal(DEFAULT_REQUEST_URL,draft.url);
});
test('drafts bind to their origin collection without a saved request ID',()=>{
  const a=pendingSource('workspace','col-a',{workspaceId:'ws-a',pendingId:'draft-1'});
  const b=pendingSource('workspace','col-a',{workspaceId:'ws-a',pendingId:'draft-2'});
  const c=pendingSource('local','col-b',{folderPath:['Auth'],pendingId:'draft-3'});
  assert.equal(a.pending,true);assert.equal(a.requestId,undefined);
  assert.equal(sameSource(a,b),false);
  assert.equal(sameSource(a,a),true);
  assert.equal(sameSource(a,{scope:'workspace',workspaceId:'ws-a',collectionId:'col-a',requestId:'saved'}),false);
  assert.deepEqual(c.folderPath,['Auth']);
  assert.equal(findBoundTab([{id:'one',source:a},{id:'two',source:b}],b).id,'two');
});
test('fingerprint tracks request mutations, not HTTP results or script console logs',()=>{
  const original=freshRequest('Request token');
  const base=requestFingerprint(original,'Request token');
  assert.equal(requestFingerprint({...original,result:{statusCode:200},scriptLog:['ok'],reqTab:'body'},'Request token'),base);
  assert.notEqual(requestFingerprint({...original,url:'https://httpbin.org/post'},'Request token'),base);
  assert.notEqual(requestFingerprint({...original,body:'{"x":2}'},'Request token'),base);
  assert.notEqual(requestFingerprint({...original,preScript:'console.log(1)'},'Request token'),base);
  assert.equal(requestFingerprint(original,'New name'),base); // Rename is committed immediately via the collection action.
  assert.notEqual(requestFingerprint({...original,rows:[{key:'Authorization',value:'Bearer top-secret'}]},'Request token'),base);
  assert.equal(requestFingerprint({...original,rows:[{key:'Authorization',value:'Bearer top-secret'}]},'Request token').includes('top-secret'),false);
});
test('new drafts always warn on close, existing requests only warn after editing',()=>{
  const draft=freshRequest('Auth token');
  const clean={id:'tab1',name:'Auth token',source:{scope:'local',collectionId:'a',requestId:'r1'},savedFingerprint:requestFingerprint(draft,'Auth token')};
  assert.equal(needsCloseConfirmation(clean,draft),false);
  assert.equal(hasUnsavedMarker(clean,draft),false);
  assert.equal(needsCloseConfirmation(clean,{...draft,method:'POST'}),true);
  const pending={...clean,source:pendingSource('local','a',{pendingId:'pending-one'})};
  assert.equal(needsCloseConfirmation(pending,draft),true);
  assert.equal(needsCloseConfirmation({...clean,pendingCopy:true,source:null},draft),true);
  assert.equal(hasUnsavedMarker(pending,draft),true);
});
test('after first save, tab gets stable server ID and later changes dirty it again',()=>{
  const d=freshRequest('New Request');
  const pending={id:'tab1',name:'New Request',source:pendingSource('workspace','col',{workspaceId:'ws',pendingId:'tmp'}),savedFingerprint:requestFingerprint(d,'New Request')};
  const after=tabSaved(pending,{scope:'workspace',workspaceId:'ws',collectionId:'col',requestId:'saved-id'},d);
  assert.equal(after.source.pending,undefined);
  assert.equal(after.source.requestId,'saved-id');
  assert.equal(hasUnsavedChanges(after,d),false);
  assert.equal(hasUnsavedChanges(after,{...d,url:'https://httpbin.org/anything'}),true);
});
test('Close Others and Close Right identify every unsaved tab they would remove',()=>{
  const tabs=['t1','t2','t3','t4'].map(id=>({id}));
  assert.deepEqual(planTabClose(tabs,'t2','t3','right').removedIds,['t3','t4']);
  assert.deepEqual(planTabClose(tabs,'t2','t3','others').removedIds,['t1','t3','t4']);
  assert.deepEqual(planTabClose(tabs,'t2','t3','close').removedIds,['t2']);
});
test('browser recovery keeps unsaved collection identity and non-plaintext fingerprint',()=>{
  const values=new Map();
  const mock={getItem:key=>values.get(key)||null,setItem:(key,v)=>values.set(key,v),removeItem:key=>values.delete(key)};
  const savedSession=globalThis.sessionStorage, savedLocal=globalThis.localStorage;
  globalThis.sessionStorage=mock;globalThis.localStorage=mock;
  try {
    const d=freshRequest('New Request');
    const tab={id:'t1',name:'New Request',method:'GET',source:pendingSource('local','collection',{pendingId:'draft'}),savedFingerprint:requestFingerprint(d,'New Request')};
    writeWorkbenchCache({openTabs:[tab],activeTabId:'t1',drafts:{t1:d},active:d,recent:[],split:'horizontal',explorerTab:'collections'});
    const recovered=readWorkbenchCache();
    assert.equal(recovered.openTabs[0].source.pending,true);
    assert.equal(recovered.openTabs[0].savedFingerprint,tab.savedFingerprint);
    assert.equal(recovered.drafts.t1.url,DEFAULT_REQUEST_URL);
  }finally {globalThis.sessionStorage=savedSession;globalThis.localStorage=savedLocal;}
});
test('App creates in-place collection drafts, persists first Save, and confirms destructive closes',()=>{
  const app=source('../src/App.jsx');
  assert.match(app,/function createCollectionDraft\(scope,collectionId,folderPath=\[\]\)/);
  assert.match(app,/if\(action==='newRequest'\)\{\s*createCollectionDraft\('workspace'/);
  assert.match(app,/const saved=await api\(base,'POST',savedPayload,token\)/);
  assert.match(app,/await api\(`\$\{base\}\/\$\{origin.requestId\}`,'PUT'/);
  assert.match(app,/setCloseConfirmation\(\{action,id,unsaved\}\)/);
  assert.match(app,/Discard & close/);
  assert.match(app,/pendingTabs=\{openTabs.filter/);
});
test('Collections show pending request plus button and unsaved indicators',()=>{
  const tree=source('../src/features/LocalCollectionsTree.jsx');
  const app=source('../src/App.jsx');
  const style=source('../src/v16-draft-requests.css');
  assert.match(tree,/New request in collection/);
  assert.match(tree,/pp-draft-request/);
  assert.match(app,/New request in collection/);
  assert.match(app,/pp-unsaved-dot/);
  assert.match(style,/\.pp-tree-actions/);
});
