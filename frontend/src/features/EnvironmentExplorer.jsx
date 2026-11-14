import React, {useEffect,useMemo,useState} from 'react';
import {Check, Eye, EyeOff, LockKeyhole, Plus, Search, Save, Trash2, X} from 'lucide-react';
import {RetroSelect} from './RetroSelect';

const copyEnvironment = (item) => item ? {...item,variables:(item.variables||[]).map(v=>({...v}))} : null;
const compare = (a,b,sort) => sort==='z-a' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);

/** Non-modal, persistent environment explorer. Does not own storage or secret persistence. */
export function EnvironmentExplorer({items=[],selected='',onSelect,onSave,onCreate,onDelete,scope='Guest (local)'}) {
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState('a-z');
  const [draft,setDraft]=useState(null);
  const [createName,setCreateName]=useState('');
  const [creating,setCreating]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [reveal,setReveal]=useState({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const active=items.find(x=>x.id===selected);
  const shown=useMemo(()=>items.filter(x=>x.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>compare(a,b,sort)),[items,query,sort]);
  useEffect(()=>{setDraft(copyEnvironment(active));setReveal({});setConfirmDelete(false);setError('');setSaved(false);},[selected,items]);
  async function task(action){setBusy(true);setError('');setSaved(false);try{await action();}catch(err){setError(err.message||'Operation failed');}finally{setBusy(false)}}
  async function create(event){event.preventDefault();const name=createName.trim();if(!name)return setError('Environment name is required.');if(items.some(x=>x.name.trim().toLowerCase()===name.toLowerCase()))return setError('Environment name already exists.');await task(async()=>{await onCreate(name);setCreating(false);setCreateName('');});}
  async function save(){if(!draft)return;if(!draft.name.trim())return setError('Name is required.');await task(async()=>{await onSave({...draft,name:draft.name.trim(),variables:draft.variables.filter(v=>v.key.trim())});setSaved(true);});}
  async function remove(){if(!draft)return;await task(async()=>{await onDelete(draft.id);setConfirmDelete(false);});}
  function changeVar(i,key,value){setDraft(old=>({...old,variables:old.variables.map((v,j)=>j===i?{...v,[key]:value}:v)}));setSaved(false);}
  return <div className="pp-env-explorer" aria-label="Environment explorer">
    <div className="pp-env-toolbar"><div className="pp-explorer-search"><Search size={14}/><input aria-label="Search environments" placeholder="Search environments..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="pp-env-toolbar-row"><RetroSelect ariaLabel="Sort environments" value={sort} onChange={setSort} options={[{value:"a-z",label:"Name A–Z"},{value:"z-a",label:"Name Z–A"}]}/><button className="pp-env-primary" onClick={()=>{setCreating(true);setConfirmDelete(false);}}><Plus size={14}/> New</button></div></div>
    <div className="pp-env-list" role="listbox" aria-label="Environments">
      <button role="option" aria-selected={!selected} className={!selected?'active':''} onClick={()=>onSelect('')}>No environment</button>
      {shown.map(env=><button role="option" aria-selected={selected===env.id} key={env.id} className={selected===env.id?'active':''} onClick={()=>onSelect(env.id)}><span className={`pp-env-presence ${selected===env.id?'selected':''}`}/><span className="pp-env-item-name">{env.name}</span>{selected===env.id&&<Check size={14}/>}</button>)}
      {!shown.length&&<p className="pp-env-empty">No matching environments.</p>}
    </div>
    {creating&&<form className="pp-env-create-inline" onSubmit={create}><label>New environment<input autoFocus maxLength={120} placeholder="Development" value={createName} onChange={e=>setCreateName(e.target.value)}/></label><div><button type="button" disabled={busy} onClick={()=>{setCreating(false);setError('')}}>Cancel</button><button type="submit" disabled={busy||!createName.trim()}>Create</button></div></form>}
    <div className="pp-env-details">
      {draft?<><div className="pp-env-detail-header"><strong>Variables</strong><span>{scope}</span></div>
        <label className="pp-env-name-label">Name<input value={draft.name} maxLength={120} onChange={e=>{setDraft(d=>({...d,name:e.target.value}));setSaved(false);}}/></label>
        <div className="pp-env-table-heading"><span>KEY</span><span>VALUE</span><span>SECRET</span></div>
        <div className="pp-env-variables">{draft.variables.map((v,i)=><div className="pp-env-inline-variable" key={i}>
          <input aria-label={`Variable ${i+1} key`} placeholder="key" value={v.key} onChange={e=>changeVar(i,'key',e.target.value)}/>
          <div className="pp-env-variable-value"><input aria-label={`Variable ${i+1} value`} type={v.isSecret&&!reveal[i]?'password':'text'} placeholder="value" value={v.value} onChange={e=>changeVar(i,'value',e.target.value)}/>{v.isSecret&&<button title="Reveal secret" aria-label="Reveal secret" onClick={()=>setReveal(old=>({...old,[i]:!old[i]}))}>{reveal[i]?<EyeOff size={13}/>:<Eye size={13}/>}</button>}</div>
          <input type="checkbox" aria-label={`Variable ${i+1} secret`} checked={!!v.isSecret} onChange={e=>changeVar(i,'isSecret',e.target.checked)}/>
          <button aria-label={`Delete variable ${i+1}`} title="Remove variable" onClick={()=>{setDraft(d=>({...d,variables:d.variables.filter((_,j)=>j!==i)}));setSaved(false);}}><X size={13}/></button>
        </div>)}</div>
        <button className="pp-env-add-variable" onClick={()=>{setDraft(d=>({...d,variables:[...d.variables,{key:'',value:'',isSecret:false}]}));setSaved(false);}}><Plus size={13}/> Add variable</button>
        {confirmDelete?<div className="pp-env-confirm"><span>Delete {draft.name}?</span><button onClick={()=>setConfirmDelete(false)} disabled={busy}>Cancel</button><button className="danger" disabled={busy} onClick={remove}>Delete</button></div>:<div className="pp-env-detail-actions"><button title="Delete environment" aria-label="Delete environment" disabled={busy} onClick={()=>setConfirmDelete(true)}><Trash2 size={15}/></button><button className="pp-env-primary" disabled={busy} onClick={save}><Save size={14}/> {saved?'Saved':'Save changes'}</button></div>}
      </>:<div className="pp-env-no-selection"><LockKeyhole size={19}/><p>Select an environment to edit variables.</p><small>Use {'{{baseUrl}}'} in requests and scripts.</small></div>}
      {error&&<p role="alert" className="pp-env-error">{error}</p>}
    </div>
  </div>;
}
