import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executeCollectionRun,validateRunnerConfig} from '../src/features/collectionRunnerEngine.js';

const sample=(id,url='https://example.test/{{path}}')=>({id,name:id,method:'GET',url,rows:[],params:[],body:'',format:'application/json',preScript:'',postScript:''});
const noopScript=async(_code,_phase,env,_req,_resp,local,collection)=>({error:null,environmentVariables:{...env},collectionVariables:{...collection},localVariables:{...local},logs:[],tests:[]});
const response={statusCode:200,elapsedMs:4,body:'{"token":"abc"}',headers:{}};

test('config bounds prohibit unbounded, missing, duplicate or excessive runs',()=>{
  assert.equal(validateRunnerConfig({requests:[sample('a')],selectedIds:['a'],iterations:1}).length,1);
  assert.throws(()=>validateRunnerConfig({requests:[sample('a')],selectedIds:['x']}),/no longer available/i);
  assert.throws(()=>validateRunnerConfig({requests:[sample('a')],selectedIds:[],iterations:1}),/Select at least/);
  assert.throws(()=>validateRunnerConfig({requests:[sample('a')],selectedIds:['a'],iterations:100}),/Iterations/);
  assert.throws(()=>validateRunnerConfig({requests:[sample('a')],selectedIds:['a'],delayMs:100000}),/Delay/);
  const many=Array.from({length:30},(_,i)=>sample(String(i)));
  assert.throws(()=>validateRunnerConfig({requests:many,selectedIds:many.map(r=>r.id),iterations:5}),/Maximum 100/);
});

test('sequential requests resolve variables set in prior post-response script',async()=>{
  const seen=[];const updates=[];
  const requests=[{...sample('login','https://api.test/login'),postScript:'POST_TOKEN'},sample('inquiry','https://api.test/inquiry?access={{token}}')];
  const script=async(code,phase,env,_request,_response,local,collection)=>({
    error:null,environmentVariables:code==='POST_TOKEN'?{...env,token:'MY_TOKEN'}:{...env},
    collectionVariables:{...collection},localVariables:{...local},logs:[],tests:[]
  });
  const result=await executeCollectionRun({requests,selectedIds:['login','inquiry'],iterations:1,script,
    send:async command=>{seen.push(command.url);return response},onProgress:x=>updates.push(x.completed)});
  assert.equal(result.status,'completed');assert.equal(result.passed,2);assert.equal(result.failed,0);
  assert.deepEqual(seen,['https://api.test/login','https://api.test/inquiry?access=MY_TOKEN']);
  assert.deepEqual(updates,[0,1,2,2]);
});

test('collection vars are isolated from environment variables and passed to subsequent steps',async()=>{
  const seen=[];
  const script=async(code,phase,env,_request,_response,local,collection)=>({error:null,
    environmentVariables:{...env},collectionVariables:code==='CHANGE_COLLECTION'?{...collection,stan:'999999'}:{...collection},
    localVariables:{...local},logs:[],tests:[]});
  const requests=[{...sample('a','https://api.test/get'),preScript:'CHANGE_COLLECTION'},sample('b','https://api.test/{{stan}}')];
  const result=await executeCollectionRun({requests,selectedIds:['a','b'],environmentVariables:{baseUrl:'https://api.test'},collectionVariables:{stan:'111111'},
    script,send:async command=>{seen.push(command.url);return response}});
  assert.equal(result.passed,2);assert.deepEqual(seen,['https://api.test/get','https://api.test/999999']);
});

test('runner counts pm.test assertions and stops on failure by default',async()=>{
  const seen=[];
  const script=async(code,phase,env,_request,_response,local,collection)=>({error:null,
    environmentVariables:{...env},collectionVariables:{...collection},localVariables:{...local},logs:[],
    tests:phase==='post'?[{name:'expected',passed:false,error:'Nope'}]:[]});
  const result=await executeCollectionRun({requests:[sample('a','https://api.test/1'),sample('b','https://api.test/2')],
    selectedIds:['a','b'],script,send:async command=>{seen.push(command.url);return response}});
  assert.equal(result.status,'failed');assert.equal(result.completed,1);
  assert.equal(result.assertionsFailed,1);assert.deepEqual(seen,['https://api.test/1']);
});

