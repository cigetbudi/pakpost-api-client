import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImportText,parsePostmanCollection,createLocalPostmanExport} from '../src/features/importExport.js';
import {toLocalCollection,makeCollectionTree,filterCollectionTree,readLocalCollections,writeLocalCollections,validateLibrary} from '../src/features/localCollections.js';
import {planTabClose} from '../src/features/tabActions.js';

const source={info:{name:'My API'},item:[
  {name:'Auth',item:[{name:'Login',request:{method:'POST',url:'https://example.org/login',body:{mode:'raw',raw:'{"email":"test"}',options:{raw:{language:'json'}}}},event:[{listen:'test',script:{exec:['pm.test("ok", () => {})']}}]}]},
  {name:'Users',item:[{name:'Nested',item:[{name:'Find',request:{method:'GET',url:'https://example.org/users'}}]}]}
]};

test('Postman import retains collection root and nested hierarchy without tab creation',()=>{
  const parsed=parseImportText(JSON.stringify(source));
  assert.equal(parsed.kind,'postman');assert.equal(parsed.collections.length,1);
  assert.equal(parsed.collections[0].name,'My API');
  assert.deepEqual(parsed.requests.map(r=>r.folderPath),[['Auth'],['Users','Nested']]);
  const lib=toLocalCollection(parsed.collections[0],(()=>{let i=0;return ()=>`id-${++i}`})());
  assert.equal(lib.requests[0].requestName,'Login');
  const tree=makeCollectionTree(lib.requests);
  assert.equal(tree.folders[0].requests[0].requestName,'Login');
  assert.equal(tree.folders[1].folders[0].requests[0].requestName,'Find');
  assert.equal(tree.folders[0].requests[0].postScript,'pm.test("ok", () => {})');
  assert.equal(filterCollectionTree(tree,'users').folders.length,1);
});

test('export imported local collections back into nested Postman structure',()=>{
  const imported=parseImportText(JSON.stringify(source));
  const col=toLocalCollection(imported.collections[0],()=>String(Math.random()));
  const exported=createLocalPostmanExport([col]);
  assert.equal(exported.item[0].name,'My API');
  assert.equal(exported.item[0].item[1].name,'Users');
  assert.equal(exported.item[0].item[1].item[0].item[0].name,'Find');
  const again=parsePostmanCollection(exported);
  assert.equal(again.length,2);assert.deepEqual(again[1].folderPath,['My API','Users','Nested']);
});

test('collection recovery survives refresh; local storage fallback masks tokens',()=>{
  const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
  globalThis.sessionStorage=storage();globalThis.localStorage=storage();
  const col=toLocalCollection({name:'Local',requests:[{name:'Secret',requestName:'Secret',method:'POST',url:'https://example.org',rows:[{key:'Authorization',value:'Bearer abc'}],body:'{"x":1}',folderPath:['Auth']} ]},(()=>{let i=0;return ()=>`test${++i}`})());
  writeLocalCollections([col]);
  assert.equal(readLocalCollections()[0].requests[0].rows[0].value,'Bearer abc');
  sessionStorage.removeItem('pakpost_v5_collections_live');
  assert.equal(readLocalCollections()[0].requests[0].rows[0].value,'{{REDACTED}}');
  assert.deepEqual(readLocalCollections()[0].requests[0].folderPath,['Auth']);
});

test('tab context menu plans close, others and right without losing active tab',()=>{
  const tabs=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
  assert.deepEqual(planTabClose(tabs,'b','d','others').remaining.map(t=>t.id),['b']);
  assert.equal(planTabClose(tabs,'b','d','others').nextActiveId,'b');
  assert.deepEqual(planTabClose(tabs,'b','a','right').removedIds,['c','d']);
  assert.equal(planTabClose(tabs,'b','d','right').nextActiveId,'b');
  assert.equal(planTabClose(tabs,'b','b','close').nextActiveId,'c');
  assert.equal(planTabClose([{id:'only'}],'only','only','close').reset,true);
});

test('import library limits keep browsing responsive',()=>{
  assert.throws(()=>validateLibrary(Array.from({length:61},(_,i)=>({id:String(i),requests:[]}))),/Maximum 60/);
  assert.throws(()=>validateLibrary([{requests:Array.from({length:501},()=>({}))}]),/Maximum 500/);
});
