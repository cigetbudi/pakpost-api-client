import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronizeWorkspaceChanges} from '../../src/features/realtime/services/workspaceSync.js';

const workspaceId='11111111-1111-1111-1111-111111111111';
const collectionId='22222222-2222-2222-2222-222222222222';
const requestId='33333333-3333-3333-3333-333333333333';
const otherId='44444444-4444-4444-4444-444444444444';
const events=[{workspaceId,collectionId,requestId,kind:'request.updated',revision:3,sourceInstance:'peer'}];
const tab=id=>({id,source:{scope:'workspace',workspaceId,collectionId,requestId:id,revision:1}});

function context(overrides={}){
  let calls=0;
  const reconciled=[];
  const state={
    events,workspaceId,token:'jwt',isCurrent:()=>true,tabs:[tab(requestId),tab(otherId)],
    selectedCollectionId:collectionId,expandedCollections:{},requestLists:{},
    setCollections:()=>{},setSelectedCollectionId:()=>{},
    setRequestLists:()=>{},setSelectedRequests:()=>{},markConflict:()=>{},
    reconcile:async(...args)=>reconciled.push(args),
    fetchCollections:async()=>[],fetchRequests:async()=>{calls++;return [];},
    isSelectedCollection:id=>id===collectionId,
    isPagedCollection:()=>true,
    ...overrides,
  };
  return {state,reconciled,requests:()=>calls};
}

test('realtime update on large Collection skips full index and targets only changed open tab',async()=>{
  const {state,reconciled,requests}=context();
  await synchronizeWorkspaceChanges(state);
  assert.equal(requests(),0);
  assert.equal(reconciled.length,1);
  assert.deepEqual(reconciled[0][2],[{id:requestId,revision:3,isIndex:true}]);
  assert.deepEqual(reconciled[0][3],{onlyRequestId:requestId});
});

test('large Collection delete does not reconcile unrelated open tabs as deleted',async()=>{
  const {state,reconciled,requests}=context({events:[{...events[0],kind:'request.deleted',revision:null}]});
  await synchronizeWorkspaceChanges(state);
  assert.equal(requests(),0);
  assert.deepEqual(reconciled[0][2],[]);
  assert.deepEqual(reconciled[0][3],{onlyRequestId:requestId});
});

test('large Collection deduplicates changes by ID within one SignalR batch',async()=>{
  const {state,reconciled,requests}=context({events:[...events,{...events[0],revision:4}]});
  await synchronizeWorkspaceChanges(state);
  assert.equal(requests(),0);
  assert.equal(reconciled.length,1);
  assert.equal(reconciled[0][2][0].revision,4);
});

test('small Collections keep existing full-index reconciliation path',async()=>{
  const {state,reconciled,requests}=context({isPagedCollection:()=>false});
  await synchronizeWorkspaceChanges(state);
  assert.equal(requests(),1);
  assert.equal(reconciled.length,1);
  assert.equal(reconciled[0][3],undefined);
});