test('continue-on-failure runs following requests, with bounded safe report',async()=>{
  let count=0;
  const result=await executeCollectionRun({requests:[sample('a','https://api.test/1'),sample('b','https://api.test/2')],
    selectedIds:['a','b'],stopOnFailure:false,script:noopScript,
    send:async()=>{count++;return {...response,statusCode:count===1?500:200}}});
  assert.equal(result.status,'failed');assert.equal(result.completed,2);
  assert.equal(result.passed,1);assert.equal(result.failed,1);
  assert.equal(result.rows[0].error,'HTTP 500');
  assert.equal(JSON.stringify(result).includes('"token":"abc"'),false);
});

test('abort signal prevents further requests, without persisting script variables',async()=>{
  const controller=new AbortController();let calls=0;
  const result=await executeCollectionRun({requests:[sample('a','https://api.test/1'),sample('b','https://api.test/2')],
    selectedIds:['a','b'],signal:controller.signal,script:noopScript,
    send:async()=>{calls++;controller.abort();return response}});
  assert.equal(result.status,'stopped');assert.equal(calls,1);
  assert.equal(result.completed,1);
  assert.equal(Object.hasOwn(result,'environmentVariables'),false);
});

test('logs mask tokens and do not include HTTP body',async()=>{
  const script=async(code,phase,env,_req,_resp,local,collection)=>({error:null,environmentVariables:{...env},collectionVariables:{...collection},localVariables:{...local},logs:phase==='pre'?['access_token="my-secret"','Bearer xyz123']:[],tests:[]});
  const result=await executeCollectionRun({requests:[sample('a','https://api.test/1')],selectedIds:['a'],script,send:async()=>response});
  const rendered=JSON.stringify(result);
  assert.equal(rendered.includes('my-secret'),false);
  assert.equal(rendered.includes('xyz123'),false);
  assert.equal(rendered.includes('"token":"abc"'),false);
});

test('runner remains lazy and Cloud/Local menus include Runner',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const local=readFileSync(new URL('../src/features/LocalCollectionsTree.jsx',import.meta.url),'utf8');
  assert.match(app,/lazy\(\(\) => import\('\.\/features\/CollectionRunner\.jsx'\)\)/);
  assert.match(app,/\['runCollection','Run collection'\]/);
  assert.match(local,/\['runCollection','Run collection'\]/);
  assert.match(app,/runnerTarget\.transport==='proxy'/);
  assert.match(app,/setRunnerTarget\(null\)/);
});

test('explicit pm.test passing assertion can validate an intentional HTTP 400',async()=>{
  const script=async(_code,phase,env,_req,_resp,local,collection)=>({
    environmentVariables:{...env},collectionVariables:{...collection},localVariables:{...local},logs:[],error:null,
    tests:phase==='post'?[{name:'Expected bad request',passed:true}]:[]});
  const summary=await executeCollectionRun({requests:[sample('a','https://api.test/expected-error')],selectedIds:['a'],
    script,send:async()=>({...response,statusCode:400})});
  assert.equal(summary.passed,1);
  assert.equal(summary.rows[0].status,400);
});

test('pre-request runtime failure prevents HTTP send and includes sanitized diagnostic',async()=>{
  let calls=0;
  const broken=async(code,phase,env,request,response,local,collection)=>({
    environmentVariables:{...env},collectionVariables:{...collection},localVariables:{...local},
    logs:phase==='pre'?['access_token="hidden-secret"']:[],tests:[],
    error:phase==='pre'?'ReferenceError: missingIdentifier at line 4':null
  });
  const result=await executeCollectionRun({requests:[sample('a','https://api.test/get')],selectedIds:['a'],
    script:broken,send:async()=>{calls++;return response}});
  assert.equal(calls,0);
  assert.equal(result.failed,1);
  assert.match(result.rows[0].error,/ReferenceError/);
  assert.equal(JSON.stringify(result).includes('hidden-secret'),false);
});

test('request headers and params use runner-scope variables and auth metadata',async()=>{
  const requests=[{...sample('auth','https://api.test/account'),
    rows:[{key:'X-STAN',value:'{{stan}}'}],params:[{key:'trace',value:'{{stan}}'}],
    authType:'bearer',bearerToken:'{{token}}'}];
  const calls=[];
  const result=await executeCollectionRun({requests,selectedIds:['auth'],environmentVariables:{token:'secret-token'},
    collectionVariables:{stan:'132456'},script:noopScript,send:async command=>{calls.push(command);return response}});
  assert.equal(result.passed,1);
  assert.equal(calls[0].headers.Authorization,'Bearer secret-token');
  assert.equal(calls[0].headers['X-STAN'],'132456');
  assert.equal(new URL(calls[0].url).searchParams.get('trace'),'132456');
  assert.equal(JSON.stringify(result).includes('secret-token'),false);
});
