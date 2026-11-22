import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readWorkbenchSource} from '../support/workbenchSource.js';
import {applyLocalAction} from '../../src/features/collections/services/localCollectionActions.js';
import {renameResponseExample} from '../../src/features/requests/services/responseExamples.js';
import {encodeStoredHeaders,decodeStoredHeaders} from '../../src/features/requests/services/requestMetadata.js';
import {createLocalPostmanExport} from '../../src/features/import-export/services/importExport.js';
import {exportOpenApiCollection} from '../../src/features/import-export/services/exportFormats.js';

const examples=[
  {id:'success',name:'Success',statusCode:200,reasonPhrase:'OK',contentType:'application/json',headers:{'Content-Type':'application/json'},body:'{"code":"00"}',description:'Valid transaction'},
  {id:'failed',name:'Invalid Amount',statusCode:400,reasonPhrase:'Bad Request',contentType:'application/json',headers:{'Content-Type':'application/json'},body:'{"code":"01"}',description:'Invalid amount'}
];
const collections=[{
  id:'col',name:'Token Service Net',documentation:'Root notes',folderDocs:{},
  requests:[{id:'req',name:'Withdrawal',requestName:'Withdrawal',method:'POST',url:'https://api.example.test/withdrawal',folderPath:[],responseExamples:examples,rows:[],params:[],body:''}]
}];

test('rename changes only the example name while retaining ID, status, body, headers, and notes',()=>{
  const old=structuredClone(examples);
  const updated=renameResponseExample(examples,'failed','  Failed - Invalid Amount  ');
  assert.equal(updated[1].name,'Failed - Invalid Amount');
  assert.deepEqual(Object.fromEntries(Object.keys(examples[1]).map(key=>[key,updated[1][key]])),{...examples[1],name:'Failed - Invalid Amount'});
  assert.deepEqual(examples,old);
});

test('rename rejects empty, duplicate, oversize and unknown example names',()=>{
  assert.throws(()=>renameResponseExample(examples,'success','   '),/required/);
  assert.throws(()=>renameResponseExample(examples,'failed','SuCcEsS'),/already exists/);
  assert.throws(()=>renameResponseExample(examples,'success','n'.repeat(141)),/140/);
  assert.throws(()=>renameResponseExample(examples,'unknown','Other'),/not found/);
});

test('local rename persists in the same request without changing status or endpoint identity',()=>{
  const next=applyLocalAction(collections,{type:'renameExample',collectionId:'col',requestId:'req',exampleId:'failed',name:'Over Daily Limit'});
  assert.equal(next[0].requests[0].id,'req');
  assert.equal(next[0].requests[0].responseExamples[1].name,'Over Daily Limit');
  assert.equal(next[0].requests[0].responseExamples[1].statusCode,400);
  assert.equal(collections[0].requests[0].responseExamples[1].name,'Invalid Amount');
  const postman=createLocalPostmanExport(next);
  const item=postman.item[0].item[0];
  assert.equal(item.response[1].name,'Over Daily Limit');
  const openapi=exportOpenApiCollection(next[0].requests);
  assert.equal(openapi.paths['/withdrawal'].post.responses['400'].content['application/json'].examples['over-daily-limit'].summary,'Over Daily Limit');
});

test('workspace metadata roundtrip keeps renamed examples, request headers and documentation',()=>{
  const original=encodeStoredHeaders([{key:'X-Client',value:'test',enabled:true}], [{key:'a',value:'b',enabled:false}], 'API docs',examples);
  const meta=decodeStoredHeaders(original);
  const updated=renameResponseExample(meta.responseExamples,'success','Transaction OK');
  const saved=decodeStoredHeaders(encodeStoredHeaders(meta.headers,meta.params,meta.documentation,updated));
  assert.equal(saved.responseExamples[0].name,'Transaction OK');
  assert.equal(saved.documentation,'API docs');
  assert.deepEqual(saved.headers,meta.headers);
  assert.deepEqual(saved.params,meta.params);
});

test('Local example tree has nested visual order and local/Neon menus include rename',()=>{
  const tree=readFileSync(new URL('../../src/features/collections/components/LocalCollectionsTree.jsx',import.meta.url),'utf8');
  const app=readWorkbenchSource();
  assert.match(tree,/example:\[\['renameExample','Rename example'\]/);
  assert.match(tree,/pp-local-request pp-explorer-tree-request/);
  assert.match(tree,/pp-tree-example pp-explorer-tree-example/);
  assert.match(app,/\['renameExample','Rename example'\],\['deleteExample','Delete example'\]/);
  assert.match(app,/async function renameSavedExample\(/);
  assert.match(app,/synchronizeSavedExamples\(scope,workspaceId,collectionId,requestId,examples\)/);
});
