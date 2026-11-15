import test from 'node:test';
import assert from 'node:assert/strict';
import {createResponseExample,exampleToResult,sanitizeResponseExamples,statusTone,suggestExampleName,upsertResponseExample} from '../src/features/responseExamples.js';
import {encodeStoredHeaders,decodeStoredHeaders} from '../src/features/requestMetadata.js';
import {createPostmanCollection,parsePostmanCollection} from '../src/features/importExport.js';
import {exportOpenApiCollection} from '../src/features/exportFormats.js';
import {applyLocalAction} from '../src/features/localCollectionActions.js';

const base={name:'Withdrawal',requestName:'Withdrawal',method:'POST',url:'https://example.org/api/withdrawal',rows:[],params:[],format:'application/json'};
const response={statusCode:400,reasonPhrase:'Bad Request',headers:{'content-type':'application/json','Set-Cookie':'session=SECRET'},body:'{"message":"Invalid Amount","responseCode":"4001"}',elapsedMs:53};

test('status code colors and suggested names support success and failure cases',()=>{
  assert.equal(statusTone(200),'good');
  assert.equal(statusTone(302),'warn');
  assert.equal(statusTone(401),'bad');
  assert.equal(statusTone(503),'bad');
  assert.equal(suggestExampleName(response),'Failed - Invalid Amount');
  assert.equal(suggestExampleName({...response,statusCode:200,reasonPhrase:'OK',body:'{}'}),'Success');
});

test('response capture retains body and status but redacts sensitive response headers',()=>{
  const example=createResponseExample(response,{name:'Failed - Invalid Amount'});
  assert.equal(example.statusCode,400);
  assert.equal(example.body,response.body);
  assert.equal(example.headers['Set-Cookie'],'[REDACTED]');
  assert.equal(exampleToResult(example).statusCode,400);
  assert.equal(upsertResponseExample([example],createResponseExample(response,{name:'Failed - Invalid Amount'})).length,1);
});

test('workspace JSONB metadata roundtrips examples without exposing transport headers',()=>{
  const example=createResponseExample(response,{name:'Invalid Amount'});
  const json=encodeStoredHeaders([{key:'X-Test',value:'demo'}],[], 'API description',[example]);
  const restored=decodeStoredHeaders(json);
  assert.equal(restored.responseExamples[0].statusCode,400);
  assert.equal(restored.documentation,'API description');
  assert.equal(JSON.parse(json)['X-Test'],'demo');
  assert.equal(decodeStoredHeaders('{"Accept":"application/json"}').responseExamples.length,0);
});

test('Postman and OpenAPI exports include response examples, Postman import restores them',()=>{
  const examples=[
    createResponseExample({...response,statusCode:200,reasonPhrase:'OK',body:'{"ok":true}'},{name:'Success'}),
    createResponseExample(response,{name:'Failed - Invalid Amount'})
  ];
  const source={...base,responseExamples:examples};
  const exported=createPostmanCollection([source],{name:'Demo'});
  assert.equal(exported.item[0].response.length,2);
  const imported=parsePostmanCollection(exported);
  assert.equal(imported[0].responseExamples.length,2);
  assert.equal(imported[0].responseExamples[1].statusCode,400);
  const openapi=exportOpenApiCollection([source],{name:'Demo'});
  assert.equal(openapi.paths['/api/withdrawal'].post.responses['200'].content['application/json'].examples.success.value.ok,true);
  assert.equal(openapi.paths['/api/withdrawal'].post.responses['400'].content['application/json'].examples['failed-invalid-amount'].summary,'Failed - Invalid Amount');
});

test('local example delete leaves request and other examples intact',()=>{
  const col={id:'col-1',name:'Withdrawal',requests:[{...base,id:'req-1',folderPath:[],responseExamples:[{id:'a',name:'Success',statusCode:200},{id:'b',name:'Invalid Amount',statusCode:400}]}]};
  const next=applyLocalAction([col],{type:'deleteExample',collectionId:'col-1',requestId:'req-1',exampleId:'b'});
  assert.equal(next[0].requests[0].responseExamples.length,1);
  assert.equal(next[0].requests[0].responseExamples[0].name,'Success');
  assert.equal(col.requests[0].responseExamples.length,2);
});

test('response preview payload is capped to keep frontend caching bounded',()=>{
  const data=sanitizeResponseExamples(Array.from({length:25},(_,i)=>({id:`x${i}`,name:`Case ${i}`,statusCode:200,body:'a'.repeat(100000)})));
  assert.equal(data.length,15);
  assert.equal(data[0].body.length,64000);
});
