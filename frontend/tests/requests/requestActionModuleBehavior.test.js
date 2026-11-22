import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestTabActions} from '../../src/features/requests/controllers/createRequestTabActions.js';
import {createRequestTabManagementActions} from '../../src/features/requests/controllers/createRequestTabManagementActions.js';
import {createResponseExampleSaveActions} from '../../src/features/requests/controllers/createResponseExampleSaveActions.js';
import {planTabClose} from '../../src/features/requests/services/tabActions.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
};

test('tab facade exports all original editor and lifecycle actions after modularization', () => {
  const actions=createRequestTabActions({});
  for(const action of ['beginRequestRename','setCurrentRequestName','finishRequestRename','cancelRequestRename',
    'snapshot','restoreDraft','stashActive','selectTab','navigateConsoleEvent','addTab',
    'importCurlIntoCurrent','closeTab','performTabAction','showTabContext',
    'selectTabFromDraft','loadSavedRequest','resetSandboxRequest']) {
    assert.equal(typeof actions[action], 'function', action);
  }
});

test('tab duplication produces a fresh unsaved draft with no response or script output', () => {
  let tabs=[{id:'t1',name:'Inquiry',method:'GET',source:{scope:'local',requestId:'saved-id'}}];
  const drafts={current:{t1:{method:'GET',body:'original',result:{statusCode:200},scriptLog:['private response'],scriptTests:['ok'],scriptError:'old'}}};
  const sequence={current:1};let selected='';
  const actions=createRequestTabManagementActions({
    openTabs:tabs, draftsRef:drafts, tabSequence:sequence, activeTabRef:{current:'t1'},
    stashActive:()=>{}, setTabMenu:()=>{},
    requestFingerprint:()=> 'fingerprint',
    setOpenTabs:fn=>{tabs=fn(tabs);}, selectTabFromDraft:id=>{selected=id;},
  });
  actions.performTabAction('duplicate','t1');
  assert.equal(tabs.length,2);
  assert.equal(tabs[1].id,'t2');
  assert.equal(tabs[1].pendingCopy,true);
  assert.equal(tabs[1].source,null);
  assert.equal(drafts.current.t2.body,'original');
  assert.equal(drafts.current.t2.result,null);
  assert.deepEqual(drafts.current.t2.scriptLog,[]);
  assert.deepEqual(drafts.current.t2.scriptTests,[]);
  assert.equal(drafts.current.t2.scriptError,'');
  assert.equal(drafts.current.t1.result.statusCode,200);
  assert.equal(selected,'t2');
});

test('close action asks for unsaved confirmation before deleting a draft', () => {
  let tabs=[{id:'t1',name:'Keep'},{id:'t2',name:'Unsaved'}];
  const drafts={current:{t1:{},t2:{body:'unsaved'}}};
  let confirmation=null;
  const actions=createRequestTabManagementActions({
    openTabs:tabs, draftsRef:drafts, activeTabRef:{current:'t1'},
    stashActive:()=>{}, setTabMenu:()=>{}, setCloseConfirmation:value=>{confirmation=value;},
    needsCloseConfirmation:tab=>tab.id==='t2', planTabClose,
    setOpenTabs:next=>{tabs=typeof next==='function'?next(tabs):next;},
  });
  actions.performTabAction('close','t2');
  assert.equal(tabs.length,2);
  assert.deepEqual(confirmation.unsaved,['t2']);
  actions.performTabAction('close','t2',true);
  assert.equal(tabs.length,1);
  assert.equal(tabs[0].id,'t1');
  assert.equal(drafts.current.t2,undefined);
  assert.equal(confirmation,null);
});

