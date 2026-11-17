import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2,ChevronDown,ChevronRight, CircleX, Play, Square, X} from 'lucide-react';
import {executeCollectionRun,RUNNER_MAX_ITERATIONS,RUNNER_MAX_DELAY_MS,RUNNER_MAX_STEPS} from './collectionRunnerEngine.js';
import {runSandbox} from './runScript.js';
import {appendConsoleEvent} from './pakpostConsoleStore.js';
import './collection-runner.css';

/** Optional feature: only imported when Runner is opened from a Collection. */
export default function CollectionRunner({target,requests=[],environmentVariables={},collectionVariables={},send,onClose}) {
  const [selected,setSelected]=useState(()=>requests.map(r=>r.id));
  const [iterations,setIterations]=useState(1);
  const [delayMs,setDelayMs]=useState(0);
  const [stopOnFailure,setStopOnFailure]=useState(true);
  const [confirmWrites,setConfirmWrites]=useState(false);
  const [summary,setSummary]=useState(null);
  const [failure,setFailure]=useState('');
  const [expanded,setExpanded]=useState('');
  const [running,setRunning]=useState(false);
  const controller=useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const dangerous=useMemo(()=>requests.some(r=>selected.includes(r.id)&&!['GET','HEAD','OPTIONS'].includes(String(r.method).toUpperCase())),[requests,selected]);
  const steps=selected.length*iterations;
  const invalidOptions=!Number.isInteger(iterations)||iterations<1||iterations>RUNNER_MAX_ITERATIONS||!Number.isInteger(delayMs)||delayMs<0||delayMs>RUNNER_MAX_DELAY_MS;
  const blocked=running||invalidOptions||!selected.length||steps>RUNNER_MAX_STEPS||(dangerous&&!confirmWrites);
  async function start(){
    if(blocked||controller.current)return;
    const aborter=new AbortController();controller.current=aborter;
    setRunning(true);setFailure('');setSummary(null);setExpanded('');
    try{
      await executeCollectionRun({requests,selectedIds:selected,iterations,delayMs,stopOnFailure,
        environmentVariables,collectionVariables,signal:aborter.signal,
        script:runSandbox,send,
        onProgress:setSummary,
        onStep:row=>appendConsoleEvent({executionId:row.runId,phase:'runner',level:row.passed?'info':'error',
          message:`${row.method} ${row.name} · iteration ${row.iteration} · ${row.passed?'passed':row.error||'failed'}`,
          method:row.method,status:row.status??undefined,elapsedMs:row.elapsedMs,passed:row.passed})});
    }catch(error){setFailure(String(error?.message||error).slice(0,400));}
    finally{setRunning(false);controller.current=null;}
  }
  function close(){controller.current?.abort();onClose();}
  function toggle(id){setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);setConfirmWrites(false);}
  return createPortal(<div className="pp-runner-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!running)close()}}>
    <section className="pp-runner-dialog" role="dialog" aria-modal="true" aria-label={`Collection Runner · ${target.name}`}>
      <header className="pp-runner-header">
        <div><span className="pp-runner-kicker">COLLECTION RUNNER · V8.2</span><h2>{target.name}</h2><p>{target.scope==='workspace'?'Cloud Workspace':'Local Collection'} · Environment: {target.environmentName||'None'} · Session-only variables</p></div>
        <button className="icon-btn" onClick={close} disabled={running} title={running?'Stop the run before closing':'Close Runner'} aria-label="Close Collection Runner"><X size={18}/></button>
      </header>
      <div className="pp-runner-content">
        <div className="pp-runner-options">
          <div className="pp-runner-section-head"><strong>Requests</strong><span>{selected.length} selected</span></div>
          <div className="pp-runner-select-actions"><button disabled={running} onClick={()=>{setSelected(requests.map(r=>r.id));setConfirmWrites(false)}}>Select all</button><button disabled={running} onClick={()=>{setSelected([]);setConfirmWrites(false)}}>Clear</button></div>
          <div className="pp-runner-requests" role="group" aria-label="Select endpoints">
            {requests.map(request=><label className="pp-runner-request" key={request.id}><input type="checkbox" checked={selected.includes(request.id)} disabled={running} onChange={()=>toggle(request.id)}/><span className={`pp-http-label ${String(request.method||'GET').toLowerCase()}`}>{request.method||'GET'}</span><span title={request.requestName||request.name}>{request.requestName||request.name||'Untitled'}</span></label>)}
            {!requests.length&&<p className="pp-runner-empty">No saved requests in this Collection.</p>}
          </div>
          <div className="pp-runner-config">
            <label>Iterations <input aria-label="Runner iterations" type="number" min="1" max={RUNNER_MAX_ITERATIONS} value={iterations} disabled={running} onChange={e=>setIterations(Number(e.target.value))}/></label>
            <label>Delay (ms) <input aria-label="Runner delay" type="number" min="0" max={RUNNER_MAX_DELAY_MS} step="100" value={delayMs} disabled={running} onChange={e=>setDelayMs(Number(e.target.value))}/></label>
            <label className="pp-runner-toggle"><input type="checkbox" checked={stopOnFailure} disabled={running} onChange={e=>setStopOnFailure(e.target.checked)}/> Stop on failure</label>
          </div>
          <p className="pp-runner-hint">Requests are sent to real endpoints. Run uses the selected Environment and Collection values as a private snapshot. Script variables can chain across requests; no Save/Cloud write is performed.</p>
          {dangerous&&<label className="pp-runner-safety"><input type="checkbox" disabled={running} checked={confirmWrites} onChange={e=>setConfirmWrites(e.target.checked)}/><span>I understand: selected POST/PUT/PATCH/DELETE requests may create or change real data on the target API.</span></label>}
          {steps>RUNNER_MAX_STEPS&&<p className="form-error">Limit: {RUNNER_MAX_STEPS} requests per run. Reduce endpoints or iterations.</p>}
          <div className="pp-runner-actions"><button className="pp-runner-start" type="button" disabled={blocked} onClick={start}><Play size={15}/> Run {steps} request{steps===1?'':'s'}</button>{running&&<button type="button" className="pp-runner-stop" onClick={()=>controller.current?.abort()}><Square size={14}/> Stop after current request</button>}</div>
        </div>
        <div className="pp-runner-results">
          <div className="pp-runner-section-head"><strong>Run results</strong><span>{summary?.status||'Not started'}</span></div>
          {!summary&&!failure&&<div className="pp-runner-empty-results"><Play size={28}/><strong>Ready to run</strong><p>Choose requests, then click Run. Results stay local to this dialog.</p></div>}
          {failure&&<div className="form-error" role="alert">{failure}</div>}
          {summary&&<>
            <div className="pp-runner-progress" role="progressbar" aria-valuenow={summary.completed} aria-valuemin={0} aria-valuemax={summary.total}><span style={{width:`${summary.total?summary.completed/summary.total*100:0}%`}}/></div>
            <div className="pp-runner-stats"><div><strong>{summary.completed}/{summary.total}</strong><span>Executed</span></div><div><strong>{summary.passed}</strong><span>Passed</span></div><div><strong>{summary.failed}</strong><span>Failed</span></div><div><strong>{summary.assertionsPassed}/{summary.assertionsPassed+summary.assertionsFailed}</strong><span>Assertions</span></div></div>
            <div className="pp-runner-result-list">
              {summary.rows.map(row=><div className="pp-runner-result" key={row.id}>
                <button type="button" className="pp-runner-result-title" aria-expanded={expanded===row.id} onClick={()=>setExpanded(old=>old===row.id?'':row.id)}>
                  {row.passed?<CheckCircle2 size={15} className="pp-runner-green"/>:<CircleX size={15} className="pp-runner-red"/>}
                  <span className={`pp-http-label ${row.method.toLowerCase()}`}>{row.method}</span>
                  <span className="pp-runner-result-name">{row.name}</span>
                  <span className="pp-runner-result-meta">#{row.iteration} · {row.status??'ERR'} · {row.elapsedMs}ms</span>
                  {expanded===row.id?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                </button>
                {expanded===row.id&&<div className="pp-runner-result-detail">
                  {row.error&&<p className="pp-runner-error">{row.error}</p>}
                  {row.tests.map((test,i)=><div className={test.passed?'pp-runner-test-pass':'pp-runner-test-fail'} key={i}>{test.passed?'✓':'✕'} {test.name} {test.error&&<small>— {test.error}</small>}</div>)}
                  {row.logs.length>0&&<pre>{row.logs.join('\n')}</pre>}
                  {!row.tests.length&&!row.logs.length&&!row.error&&<p>No script tests/logs for this request.</p>}
                </div>}
              </div>)}
            </div>
            <p className="pp-runner-hint">Responses and variables are not stored. Script log masking is best-effort—avoid printing secrets in scripts.</p>
          </>}
        </div>
      </div>
    </section>
  </div>,document.body);
}
