import React, {useEffect,useState} from 'react';
import {Plus, Trash2, Eye, EyeOff, Lock, Save, X} from 'lucide-react';
export function EnvironmentDialog({items=[],selected,onSelect,onSave,onCreate,onDelete,onClose,scope='Guest (local)'}) {
  const [editing,setEditing]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [visible,setVisible]=useState({});
  useEffect(()=>{setEditing(items.find(x=>x.id===selected) ? JSON.parse(JSON.stringify(items.find(x=>x.id===selected))) : null);setError('');},[items,selected]);
  async function perform(fn) {setBusy(true);setError('');try{await fn();}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div role="dialog" aria-modal="true" aria-label="Environments" className="dialog pp-env-dialog">
      <div className="dialog-top"><div><h2>Environments</h2><p>{scope} · Variables are substituted in URL, headers, body, and scripts</p></div><button className="icon-btn" title="Close" onClick={onClose}><X size={17}/></button></div>
      <div className="pp-env-columns">
        <aside className="pp-env-sidebar"><div className="pp-env-menu-title">ENVIRONMENTS</div>
          <button className={!selected?'chosen':''} onClick={()=>onSelect('')}>No environment</button>
          {items.map(x=><button key={x.id} className={selected===x.id?'chosen':''} onClick={()=>onSelect(x.id)}>{x.name}</button>)}
          <button className="pp-env-add" disabled={busy} onClick={()=>{const name=prompt('New environment name');if(name?.trim())perform(()=>onCreate(name.trim()))}}><Plus size={14}/> New environment</button>
        </aside>
        <section className="pp-env-content">
          {!editing ? <div className="pp-env-help">Select or create an environment. Use <code>{'{{baseUrl}}'}</code> in a request.</div> : <>
            <label className="pp-env-label">Name<input value={editing.name} onChange={e=>setEditing(x=>({...x,name:e.target.value}))}/></label>
            <div className="pp-env-var-head"><span>VARIABLE</span><span>VALUE</span><span>SECRET</span><span/></div>
            {editing.variables.map((v,i)=><div className="pp-env-var" key={i}>
              <input placeholder="baseUrl" value={v.key} onChange={e=>setEditing(x=>({...x,variables:x.variables.map((a,j)=>i===j?{...a,key:e.target.value}:a)}))}/>
              <div className="pp-env-value"><input type={v.isSecret&&!visible[i]?'password':'text'} placeholder="https://api.example.com" value={v.value} onChange={e=>setEditing(x=>({...x,variables:x.variables.map((a,j)=>i===j?{...a,value:e.target.value}:a)}))}/>{v.isSecret&&<button title="Toggle secret visibility" onClick={()=>setVisible(v=>({...v,[i]:!v[i]}))}>{visible[i]?<EyeOff size={14}/>:<Eye size={14}/>}</button>}</div>
              <input type="checkbox" aria-label="Secret variable" checked={!!v.isSecret} onChange={e=>setEditing(x=>({...x,variables:x.variables.map((a,j)=>i===j?{...a,isSecret:e.target.checked}:a)}))}/>
              <button title="Delete variable" onClick={()=>setEditing(x=>({...x,variables:x.variables.filter((_,j)=>j!==i)}))}><X size={14}/></button>
            </div>)}
            <button className="pp-inline-add" onClick={()=>setEditing(x=>({...x,variables:[...x.variables,{key:'',value:'',isSecret:false}]}))}><Plus size={14}/> Add variable</button>
            <div className="pp-env-foot"><span><Lock size={13}/> {scope.startsWith('Workspace')?'Secret values encrypted on the server':'Guest secrets are session-only'}</span><button className="pp-plain-btn" title="Delete environment" disabled={busy} onClick={()=>{if(confirm('Delete this environment?'))perform(()=>onDelete(editing.id))}}><Trash2 size={14}/></button><button className="pp-small-primary" disabled={busy} onClick={()=>perform(()=>onSave({...editing,variables:editing.variables.filter(v=>v.key.trim())}))}><Save size={14}/> Save</button></div>
          </>}
        </section>
      </div>
      {error&&<div className="form-error">{error}</div>}
    </div>
  </div>;
}
