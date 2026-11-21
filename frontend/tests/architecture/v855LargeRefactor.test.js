import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planSignedOutWorkbench, invalidateBrowserSession } from '../../src/features/auth/services/logoutWorkbench.js';
import { executeWorkbenchRequest } from '../../src/features/requests/services/executeWorkbenchRequest.js';
import { buildRequestCommand, buildRedactedCodeRequest, buildRequestPreview } from '../../src/features/requests/services/requestCommand.js';
import { synchronizeWorkspaceChanges, reconcileRequestTabs } from '../../src/features/realtime/services/workspaceSync.js';
import { CLIENT_INSTANCE_ID } from '../../src/services/httpClient.js';
import { freshRequest, requestFingerprint } from '../../src/features/requests/services/draftLifecycle.js';

const read = path => readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8');

test('logout plans safe Local fallback even if the last cached draft is missing', () => {
  const oldTabs = [
    {id:'cloud1',name:'Secret Cloud',source:{scope:'workspace'}},
    {id:'local2',name:'Local API',source:{scope:'local'}},
  ];
  const result = planSignedOutWorkbench(oldTabs,'cloud1',{},freshRequest('Secret Cloud'));
  assert.deepEqual(result.tabs.map(x=>x.id),['local2']);
  assert.equal(result.activeDraft.name,'Local API');
  assert.ok(result.activeDraft.url);
  assert.ok(!JSON.stringify(result).includes('Secret Cloud'));
  const fallback = planSignedOutWorkbench([{id:'cloud1',source:{scope:'workspace'}}],'cloud1',{},{});
  assert.equal(fallback.tabs[0].id,'t0');
  assert.equal(fallback.activeDraft.method,'GET');
});

test('logout credentials are invalidated even if recovery clearing throws', () => {
  const removed=[];
  invalidateBrowserSession({removeItem:key=>removed.push(key)},()=>{throw Error('quota')});
  assert.deepEqual(removed,['pakpost_token']);
  assert.doesNotThrow(()=>invalidateBrowserSession({removeItem:()=>{throw Error('blocked')}},()=>{throw Error('blocked')}));
  const app=readWorkbenchSource();
  assert.match(app,/onClick=\{logout\}/);
  assert.match(app,/aria-label="Sign out"/);
  const handler=app.slice(app.indexOf('  function performLogout(broadcast) {'),app.indexOf('  const { requiresLogin,'));
  assert.ok(handler.indexOf('invalidateBrowserSession(')<handler.indexOf('planSignedOutWorkbench('));
  assert.ok(handler.indexOf("setToken('')")<handler.indexOf('planSignedOutWorkbench('));
});

const baseRequest = {
  method:'GET',url:'https://example.test/get',rows:[],params:[],body:'',format:'none',
  formFields:[],binaryFile:{name:'',base64:''},preScript:'',postScript:'',interceptorMode:'proxy'
};
const preSuccess = {
  error:null,logs:['PRE: started'],tests:[],variables:{baseUrl:'https://example.test',stan:'123'},
  environmentVariables:{baseUrl:'https://example.test',stan:'123'},
  collectionVariables:{client:'RAYA',rrn:'999'},localVariables:{},requestHeaderOverrides:{'X-Test':'enabled'}
};
const postSuccess = {
  error:null,logs:['POST: done'],tests:[{name:'status 200',passed:true}],variables:{stan:'456'},
  environmentVariables:{stan:'456'},collectionVariables:{client:'RAYA',rrn:'999'},localVariables:{},
};
const fakeExecutorParams = overrides => ({
  request:baseRequest, environmentValues:{baseUrl:'https://example.test'},collectionValues:{client:'RAYA'},
  loadCollectionValues:async old=>({...old,rrn:'100'}),
  saveCollectionValues:()=>{},saveEnvironmentValues:async()=>{},
  buildOutgoing:()=>({method:'GET',url:'https://example.test/get',headers:{},bodyMode:'none'}),
  dispatch:async()=>({statusCode:200,elapsedMs:4,body:'{}'}),
  sandbox:async(_,phase)=>phase==='pre'?preSuccess:postSuccess,
  ...overrides,
});

