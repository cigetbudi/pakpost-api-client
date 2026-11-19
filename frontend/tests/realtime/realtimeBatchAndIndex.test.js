import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleWorkspaceBatch} from '../../src/features/realtime/services/workspaceBatch.js';
import {hydrateOpenCloudDetails,reconcileRequestTabs,synchronizeWorkspaceChanges} from '../../src/features/realtime/services/workspaceSync.js';
import {requestFingerprint,freshRequest} from '../../src/features/requests/services/draftLifecycle.js';
import {workspaceCollectionKey} from '../../src/features/collections/services/collectionExpansion.js';

const ws = '11111111-1111-1111-1111-111111111111';
const col = '22222222-2222-2222-2222-222222222222';
const id = '33333333-3333-3333-3333-333333333333';
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));

function tabFor(requestId,revision,draft) {
  return {id:`tab-${requestId}`,name:'Request',savedName:'Request',
    savedFingerprint:requestFingerprint(draft,'Request'),
    source:{scope:'workspace',workspaceId:ws,collectionId:col,requestId,revision}};
}

test('burst of >100 realtime events drains entirely in order, never overlapping batches', async () => {
  const queueRef={current:Array.from({length:254},(_,i)=>i)};
  const timerRef={current:null};
  const received=[];
  let active=0,max=0;
  const handlerRef={current:async batch=>{
    active++;max=Math.max(max,active);
    await pause(2);
    received.push(...batch);
    active--;
  }};
  scheduleWorkspaceBatch(queueRef,timerRef,handlerRef,0);
  const deadline=Date.now()+1000;
  while(received.length!==254 && Date.now()<deadline)await pause(5);
  assert.deepEqual(received,Array.from({length:254},(_,i)=>i));
  assert.equal(max,1);
  assert.equal(queueRef.current.length,0);
});

test('realtime queue reset stops old batches from draining into a new workspace', async () => {
  const queueRef={current:[1,2]},timerRef={current:null};
  let release,entered;
  const inProgress=new Promise(resolve=>{entered=resolve});
  const gate=new Promise(resolve=>{release=resolve});
  const received=[];
  const handlerRef={current:async batch=>{entered();await gate;received.push(...batch)}};
  scheduleWorkspaceBatch(queueRef,timerRef,handlerRef,0);
  await inProgress;
  clearTimeout(timerRef.current);timerRef.current=null;queueRef.current=[];
  release();await pause(5);
  assert.deepEqual(received,[1,2]);
  assert.equal(timerRef.current,null);
  assert.equal(queueRef.current.length,0);
});

test('index refresh hydrates full payload only for clean open tabs with newer revisions', async () => {
  const clean=freshRequest('Request');clean.body='private body';
  const changed={...clean,body:'local unsaved edit'};
  const cleanTab=tabFor(id,1,clean);
  const dirtyId='44444444-4444-4444-4444-444444444444';
  const dirtyTab=tabFor(dirtyId,1,clean);
  const index=[{id,revision:2,isIndex:true,name:'Request',url:'https://index.example'},
    {id:dirtyId,revision:2,isIndex:true,name:'Request'}];
  const calls=[];
  const hydrated=await hydrateOpenCloudDetails({workspaceId:ws,collectionId:col,requests:index,
    tabs:[cleanTab,dirtyTab],readDraft:tabId=>tabId===cleanTab.id?clean:changed,
    fetchDetail:async requestId=>{calls.push(requestId);return {id:requestId,revision:2,body:'full body',name:'Request'}},
    isCurrent:()=>true});
  assert.deepEqual(calls,[id]);
  assert.equal(hydrated[0].body,'full body');
  assert.equal(hydrated[1].isIndex,true);
});

test('index alone never overwrites a clean editor with missing scripts/body', () => {
  const draft=freshRequest('Request');draft.body='retain this data';
  let writes=0;
  reconcileRequestTabs({workspaceId:ws,collectionId:col,
    requests:[{id,revision:2,isIndex:true}],tabs:[tabFor(id,1,draft)],
    activeTabId:`tab-${id}`,readDraft:()=>draft,transformRemote:()=>({body:''}),
    markConflict:()=>{},updateDraft:()=>{writes++},updateTab:()=>{writes++},
    restoreActive:()=>{writes++},clearConflict:()=>{}});
  assert.equal(writes,0);
});

test('stale workspace session discards hydrated details without React changes', async () => {
  const draft=freshRequest('Request');
  let current=true;
  const result=await hydrateOpenCloudDetails({workspaceId:ws,collectionId:col,
    requests:[{id,revision:2,isIndex:true}],tabs:[tabFor(id,1,draft)],readDraft:()=>draft,
    fetchDetail:async()=>{current=false;return {id,revision:2,body:'new data'}},
    isCurrent:()=>current});
  assert.equal(result,null);
});

test('many request events refresh each Collection once and cap NeonDB concurrency', async () => {
  const ids=Array.from({length:9},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
  const events=ids.flatMap(collectionId=>[1,2,3].map(()=>({
    workspaceId:ws,collectionId,kind:'request.updated',requestId:id,sourceInstance:'another-tab',
  })));
  const requestLists=Object.fromEntries(ids.map(collectionId=>[workspaceCollectionKey(ws,collectionId),[]]));
  let active=0,max=0,calls=0,writes=0;
  await synchronizeWorkspaceChanges({events,workspaceId:ws,token:'token',isCurrent:()=>true,
    tabs:[],selectedCollectionId:'',expandedCollections:{},requestLists,
    setCollections:()=>{},setSelectedCollectionId:()=>{},setRequestLists:()=>{writes++},
    setSelectedRequests:()=>{throw Error('selection has changed')},isSelectedCollection:()=>false,
    markConflict:()=>{},reconcile:async()=>{},fetchCollections:async()=>[],
    fetchRequests:async()=>{active++;max=Math.max(max,active);calls++;await pause(3);active--;return []},
  });
  assert.equal(calls,9);
  assert.equal(writes,9);
  assert.ok(max<=3);
  assert.ok(max>1);
});
