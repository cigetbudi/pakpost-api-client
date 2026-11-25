import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestExecutionActions} from '../../src/features/requests/controllers/createRequestExecutionActions.js';
import {dispatchRequest} from '../../src/features/requests/services/interceptorClient.js';
const noop=()=>{};
function harness(mode='browser'){
  let outcome,loading=false,dispatches=0,variablesWritten=0;
  const executionRef={current:null};
  const currentTokenRef={current:'test-account'};
  const activeTabRef={current:'tab'};
  const draftsRef={current:{tab:{}}};
  const openTabsRef={current:[{id:'tab'}]};
  const sessionCollectionVariables={current:{}};
  let release;
  const deferred=new Promise(resolve=>release=resolve);
  const actions=createRequestExecutionActions({url:'https://example.test',method:'GET',rows:[],loading:false,interceptorMode:mode,
    currentTokenRef,executionRef,activeTabRef,draftsRef,openTabsRef,sessionCollectionVariables,
    setLoading:v=>loading=v,setResult:v=>outcome=v,appendConsoleEvent:noop,stashActive:noop,
    setPrettyResponse:noop,setResponsePretty:noop,setScriptError:noop,setScriptDiagnostic:noop,setScriptJump:noop,setScriptLog:noop,setScriptTests:noop,
    varsFromEnv:()=>({}),collectionVariableKey:()=> 'key',readCollectionVariables:()=>({}),buildOutgoing:()=>({}),
    writeCollectionVariables:()=>variablesWritten++,applyScriptVariables:()=>variablesWritten++,
    setOpenTabs:noop,setRecent:noop,setResTab:noop,isReadOnlyCloudTab:()=>true,getMessage:e=>e.message,
    dispatchRequest:async(command,mode,{signal})=>{dispatches++;await deferred;if(signal.aborted)throw Error('aborted');return {statusCode:200}},
    executeWorkbenchRequest:async opts=>{const response=await opts.dispatch({});opts.saveCollectionValues({});opts.saveEnvironmentValues({});return {response,command:{url:'https://example.test'},logs:[],tests:[]};}
  });
  return {actions,release,currentTokenRef,executionRef, get outcome(){return outcome},get loading(){return loading},get dispatches(){return dispatches},get variablesWritten(){return variablesWritten}};
}
test('cancelling supported request aborts signal, prevents duplicate sends and resets busy state',async()=>{
  const h=harness();const run=h.actions.sendRequest();assert.equal(h.loading,true);
  await h.actions.sendRequest();assert.equal(h.dispatches,1);const signal=h.executionRef.current.controller.signal;
  h.actions.cancelRequest();assert.equal(signal.aborted,true);h.release();await run;
  assert.equal(h.outcome.cancelled,true);assert.equal(h.loading,false);assert.equal(h.executionRef.current,null);assert.equal(h.variablesWritten,0);
});
test('native cancellation aborts the client execution and discards the result',async()=>{
  const h=harness('native');const run=h.actions.sendRequest();h.actions.cancelRequest();assert.equal(h.executionRef.current.controller.signal.aborted,true);h.release();await run;assert.equal(h.outcome.cancelled,true);
});
test('browser dispatch forwards cancellation to the underlying fetch signal',async()=>{
  const originalFetch=globalThis.fetch;let observed;
  globalThis.fetch=async(url,init)=>{observed=init.signal;return new Promise((resolve,reject)=>{if(observed.aborted)reject(Error('aborted'));else observed.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});};
  try{const c=new AbortController();const run=dispatchRequest({url:'https://example.test',method:'GET'},'browser',{signal:c.signal});c.abort();await assert.rejects(run,/aborted/);assert.equal(observed.aborted,true);}finally{globalThis.fetch=originalFetch;}
});
test('browser elapsedMs reports body read as well as header wait',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){setTimeout(()=>{controller.enqueue(new TextEncoder().encode('hello'));controller.close();},35);}}),{status:200});
  try{const result=await dispatchRequest({url:'https://example.test',method:'GET'},'browser');assert.equal(result.elapsedMs,result.timing.totalMs);assert.ok(result.timing.bodyMs>0);assert.equal(result.body,'hello');}finally{globalThis.fetch=originalFetch;}
});
