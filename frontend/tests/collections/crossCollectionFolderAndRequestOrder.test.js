import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLocalAction} from '../../src/features/collections/services/localCollectionActions.js';
import {dragRowPlacement,startRequestDrag,readRequestDrag,peekRequestDrag,endRequestDrag} from '../../src/features/collections/services/requestDrag.js';
import {reorderTabs} from '../../src/features/requests/services/tabActions.js';

const fixture=()=>[
  {id:'A',name:'A',folderDocs:{'["Auth"]':'Auth docs','["Auth","JWT"]':'JWT docs','["RootOnly"]':'source remains'},
    requests:[
      {id:'login',name:'Login',folderPath:['Auth','JWT']},
      {id:'token',name:'Token',folderPath:['Auth']},
      {id:'keep',name:'Keep',folderPath:['RootOnly']},
    ]},
  {id:'B',name:'B',folderDocs:{'["Billing"]':'Billing docs'},
    requests:[{id:'list',name:'List',folderPath:['Billing']},{id:'top',name:'Top',folderPath:[]}]}
];

test('Local cross-collection moves entire folder subtree without changing request identities',()=>{
  const before=fixture();
  const after=applyLocalAction(before,{type:'moveFolder',collectionId:'A',folderPath:['Auth'],
    targetCollectionId:'B',targetFolderPath:['Billing']});
  assert.deepEqual(after[0].requests.map(row=>row.id),['keep']);
  assert.deepEqual(after[1].requests.map(row=>row.id),['list','top','login','token']);
  assert.deepEqual(after[1].requests.find(r=>r.id==='login').folderPath,['Billing','Auth','JWT']);
  assert.equal(after[1].folderDocs['["Billing","Auth","JWT"]'],'JWT docs');
  assert.equal(after[1].folderDocs['["Billing","Auth"]'],'Auth docs');
  assert.equal(after[1].folderDocs['["Billing"]'],'Billing docs');
  assert.equal(after[0].folderDocs['["RootOnly"]'],'source remains');
  assert.equal(after[0].folderDocs['["Auth"]'],undefined);
  assert.deepEqual(before[0].requests.map(row=>row.id),['login','token','keep']);
  assert.equal(before[0].folderDocs['["Auth"]'],'Auth docs');
});

test('Local folder transfer rejects missing targets and sibling folder collision without mutating source',()=>{
  const existing=fixture();
  existing[1].folderDocs['["Billing","Auth"]']='already there';
  assert.throws(()=>applyLocalAction(existing,{type:'moveFolder',collectionId:'A',folderPath:['Auth'],
    targetCollectionId:'B',targetFolderPath:['Billing']}),/already exists/);
  assert.throws(()=>applyLocalAction(fixture(),{type:'moveFolder',collectionId:'A',folderPath:['Auth'],
    targetCollectionId:'missing',targetFolderPath:[]}),/Destination collection/);
  assert.throws(()=>applyLocalAction(fixture(),{type:'moveFolder',collectionId:'A',folderPath:['Auth'],
    targetCollectionId:'B',targetFolderPath:['Missing']}),/Destination folder/);
  assert.equal(existing[0].requests.length,3);
});

test('Local endpoints reorder before/after within one folder and retain path',()=>{
  let collections=[{id:'A',name:'A',requests:[
    {id:'a',name:'A',folderPath:['Folder']},
    {id:'b',name:'B',folderPath:['Folder']},
    {id:'c',name:'C',folderPath:['Folder']}
  ]}];
  collections=applyLocalAction(collections,{type:'moveRequest',collectionId:'A',requestId:'a',
    targetCollectionId:'A',targetFolderPath:['Folder'],beforeRequestId:'b',placement:'after'});
  assert.deepEqual(collections[0].requests.map(r=>r.id),['b','a','c']);
  collections=applyLocalAction(collections,{type:'moveRequest',collectionId:'A',requestId:'c',
    targetCollectionId:'A',targetFolderPath:['Folder'],beforeRequestId:'b',placement:'before'});
  assert.deepEqual(collections[0].requests.map(r=>r.id),['c','b','a']);
  assert.deepEqual(collections[0].requests[0].folderPath,['Folder']);
});

test('Workbench tab inserts on the chosen side of a destination',()=>{
  const tabs=['a','b','c','d'].map(id=>({id}));
  assert.deepEqual(reorderTabs(tabs,'a','c','before').map(t=>t.id),['b','a','c','d']);
  assert.deepEqual(reorderTabs(tabs,'d','b','after').map(t=>t.id),['a','b','d','c']);
  assert.deepEqual(tabs.map(t=>t.id),['a','b','c','d']);
});

test('Request drag context identifies source and exposes before/after marker based on pointer',()=>{
  const data=new Map();
  const transfer={types:[],effectAllowed:'',setData:(type,value)=>{data.set(type,value);transfer.types=[...data.keys()]},getData:type=>data.get(type)||''};
  const mime='application/x-pakpost-workspace-request';
  startRequestDrag(transfer,mime,{collectionId:'A',folderId:null,requestId:'a'});
  assert.equal(peekRequestDrag(mime).requestId,'a');
  assert.equal(readRequestDrag(transfer,mime).requestId,'a');
  assert.equal(dragRowPlacement({clientY:104,currentTarget:{getBoundingClientRect:()=>({top:100,height:20})}}),'before');
  assert.equal(dragRowPlacement({clientY:117,currentTarget:{getBoundingClientRect:()=>({top:100,height:20})}}),'after');
  endRequestDrag();
  assert.equal(peekRequestDrag(mime),null);
});
