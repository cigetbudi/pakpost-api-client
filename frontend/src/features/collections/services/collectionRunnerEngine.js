/** V8.2 Collection Runner: sequential, bounded, entirely browser-session state.
 * Transport and QuickJS script executor are injected so this remains testable.
 * No Cloud Collection or Environment write occurs during a run.
 */
import {buildCommand,resolveRows,languageFromMime,syntaxProblem} from '../../requests/services/requestTools.js';
import {stripJsonComments} from '../../requests/services/jsonComments.js';
import {applyAuthorization} from '../../requests/services/authorization.js';
import {postmanRequestSnapshot} from '../../requests/services/postmanCompat.js';
import {resolvedScriptVariables} from './collectionVariableSession.js';
import {redactConsoleMessage} from '../../console/services/pakpostConsoleStore.js';

export const RUNNER_MAX_STEPS=100;
export const RUNNER_MAX_ITERATIONS=10;
export const RUNNER_MAX_DELAY_MS=5000;
const MAX_VISIBLE_LOGS=12;
const safeText=value=>redactConsoleMessage(String(value??'')).slice(0,360);

export function validateRunnerConfig({requests,selectedIds,iterations=1,delayMs=0}) {
  if(!Array.isArray(requests)||requests.length>500)throw Error('Runner supports up to 500 saved requests per collection.');
  const selected=new Set(selectedIds||[]);
  const steps=requests.filter(r=>selected.has(r.id));
  if(selected.size&&steps.length!==selected.size)throw Error('Selected endpoints are no longer available. Reload the Collection.');
  if(!steps.length)throw Error('Select at least one saved endpoint.');
  if(!Number.isInteger(iterations)||iterations<1||iterations>RUNNER_MAX_ITERATIONS)
    throw Error(`Iterations must be between 1 and ${RUNNER_MAX_ITERATIONS}.`);
  if(!Number.isInteger(delayMs)||delayMs<0||delayMs>RUNNER_MAX_DELAY_MS)
    throw Error(`Delay must be 0–${RUNNER_MAX_DELAY_MS} ms.`);
  if(steps.length*iterations>RUNNER_MAX_STEPS)
    throw Error(`Maximum ${RUNNER_MAX_STEPS} requests per run. Reduce iterations or endpoints.`);
  return steps;
}

function prepareRequest(draft,variables){
  const method=String(draft.method||'GET').toUpperCase();
  const format=draft.format||'application/json';
  const body=languageFromMime(format)==='json'?stripJsonComments(draft.body||''):draft.body||'';
  const command=buildCommand({method,url:draft.url||'',headers:draft.rows||[],body,format,
    fields:draft.formFields||[],fileBase64:draft.binaryFile?.base64||'',fileName:draft.binaryFile?.name||''},variables);
  const url=new URL(command.url);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)
    throw Error('Only HTTP(S) URLs without embedded credentials are supported.');
  for(const row of resolveRows(draft.params||[],variables))url.searchParams.append(row.key,row.value);
  command.url=url.toString();
  if(command.bodyMode==='multipart'&&(draft.formFields||[]).some(f=>f.fileName&&!f.fileBase64))
    throw Error('Attach multipart files in the request editor before running. Saved file bytes are not available.');
  if(command.bodyMode==='binary'&&!draft.binaryFile?.base64)
    throw Error('Saved binary file bytes are not available in Collection Runner.');
  if(command.bodyMode==='raw'){
    const problem=syntaxProblem(command.body,languageFromMime(format));
    if(problem)throw Error('Invalid request body: '+problem.message);
  }
  return applyAuthorization(command,draft,variables);
}

function sleep(ms,signal){
  if(!ms)return Promise.resolve();
  return new Promise(resolve=>{
    if(signal?.aborted)return resolve();
    let timer;
    const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve()};
    timer=setTimeout(done,ms);
    signal?.addEventListener('abort',done,{once:true});
  });
}

/**
 * @param {object} options
 * @param {Function} options.script - QuickJS runner, same signature as runSandbox
 * @param {Function} options.send - transport callback (secure proxy/browser/extension)
 * @param {Function} options.onProgress - receives sanitized progress, never raw HTTP data
 */
