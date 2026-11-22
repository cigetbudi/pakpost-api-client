import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {environmentContextKey,readEnvironmentSelections,selectionForContext,setSelectionForContext,writeEnvironmentSelections,environmentsForContext} from '../../src/features/environments/services/environmentContext.js';

const uuidA='fc3d6bb4-b939-4b12-89e5-0a020e8bed88';
const uuidB='bf2f732e-67bd-40cd-9ba5-946d45535b56';
const userA='ece2e251-af78-43a7-b265-ed7488d30dbc';
const userB='8df233d0-63d9-4eb5-b509-8ca49844db34';
const core=environmentContextKey('workspace',uuidA,userA);
const dbr=environmentContextKey('workspace',uuidB,userA);
const other=environmentContextKey('workspace',uuidA,userB);

function memoryStore(initial={}){
  const values={...initial};return {getItem:key=>values[key]??null,setItem:(key,value)=>{values[key]=value;},values};
}

test('Environment context is unique per user and Cloud workspace; Local stays independent',()=>{
  assert.notEqual(core,dbr);
  assert.notEqual(core,other);
  assert.equal(environmentContextKey('local',uuidA,userA),'local');
  assert.equal(environmentContextKey('local',uuidB,userB),'local');
  assert.equal(environmentContextKey('workspace',uuidA,''),'');
  assert.equal(environmentContextKey('workspace','',userA),'');
});

test('Core Banking and DBR can use same-named Development with different selected IDs',()=>{
  const coreDev='101a050e-a7f6-41f4-ab45-567a18e394b1';
  const dbrDev='cae1c722-373f-42c7-91db-55a7ffad5c3a';
  let s={};
  s=setSelectionForContext(s,core,coreDev);
  s=setSelectionForContext(s,dbr,dbrDev);
  assert.equal(selectionForContext(s,core),coreDev);
  assert.equal(selectionForContext(s,dbr),dbrDev);
  assert.equal(selectionForContext(s,other),'');
  s=setSelectionForContext(s,other,'');
  assert.equal(selectionForContext(s,other),'');
  assert.equal(selectionForContext(s,core),coreDev);
  s=setSelectionForContext(s,core,'');
  assert.equal(selectionForContext(s,core),'');
  assert.equal(selectionForContext(s,dbr),dbrDev);
});

test('Same account: switching workspace and back restores the correct environment',()=>{
  const envA='107a62a4-3cb9-44b9-87a3-f744094f67c4';
  const envB='d3b9e258-4b4e-4d84-a066-289456f46689';
  const store=memoryStore();
  const selections=setSelectionForContext(setSelectionForContext({},core,envA),dbr,envB);
  writeEnvironmentSelections(store,selections);
  const fromReload=readEnvironmentSelections(store);
  assert.equal(selectionForContext(fromReload,core),envA);
  assert.equal(selectionForContext(fromReload,dbr),envB);
  assert.equal(selectionForContext(fromReload,environmentContextKey('local')),'');
});

test('Migration restores old Local selection but never guesses a Cloud workspace',()=>{
  const legacyId='d3b9e258-4b4e-4d84-a066-289456f46689';
  assert.equal(selectionForContext(readEnvironmentSelections(memoryStore(),{envScope:'local',activeEnvId:legacyId}),'local'),legacyId);
  const cloud=readEnvironmentSelections(memoryStore(),{envScope:'workspace',activeEnvId:legacyId});
  assert.deepEqual(cloud,{});
  assert.equal(selectionForContext(cloud,core),'');
});

test('Remote list results cannot appear for another workspace or another account',()=>{
  const coreResult={context:core,items:[{id:'core-dev',name:'Development',variables:[{key:'token',value:'CORE'}]}]};
  assert.equal(environmentsForContext(coreResult,core).length,1);
  assert.deepEqual(environmentsForContext(coreResult,dbr),[]);
  assert.deepEqual(environmentsForContext(coreResult,other),[]);
  assert.deepEqual(environmentsForContext({context:dbr,items:[{id:'dbr-dev'}]},core),[]);
  assert.deepEqual(environmentsForContext({context:core,items:null},core),[]);
});

test('Corrupt storage and invalid selection values are ignored; no secret values persisted',()=>{
  const invalid=memoryStore({pakpost_environment_selections_v6:'not-json'});
  assert.deepEqual(readEnvironmentSelections(invalid),{});
  const s=setSelectionForContext({},core,'token:very-secret');
  assert.deepEqual(s,{});
  const persisted=memoryStore();
  writeEnvironmentSelections(persisted,setSelectionForContext({},core,'e1'));
  const json=persisted.getItem('pakpost_environment_selections_v6');
  assert.ok(!json.includes('access_token'));
  assert.deepEqual(readEnvironmentSelections(persisted),{[core]:'e1'});
});

test('V6 React wiring scopes requests, active IDs, and editor instances to workspace',()=>{
  const app=readWorkbenchSource();
  const environmentView=readFileSync(new URL('../../src/features/environments/hooks/useScopedEnvironmentView.js',import.meta.url),'utf8');
  const cache=readFileSync(new URL('../../src/features/workspace/services/workspaceCache.js',import.meta.url),'utf8');
  const backend=readFileSync(new URL('../../../backend/src/Pakpost.Infrastructure/Persistence/Repositories/RequestEnvironmentRepository.cs',import.meta.url),'utf8');
  const handler=[
    '../../../backend/src/Pakpost.Application/Internal/Environments/Handlers/ListEnvironmentsHandler.cs',
    '../../../backend/src/Pakpost.Application/Internal/Environments/Handlers/UpdateEnvironmentHandler.cs'
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.match(environmentView,/environmentContextKey\(STORAGE_WORKSPACE, selectedWs, userId\)/);
  assert.match(environmentView,/environmentsForContext\(workspaceEnvironmentResult, cloudEnvironmentContext\)/);
  assert.match(environmentView,/selectionForContext\(environmentSelections, environmentContext\)/);
  const explorer=readFileSync(new URL('../../src/features/collections/components/WorkbenchExplorer.jsx',import.meta.url),'utf8');
  assert.match(explorer,/key=\{environmentContext\|\|'cloud-pending'\}/);
  assert.match(app,/let cancelled=false/);
  assert.match(app,/cloudEnvironmentContextRef\.current===context/);
  assert.match(environmentView,/cloudEnvironmentContextRef\.current\) return previous/);
  assert.match(app,/selectEnvironmentForContext\(STORAGE_WORKSPACE,workspaceId,me\?\.id,saved\[0\]\.id\)/);
  assert.match(app,/const existing=cloud\?await api\(`/);
  assert.doesNotMatch(app,/useEffect\(\(\)=>\{if\(envScope===STORAGE_WORKSPACE\)setActiveEnvId\(''\)/);
  assert.match(cache,/activeEnvId:envScope==='local'\?activeEnvId:''/);
  assert.match(backend,/\.Where\(environment\s*=>\s*environment\.WorkspaceId\s*==\s*workspaceId\)/);
  assert.match(handler,/EnvironmentAccess\.Verify\(\s*workspaces,\s*(?:q|query)\.WorkspaceId,\s*(?:q|query)\.ActorId,\s*false,\s*ct\)/);
  assert.match(handler,/environment\.WorkspaceId\s*!=\s*(?:c|command)\.WorkspaceId/);
});
