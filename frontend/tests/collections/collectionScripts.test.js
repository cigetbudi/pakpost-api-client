import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {collectionScripts,composeCollectionScript,runCollectionPhase,collectionPostmanEvents} from '../../src/features/collections/services/collectionScripts.js';
import {parseImportText} from '../../src/features/import-export/services/importExport.js';
import {toLocalCollection,safeLocalCollectionsSnapshot} from '../../src/features/collections/services/localCollections.js';
import {exportCollectionByFormat} from '../../src/features/import-export/services/exportFormats.js';
import {saveCloudCollections} from '../../src/features/import-export/services/storageScope.js';

test('root scripts remain separate and survive Local and Postman round trip',()=>{
  const doc={info:{name:'Synthetic',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},variable:[{key:'BASE_URL',value:'https://example.test'}],event:[{listen:'prerequest',script:{exec:['function helper(x){return x+1}']}},{listen:'test',script:{exec:['function decode(x){return x}']}}],item:[{name:'Test',request:{method:'GET',url:'{{BASE_URL}}/test'},event:[{listen:'prerequest',script:{exec:['helper(2)']}}]}]};
  const parsed=parseImportText(JSON.stringify(doc));
  const col=toLocalCollection(parsed.collections[0],()=> 'dummy');
  assert.equal(col.preScript,'function helper(x){return x+1}');
  assert.equal(col.requests[0].preScript,'helper(2)');
  assert.equal(safeLocalCollectionsSnapshot([col]).collections[0].postScript,col.postScript);
  const out=exportCollectionByFormat(col.requests,{localCollection:col});
  assert.deepEqual(out.event,collectionPostmanEvents(col));
  assert.equal(parseImportText(JSON.stringify(out)).collections[0].preScript,col.preScript);
});
test('cloud import transmits scripts atomically and separately',async()=>{
  let sent;
  await saveCloudCollections([{name:'Synthetic',preScript:'function helper(){}',postScript:'pm.test("ok",()=>{})',requests:[{name:'Ping',method:'GET',url:'https://example.test'}]}],{workspaceId:'ws',token:'dummy',request:async(path,method,body)=>{sent={path,method,body};return {count:1,createdCount:1,firstId:'col',collections:[]};}});
  assert.equal(sent.path,'/api/workspaces/ws/collections/import');
  assert.equal(sent.body.collections[0].preScript,'function helper(){}');
  assert.equal(sent.body.collections[0].requests[0].preRequestScript,'');
});
test('shared lexical helpers, execution order and request shadowing',()=>{
  const log=[];
  const {code}=composeCollectionScript('const value=3; function helper(x){return x+value}; log.push("collection")','const value=9; log.push(helper(value));');
  vm.runInNewContext('(function(){'+code+'})()', {log});
  assert.deepEqual(log,['collection',12]);
});
test('collection-only code executes; empty collection does not rewrite request',()=>{
  assert.equal(composeCollectionScript('', 'return;').code,'return;');
  assert.equal(composeCollectionScript('log.push(1)','').code,'log.push(1)');
});
test('error location maps to request source or identifies collection source',async()=>{
  const base={error:'Error: bad (line 3)',diagnostic:{line:3,column:2,message:'bad'}};
  const r=await runCollectionPhase(async()=>base,'helper();','bad();','pre');
  assert.equal(r.diagnostic.line,1);
  const c=await runCollectionPhase(async()=>({...base,diagnostic:{...base.diagnostic,line:1}}),'bad();','helper();','pre');
  assert.equal(c.diagnostic.line,null);assert.match(c.error,/Collection script/);
});
test('script settings limit and defaults',()=>{
  assert.deepEqual(collectionScripts({}),{preScript:'',postScript:''});
  assert.throws(()=>collectionScripts({preScript:'x'.repeat(64001)}),/64000/);
});
