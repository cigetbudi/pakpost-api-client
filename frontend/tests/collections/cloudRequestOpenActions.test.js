import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRequestOpenActions } from '../../src/features/collections/controllers/createCloudRequestOpenActions.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture(api = async () => ({id:'r1',name:'saved detail'})) {
  const selectedWorkspaceRef={current:'ws-a'};
  const currentTokenRef={current:'session-a'};
  const cloudOpenEpoch={current:0};
  const loaded=[];
  const selected=[];
  const openedExamples=[];
  const notices=[];
  const actions=createCloudRequestOpenActions({
    api,cloudOpenEpoch,currentTokenRef,selectedWorkspaceRef,
    selectedWs:'ws-a',selectedCol:'col-a',token:'session-a',openTabs:[],
    tabActions:{loadSavedRequest:item=>loaded.push(item),selectTab:id=>selected.push(id)},
    collectionActions:{openWorkspaceExample:(...args)=>openedExamples.push(args)},
    setNotice:value=>notices.push(value),getMessage:error=>error.message,
  });
  return {actions,selectedWorkspaceRef,currentTokenRef,cloudOpenEpoch,loaded,selected,openedExamples,notices};
}

test('Cloud index request hydrates detail only for the current session', async()=>{
  const remote=deferred();
  const scope=fixture(()=>remote.promise);
  const pending=scope.actions.loadSavedRequest({id:'r1',isIndex:true});
  scope.currentTokenRef.current='session-b';
  remote.resolve({id:'r1',body:'private-workspace-data'});
  assert.equal(await pending,false);
  assert.deepEqual(scope.loaded,[]);
  assert.deepEqual(scope.notices,[]);
});

test('out-of-order Cloud response cannot replace a newer request', async()=>{
  const first=deferred();
  const second=deferred();
  const scope=fixture(path=>path.endsWith('/r1')?first.promise:second.promise);
  const older=scope.actions.loadSavedRequest({id:'r1',isIndex:true});
  const newer=scope.actions.loadSavedRequest({id:'r2',isIndex:true});
  second.resolve({id:'r2',name:'newer'});
  first.resolve({id:'r1',name:'older'});
  assert.equal(await newer,true);
  assert.equal(await older,false);
  assert.deepEqual(scope.loaded.map(x=>x.id),['r2']);
});

test('Cloud index request preserves collection detail path and current-auth binding',async()=>{
  const calls=[];
  const scope=fixture(async (...args)=>{calls.push(args);return {id:'r1',body:'detail'};});
  assert.equal(await scope.actions.loadSavedRequest({id:'r1',collectionId:'col-b',isIndex:true}),true);
  assert.deepEqual(calls,[['/api/workspaces/ws-a/collections/col-b/requests/r1','GET',undefined,'session-a']]);
  assert.deepEqual(scope.loaded.map(x=>x.body),['detail']);
});

test('stale response example is discarded after workspace changes',async()=>{
  const remote=deferred();
  const scope=fixture(()=>remote.promise);
  const pending=scope.actions.openWorkspaceExample({id:'r1',isIndex:true},'col-a',{name:'Example'});
  scope.selectedWorkspaceRef.current='ws-b';
  remote.resolve({id:'r1',body:'secret'});
  await pending;
  assert.deepEqual(scope.openedExamples,[]);
});

test('already-hydrated requests are opened without fetching',async()=>{
  const scope=fixture(()=>{throw Error('must not request');});
  assert.equal(await scope.actions.loadSavedRequest({id:'r1',name:'Full request'}),true);
  await scope.actions.openWorkspaceExample({id:'r1',name:'Full request'},'col-a',{name:'Default'});
  assert.equal(scope.loaded.length,1);
  assert.equal(scope.openedExamples.length,1);
});

test('Cloud API errors are shown only for the active selection',async()=>{
  const active=fixture(async()=>{throw Error('service unavailable');});
  assert.equal(await active.actions.loadSavedRequest({id:'r1',isIndex:true}),false);
  assert.match(active.notices[0],/service unavailable/);
  const remote=deferred();
  const stale=fixture(()=>remote.promise);
  const request=stale.actions.loadSavedRequest({id:'r1',isIndex:true});
  stale.cloudOpenEpoch.current++;
  remote.reject(Error('old request'));
  assert.equal(await request,false);
  assert.deepEqual(stale.notices,[]);
});
