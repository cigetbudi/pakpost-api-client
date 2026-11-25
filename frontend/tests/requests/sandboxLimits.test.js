import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScriptOutput,validateScriptInput,SANDBOX_LIMITS} from '../../src/features/requests/services/sandboxLimits.js';
import {runSandbox} from '../../src/features/requests/services/runScript.js';
const valid={variables:{a:'b'},environmentVariables:{},collectionVariables:{},localVariables:{},requestHeaderOverrides:{},logs:[],tests:[],scriptFault:null};
test('normal sandbox result passes',()=>assert.deepEqual(parseScriptOutput(JSON.stringify(valid)),valid));
test('oversized code is refused before worker creation, including UTF8',async()=>{
  assert.throws(()=>validateScriptInput({code:'é'.repeat(SANDBOX_LIMITS.code)}),/source size/);
  await assert.rejects(runSandbox('x'.repeat(SANDBOX_LIMITS.code+1),'pre',{},null,null),/source size/);
});
test('oversized payload and output fail closed',()=>{
  assert.throws(()=>validateScriptInput({code:'a',request:'x'.repeat(SANDBOX_LIMITS.input)}),/input/);
  assert.throws(()=>parseScriptOutput('x'.repeat(SANDBOX_LIMITS.output+1)),/output/);
});
test('prototype keys and malformed maps are refused',()=>{
  for(const field of ['variables','environmentVariables','collectionVariables','localVariables','requestHeaderOverrides']){
    assert.throws(()=>parseScriptOutput(JSON.stringify({...valid,[field]:JSON.parse('{"__proto__":"x"}')})),/reserved/);
    assert.throws(()=>parseScriptOutput(JSON.stringify({...valid,[field]:[]})),/reserved/);
  }
});
test('log and assertion records are bounded',()=>{
  assert.throws(()=>parseScriptOutput(JSON.stringify({...valid,logs:['x'.repeat(8193)]})),/log limit/);
  assert.throws(()=>parseScriptOutput(JSON.stringify({...valid,tests:Array(501).fill({name:'ok',passed:true})})),/assertion limit/);
  assert.throws(()=>parseScriptOutput(JSON.stringify({...valid,tests:[{name:'bad',passed:'yes'}]})),/assertion limit/);
});
test('worker is terminated even when postMessage throws',async()=>{
  const before=globalThis.Worker;let terminated=0;
  globalThis.Worker=class{postMessage(){throw Error('clone failed')}terminate(){terminated++}};
  try{await assert.rejects(runSandbox('x','pre',{},null,null),/could not be sent/);assert.equal(terminated,1);}
  finally{if(before===undefined)delete globalThis.Worker;else globalThis.Worker=before;}
});
