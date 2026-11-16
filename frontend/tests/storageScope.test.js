import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowedStorageScope,defaultStorageScope,STORAGE_LOCAL,STORAGE_WORKSPACE,cloudEndpointCount,importedRequestPayload,collectionImportSources,saveCloudCollections} from '../src/features/storageScope.js';
import {decodeStoredHeaders} from '../src/features/requestMetadata.js';
import {parseImportText} from '../src/features/importExport.js';

test('guest is always Local, authenticated default is Cloud',()=>{
  assert.equal(defaultStorageScope(false),STORAGE_LOCAL);
  assert.equal(defaultStorageScope(true),STORAGE_WORKSPACE);
  assert.equal(allowedStorageScope(false,STORAGE_WORKSPACE),STORAGE_LOCAL);
  assert.equal(allowedStorageScope(true,STORAGE_LOCAL),STORAGE_LOCAL);
  assert.equal(allowedStorageScope(true,STORAGE_WORKSPACE),STORAGE_WORKSPACE);
});

test('imported requests use actual backend DTO fields, preserve params/scripts/examples',()=>{
  const payload=importedRequestPayload({name:'Nested / My API',method:'post',url:'{{baseUrl}}/abc',format:'application/json',body:'{"test":true}',
    rows:[{key:'X-Test',value:'yes',enabled:true}],params:[{key:'a',value:'1'}],documentation:'Sample',responseExamples:[{name:'Okay',statusCode:200,body:'ok'}],
    preScript:'pm.environment.set("x", 1)',postScript:'pm.test("ok",()=>{})',formFields:[{key:'file',fileName:'test.txt',fileBase64:'DO-NOT-PERSIST'}]});
  assert.equal(payload.name,'Nested / My API');
  assert.equal(payload.method,'POST');
  assert.equal(payload.url,'{{baseUrl}}/abc');
  assert.equal(payload.bodyMode,'raw');
  assert.equal(payload.preRequestScript,'pm.environment.set("x", 1)');
  assert.equal(payload.postResponseScript,'pm.test("ok",()=>{})');
  assert.equal(JSON.parse(payload.formFieldsJson)[0].fileBase64,undefined);
  const metadata=decodeStoredHeaders(payload.headersJson);
  assert.equal(metadata.documentation,'Sample');
  assert.equal(metadata.params[0].key,'a');
  assert.equal(metadata.responseExamples[0].name,'Okay');
});

test('cloud payload rejects missing URL and literal authentication secrets, no silent fallback',()=>{
  assert.throws(()=>importedRequestPayload({name:'No URL',url:''}),/needs a URL/);
  assert.throws(()=>importedRequestPayload({name:'Secret',url:'https://example.org',authType:'bearer',bearerToken:'literal-token'}),/variable/);
});

test('native Postman folder path stays present in parsed request name for flat cloud backend',()=>{
  const input=JSON.stringify({info:{name:'API sample'},item:[{name:'Folder A',item:[{name:'Get user',request:{method:'GET',url:'https://example.org'}}]}]});
  const parsed=parseImportText(input);
  const sources=collectionImportSources(parsed);
  assert.equal(sources[0].name,'API sample');
  assert.deepEqual(sources[0].requests[0].folderPath,['Folder A']);
  assert.match(importedRequestPayload(sources[0].requests[0]).name,/Folder A/);
  assert.equal(importedRequestPayload({name:'Get user',folderPath:['Folder A'],url:'https://example.org'}).name,'Folder A / Get user');
});

test('a session backup restores tabs rather than creating Cloud collections',()=>{
  assert.deepEqual(collectionImportSources({kind:'pakpost',requests:[{name:'test'}]}),[]);
});


