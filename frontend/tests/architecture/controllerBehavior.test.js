import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequestTabActions } from '../../src/features/requests/controllers/createRequestTabActions.js';
import { createRequestHistoryActions } from '../../src/features/requests/controllers/createRequestHistoryActions.js';
import { createCollectionRunnerActions } from '../../src/features/collections/controllers/createCollectionRunnerActions.js';
import { createInvitationActions } from '../../src/features/workspace/controllers/createInvitationActions.js';
import { createRequestExecutionActions } from '../../src/features/requests/controllers/createRequestExecutionActions.js';
import { applyFieldMerge } from '../../src/features/requests/services/requestVersionMerge.js';

// Missing setters must be obvious in a real controller, but the lightweight test
// context supplies spies for the UI controls unrelated to each scenario.
const withSetters = (values, updates = {}) => new Proxy(values, {
  get(target, key) {
    if (key in target) return target[key];
    if (typeof key === 'string' && /^set[A-Z]/.test(key)) return value => { updates[key] = value; };
    return undefined;
  },
});

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
};

test('tab controller snapshots immutable request rows and restores editor state correctly', () => {
  const changes = {};
  const originalRows = [{key:'X-Test',value:'123',enabled:true}];
  const actions = createRequestTabActions(withSetters({
    EMPTY_HEADER:{key:'',value:'',enabled:true},
    method:'POST',url:'https://example.test',rows:originalRows,formFields:[{key:'id',value:'1'}],
    params:[{key:'q',value:'a'}],body:'{"ok":true}',documentation:'docs',
    format:'application/json',binaryFile:{name:'',base64:''},preScript:'',postScript:'',
    responseExamples:[],scriptLog:[],scriptTests:[],scriptError:'',scriptDiagnostic:null,
    reqTab:'body',resTab:'headers',result:null,responsePretty:true,prettyResponse:'',
    currentAuth:() => ({authType:'none'}),sanitizeResponseExamples:values=>values,
  },changes));
  const snapshot = actions.snapshot();
  snapshot.rows[0].value = '999';
  assert.equal(originalRows[0].value,'123', 'snapshot must not alias editable header objects');
  assert.equal(snapshot.authType, 'none');
  actions.restoreDraft({method:'GET',url:'https://second.test',rows:[],params:[],scriptDiagnostic:null});
  assert.equal(changes.setMethod,'GET');
  assert.equal(changes.setUrl,'https://second.test');
  assert.deepEqual(changes.setRows,[]);
  assert.deepEqual(changes.setParams,[]);
  assert.equal(changes.setScriptDiagnostic,null);
});

test('history merge preserves local body and script unless explicitly selected', () => {
  let tabs=[{id:'t1',name:'Inquiry',source:{scope:'workspace',revision:2}}];
  const drafts = {t1:{method:'POST',body:'local-body',preScript:'local-script'}};
  let notice='', conflictAlerts={t1:{kind:'conflict'}};
  const actions = createRequestHistoryActions(withSetters({
    activeTabRef:{current:'t1'},openTabsRef:{current:tabs},
    draftsRef:{current:drafts},snapshotRef:{current:()=>drafts.t1},
    applyFieldMerge,workspaceDraft:remote=>remote,
    setOpenTabs:fn=>{tabs=fn(tabs);},
    setRemoteAlerts:fn=>{conflictAlerts=fn(conflictAlerts);},
    setCurrentRequestName:()=>{},restoreDraft:()=>{},
    setConflictDialog:()=>{},setNotice:value=>{notice=value;},
  }));
  actions.applyMergedRevision('t1',{revision:3,method:'GET',body:'cloud-body',preScript:'cloud-script'},['method'],{resolveConflict:true});
  assert.equal(drafts.t1.method,'GET');
  assert.equal(drafts.t1.body,'local-body');
  assert.equal(drafts.t1.preScript,'local-script');
  assert.equal(tabs[0].source.revision,3);
  assert.deepEqual(conflictAlerts,{});
  assert.match(notice,/Cloud was NOT changed/);
});

