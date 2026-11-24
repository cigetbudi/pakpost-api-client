import React,{useState} from 'react';
import {selectJsonPath,compareJsonResponses} from '../../features/requests/services/responseAnalysis.js';
import '../../styles/features/response-analysis.css';
export function ResponseAnalysis({result,variableUi}){
  const [path,setPath]=useState('$');const [output,setOutput]=useState(null);
  const [baseline,setBaseline]=useState(null);const [diff,setDiff]=useState(null);
  const [error,setError]=useState('');const [key,setKey]=useState('');const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const valid=result&&!result.error&&!result.truncated&&!result.isBinary;
  const currentOutput=output?.result===result?output.values:null;
  const currentDiff=diff?.result===result?diff.changes:null;
  const format=value=>JSON.stringify(value,null,2);
  function filter(){setError('');setOutput(null);try{if(!valid)throw Error('A complete JSON response is required.');setOutput({result,values:selectJsonPath(result.body,path)});}catch(e){setError(e.message);}}
  function compare(){setError('');setDiff(null);try{if(!valid||baseline===null)throw Error('Capture a baseline first.');setDiff({result,changes:compareJsonResponses(baseline,result.body)});}catch(e){setError(e.message);}}
  async function save(){
    if(saving||!currentOutput?.length||!variableUi?.onEditVariable)return;
    const name=key.trim();if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)){setError('Invalid variable name.');return;}
    const value=currentOutput.length===1?currentOutput[0]:currentOutput;
    const text=typeof value==='string'?value:JSON.stringify(value);
    if(text.length>8192){setError('Maximum 8192 characters.');return;}
    if(!window.confirm(`Save selected response data to ${variableUi.source} as ${name}? Existing values may be replaced. Check for sensitive data before continuing.`))return;
    setSaving(true);setError('');setNotice('');try{await variableUi.onEditVariable(name,text);setNotice('Variable update completed.');}catch(e){setError(e.message);}finally{setSaving(false);}
  }
  return <div className="pp-response-analysis">
    {valid&&<div><strong>Request timing</strong><p>{result.timing?`Headers: ${result.timing.headersMs} ms · Body read: ${result.timing.bodyMs} ms · Total: ${result.timing.totalMs} ms`:`Reported duration: ${result.elapsedMs??'Unavailable'} ms`}</p><small>DNS, TCP and TLS timings are not exposed by all transports. Headers time is not a raw TTFB measurement.</small></div>}
    <div className="pp-analysis-actions"><label>JSONPath <input value={path} maxLength={512} onChange={e=>{setPath(e.target.value);setOutput(null);}} placeholder="$.data[*].name"/></label><button disabled={!valid} onClick={filter}>Filter</button></div>
    <small>Supports $.key, [0], [*], .*, ["key"]. No script expressions.</small>
    {currentOutput&&<><pre>{format(currentOutput)}</pre><div className="pp-analysis-actions"><label>Save as variable<input value={key} onChange={e=>setKey(e.target.value)} placeholder="variableName"/></label><button disabled={saving||!currentOutput.length||!variableUi?.onEditVariable} onClick={save}>{saving?'Saving…':'Save variable'}</button></div><small>{variableUi?.source||'Select an environment first.'}</small></>}
    <div className="pp-analysis-actions"><button disabled={!valid} onClick={()=>{setError('');try{JSON.parse(result.body);setBaseline(result.body);setDiff(null);}catch{setError('Baseline must be JSON.');}}}>Capture baseline</button><button disabled={!valid||baseline===null} onClick={compare}>Compare latest</button><button disabled={baseline===null} onClick={()=>{setBaseline(null);setDiff(null);}}>Clear baseline</button><small>{baseline!==null?'Baseline captured in this tab':'No baseline'}</small></div>
    {currentDiff&&<><strong>{currentDiff.length} changes</strong>{currentDiff.map(change=><div className="pp-analysis-change" key={change.path}><strong>{change.kind} · {change.path}</strong><div>{Object.hasOwn(change,'before')&&<pre className="before">{format(change.before)}</pre>}{Object.hasOwn(change,'after')&&<pre className="after">{format(change.after)}</pre>}</div></div>)}</>}
    {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </div>;
}
