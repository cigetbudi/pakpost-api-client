import test from 'node:test';
import assert from 'node:assert/strict';
import {selectJsonPath,compareJsonResponses} from '../../src/features/requests/services/responseAnalysis.js';
import {planTabClose} from '../../src/features/requests/services/tabActions.js';
import {createCommandPaletteItems} from '../../src/app/services/commandPaletteItems.js';
import {postmanCompletions} from '../../src/features/requests/services/scriptSnippets.js';
import {parseRunnerData,runnerReport,runnerJUnit} from '../../src/features/collections/services/runnerData.js';
import {executeCollectionRun} from '../../src/features/collections/services/collectionRunnerEngine.js';

test('JSONPath supports keys, index, wildcard and quoted keys without evaluation',()=>{
  const body=JSON.stringify({data:[{name:'A'},{name:'B'}],'a.b':3});
  assert.deepEqual(selectJsonPath(body,'$.data[*].name'),['A','B']);
  assert.deepEqual(selectJsonPath(body,'$.data[1].name'),['B']);
  assert.deepEqual(selectJsonPath(body,'$["a.b"]'),[3]);
  assert.deepEqual(selectJsonPath(body,'$.missing'),[]);
  assert.deepEqual(selectJsonPath('{}','$.constructor'),[]);
  assert.deepEqual(selectJsonPath(body,'$.data[?(@.name)].name'),['A','B']);
  assert.throws(()=>selectJsonPath(body,'$.data[?(@.name.toString())]'),/Supported/);
  assert.throws(()=>selectJsonPath(JSON.stringify(Array(1001).fill(0)),'$[*]'),/Too many/);
});
test('JSON diff is structural and distinguishes missing from null',()=>{
  assert.deepEqual(compareJsonResponses('{"b":2,"a":1}','{"a":1,"b":2}'),[]);
  assert.deepEqual(compareJsonResponses('{"a":null,"b":2}','{"b":3,"c":false}'),[
    {path:'/a',kind:'removed',before:null},{path:'/b',kind:'changed',before:2,after:3},{path:'/c',kind:'added',after:false}]);
  assert.throws(()=>compareJsonResponses('bad','{}'));
});
test('pins survive bulk close but allow deliberate direct close',()=>{
  const tabs=[{id:'a'},{id:'b',pinned:true},{id:'c'}];
  assert.deepEqual(planTabClose(tabs,'a','a','right').remaining.map(t=>t.id),['a','b']);
  assert.deepEqual(planTabClose(tabs,'c','c','others').remaining.map(t=>t.id),['b','c']);
  assert.deepEqual(planTabClose(tabs,'b','b','close').remaining.map(t=>t.id),['a','c']);
});
test('command palette sorts recent open tabs without changing their physical order',()=>{
  const tabs=[{id:'a',name:'A',lastOpenedAt:1},{id:'b',name:'B',lastOpenedAt:2}];
  const items=createCommandPaletteItems({commandOpen:true,openTabs:tabs,localCollections:[],savedRequests:[],token:''});
  assert.deepEqual(items.filter(t=>t.key.startsWith('tab-')).map(t=>t.key),['tab-b','tab-a']);
  assert.equal(tabs[0].id,'a');
});
test('script completion offers supported pm methods',()=>{
  const result=postmanCompletions({matchBefore:()=>({from:0,text:'pm.iterationData.'})});
  assert.deepEqual(result.options.map(x=>x.label),['pm.iterationData.get','pm.iterationData.has']);
});
test('runner data reads quoted CSV, escaped quotes, CRLF and primitive JSON',()=>{
  assert.deepEqual(parseRunnerData('id,name\r\n1,"A, B"\r\n2,"say ""hi"""\r\n','csv'),[{id:'1',name:'A, B'},{id:'2',name:'say "hi"'}]);
  assert.deepEqual(parseRunnerData('[{"id":1,"ok":true}]','json'),[{id:1,ok:true}]);
  for(const source of ['[{"__proto__":"x"}]','[{"x":{}}]','[]'])assert.throws(()=>parseRunnerData(source,'json'));
  assert.throws(()=>parseRunnerData('id,id\n1,2','csv'));
  assert.throws(()=>parseRunnerData('id,name\n1','csv'));
});
test('runner report omits potentially sensitive fields',()=>{
  const summary={status:'completed',total:1,completed:1,passed:1,failed:0,assertionsPassed:1,assertionsFailed:0,rows:[{name:'secret-name',method:'GET',status:200,elapsedMs:12,iteration:1,passed:true,tests:[{name:'secret-test',passed:true}],logs:['secret-log'],body:'secret-body'}]};
  for(const report of [JSON.stringify(runnerReport(summary)),runnerJUnit(summary)])assert.doesNotMatch(report,/secret-/);
  assert.match(runnerJUnit(summary),/tests="1" failures="0"/);
});
test('dataset drives URL resolution and pm iteration inputs without writing environment',async()=>{
  const urls=[],seen=[];
  const script=async(code,phase,env,request,response,local,collection,data,info)=>{
    seen.push({data,info});return {environmentVariables:env,collectionVariables:collection,localVariables:local,logs:[],tests:[]};
  };
  const summary=await executeCollectionRun({requests:[{id:'a',name:'test',url:'https://example.com/{{id}}',method:'GET',rows:[]}],selectedIds:['a'],iterations:2,iterationData:[{id:1},{id:2}],environmentVariables:{id:'old'},script,send:async command=>{urls.push(command.url);return {statusCode:200,elapsedMs:1};}});
  assert.deepEqual(urls,['https://example.com/1','https://example.com/2']);assert.equal(summary.passed,2);assert.equal(seen[2].info.iteration,1);
});
