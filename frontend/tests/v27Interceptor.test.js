import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {readInterceptorMode,writeInterceptorMode,extensionBridge,prepareBrowserRequest,dispatchRequest} from '../src/features/interceptorClient.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const bgSource=fs.readFileSync(path.join(root,'extension/common/background.js'),'utf8');
const manifestChrome=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.chrome.json'),'utf8'));
const manifestFirefox=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.firefox.json'),'utf8'));

function makeHarness({origins=['http://localhost:5173'],destinations=['https://echo.example.test'],grant=true}={}){
  let receivedListener;
  let fetchCalls=[];
  const chrome={
    runtime:{id:'extension-test-id',lastError:null,getManifest:()=>({version:'0.1.0'}),
      onMessage:{addListener(fn){receivedListener=fn}},onInstalled:{addListener(){}},onStartup:{addListener(){}}},
    storage:{local:{async get(){return {allowedOrigins:origins,allowedDestinations:destinations}}}},
    permissions:{async contains(){return grant},request(){}},
    scripting:{async getRegisteredContentScripts(){return []},async registerContentScripts(){},async unregisterContentScripts(){}},
  };
  const fetch=async(url,init)=>{fetchCalls.push({url,init});return {
    status:200,statusText:'OK',type:'basic',headers:new Headers([['content-type','application/json']]),
    body:null,async arrayBuffer(){return new TextEncoder().encode('{"ok":true}').buffer}
  }};
  vm.runInNewContext(bgSource,{chrome,fetch,TextEncoder,TextDecoder,Headers,FormData,Blob,Uint8Array,URL,URLSearchParams,
    atob,btoa,performance,setTimeout,clearTimeout,AbortController,Map,Set});
  const send=(payload,{url='http://localhost:5173/app',tabUrl='http://localhost:5173/app',frameId=0}={})=>new Promise(resolve=>{
    receivedListener({kind:'PAKPOST_BRIDGE',channel:'pakpost.interceptor.v1',action:'SEND',payload},
      {url,tab:{id:5,url:tabUrl},frameId},resolve);
  });
  return {send,fetchCalls,chrome};
}

test('default interceptor is secure proxy; preference persisted without secrets',()=>{
  const data=new Map();const store={getItem:k=>data.get(k)||'',setItem:(k,v)=>data.set(k,v)};
  assert.equal(readInterceptorMode(store),'proxy');
  writeInterceptorMode(store,'extension');assert.equal(readInterceptorMode(store),'extension');
  assert.throws(()=>writeInterceptorMode(store,'agent'));
  assert.equal(data.size,1);
});

test('extension bridge correlates only same-origin responses and rejects spoofed events',async()=>{
  let receive;let sent;
  const fake={location:{origin:'http://localhost:5173'},postMessage(message){sent=message},
    addEventListener(name,listener){receive=listener},removeEventListener(){}};
  const result=extensionBridge('PING',null,{target:fake,timeoutMs:100});
  receive({source:fake,origin:'https://evil.example',data:{channel:sent.channel,type:'RESPONSE',id:sent.id,ok:true,result:{version:'fake'}}});
  receive({source:fake,origin:fake.location.origin,data:{channel:sent.channel,type:'RESPONSE',id:sent.id+'bad',ok:true}});
  receive({source:fake,origin:fake.location.origin,data:{channel:sent.channel,type:'RESPONSE',id:sent.id,ok:true,result:{version:'0.1.0'}}});
  assert.equal((await result).version,'0.1.0');
});

test('extension rejects untrusted origin even when destination is approved',async()=>{
  const h=makeHarness();const result=await h.send({method:'GET',url:'https://echo.example.test'},{url:'http://untrusted.test:5173/'});
  assert.equal(result.ok,false);assert.match(result.error,/not been authorized/i);assert.equal(h.fetchCalls.length,0);
});

test('extension rejects unapproved destinations and credentials in URL',async()=>{
  const h=makeHarness();
  const blocked=await h.send({method:'GET',url:'http://10.10.1.5/admin'});
  assert.equal(blocked.ok,false);assert.match(blocked.error,/not allowed/i);
  const credentials=await h.send({method:'GET',url:'https://user:secret@echo.example.test/private'});
  assert.equal(credentials.ok,false);assert.match(credentials.error,/without embedded credentials/i);
  assert.equal(h.fetchCalls.length,0);
});

test('extension rejects missing browser permission and disallowed headers',async()=>{
  const h=makeHarness({grant:false});
  const result=await h.send({method:'GET',url:'https://echo.example.test'});
  assert.equal(result.ok,false);assert.equal(h.fetchCalls.length,0);
  const allowed=makeHarness();
  const forbidden=await allowed.send({method:'GET',url:'https://echo.example.test',headers:{Host:'attacker.test'}});
  assert.equal(forbidden.ok,false);assert.equal(allowed.fetchCalls.length,0);
});

test('extension sends approved POST with credentials omitted and redirects blocked',async()=>{
  const h=makeHarness();
  const result=await h.send({method:'POST',url:'https://echo.example.test/post',headers:{'X-Test':'good','Authorization':'Bearer demo'},bodyMode:'raw',body:'{}',contentType:'application/json'});
  assert.equal(result.ok,true);assert.equal(result.result.statusCode,200);
  assert.equal(h.fetchCalls.length,1);
  const {init}=h.fetchCalls[0];
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.referrerPolicy,'no-referrer');
  assert.equal(init.headers.get('Authorization'),'Bearer demo');
  assert.equal(init.body,'{}');
});

test('page browser mode explicitly applies CORS (not proxy), and rejects invalid headers',()=>{
  const {init}=prepareBrowserRequest({method:'GET',url:'https://example.test',headers:{'X-Demo':'1'}});
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');
  assert.throws(()=>prepareBrowserRequest({method:'GET',url:'https://example.test',headers:{Host:'evil'}}));
});

test('extension mode never silently falls back to backend proxy',async()=>{
  const fake={location:{origin:'http://localhost:5173'},postMessage(){},addEventListener(){},removeEventListener(){}};
  assert.equal(await dispatchRequest({},'proxy'),null);
  await assert.rejects(extensionBridge('SEND',{}, {target:fake,timeoutMs:5}),/Extension timed out/);
});

test('chrome and firefox require runtime host grants; no broad install-time host access',()=>{
  for(const manifest of [manifestChrome,manifestFirefox]){
    assert.equal(manifest.manifest_version,3);
    assert.deepEqual(manifest.optional_host_permissions,['http://*/*','https://*/*']);
    assert.equal(manifest.host_permissions,undefined);
    assert.ok(manifest.permissions.includes('scripting'));
  }
  assert.ok(manifestChrome.background.service_worker);
  assert.ok(manifestFirefox.background.scripts);
});


test('extension validates the exact calling port, even if the same host has permission',async()=>{
  const h=makeHarness();
  const response=await h.send({method:'GET',url:'https://echo.example.test'},
    {url:'http://localhost:3000/',tabUrl:'http://localhost:3000/'});
  assert.equal(response.ok,false);assert.match(response.error,/not been authorized/i);assert.equal(h.fetchCalls.length,0);
});

test('extension refuses requests from subframes',async()=>{
  const h=makeHarness();const response=await h.send({method:'GET',url:'https://echo.example.test'}, {frameId:1});
  assert.equal(response.ok,false);assert.match(response.error,/top-level/i);assert.equal(h.fetchCalls.length,0);
});
