import React, {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Plus, Trash2, Eye, EyeOff, Lock, Save, X} from 'lucide-react';

function EnvironmentActionModal({mode,onCancel,onCreate,onDelete,existingNames=[],currentName='',busy=false}) {
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  const input=useRef(null);
  useEffect(()=>{if(mode==='create')input.current?.focus();const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!busy)onCancel();}};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true);},[mode,busy,onCancel]);
  async function submit(e){
    e.preventDefault();setError('');
    if(mode==='create'){
      const normalized=name.trim();
      if(!normalized){setError('Environment name is required.');return;}
      if(normalized.length>120){setError('Use 120 characters or less.');return;}
      if(existingNames.some(x=>x.trim().toLowerCase()===normalized.toLowerCase())){setError('An environment with this name already exists.');return;}
      try{await onCreate(normalized);}catch(err){setError(err.message||'Could not create environment.');}
    }else{
      try{await onDelete();}catch(err){setError(err.message||'Could not delete environment.');}
    }
  }
  return createPortal(<div className="pp-env-action-backdrop" onMouseDown={e=>{e.stopPropagation();if(e.target===e.currentTarget&&!busy)onCancel();}}>
    <form className="pp-env-action-dialog" role="dialog" aria-modal="true" aria-labelledby="pp-env-action-title" onSubmit={submit}>
      <div className="pp-env-action-head"><div><h3 id="pp-env-action-title">{mode==='create'?'New environment':'Delete environment?'}</h3><p>{mode==='create'?'Create a named set of variables for your requests.':`Remove “${currentName}” and its saved variables? This cannot be undone.`}</p></div><button type="button" aria-label="Close dialog" className="pp-env-action-x" onClick={onCancel} disabled={busy}><X size={17}/></button></div>
      {mode==='create'&&<label className="pp-env-action-field">Environment name<input ref={input} value={name} onChange={e=>{setName(e.target.value);setError('');}} placeholder="Development" maxLength={120} autoComplete="off"/></label>}
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="pp-env-action-footer"><button type="button" className="pp-env-action-cancel" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className={mode==='create'?'pp-env-action-submit':'pp-env-action-delete'} disabled={busy}>{busy?'Working…':mode==='create'?'Create environment':'Delete environment'}</button></div>
    </form>
  </div>,document.body);
}

export function EnvironmentDialog({items=[],selected,onSelect,onSave,onCreate,onDelete,onClose,scope='Guest (local)'}) {
  const [editing,setEditing]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [visible,setVisible]=useState({});
  const [action,setAction]=useState(null);
  useEffect(()=>{setEditing(items.find(x=>x.id===selected) ? JSON.parse(JSON.stringify(items.find(x=>x.id===selected))) : null);setError('');},[items,selected]);
  async function perform(fn) {setBusy(true);setError('');try{await fn();}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function create(name){setBusy(true);try{await onCreate(name);setAction(null);}finally{setBusy(false);}}
  async function remove(){setBusy(true);try{await onDelete(editing.id);setAction(null);}finally{setBusy(false);}}
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div role="dialog" aria-modal="true" aria-label="Environments" className="dialog pp-env-dialog">
      <div className="dialog-top"><div><h2>Environments</h2><p>{scope} · Variables are substituted in URL, headers, body, and scripts</p></div><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={17}/></button></div>
      <div className="pp-env-columns">
        <aside className="pp-env-sidebar"><div className="pp-env-menu-title">ENVIRONMENTS</div>
          <button className={!selected?'chosen':''} onClick={()=>onSelect('')}>No environment</button>
          {items.map(x=><button key={x.id} className={selected===x.id?'chosen':''} onClick={()=>onSelect(x.id)}>{x.name}</button>)}
          <button className="pp-env-add" disabled={busy} onClick={()=>setAction('create')}><Plus size={14}/> New environment</button>
        </aside>
        <section className="pp-env-content">
          {!editing ? <div className="pp-env-help">Select or create an environment. Use <code>{'{{baseUrl}}'}</code> in a request.</div> : <>
            <label className="pp-env-label">Name<input value={editing.name} onChange={e=>setEditing(x=>({...x,name:e.target.value}))}/></label>
            <div className="pp-env-var-head"><span>VARIABLE</span><span>VALUE</span><span>SECRET</span><span/></div>
            {editing.variables.map((v,i)=><div className="pp-env-var" key={i}>
              <input placeholder="baseUrl" value={v.key} onChange={e=>setEditing(x=>({...x,variables:x.variables.map((a,j)=>i===j?{...a,key:e.target.value}:a)}))}/>
              <div className="pp-env-value"><input type={v.isSecret&&!visible[i]?'password':'text'} placeholder="https://api.example.com" value={v.value} onChange={e=>setEditing(x=>({...x,variables:x.variables.map((a,j)=>i===j?{...a,value:e.target.value}:a)}))}/>{v.isSecret&&<button aria-label="Toggle secret visibility" title="Toggle secret visibility" onClick={()=>setVisible(v=>({...v,[i]:!v[i]}))}>{visible[i]?<EyeOff size={14}/>:<Eye size={14}/>}</button>}</div>
              <input type="checkbox" aria-label="Secret variable" checked={!!v.isSecret} onChange={e=>setEditing(x=>({...x,variables:x.variables.map((a,j)=>i===j?{...a,isSecret:e.target.checked}:a)}))}/>
              <button aria-label="Delete variable" title="Delete variable" onClick={()=>setEditing(x=>({...x,variables:x.variables.filter((_,j)=>j!==i)}))}><X size={14}/></button>
            </div>)}
            <button className="pp-inline-add" onClick={()=>setEditing(x=>({...x,variables:[...x.variables,{key:'',value:'',isSecret:false}]}))}><Plus size={14}/> Add variable</button>
            <div className="pp-env-foot"><span><Lock size={13}/> {scope.startsWith('Workspace')?'Secret values encrypted on the server':'Guest secrets are session-only'}</span><button className="pp-plain-btn" aria-label="Delete environment" title="Delete environment" disabled={busy} onClick={()=>setAction('delete')}><Trash2 size={14}/></button><button className="pp-small-primary" disabled={busy} onClick={()=>perform(()=>onSave({...editing,variables:editing.variables.filter(v=>v.key.trim())}))}><Save size={14}/> Save</button></div>
          </>}
        </section>
      </div>
      {error&&<div className="form-error">{error}</div>}
    </div>
    {action&&<EnvironmentActionModal mode={action} onCancel={()=>setAction(null)} onCreate={create} onDelete={remove} existingNames={items.map(x=>x.name)} currentName={editing?.name||''} busy={busy}/>}
  </div>;
}
