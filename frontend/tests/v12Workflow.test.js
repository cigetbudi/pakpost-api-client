import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripJsonComments,hasJsonComments} from '../src/features/jsonComments.js';
import {syntaxProblem,buildCommand} from '../src/features/requestTools.js';
import {applyLocalAction,createLocalSavedRequest,updateLocalRequest,exportLocalCollection} from '../src/features/localCollectionActions.js';
import {findBoundTab} from '../src/features/sourceTabs.js';
import {reorderTabs} from '../src/features/tabActions.js';

const newIds=()=>{let i=0;return ()=>`id-${++i}`};
const collection={id:'c1',name:'API Tests',requests:[
  {id:'r1',method:'POST',requestName:'Create token',name:'Create token',url:'https://api.example.com/token',folderPath:['Auth'],body:'{}',rows:[],params:[]},
  {id:'r2',method:'GET',requestName:'Fetch user',name:'Fetch user',url:'https://api.example.com/users',folderPath:['Users'],rows:[],params:[]}
]};
test('JSON comments preserve quoted URLs, escaped quotes and newlines',()=>{
  const source='{"url":"https://example.com/x\\\"//ok","amount": 5, // comment\n /* block\n comment */ "ok":true}';
  const clean=stripJsonComments(source);
  assert.equal(source.split('\n').length,clean.split('\n').length);
  assert.deepEqual(JSON.parse(clean),{url:'https://example.com/x"//ok',amount:5,ok:true});
  assert.equal(hasJsonComments(source),true);
  assert.equal(syntaxProblem(source,'json'),null);
  assert.throws(()=>stripJsonComments('{/* unterminated'),/Unterminated/);
});
test('signed/raw body omits editor comments before submission',()=>{
  const source='{"amount": 5 // temporary\n}';
  const command=buildCommand({method:'POST',url:'https://api.example.com/post',headers:[],body:stripJsonComments(source),format:'application/json'},{});
  assert.deepEqual(JSON.parse(command.body),{amount:5});
  assert.ok(!command.body.includes('//'));
});
test('rename and duplicate collection preserve request identities safely',()=>{
  const next=applyLocalAction([collection],{type:'renameCollection',collectionId:'c1',name:'Payment API'});
  assert.equal(next[0].name,'Payment API');assert.equal(collection.name,'API Tests');
  const dup=applyLocalAction(next,{type:'duplicateCollection',collectionId:'c1'},newIds());
  assert.equal(dup.length,2);assert.notEqual(dup[0].requests[0].id,dup[1].requests[0].id);
  assert.equal(dup[1].requests[0].folderPath[0],'Auth');
});
test('folder operations, sorting and move preserve nested structure',()=>{
  const rename=applyLocalAction([collection],{type:'renameFolder',collectionId:'c1',folderPath:['Auth'],name:'Security'});
  assert.deepEqual(rename[0].requests[0].folderPath,['Security']);
  const moved=applyLocalAction(rename,{type:'moveRequest',collectionId:'c1',requestId:'r2',targetCollectionId:'c1',targetFolderPath:['Security'],beforeRequestId:'r1'});
  assert.equal(moved[0].requests[0].id,'r2');
  assert.deepEqual(moved[0].requests[0].folderPath,['Security']);
});
test('save changes updates original local endpoint instead of duplicating',()=>{
  const updated=updateLocalRequest([collection],'c1','r1',{method:'PATCH',url:'https://api.example.com/v2/token',name:'Update token',body:'{"a":1}'});
  assert.equal(updated[0].requests.length,2);
  assert.equal(updated[0].requests[0].id,'r1');
  assert.equal(updated[0].requests[0].method,'PATCH');
  assert.equal(collection.requests[0].method,'POST');
  const created=createLocalSavedRequest(updated,'c1',{name:'New request',method:'GET'},newIds());
  assert.equal(created.collections[0].requests.length,3);
});
test('collection export is one valid Postman Collection with subfolders',()=>{
  const exported=exportLocalCollection(collection);
  assert.equal(exported.info.name,'API Tests');
  assert.ok(exported.item.some(x=>x.name==='Auth'));
});
test('tabs reuse matching source; duplicates stay independent',()=>{
  const source={scope:'workspace',workspaceId:'w1',collectionId:'c1',requestId:'r1'};
  const tabs=[{id:'t1',name:'Create',source},{id:'t2',name:'Scratch',source:null}];
  assert.equal(findBoundTab(tabs,{...source}).id,'t1');
  assert.equal(findBoundTab(tabs,{...source,workspaceId:'w2'}),undefined);
  assert.deepEqual(reorderTabs(tabs,'t1','t2').map(x=>x.id),['t2','t1']);
});
test('Save uses Ctrl/Cmd+S and binding survives session cache',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const cache=readFileSync(new URL('../src/features/workspaceCache.js',import.meta.url),'utf8');
  assert.match(app,/e\.key\.toLowerCase\(\) === 's'/);
  assert.match(app,/e\.preventDefault\(\)/);
  assert.match(app,/findBoundTab\(openTabs,source\)/);
  assert.match(cache,/source:t\.source\|\|null/);
  assert.match(app,/async function saveCurrent\(/);
});
