import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isReadOnlyCloudTab,sandboxCacheTabIds,sandboxDocKey} from '../../src/features/requests/services/qaSandbox.js';
import {readWorkbenchCache,writeWorkbenchCache,clearWorkbenchCache} from '../../src/features/workspace/services/workspaceCache.js';

const localTab={id:'t2',name:'Local request',method:'GET',source:{scope:'local',collectionId:'local-one',requestId:'loc1'}};
const cloudA={id:'t1',name:'Account Inquiry',method:'POST',source:{scope:'workspace',workspaceId:'workspace-a',collectionId:'col-a',requestId:'req-a'}};
const cloudB={id:'t3',name:'Other Workspace',method:'POST',source:{scope:'workspace',workspaceId:'workspace-b',collectionId:'col-b',requestId:'req-b'}};
const app=readWorkbenchSource();

function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),clear:()=>map.clear()};}
function restoreGlobalStorage(){ const previous=[globalThis.sessionStorage,globalThis.localStorage];globalThis.sessionStorage=storage();globalThis.localStorage=storage();return ()=>{globalThis.sessionStorage=previous[0];globalThis.localStorage=previous[1]}; }

const draft=(body)=>({method:'POST',url:'https://example.com',body,params:[],rows:[],formFields:[],responseExamples:[],result:{statusCode:200,body:'secret response'}});
const saveConfig={
  openTabs:[cloudA,localTab],activeTabId:'t1',
  drafts:{t1:draft('QA PRIVATE TOKEN'),t2:{...draft('SAFE LOCAL DRAFT'),result:{statusCode:200,body:'local response'}}},
  active:draft('QA PRIVATE TOKEN'),recent:[],split:'horizontal',explorerTab:'collections',sidebarCollapsed:false,activeEnvId:'',envScope:'workspace'
};

test('QA and Writer Cloud tabs are read-only even if another workspace is selected',()=>{
  assert.equal(isReadOnlyCloudTab(cloudA,false,'workspace-a'),true);
  assert.equal(isReadOnlyCloudTab(cloudA,true,'workspace-b'),true);
  assert.equal(isReadOnlyCloudTab(cloudA,true,'workspace-a'),false);
  assert.equal(isReadOnlyCloudTab(localTab,false,'workspace-a'),false);
  assert.equal(isReadOnlyCloudTab(null,false,'workspace-a'),false);
  assert.deepEqual(sandboxCacheTabIds([cloudA,localTab,cloudB],'workspace-a',false),['t1','t3']);
  assert.deepEqual(sandboxCacheTabIds([cloudA,localTab,cloudB],'workspace-a',true),['t3']);
});

test('QA Cloud request and response are not written to sessionStorage or localStorage',()=>{
  const cleanup=restoreGlobalStorage();try{
    writeWorkbenchCache({...saveConfig,sandboxTabIds:['t1']});
    const live=sessionStorage.getItem('pakpost_workbench_v4_live');
    const fallback=localStorage.getItem('pakpost_workbench_v4_recovery');
    assert.ok(live&&fallback);
    assert.doesNotMatch(live,/QA PRIVATE TOKEN|secret response|Account Inquiry/);
    assert.doesNotMatch(fallback,/QA PRIVATE TOKEN|secret response|Account Inquiry/);
    const cached=readWorkbenchCache();
    assert.deepEqual(cached.openTabs.map(t=>t.id),['t2']);
    assert.equal(cached.activeTabId,'t2');
    assert.equal(cached.drafts.t2.body,'SAFE LOCAL DRAFT');
  } finally {cleanup();}
});

test('When all tabs are sandbox-only, recovery starts with a harmless fresh tester',()=>{
  const cleanup=restoreGlobalStorage();try{
    writeWorkbenchCache({...saveConfig,openTabs:[cloudA],sandboxTabIds:['t1']});
    const cached=readWorkbenchCache();
    assert.equal(cached.openTabs.length,1);
    assert.equal(cached.openTabs[0].name,'Untitled Request');
    assert.equal(cached.openTabs[0].source,null);
    assert.equal(cached.drafts.t0.body,undefined);
    clearWorkbenchCache();
    assert.equal(readWorkbenchCache(),null);
  } finally {cleanup();}
});

test('Developer Cloud tab is RAM-only after encryption hardening',()=>{
  const cleanup=restoreGlobalStorage();try{
    writeWorkbenchCache({...saveConfig,openTabs:[cloudA],sandboxTabIds:[]});
    const cache=readWorkbenchCache();
    assert.equal(cache.openTabs[0].source,null);
    assert.equal(cache.drafts.t1,undefined);
    assert.doesNotMatch(sessionStorage.getItem('pakpost_workbench_v4_live'),/QA PRIVATE TOKEN/);
    assert.doesNotMatch(localStorage.getItem('pakpost_workbench_v4_recovery'),/QA PRIVATE TOKEN/);
  } finally {cleanup();}
});

test('Temporary documentation keys separate workspace, request and collection',()=>{
  assert.notEqual(sandboxDocKey({workspaceId:'w1',collectionId:'c1',type:'request',requestId:'r1'}),sandboxDocKey({workspaceId:'w2',collectionId:'c1',type:'request',requestId:'r1'}));
  assert.notEqual(sandboxDocKey({workspaceId:'w1',collectionId:'c1',type:'request',requestId:'r1'}),sandboxDocKey({workspaceId:'w1',collectionId:'c1',type:'collection'}));
});

test('Cloud write path of QA sandbox is disabled and reset reads the stored request',()=>{
  assert.match(app,/Sandbox · Cloud read-only/);
  assert.match(app,/disabled=\{busyAction\|\|isReadOnlyCloudTab/);
  assert.match(app,/if\(origin\?\.scope==='workspace' && \(!canEditCloud \|\| origin\.workspaceId!==selectedWs\)\)/);
  assert.match(app,/resetSandboxRequest\(\)/);
  assert.match(app,/const requests=await api\(path,'GET',undefined,originalToken\)/);
  assert.match(app,/!isReadOnlyCloudTab\(openTabs\.find\(t=>t\.id===activeTabRef\.current\),canEditCloud,selectedWs\)/);
  assert.match(app,/sessionDocumentationOverlays\.current\.set/);
  const logout=readFileSync(new URL('../../src/features/auth/controllers/createWorkbenchLogoutActions.js',import.meta.url),'utf8');
  assert.match(logout,/invalidateBrowserSession\(sessionStorage, clearWorkbenchCache\)/);
});