test('response example save stays in the QA sandbox and does not call Cloud API', async () => {
  let networkCalls=0, lastNotice='', examples=null, modalOpen=true;
  const drafts={current:{tab1:{body:'{"existing":true}'}}};
  const sample={id:'example-1',name:'Success',statusCode:200};
  const actions=createResponseExampleSaveActions({
    activeSource:()=>({scope:'workspace',workspaceId:'ws',collectionId:'col',requestId:'req'}),
    activeTabRef:{current:'tab1'}, draftsRef:drafts, result:{statusCode:200,body:'ok'},
    exampleName:'Success',exampleDescription:'',responseExamples:[],selectedWs:'ws',canEditCloud:false,
    openTabs:[{id:'tab1'}], isReadOnlyCloudTab:()=>true,
    createResponseExample:()=>sample,upsertResponseExample:(items,item)=>[...items,item],
    suggestExampleName:()=> 'Success',
    doAction:async fn=>{await fn();return true;},
    api:async()=>{networkCalls++},
    snapshot:()=>({body:'{"existing":true}'}),
    setResponseExamples:value=>{examples=value;},
    setSaveExampleOpen:value=>{modalOpen=value;},
    setNotice:value=>{lastNotice=value;},
  });
  await actions.saveResponseExample({preventDefault(){}});
  assert.equal(networkCalls,0);
  assert.deepEqual(examples,[sample]);
  assert.deepEqual(drafts.current.tab1.responseExamples,[sample]);
  assert.equal(modalOpen,false);
  assert.match(lastNotice,/sandbox only/);
});

test('saving an example to a writable Cloud request carries its revision back to the tab', async () => {
  let calls=[], adopted=null, setLists=null;
  const original={id:'req',headersJson:'{}',revision:3,name:'GET Status'};
  const actions=createResponseExampleSaveActions({
    activeSource:()=>({scope:'workspace',workspaceId:'ws',collectionId:'col',requestId:'req'}),
    activeTabRef:{current:'tab1'},draftsRef:{current:{tab1:{}}},
    openTabs:[{id:'tab1'}],isReadOnlyCloudTab:()=>false,canEditCloud:true,
    token:'browser-session-marker',selectedWs:'ws',selectedCol:'col',
    api:async(path,method,body)=>{
      calls.push([path,method,body]);
      return method==='GET'?[original]:{...original,revision:4,headersJson:body.headersJson};
    },
    decodeStoredHeaders:()=>({headers:[{key:'X-Trace',value:'abc'}],params:[],documentation:'Kept docs',auth:{authType:'none'}}),
    encodeStoredHeaders:(headers,params,docs,examples)=>JSON.stringify({headers,params,docs,examples}),
    adoptSavedRevision:value=>{adopted=value;},
    workspaceCollectionKey:()=> 'ws:col',
    setWorkspaceRequestLists:fn=>{setLists=fn({});},setSavedRequests:()=>{},
    snapshot:()=>({method:'GET'}),setResponseExamples:()=>{},
  });
  const next=[{id:'e1',name:'Example'}];
  await actions.persistResponseExamples(next);
  assert.deepEqual(calls.map(call=>call[1]),['GET','PUT']);
  assert.equal(JSON.parse(calls[1][2].headersJson).docs,'Kept docs');
  assert.deepEqual(JSON.parse(calls[1][2].headersJson).examples,next);
  assert.equal(adopted.revision,4);
  assert.equal(setLists['ws:col'][0].revision,4);
});

test('delayed Cloud sandbox reset never changes an editor after session rotation',async()=>{
  const {createRequestSandboxActions}=await import('../../src/features/requests/controllers/createRequestSandboxActions.js');
  const pending=deferred();
  let notice='',changes=0;
  const source={scope:'workspace',workspaceId:'workspace-1',collectionId:'col',requestId:'req'};
  const ref={current:'same-session'}, draftsRef={current:{t1:{body:'local-draft'}}};
  const actions=createRequestSandboxActions({
    openTabs:[{id:'t1',source}],activeTabRef:{current:'t1'},
    isReadOnlyCloudTab:()=>true,canEditCloud:false,selectedWs:'workspace-1',
    token:'same-session',currentTokenRef:ref,draftsRef,
    api:()=>pending.promise,setNotice:value=>{notice=value;},getMessage:error=>error.message,
    setOpenTabs:()=>{changes++;},restoreDraft:()=>{changes++;},
    freshRequest:()=>({}),workspaceDraft:value=>value,
    sessionDocumentationOverlays:{current:new Map()},
  });
  const resetting=actions.resetSandboxRequest();
  ref.current='new-session';
  pending.resolve([{id:'req',name:'Cloud saved',revision:7}]);
  await resetting;
  assert.equal(changes,0);
  assert.equal(draftsRef.current.t1.body,'local-draft');
  assert.match(notice,/Could not reset sandbox/);
});
