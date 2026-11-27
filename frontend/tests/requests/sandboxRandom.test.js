import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {installSandboxRandom, MAX_RANDOM_WORDS} from '../../src/features/requests/services/sandboxRandom.js';

// Exercise the real guest shim with a minimal adapter for QuickJS handles.
// The separate integration test exercises actual QuickJS WASM and CryptoJS.
function context(hostCrypto) {
  const guest = vm.createContext({});
  const handle = value => ({value,dispose(){}});
  installSandboxRandom({
    global:guest,
    newFunction:(_name,fn)=>handle(()=>fn().value),
    newNumber:handle,
    setProp:(obj,key,h)=>{obj[key]=h.value;},
    evalCode:code=>({value:handle(vm.runInContext(code,guest))}),
    dump:h=>h.value,
  },hostCrypto);
  return code=>vm.runInContext(code,guest);
}

test('native entropy words reach only the guest integer array',()=>{
  let calls=0;
  const run=context({getRandomValues(target){target[0]=++calls===1?0xffffffff:0x12345678;return target;}});
  assert.equal(run('JSON.stringify(Array.from(crypto.getRandomValues(new Uint32Array(2))))'),'[4294967295,305419896]');
  assert.equal(calls,2);
  assert.equal(run('typeof __pakpostRandomWord'),'undefined');
  assert.equal(run('typeof crypto.subtle'),'undefined');
  assert.equal(run('typeof fetch'),'undefined');
});
test('native WebCrypto produces the required IV and salt bytes',()=>{
  const run=context(webcrypto);
  assert.equal(run('crypto.getRandomValues(new Uint32Array(4)).byteLength'),16);
  assert.equal(run('crypto.getRandomValues(new Uint32Array(16)).byteLength'),64);
});
test('fails closed when entropy is unavailable',()=>{
  const run=context({getRandomValues(){throw Error('unavailable');}});
  assert.throws(()=>run('crypto.getRandomValues(new Uint32Array(1))'),/Secure random unavailable/);
});
test('rejects unsupported arrays and enforces a cumulative phase quota',()=>{
  let calls=0;
  const run=context({getRandomValues(target){calls++;target[0]=7;return target;}});
  assert.throws(()=>run('crypto.getRandomValues(new Float64Array(1))'),/Uint32Array only/);
  assert.throws(()=>run(`crypto.getRandomValues(new Uint32Array(${MAX_RANDOM_WORDS+1}))`),/limit exceeded/);
  assert.equal(calls,0);
  run(`crypto.getRandomValues(new Uint32Array(${MAX_RANDOM_WORDS}))`);
  assert.equal(calls,MAX_RANDOM_WORDS);
  assert.throws(()=>run('crypto.getRandomValues(new Uint32Array(1))'),/quota exhausted/);
  assert.equal(calls,MAX_RANDOM_WORDS);
});