test('request pipeline preserves pre/post scripts, variable chaining and HTTP response', async () => {
  let command,envWrites=[],collectionWrites=[],traces=[];
  const result=await executeWorkbenchRequest(fakeExecutorParams({
    saveEnvironmentValues:async values=>envWrites.push(values),
    saveCollectionValues:values=>collectionWrites.push(values),
    trace:(...event)=>traces.push(event),
    dispatch:async outgoing=>{command=outgoing;return {statusCode:200,elapsedMs:4,body:'{}'}},
  }));
  assert.equal(command.headers['X-Test'],'enabled');
  assert.equal(result.response.statusCode,200);
  assert.equal(result.tests[0].passed,true);
  assert.equal(result.scriptError,'');
  assert.equal(envWrites.length,2);
  assert.equal(collectionWrites.length,2);
  assert.ok(traces.some(e=>e[1]==='network'));
});

test('pre-request runtime failure blocks network and retains diagnostic', async () => {
  let called=false;
  await assert.rejects(()=>executeWorkbenchRequest(fakeExecutorParams({
    sandbox:async()=>({...preSuccess,error:'ReferenceError: s is not defined',diagnostic:{line:6,column:51}}),
    dispatch:async()=>{called=true;return {statusCode:200}},
  })),error=>{
    assert.match(error.message,/Pre-request script/);
    assert.equal(error.scriptDiagnostic.line,6);
    assert.ok(error.executionLogs.length);
    return true;
  });
  assert.equal(called,false);
});

test('post-response script error does not discard the successful HTTP response', async () => {
  const result=await executeWorkbenchRequest(fakeExecutorParams({
    sandbox:async(_,phase)=>phase==='pre'?preSuccess:{...postSuccess,error:'ReferenceError: x',diagnostic:{line:4,column:2}},
  }));
  assert.equal(result.response.statusCode,200);
  assert.match(result.scriptError,/ReferenceError/);
  assert.equal(result.scriptDiagnostic.line,4);
});

test('command builder shares API auth behavior and redacts codegen credentials', () => {
  const request={...baseRequest,url:'https://example.test/{{path}}',params:[{key:'q',value:'{{value}}',enabled:true}],
    auth:{authType:'bearer',bearerToken:'top-secret-token'}};
  const cmd=buildRequestCommand(request,{path:'search',value:'hello'});
  assert.equal(cmd.url,'https://example.test/search?q=hello');
  assert.equal(cmd.headers.Authorization,'Bearer top-secret-token');
  const redacted=buildRedactedCodeRequest({request,variableMap:{path:'search',value:'hello'},allVariableMap:{}});
  assert.equal(redacted.headers.Authorization,'{{REDACTED_SECRET}}');
  assert.ok(!JSON.stringify(buildRequestPreview(request)).includes('top-secret-token'));
});

test('SignalR synchronization ignores self-originated events and wrong Workspace', async () => {
  const ws='11111111-1111-1111-1111-111111111111';
  const col='22222222-2222-2222-2222-222222222222';
  let calls=0;
  const args={events:[{kind:'request.created',workspaceId:ws,collectionId:col,sourceInstance:CLIENT_INSTANCE_ID}],
    workspaceId:ws,token:'jwt',isCurrent:()=>true,tabs:[],selectedCollectionId:col,expandedCollections:{},requestLists:{},
    setCollections:()=>{},setSelectedCollectionId:()=>{},setRequestLists:()=>{},setSelectedRequests:()=>{},
    markConflict:()=>{},reconcile:()=>{},fetchCollections:async()=>{calls++},fetchRequests:async()=>{calls++}};
  await synchronizeWorkspaceChanges(args);
  await synchronizeWorkspaceChanges({...args,events:[{kind:'request.created',workspaceId:col,collectionId:col}]});
  assert.equal(calls,0);
});

test('stale SignalR refetch never writes data after sign-out or Workspace switch', async () => {
  const ws='11111111-1111-1111-1111-111111111111',col='22222222-2222-2222-2222-222222222222';
  let current=true,writes=0;
  await synchronizeWorkspaceChanges({
    events:[{kind:'request.created',workspaceId:ws,collectionId:col}],workspaceId:ws,token:'jwt',
    isCurrent:()=>current,tabs:[],selectedCollectionId:col,expandedCollections:{},requestLists:{},
    setCollections:()=>{writes++},setSelectedCollectionId:()=>{writes++},setRequestLists:()=>{writes++},
    setSelectedRequests:()=>{writes++},markConflict:()=>{},reconcile:()=>{},
    fetchCollections:async()=>{current=false;return [{id:col}]},fetchRequests:async()=>{writes++;return []},
  });
  assert.equal(writes,0);
});

