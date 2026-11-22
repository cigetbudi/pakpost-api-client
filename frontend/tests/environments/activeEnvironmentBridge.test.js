import test from 'node:test';
import assert from 'node:assert/strict';
import {createActiveEnvironmentBridge} from '../../src/features/environments/controllers/createActiveEnvironmentBridge.js';

test('read-only Cloud variable edits stay in session overlays and code previews are redacted',async()=>{
  let writes=0,refreshes=0,notice='';
  const overlays={current:new Map()};
  const env={id:'e1',name:'QA',variables:[{key:'SESSION_SECRET',value:'hidden'}]};
  const bridge=createActiveEnvironmentBridge({
    STORAGE_WORKSPACE:'workspace',envScope:'workspace',canWriteEnvironment:false,
    activeEnvironment:env,activeSessionEnvironmentKey:'ws:e1',activeSessionOverrides:{},
    sessionEnvironmentOverlays:overlays,
    readableEnvironmentValues:()=>({SESSION_SECRET:'hidden',STATUS:'ready'}),
    applySessionOverrides:(base,patch)=>({...base,...patch}),
    isSensitiveVariable:key=>key==='SESSION_SECRET',
    putEnvironmentVariable:()=>[{key:'SESSION_SECRET',value:'replacement'}],
    sessionOverridesFromValues:(_,values)=>values,
    storeSessionOverrides:(map,key,value)=>{map.set(key,value);return true;},
    refreshSessionEnvironment:()=>{refreshes++;},
    persistEnvironment:async()=>{writes++;},
    setNotice:value=>{notice=value;},
    selectedWs:'ws',workspaces:[{id:'ws',name:'Delivery'}],setExplorerTab:()=>{},
  });
  assert.equal(bridge.varsFromEnv(false).SESSION_SECRET,'[REDACTED]');
  assert.match(bridge.variableUi.source,/Session-only edits/);
  await bridge.variableUi.onEditVariable('SESSION_SECRET','replacement');
  assert.equal(writes,0);
  assert.equal(refreshes,1);
  assert.equal(overlays.current.get('ws:e1').SESSION_SECRET,'replacement');
  assert.match(notice,/session only/);
});

test('writable Local edits persist environment changes',async()=>{
  let saved=null;
  const env={id:'local1',name:'Local env',variables:[]};
  const bridge=createActiveEnvironmentBridge({
    STORAGE_WORKSPACE:'workspace',envScope:'local',canWriteEnvironment:true,
    activeEnvironment:env,activeSessionOverrides:{},
    readableEnvironmentValues:()=>({}),applySessionOverrides:v=>v,
    putEnvironmentVariable:()=>[{key:'BASE_URL',value:'https://example.test'}],
    persistEnvironment:async value=>{saved=value;},
  });
  await bridge.variableUi.onEditVariable('BASE_URL','https://example.test');
  assert.equal(saved.id,'local1');
  assert.equal(saved.variables[0].key,'BASE_URL');
});
