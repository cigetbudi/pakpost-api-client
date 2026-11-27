import React, {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {TextEditor} from '../../requests/components/Editors.jsx';
import {Eye,EyeOff,Plus,RefreshCw,Save,Trash2,X} from 'lucide-react';
import {isSensitiveVariable} from '../../environments/services/variableExperience.js';
import {savedCollectionVariableMap,validateCollectionVariableRows} from '../services/collectionVariableSession.js';
import '../../../styles/features/collection-variables.css';

/** The dialog is loaded only after selecting Collection -> Variables. */
export default function CollectionVariablesEditor({target,initial,current,onClose,onSave,onApplySession,onReset,onReload,busy=false,readOnly=false,loadError='',theme='dark',active=true,onReport=()=>{}}) {
  const [rows,setRows]=useState([]);
  const [tab,setTab]=useState('variables');
  const [preScript,setPreScript]=useState(''),[postScript,setPostScript]=useState('');
  const [session,setSession]=useState({});
  const [sessionExtraKey,setSessionExtraKey]=useState('');
  const [sessionExtraValue,setSessionExtraValue]=useState('');
  const [visible,setVisible]=useState({});
  const [error,setError]=useState('');
  const [feedback,setFeedback]=useState('');
  const [working,setWorking]=useState(false);
  const saved=useMemo(()=>savedCollectionVariableMap(initial?.variables||[]),[initial]);
  useEffect(()=>{
    setRows((initial?.variables||[]).map(v=>({...v})));
    setPreScript(initial?.preScript||'');setPostScript(initial?.postScript||'');
    setSession(current===null?{...saved}:{...current});
    setVisible({});setError('');setFeedback('');
  },[target?.scope,target?.workspaceId,target?.collectionId,initial,saved]);
  const sessionKeys=Object.keys(session).filter(k=>!rows.some(v=>v.key===k));
  const savedChanged=JSON.stringify(rows)!==JSON.stringify(initial?.variables||[]);
  const scriptsChanged=preScript!==(initial?.preScript||'')||postScript!==(initial?.postScript||'');
  const sessionBase=current===null?saved:current;
  const sessionChanged=JSON.stringify(session)!==JSON.stringify(sessionBase);
  function updateRow(index,field,value){setRows(old=>old.map((r,i)=>{
    if(i!==index)return r;
    const updated={...r,[field]:value};
    if(field==='key'&&isSensitiveVariable(value))updated.isSecret=true;
    return updated;
  }));setFeedback('');}
  function updateSession(key,value){setSession(old=>({...old,[key]:value}));setFeedback('');}
  async function action(fn,success){setError('');setFeedback('');setWorking(true);try{await fn();setFeedback(success);}catch(e){setError(e?.message||String(e));}finally{setWorking(false);}}
  async function saveValues(){
    await action(async()=>{
      if(readOnly)throw Error('Cloud Collection editing is not allowed for this role.');
      const normalized=validateCollectionVariableRows(rows);
      if(preScript.length>64000||postScript.length>64000)throw Error('Collection scripts exceed 64000 characters each.');
      await onSave(normalized,{preScript,postScript});
    },'Saved defaults updated. Session values have not been overwritten.');
  }
  function applySession(){
    action(async()=>{
      const normalized=validateCollectionVariableRows(Object.entries(session).map(([key,value])=>({key,value})));
      onApplySession(Object.fromEntries(normalized.map(v=>[v.key,v.value])));
    },'Session values applied. Cloud defaults were not changed.');
  }
  const blocked=working||busy;
  const dirty=savedChanged||scriptsChanged||sessionChanged;
  useLayoutEffect(()=>{onReport(dirty,blocked);},[dirty,blocked]);
  const close=()=>{if(!blocked)onClose();};
  useEffect(()=>{
    if(!active)return;
    const handler=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
      e.preventDefault();e.stopImmediatePropagation();if(!blocked&&!readOnly&&initial&&(savedChanged||scriptsChanged))void saveValues();
    }else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();}
    };
    window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);
  });
  return <div className="pp-cv-dialog pp-cv-workbench-editor">
      <div className="dialog-top"><div><h2>{target?.name||'Collection'}</h2><p>Collection settings · {target?.scope==='workspace'?'Cloud Workspace':'Local'}</p></div><button className="icon-btn" aria-label="Close" onClick={close} disabled={blocked}><X size={17}/></button></div>
      <div className="pp-cv-tabs" role="tablist" aria-label="Collection settings">
        {[["variables","Variables"],["pre","Pre-request"],["post","Post-response"]].map(([id,label])=><button type="button" role="tab" key={id} aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}
        {(savedChanged||scriptsChanged)&&<span className="pp-unsaved-dot" title="Unsaved collection settings"/>}
      </div>
      {tab==='variables'&&<div className="pp-cv-explain">Saved values belong to this Collection. Session values are private to your browser tab and are used by <code>pm.collectionVariables</code>. Running scripts never automatically saves to Cloud.</div>}
      {loadError&&<div role="alert" className="form-error">Unable to load shared defaults: {loadError}. Session variables are still available.</div>}
      {busy&&!initial?<div className="pp-cv-info">Loading collection variables…</div>:<>
        {readOnly&&<div className="pp-cv-info">Your Workspace role can view shared defaults and edit session values, but cannot save changes to Cloud.</div>}
        {tab!=='variables'?<div className="pp-cv-script" role="tabpanel">
          <p>Runs before the matching request-level script, in the same isolated sandbox. Use variables rather than hardcoding secrets.</p>
          <TextEditor key={tab} value={tab==='pre'?preScript:postScript} onChange={tab==='pre'?setPreScript:setPostScript}
            readOnly={readOnly||blocked} lang="javascript" theme={theme} fill lint={false} scriptDiagnostics/>
          <small>{(tab==='pre'?preScript:postScript).length} / 64000 characters</small>
        </div>:<>
        <div className="pp-cv-scroll">
          <div className="pp-cv-columns"><span>VARIABLE</span><span>SAVED VALUE</span><span>SESSION VALUE</span><span>SECRET</span><span/></div>
          {rows.map((row,index)=>{
            const secret=row.isSecret||isSensitiveVariable(row.key);
            const displayedSession=Object.hasOwn(session,row.key)?session[row.key]:'';
            return <div className="pp-cv-row" key={`saved-${index}`}>
              <input aria-label={`Variable name ${index+1}`} value={row.key} disabled={readOnly||blocked} maxLength={120} placeholder="variableName" onChange={e=>updateRow(index,'key',e.target.value)}/>
              <div className="pp-cv-input">
                <input aria-label={`Saved value of ${row.key}`} type={secret&&!visible[`s${index}`]?'password':'text'} value={row.isRedacted?'':row.value} placeholder={row.isRedacted?'Restricted secret':'Saved default'} disabled={readOnly||row.isRedacted||blocked} maxLength={8192} onChange={e=>updateRow(index,'value',e.target.value)}/>
                {row.isRedacted&&!readOnly&&<button title="Replace restricted secret" onClick={()=>{updateRow(index,'isRedacted',false);}} disabled={blocked}>Replace</button>}
                {secret&&!row.isRedacted&&<button type="button" title="Toggle saved visibility" aria-label="Toggle saved visibility" onClick={()=>setVisible(v=>({...v,[`s${index}`]:!v[`s${index}`]}))}>{visible[`s${index}`]?<EyeOff size={14}/>:<Eye size={14}/>}</button>}
              </div>
              <div className="pp-cv-input">
                <input aria-label={`Session value of ${row.key}`} type={secret&&!visible[`r${index}`]?'password':'text'} value={displayedSession} placeholder={current!==null&&!Object.hasOwn(session,row.key)?'Unset in session':'Session value'} disabled={blocked||!row.key} maxLength={8192} onChange={e=>updateSession(row.key,e.target.value)}/>
                {secret&&<button type="button" title="Toggle session visibility" onClick={()=>setVisible(v=>({...v,[`r${index}`]:!v[`r${index}`]}))}>{visible[`r${index}`]?<EyeOff size={14}/>:<Eye size={14}/>}</button>}
              </div>
              <input type="checkbox" aria-label={`Secret ${row.key}`} checked={!!row.isSecret} disabled={readOnly||blocked||row.isRedacted} onChange={e=>updateRow(index,'isSecret',e.target.checked)}/>
              <button type="button" title="Delete saved variable" aria-label={`Delete ${row.key}`} disabled={readOnly||blocked} onClick={()=>setRows(old=>old.filter((_,i)=>i!==index))}><Trash2 size={14}/></button>
            </div>;
          })}
          {sessionKeys.map(key=><div className="pp-cv-session-row" key={`session-${key}`}>
            <span>{key}</span><span className="pp-cv-muted">Session only</span>
            <input aria-label={`Session value of ${key}`} type={isSensitiveVariable(key)&&!visible[`x${key}`]?'password':'text'} value={session[key]} onChange={e=>updateSession(key,e.target.value)} disabled={blocked}/>
            <span className="pp-cv-session-actions">
              {!readOnly&&<button type="button" aria-label={`Keep ${key} as saved default`} title="Keep as saved default (click Save defaults afterward)" disabled={blocked} onClick={()=>setRows(old=>[...old,{key,value:session[key],isSecret:isSensitiveVariable(key)}])}><Save size={14}/></button>}
              <button type="button" aria-label={`Remove session variable ${key}`} title="Remove from session" disabled={blocked} onClick={()=>setSession(old=>{const next={...old};delete next[key];return next;})}><Trash2 size={14}/></button>
            </span>
          </div>)}
          {!rows.length&&!sessionKeys.length&&<div className="pp-cv-info">No variables yet. Add a saved default or a temporary session variable.</div>}
        </div>
        <div className="pp-cv-create">
          <button type="button" disabled={readOnly||blocked} onClick={()=>setRows(old=>[...old,{key:'',value:'',isSecret:false}])}><Plus size={14}/> Add saved variable</button>
          <form onSubmit={e=>{e.preventDefault();const key=sessionExtraKey.trim();if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)||key.length>120){setError('Invalid session variable name');return;}if(Object.keys(session).some(k=>k.toLowerCase()===key.toLowerCase())){setError('Session variable already exists');return;}setSession(old=>({...old,[key]:sessionExtraValue}));setSessionExtraKey('');setSessionExtraValue('');setError('');}}>
            <input aria-label="New session variable name" value={sessionExtraKey} onChange={e=>setSessionExtraKey(e.target.value)} placeholder="Session key" disabled={blocked}/>
            <input aria-label="New session variable value" value={sessionExtraValue} onChange={e=>setSessionExtraValue(e.target.value)} placeholder="Value" disabled={blocked}/>
            <button type="submit" disabled={blocked||!sessionExtraKey.trim()}><Plus size={14}/> Add session</button>
          </form>
        </div>
        </>}
        {error&&<div role="alert" className="form-error">{error}</div>}
        {feedback&&<div role="status" className="pp-cv-feedback">{feedback}</div>}
        <div className="pp-cv-footer">
          <div className="pp-cv-footnote">{target?.scope==='workspace'?'Shared defaults require Collection write permission.':'Local secret defaults are recoverable only for this browser session.'}</div>
          <button type="button" disabled={blocked} onClick={()=>{if(!dirty||window.confirm('Discard edits and reload collection settings?'))action(onReload,'Latest saved defaults loaded.');}}><RefreshCw size={14}/> Reload</button>
          <button type="button" disabled={blocked} onClick={()=>action(async()=>{await onReset();setSession(savedCollectionVariableMap(initial?.variables||[]));},'Session reset to saved defaults.')}><RefreshCw size={14}/> Reset session</button>
          <button type="button" disabled={blocked||!sessionChanged} onClick={applySession}>Apply session</button>
          <button className="pp-cv-primary" type="button" disabled={readOnly||blocked||!initial||!(savedChanged||scriptsChanged)} onClick={saveValues}><Save size={14}/> Save settings</button>
        </div>
      </>}
  </div>;
}
