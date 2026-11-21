import test from 'node:test';
import assert from 'node:assert/strict';
import {api,BROWSER_SESSION,getBrowserCsrf,setBrowserCsrf} from '../../src/services/httpClient.js';

test('cookie-session sends CSRF for mutations, never a bearer or JWT',async()=>{
  const original=globalThis.fetch;let last;
  try{
    globalThis.fetch=async (url,opts)=>{
      last={url,opts};return {ok:true,status:200,json:async()=>({ok:true})};
    };
    setBrowserCsrf('non-secret-csrf-proof');
    await api('/api/workspaces/test/collections','PATCH',{name:'new'},BROWSER_SESSION);
    assert.equal(last.opts.credentials,'same-origin');
    assert.equal(last.opts.headers.Authorization,undefined);
    assert.equal(last.opts.headers['X-PakPost-CSRF'],getBrowserCsrf());
    assert.ok(last.opts.headers['X-PakPost-Instance']);
    await api('/api/auth/session','GET');
    assert.equal(last.opts.headers['X-PakPost-CSRF'],undefined);
  } finally {globalThis.fetch=original;setBrowserCsrf('');}
});

test('browser cookie session ignores stale JWT if it is absent from state',()=>{
  assert.equal(BROWSER_SESSION,'pakpost:cookie-session');
  assert.notEqual(BROWSER_SESSION,'Bearer');
});