export async function executeCollectionRun({requests,selectedIds,iterations=1,delayMs=0,stopOnFailure=true,
  environmentVariables={},collectionVariables={},script,send,signal,onProgress=()=>{},onStep=()=>{}}){
  const steps=validateRunnerConfig({requests,selectedIds,iterations,delayMs});
  if(typeof script!=='function'||typeof send!=='function')throw Error('Runner execution adapters are missing.');
  let env={...environmentVariables};let collection={...collectionVariables};let local={};
  const runId=globalThis.crypto?.randomUUID?.()||`run-${Date.now()}`;
  const summary={runId,status:'running',total:steps.length*iterations,completed:0,passed:0,failed:0,
    assertionsPassed:0,assertionsFailed:0,rows:[]};
  const publish=()=>onProgress({...summary,rows:[...summary.rows]});
  publish();
  outer:for(let iteration=1;iteration<=iterations;iteration++){
    for(const request of steps){
      if(signal?.aborted){summary.status='stopped';break outer;}
      const started=Date.now();
      const row={id:`${iteration}:${request.id}`,name:String(request.requestName||request.name||'Request').slice(0,160),
        method:String(request.method||'GET').toUpperCase(),iteration,status:null,elapsedMs:null,passed:false,
        tests:[],logs:[],error:''};
      try{
        const pre=await script(request.preScript||'','pre',env,
          postmanRequestSnapshot({method:row.method,url:request.url,headers:Object.fromEntries((request.rows||[]).filter(r=>r.key&&r.enabled!==false).map(r=>[r.key,r.value])),body:request.body||'',format:request.format},resolvedScriptVariables(collection,env,local)),
          null,local,collection);
        const logs=[...(pre.logs||[])];
        if(pre.error){row.logs=logs.slice(-MAX_VISIBLE_LOGS).map(safeText);throw Error('Pre-request: '+pre.error);}
        env={...pre.environmentVariables};collection={...pre.collectionVariables};local={...pre.localVariables};
        const variables=resolvedScriptVariables(collection,env,local);
        const command=prepareRequest(request,variables);
        for(const [name,value] of Object.entries(pre.requestHeaderOverrides||{})){
          for(const key of Object.keys(command.headers))if(key.toLowerCase()===name.toLowerCase())delete command.headers[key];
          command.headers[name]=value;
        }
        const response=await send(command);
        row.status=response.statusCode;
        row.elapsedMs=Number.isFinite(response.elapsedMs)?response.elapsedMs:Date.now()-started;
        const post=await script(request.postScript||'','post',env,command,response,local,collection);
        logs.push(...(post.logs||[]));
        row.logs=logs.slice(-MAX_VISIBLE_LOGS).map(safeText);
        row.tests=[...(pre.tests||[]),...(post.tests||[])].slice(0,100).map(test=>({
          name:safeText(test.name),passed:test.passed!==false,...(test.error?{error:safeText(test.error)}:{})}));
        summary.assertionsPassed+=row.tests.filter(t=>t.passed).length;
        summary.assertionsFailed+=row.tests.filter(t=>!t.passed).length;
        if(post.error)throw Error('Post-response: '+post.error);
        env={...post.environmentVariables};collection={...post.collectionVariables};local={...post.localVariables};
        // HTTP errors and failing pm.test() assertions fail a step. Successful
        // pm.test() blocks do not require an explicit assertion to run.
        // Like Postman, explicit passing pm.test assertions can validate an
        // intentionally expected 4xx response. Without assertions, 4xx/5xx fail.
        row.passed=row.tests.length?row.tests.every(t=>t.passed):response.statusCode<400;
        if(!row.passed)row.error=row.tests.some(t=>!t.passed)?'Assertion failed':`HTTP ${response.statusCode}`;
      }catch(error){
        row.error=safeText(error?.message||error);
        row.passed=false;
      }
      if(row.elapsedMs===null)row.elapsedMs=Date.now()-started;
      summary.completed++;
      if(row.passed)summary.passed++;else summary.failed++;
      summary.rows.push(row);
      onStep({...row,runId});publish();
      if(!row.passed&&stopOnFailure){summary.status='failed';break outer;}
      if(summary.completed<summary.total){await sleep(delayMs,signal);}
    }
  }
  if(summary.status==='running')summary.status=signal?.aborted?'stopped':summary.failed?'failed':'completed';
  publish();
  // Intentionally do NOT return mutated env/collection/local values; these may
  // contain secrets and are never persisted to Cloud, browser storage, or reports.
  return summary;
}
