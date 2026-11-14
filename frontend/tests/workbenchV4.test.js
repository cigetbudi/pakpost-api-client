import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCurl,parseImportText,createPostmanCollection,parsePostmanCollection,createSessionExport,parseSession} from '../src/features/importExport.js';
import {readWorkbenchCache,writeWorkbenchCache} from '../src/features/workspaceCache.js';

test('paste a multiline Postman cURL with JSON, headers and query params',()=>{
  const r=parseCurl(`curl --location 'https://postman-echo.com/post?page=2&active=true' \\\n  --header 'Content-Type: application/json' \\\n  --header 'X-Signature: {{signature}}' \\\n  --data-raw '{"amount":100000,"trxId":"TEST-001"}'`);
  assert.equal(r.method,'POST');assert.equal(r.url,'https://postman-echo.com/post');assert.deepEqual(r.params.slice(0,2),[{key:'page',value:'2'},{key:'active',value:'true'}]);
  assert.equal(r.format,'application/json');assert.match(r.body,/TEST-001/);assert.equal(r.rows[1].value,'{{signature}}');
});
test('cURL -X GET does not change to POST when body data is supplied',()=>{
  const r=parseCurl(`curl -X GET https://example.com/api --data 'a=1'`);
  assert.equal(r.method,'GET');assert.equal(r.body,'a=1');
});
test('cURL -G moves form data to query params',()=>{
  const r=parseCurl(`curl -G 'https://example.com/items' -d 'page=2&sort=asc'`);
  assert.equal(r.method,'GET');assert.equal(r.body,'');assert.equal(r.params[0].value,'2');
});
test('cURL multipart file imports metadata, not local filesystem content',()=>{
  const r=parseCurl(`curl https://example.com/upload -F 'file=@/tmp/demo.pdf' -F 'title=Test'`);
  assert.equal(r.format,'multipart/form-data');assert.equal(r.formFields[0].fileName,'demo.pdf');assert.equal(r.formFields[1].value,'Test');
});
test('cURL parser never runs shell and rejects unsupported options',()=>{
  assert.throws(()=>parseCurl(`curl --output /tmp/ohno https://example.com`),/Unsupported cURL flag/);
  assert.throws(()=>parseCurl(`curl -H 'Oops' https://example.com`),/Invalid header/);
});
test('Postman v2.1 import handles nested items, headers, scripts, and body',()=>{
  const source={info:{name:'Demo'},item:[{name:'Folder',item:[{name:'Create',request:{method:'POST',url:{raw:'https://example.com/post?a=1',query:[{key:'a',value:'1'}]},header:[{key:'Accept',value:'application/json'}],body:{mode:'raw',raw:'{"ok":true}',options:{raw:{language:'json'}}}},event:[{listen:'test',script:{exec:['pm.test("ok", () => {})']}}]}]}]};
  const items=parsePostmanCollection(source);assert.equal(items.length,1);assert.equal(items[0].name,'Folder / Create');assert.equal(items[0].postScript,'pm.test("ok", () => {})');assert.equal(items[0].params[0].key,'a');
});
test('export to Postman v2.1 and roundtrip with script and body',()=>{
  const src=parseCurl('curl -X POST https://example.com/post -H "X-Signature: abc" --data-raw \'{"ok":true}\'');src.postScript='console.log(pm.response.code)';
  const exported=createPostmanCollection([src]);assert.equal(exported.item[0].request.header.find(x=>x.key==='X-Signature').value,'{{REDACTED}}');
  const again=parsePostmanCollection(exported);assert.equal(again[0].postScript,src.postScript);assert.equal(again[0].body,src.body);
});
test('Pakpost JSON session export strips known header secrets and environment secret values',()=>{
  const r=parseCurl('curl https://example.com -H "Authorization: Bearer secret"');
  const data=createSessionExport([r],[{name:'DEV',variables:[{key:'token',value:'topsecret',isSecret:true}]}]);
  assert.equal(data.requests[0].rows[0].value,'{{REDACTED}}');assert.equal(data.environments[0].variables[0].value,'');
  assert.equal(parseSession(data).requests[0].method,'GET');
});
test('local session recovery is redacted while refresh snapshot can restore active tab',()=>{
  const makeStorage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
  globalThis.sessionStorage=makeStorage();globalThis.localStorage=makeStorage();
  const draft={method:'POST',url:'https://example.com',rows:[{key:'Authorization',value:'Bearer secret'}],body:'{"x":1}',bearerToken:'secret',params:[],formFields:[],binaryFile:{name:'',base64:''}};
  const state={openTabs:[{id:'t1',name:'Test',method:'POST'}],activeTabId:'t1',drafts:{},active:draft,recent:[],split:'vertical',explorerTab:'code',sidebarCollapsed:false,activeEnvId:'',envScope:'local'};
  writeWorkbenchCache(state);
  assert.equal(readWorkbenchCache().drafts.t1.body,'{"x":1}');
  assert.equal(readWorkbenchCache().drafts.t1.bearerToken,'secret');
  sessionStorage.removeItem('pakpost_workbench_v4_live');
  const recovered=readWorkbenchCache();assert.equal(recovered.drafts.t1.bearerToken,'');assert.equal(recovered.drafts.t1.rows[0].value,'');
});
