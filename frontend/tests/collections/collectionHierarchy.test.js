import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeCollections,visibleCollectionNodes,collectionParentChain,startCollectionDrag,readCollectionDrag,
  endCollectionDrag,isCollectionDrag,collectionDropPosition} from '../../src/features/collections/services/collectionHierarchy.js';
import {applyLocalAction} from '../../src/features/collections/services/localCollectionActions.js';

const make=()=>[
  {id:'a',name:'Auth',requests:[{id:'r-a',name:'Login',folderPath:['Endpoints']}],folderDocs:{},sortOrder:1},
  {id:'b',name:'Billing',requests:[{id:'r-b',name:'Invoice',folderPath:[]}],folderDocs:{},sortOrder:2},
  {id:'c',name:'Catalog',requests:[],folderDocs:{},sortOrder:3}
];
const find=(items,id)=>items.find(item=>item.id===id);
const rootOrder=items=>visibleCollectionNodes(items,{sort:'manual'}).filter(node=>node.depth===0).map(node=>node.collection.id);

test('reorder collections before and after persists manual order without touching payloads',()=>{
  const initial=make();
  const first=arrangeCollections(initial,'c','a','before');
  assert.deepEqual(rootOrder(first),['c','a','b']);
  const last=arrangeCollections(first,'c','b','after');
  assert.deepEqual(rootOrder(last),['a','b','c']);
  assert.deepEqual(find(last,'a').requests[0],initial[0].requests[0]);
  assert.deepEqual(rootOrder(initial),['a','b','c']);
});

test('nest a collection, create a sibling under parent, then restore to root',()=>{
  const nested=arrangeCollections(make(),'a','b','inside');
  assert.equal(find(nested,'a').parentCollectionId,'b');
  assert.deepEqual(collectionParentChain(nested,'a'),['a','b']);
  assert.deepEqual(visibleCollectionNodes(nested).map(node=>[node.collection.id,node.depth]),[
    ['b',0],['a',1],['c',0]
  ]);
  const restored=arrangeCollections(nested,'a',null,'root');
  assert.equal(find(restored,'a').parentCollectionId,null);
  assert.deepEqual(rootOrder(restored),['b','c','a']);
});

test('cannot nest self, descendant, invalid target or exceed depth',()=>{
  assert.throws(()=>arrangeCollections(make(),'a','a','inside'),/itself/);
  const nested=arrangeCollections(make(),'a','b','inside');
  assert.throws(()=>arrangeCollections(nested,'b','a','inside'),/descendants/);
  assert.throws(()=>arrangeCollections(make(),'a','missing','inside'),/Destination/);
  assert.throws(()=>arrangeCollections(make(),'a','b','invalid'),/placement/);
  const long=[{id:'p0',name:'P0',requests:[],sortOrder:1}];
  for(let i=1;i<12;i++)long.push({id:`p${i}`,name:`P${i}`,parentCollectionId:`p${i-1}`,requests:[],sortOrder:1});
  long.push({id:'extra',name:'Extra',requests:[],sortOrder:1});
  assert.throws(()=>arrangeCollections(long,'extra','p11','inside'),/limit/);
});

test('collapsed parents hide children, search includes matching parent path',()=>{
  const nested=arrangeCollections(make(),'a','b','inside');
  assert.deepEqual(visibleCollectionNodes(nested,{isOpen:item=>item.id!=='b'}).map(row=>row.collection.id),['b','c']);
  assert.deepEqual(visibleCollectionNodes(nested,{search:'auth',isOpen:()=>false}).map(row=>row.collection.id),['b','a']);
  assert.deepEqual(visibleCollectionNodes(nested,{search:'login',isOpen:()=>false,
    requestMatches:item=>item.requests?.some(request=>request.name==='Login')}).map(row=>row.collection.id),['b','a']);
});

test('local collection delete protects nested children, duplicate retains parent',()=>{
  const nested=arrangeCollections(make(),'a','b','inside');
  assert.throws(()=>applyLocalAction(nested,{type:'deleteCollection',collectionId:'b'}),/subcollections/);
  const duplicated=applyLocalAction(nested,{type:'duplicateCollection',collectionId:'a'},()=>`copy-${Date.now()}`);
  assert.equal(duplicated.length,4);
  assert.equal(duplicated.find(c=>c.id.startsWith('copy-')).parentCollectionId,'b');
});

test('drag transfer has a fallback and relative drop positions',()=>{
  const data=new Map();
  const transfer={types:[],setData(type,value){data.set(type,value);this.types.push(type);},getData(type){return data.get(type)||'';}};
  startCollectionDrag(transfer,{scope:'local',collectionId:'a'});
  assert.ok(isCollectionDrag(transfer));
  assert.deepEqual(readCollectionDrag(transfer),{scope:'local',collectionId:'a'});
  assert.deepEqual(['before','inside','after'],[0.1,0.5,0.9].map(y=>collectionDropPosition({
    currentTarget:{getBoundingClientRect:()=>({top:0,height:100})},clientY:y*100})));
  endCollectionDrag();
});