test('dirty Cloud tab is marked conflict and its draft is never overwritten', () => {
  const ws='ws1',col='col1', draft={...freshRequest('InquiryAccount'),url:'https://local.test'};
  const tab={id:'tab1',name:'InquiryAccount',savedName:'InquiryAccount',savedFingerprint:requestFingerprint(freshRequest('InquiryAccount'),'InquiryAccount'),
    source:{scope:'workspace',workspaceId:ws,collectionId:col,requestId:'req1',revision:1}};
  let conflict=null,updated=0;
  reconcileRequestTabs({workspaceId:ws,collectionId:col,requests:[{id:'req1',name:'InquiryAccount',revision:2}],tabs:[tab],
    activeTabId:'tab1',readDraft:()=>draft,transformRemote:()=>freshRequest('InquiryAccount'),
    markConflict:(_,value)=>{conflict=value},updateDraft:()=>{updated++},updateTab:()=>{updated++},restoreActive:()=>{updated++},clearConflict:()=>{},
  });
  assert.equal(conflict.kind,'conflict');
  assert.equal(updated,0);
});

test('realtime connection remains opt-in and does not import SignalR in initial App bundle', () => {
  const hook=read('features/realtime/hooks/useWorkspaceRealtimeLifecycle.js');
  const hub=read('features/realtime/services/workspaceRealtime.js');
  assert.match(hook,/if \(!enabled \|\| !token \|\| !workspaceId\)/);
  assert.match(hub,/import\('@microsoft\/signalr'\)/);
  assert.doesNotMatch(readWorkbenchSource(),/from ['"]@microsoft\/signalr['"]/);
});

test('a pristine Cloud tab reloads revision 2 while keeping its previous response', () => {
  const ws='ws1',col='col1',draft={...freshRequest('InquiryAccount'),result:{statusCode:200}};
  const tab={id:'tab1',name:'InquiryAccount',savedName:'InquiryAccount',savedFingerprint:requestFingerprint(draft,'InquiryAccount'),
    source:{scope:'workspace',workspaceId:ws,collectionId:col,requestId:'req1',revision:1}};
  let refreshed=null, updatedTab=null;
  reconcileRequestTabs({workspaceId:ws,collectionId:col,requests:[{id:'req1',name:'InquiryAccount',method:'POST',revision:2}],tabs:[tab],
    activeTabId:'tab1',readDraft:()=>draft,transformRemote:()=>({...freshRequest('InquiryAccount'),url:'https://cloud.test'}),
    markConflict:()=>{throw Error('should not conflict')},updateDraft:(_,value)=>{refreshed=value},
    updateTab:(_,update)=>{updatedTab=update(tab)},restoreActive:()=>{},clearConflict:()=>{},
  });
  assert.equal(refreshed.url,'https://cloud.test');
  assert.deepEqual(refreshed.result,{statusCode:200});
  assert.equal(updatedTab.source.revision,2);
});

test('account switch before dispatch prevents stale request from being sent', async () => {
  let current=true, dispatched=false;
  await assert.rejects(()=>executeWorkbenchRequest(fakeExecutorParams({
    isCurrent:()=>current,
    sandbox:async(_,phase)=>{current=false;return preSuccess},
    dispatch:async()=>{dispatched=true;return {statusCode:200}},
  })),/Request cancelled/);
  assert.equal(dispatched,false);
});

test('Cloud request repository retains authorization and HTTP 409 conflict status', async () => {
  const {getWorkspaceRequests,updateWorkspaceRequest,workspaceRequestsPath}=await import('../../src/features/collections/services/workspaceRequestRepository.js');
  assert.equal(workspaceRequestsPath('ws','col'),'/api/workspaces/ws/collections/col/requests');
  const prior=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(path,opts)=>{
    calls.push({path,opts});
    return {ok:false,status:409,json:async()=>({message:'Revision conflict'})};
  };
  try {
    await assert.rejects(()=>updateWorkspaceRequest('ws','col','req',{revision:11},'jwt'),err=>err.status===409);
    assert.equal(calls.length,1);
    assert.equal(calls[0].path,'/api/workspaces/ws/collections/col/requests/req');
    assert.equal(calls[0].opts.headers.Authorization,'Bearer jwt');
    assert.equal(JSON.parse(calls[0].opts.body).revision,11);
  } finally {globalThis.fetch=prior;}
});