test('Cloud collection import uses the existing API, not browser storage',async()=>{
  const calls=[];
  const result=await saveCloudCollections([{name:'Imported',requests:[{name:'Request',url:'https://api.example.com'}]}],{
    workspaceId:'workspace-id',token:'signed-token',
    request:async (...args)=>{calls.push(args);return args[0].endsWith('/requests')?{id:'saved-request'}:{id:'collection-id'};}
  });
  assert.deepEqual(calls.map(x=>x[0]),[
    '/api/workspaces/workspace-id/collections',
    '/api/workspaces/workspace-id/collections/collection-id/requests'
  ]);
  assert.equal(calls[0][2].name,'Imported');
  assert.equal(calls[1][2].name,'Request');
  assert.equal(calls[1][3],'signed-token');
  assert.deepEqual(result,{count:1,createdCount:1,firstId:'collection-id'});
});

test('Cloud preflight rejects invalid requests before any write, and failed write never falls back',async()=>{
  let calls=0;
  const request=async()=>{calls++;throw Error('backend validation failure')};
  const settings={workspaceId:'ws',token:'auth',request};
  await assert.rejects(saveCloudCollections([{name:'Bad',requests:[{url:''}]}],settings),/needs a URL/);
  assert.equal(calls,0);
  await assert.rejects(saveCloudCollections([{name:'Good',requests:[{url:'https://example.org'}]}],settings),/Cloud import partially completed/);
  assert.equal(calls,1);
});

test('Insomnia env-only import does not create an empty cloud collection',()=>{
  assert.deepEqual(collectionImportSources({kind:'insomnia',requests:[],collections:[],environments:[{name:'Dev'}]}),[]);
});

test('Cloud endpoint count is available before expanding the collection',()=>{
  const c={id:'col-1',requestCount:8};
  assert.equal(cloudEndpointCount(c,{},'ws:col-1'),8);
  assert.equal(cloudEndpointCount(c,{'ws:col-1':[{id:1},{id:2}]},'ws:col-1'),2);
  assert.equal(cloudEndpointCount(c,{'ws:col-1':null},'ws:col-1'),8);
  assert.equal(cloudEndpointCount({id:'new',requestCount:0},{},'ws:new'),0);
});

test('Header controls ONE shared storage scope for Collections and Environments',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/const \[storageScope,setStorageScope\] = useState/);
  assert.match(app,/const collectionsScope=storageScope/);
  assert.match(app,/const envScope=storageScope/);
  assert.match(app,/onChange={updateStorageScope}/);
  assert.match(app,/Storage location for collections and environments/);
  assert.doesNotMatch(app,/<StorageScopeTabs/);
  assert.match(app,/Switch environment workspace/);
  assert.match(app,/Sign in to access Cloud environments/);
  assert.match(app,/cloudEndpointCount\(c,workspaceRequestLists,requestKey\)/);
});

test('Collections toolbar keeps all four sorts, provides compact expand/collapse and import/new actions',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const toolbar=app.split('<div className="pp-collections-toolbar-row">')[1]?.split('</div>')[0];
  assert.ok(toolbar);
  for(const label of ['Manual order','Name A–Z','Name Z–A','Recently updated'])assert.ok(toolbar.includes(label));
  assert.match(toolbar,/Expand all collections and folders/);
  assert.match(toolbar,/Collapse all collections and folders/);
  assert.match(app,/onClick={openCollectionImport}/);
  assert.match(app,/onSubmit={createExplorerCollection}/);
  assert.doesNotMatch(app,/pp-global-collection-sort/);
  assert.doesNotMatch(app,/pp-add-side.*New collection/);
});

test('Import dialog keeps explicit Local/Cloud destination and guards against env-only files',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/setCollectionImportDestination\(token&&canEditCloud\?STORAGE_WORKSPACE:STORAGE_LOCAL\)/);
  assert.match(app,/collectionImportSources\(parsed\)/);
  assert.match(app,/parsed.kind==='environment'/);
  assert.match(app,/importRequestsAndEnvironments\(parsed,allowedStorageScope/);
  assert.match(app,/<ImportDestinationPicker authenticated={!!token}/);
});