test('runner loading cannot publish a stale collection after close/logout', async () => {
  const pending = deferred();
  const events=[];
  const runnerFetchId={current:0};
  const actions=createCollectionRunnerActions(withSetters({
    runnerFetchId,localCollections:[{id:'local-col',name:'Local',requests:[{method:'GET',url:'https://example.test'}]}],
    readSavedCollectionVariables:()=>pending.promise,
    sessionCollectionVariables:{current:new Map()},
    collectionVariableKey:()=> 'guest:local-col',
    savedCollectionVariableMap:()=>({}),readCollectionVariables:()=>({}),
    varsFromEnv:()=>({}),
    setRunnerLoading:loading=>events.push(['loading',loading]),
    setRunnerTarget:target=>events.push(['target',target]),
  }));
  const loading=actions.openCollectionRunner({scope:'local',collectionId:'local-col'});
  actions.closeRunner();
  pending.resolve({variables:[]});
  await loading;
  assert.deepEqual(events.filter(([type,value])=>type==='target'&&value!=null),[]);
  assert.equal(runnerFetchId.current,2);
  assert.deepEqual(events.filter(([type])=>type==='loading').map(([,value])=>value),[true,false]);
});

test('an open docked runner cannot be replaced by another collection', async () => {
  const notices=[];
  const runnerFetchId={current:1};
  const actions=createCollectionRunnerActions(withSetters({
    runnerTarget:{collectionId:'existing'},runnerFetchId,
    setNotice:notice=>notices.push(notice),
    setRunnerTarget:()=>assert.fail('Existing runner must not be replaced'),
    setRunnerLoading:()=>assert.fail('No new fetch should start'),
  }));
  await actions.openCollectionRunner({scope:'local',collectionId:'other'});
  assert.equal(runnerFetchId.current,1);
  assert.match(notices[0],/Close the current Collection Runner/);
});

test('invitation controller refuses a Cloud invite without permission', async () => {
  let writes=0;
  const actions=createInvitationActions(withSetters({
    canManageMembers:false,invitationBusy:false,inviteEmail:'qa@example.test',inviteRoles:['QA'],
    selectedWs:'workspace',token:'sample-token',api:async()=>{writes++},
  }));
  await actions.inviteMember({preventDefault(){}});
  assert.equal(writes,0);
});

test('request execution does not publish a response after the account changes', async () => {
  const pending=deferred();
  const currentTokenRef={current:'token-A'};
  const results=[];const sessions=[];
  const actions=createRequestExecutionActions(withSetters({
    method:'GET',url:'https://example.test',rows:[],body:'',formFields:[],binaryFile:null,
    format:'application/json',preScript:'',postScript:'',interceptorMode:'proxy',
    loading:false,envScope:'local',currentTokenRef,
    activeTabRef:{current:'tab-1'},openTabsRef:{current:[{id:'tab-1',source:null}]},
    draftsRef:{current:{'tab-1':{}}},
    me:{id:'user-A'},selectedWs:'workspace-A',
    varsFromEnv:()=>({}),collectionVariableKey:()=> 'user-A:tab-1',
    sessionCollectionVariables:{current:new Map()},readCollectionVariables:()=>({}),
    activeEnvironment:null,activeSessionEnvironmentKey:'',
    executeWorkbenchRequest:async({isCurrent,saveCollectionValues,saveEnvironmentValues})=>{
      await pending.promise;
      assert.equal(isCurrent(),false);
      saveCollectionValues({token:'should-not-write'});
      saveEnvironmentValues({token:'should-not-write'});
      return {response:{statusCode:200},command:{url:'https://example.test'},logs:[],tests:[],scriptError:'',scriptDiagnostic:null};
    },
    writeCollectionVariables:()=>{sessions.push('collection');},
    applyScriptVariables:()=>{sessions.push('environment');},
    appendConsoleEvent:()=>{},stashActive:()=>{},
    setResult:value=>{results.push(value)},
  }));
  const request=actions.sendRequest();
  currentTokenRef.current=''; // Logout before HTTP/script resolves.
  pending.resolve();
  await request;
  assert.deepEqual(results,[null], 'stale result must not replace a new account editor');
  assert.deepEqual(sessions,[], 'stale execution must not mutate session variables');
});

test('App delegates to feature controllers and retains per-instance Zustand stores', () => {
  const app=readWorkbenchSource();
  assert.ok(readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8').split('\n').length < 40, 'App must be a thin composition boundary');
  for (const controller of ['createRequestTabActions','createRequestHistoryActions','createRequestExecutionActions',
    'createCollectionActions','createCollectionRunnerActions','createRealtimeActions','createInvitationActions']) {
    assert.match(app,new RegExp(`${controller}\\(\\{`));
  }
  assert.match(app,/createRequestWorkbenchStore/);
  assert.match(app,/createCollectionWorkbenchStore/);
  assert.match(app,/createEnvironmentWorkbenchStore/);
  assert.match(app,/localEnvironments:\s*isTauriDesktop\(\)\s*\?\s*\[\]\s*:\s*initialLocalEnvs\(\)/);
  assert.doesNotMatch(app,/localEnvironments:\s*initialLocalEnvs\s*[,}]/);
});
