import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core';
import releaseVariant from '@jitl/quickjs-singlefile-browser-release-sync';
import {installSandboxRandom} from '../../src/features/requests/services/sandboxRandom.js';

const require = createRequire(import.meta.url);
test('actual QuickJS and CryptoJS generate salt/IV and roundtrip encrypted synthetic data',async()=>{
  const QuickJS = await newQuickJSWASMModuleFromVariant(releaseVariant);
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(48 * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024);
  const ctx = runtime.newContext();
  function evaluate(code, filename) {
    const result = ctx.evalCode(code,filename);
    if(result.error){let error;try{error=ctx.dump(result.error);}finally{result.error.dispose();}throw Error(JSON.stringify(error));}
    try{return ctx.dump(result.value);}finally{result.value.dispose();}
  }
  try {
    installSandboxRandom(ctx,webcrypto);
    evaluate(readFileSync(require.resolve('crypto-js/crypto-js.js'),'utf8'),'crypto-js.js');
    const result=evaluate(`(function(){
      const iv=CryptoJS.lib.WordArray.random(16);
      const salt=CryptoJS.lib.WordArray.random(64);
      const key=CryptoJS.PBKDF2('synthetic-test-only',salt,{keySize:256/32,iterations:2145,hasher:CryptoJS.algo.SHA512});
      const encrypted=CryptoJS.AES.encrypt('hello',key,{iv});
      const decrypted=CryptoJS.AES.decrypt(encrypted,key,{iv}).toString(CryptoJS.enc.Utf8);
      return JSON.stringify({iv:iv.sigBytes,salt:salt.sigBytes,decrypted,distinct:iv.toString()!==CryptoJS.lib.WordArray.random(16).toString()});
    })()`, 'synthetic.js');
    assert.deepEqual(JSON.parse(result),{iv:16,salt:64,decrypted:'hello',distinct:true});
  } finally {ctx.dispose();runtime.dispose();}
});
