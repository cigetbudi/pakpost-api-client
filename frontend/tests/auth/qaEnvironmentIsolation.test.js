import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sessionEnvironmentKey, readableEnvironmentValues, applySessionOverrides,
  sessionOverridesFromValues, storeSessionOverrides,
} from '../../src/features/environments/services/sessionEnvironment.js';

const read = path => fs.readFileSync(new URL('../../../'+path,import.meta.url),'utf8');

test('QA session key is isolated by account, workspace and environment',()=>{
  const accountA='workspace:userA:workspaceDBR';
  const accountB='workspace:userB:workspaceDBR';
  const key=sessionEnvironmentKey(accountA,'environmentDev');
  assert.equal(key,'workspace:userA:workspaceDBR:environmentDev');
  assert.notEqual(key,sessionEnvironmentKey(accountB,'environmentDev'));
  assert.notEqual(key,sessionEnvironmentKey('workspace:userA:workspaceCore','environmentDev'));
  assert.notEqual(key,sessionEnvironmentKey(accountA,'environmentProd'));
  assert.equal(sessionEnvironmentKey('local','environmentDev'),'');
  assert.equal(sessionEnvironmentKey(accountA,'../other'),'');
});

test('restricted Cloud secret is never returned as a readable value',()=>{
  const cloud={variables:[
    {key:'baseUrl',value:'https://dbr.example.test',isSecret:false,isRedacted:false},
    {key:'token',value:'',isSecret:true,isRedacted:true},
  ]};
  assert.deepEqual(readableEnvironmentValues(cloud),{baseUrl:'https://dbr.example.test'});
});

test('QA pm.environment.set overlays variables in memory without changing Cloud data',()=>{
  const cloud={variables:[{key:'baseUrl',value:'https://old.example.test'}]};
  const original=readableEnvironmentValues(cloud);
  const updated={...original,baseUrl:'https://new.example.test',token:'personal-test-token'};
  const overrides=sessionOverridesFromValues(original,updated);
  assert.deepEqual(overrides,{baseUrl:'https://new.example.test',token:'personal-test-token'});
  assert.deepEqual(applySessionOverrides(original,overrides),updated);
  assert.equal(cloud.variables[0].value,'https://old.example.test');
});

test('QA pm.environment.unset temporarily hides a Cloud variable',()=>{
  const base={baseUrl:'https://old.example.test',feature:'enabled'};
  const patch=sessionOverridesFromValues(base,{baseUrl:'https://old.example.test'});
  assert.deepEqual(patch,{feature:null});
  assert.deepEqual(applySessionOverrides(base,patch),{baseUrl:'https://old.example.test'});
});

test('restoring original value clears the temporary override',()=>{
  const base={baseUrl:'https://old.example.test'};
  assert.deepEqual(sessionOverridesFromValues(base,{...base}),{});
});

test('QA session overrides are RAM-only and separate across context keys',()=>{
  const store=new Map();
  const core=sessionEnvironmentKey('workspace:userA:core','dev');
  const dbr=sessionEnvironmentKey('workspace:userA:dbr','dev');
  assert.equal(storeSessionOverrides(store,core,{token:'core-token'}),true);
  assert.equal(storeSessionOverrides(store,dbr,{token:'dbr-token'}),true);
  assert.equal(storeSessionOverrides(store,core,{token:'core-token'}),false);
  assert.equal(applySessionOverrides({},store.get(core)).token,'core-token');
  assert.equal(applySessionOverrides({},store.get(dbr)).token,'dbr-token');
  store.clear();
  assert.equal(store.size,0);
});

test('session overlay memory cache has a bounded size',()=>{
  const store=new Map();
  for(let i=0;i<5;i++)storeSessionOverrides(store,'workspace:userA:core:e'+i,{test:String(i)},3);
  assert.deepEqual([...store.keys()],['workspace:userA:core:e2','workspace:userA:core:e3','workspace:userA:core:e4']);
});

test('Send does not call Cloud PUT for read-only QA, Writer or Developer',()=>{
  const app=readWorkbenchSource();
  assert.match(app,/if\(scope===STORAGE_WORKSPACE&&!canWrite\)\{[\s\S]*?rememberSessionValues\(sessionKey,environment,values\);[\s\S]*?return;/);
  const executor=read('frontend/src/features/requests/services/executeWorkbenchRequest.js');
  assert.match(app,/saveEnvironmentValues:values=>isCurrent\(\)\?applyScriptVariables\(values,runEnvironment\)/);
  assert.match(app,/const isCurrent=\(\)=>runToken===currentTokenRef\.current&&!controller\.signal\.aborted/);
  assert.match(executor,/await saveEnvironmentValues\(pre\.environmentVariables \|\| variables\)/);
  assert.match(executor,/await saveEnvironmentValues\(post\.environmentVariables \|\| post\.variables\)/);
  assert.match(app,/const runEnvironment=\{environment:activeEnvironment,scope:envScope,sessionKey:activeSessionEnvironmentKey/);
  assert.match(app,/const canWriteEnvironment=envScope!==STORAGE_WORKSPACE\|\|\(membersWorkspaceId===selectedWs&&canWorkspace\(currentWorkspaceMember\(members,me\),'environment\.write'\)\)/);
  assert.doesNotMatch(app,/sessionStorage\.setItem\([^\n]*sessionEnvironment/);
  assert.doesNotMatch(app,/localStorage\.setItem\([^\n]*sessionEnvironment/);
});

test('backend authorizes environment selection with read, not write permission',()=>{
  const env=read('backend/src/Pakpost.Application/Internal/Environments/Services/EnvironmentAccess.cs');
  assert.match(env,/write\s*\?\s*WorkspacePermissions\.EnvironmentWrite\s*:\s*WorkspacePermissions\.EnvironmentRead/);
});
