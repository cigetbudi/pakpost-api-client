import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Eye,EyeOff,FileUp,MoreHorizontal,Plus,Search,Save,X} from 'lucide-react';
import {RetroSelect} from './RetroSelect';
import {MenuActionItem} from './MenuActionItem';

const clone=env=>({...env,variables:(env?.variables||[]).map(v=>({...v}))});
const blank=()=>({name:'',variables:[{key:'',value:'',isSecret:false}]});
/** Lightweight list; variable inputs mount only while the edit dialog is open. */
export function EnvironmentExplorer({items=[],selected='',onSelect,onSave,onCreate,onDelete,onDuplicate,onExport,onImportFile,scope='Guest (local)'}){
  const [query,setQuery]=useState('');const [sort,setSort]=useState('a-z');
  const [menu,setMenu]=useState(null);const [editor,setEditor]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);const [reveal,setReveal]=useState({});
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const menuRef=useRef(null);const popupRef=useRef(null);const importInputRef=useRef(null);
  const shown=useMemo(()=>items.filter(x=>x.name.toLowerCase().includes(query.toLowerCase().trim())).sort((a,b)=>sort==='z-a'?b.name.localeCompare(a.name):a.name.localeCompare(b.name)),[items,query,sort]);
  useEffect(()=>{setMenu(null);},[selected]);
  useEffect(()=>{
    if(!menu)return;
    const close=e=>{if(!menuRef.current?.contains(e.target)&&!popupRef.current?.contains(e.target))setMenu(null)};
    const key=e=>{if(e.key==='Escape')setMenu(null)};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)};
  },[menu]);
  useEffect(()=>{
    if(!editor&&!confirmDelete)return;
    const key=e=>{if(e.key==='Escape'&&!busy){setEditor(null);setConfirmDelete(null);setError('')}};
    document.addEventListener('keydown',key);
    return()=>document.removeEventListener('keydown',key);
  },[editor,confirmDelete,busy]);
  function openEditor(item=null,mode='edit'){
    setError('');setMenu(null);setReveal({});
    setEditor({mode,draft:item?clone(item):blank()});
  }
  function editVariable(index,key,value){setEditor(old=>({...old,draft:{...old.draft,variables:old.draft.variables.map((v,i)=>i===index?{...v,[key]:value}:v)}}));}
  async function run(fn){setBusy(true);setError('');try{await fn();return true;}catch(e){setError(e?.message||'Operation failed');return false;}finally{setBusy(false)}}
  async function submit(e){e.preventDefault();if(!editor)return;
    const data={...editor.draft,name:editor.draft.name.trim(),variables:editor.draft.variables.filter(x=>x.key.trim()).map(v=>({...v,key:v.key.trim()}))};
    if(!data.name)return setError('Environment name is required.');
    if(items.some(x=>x.id!==data.id&&x.name.toLowerCase()===data.name.toLowerCase()))return setError('Environment name already exists.');
    const keys=data.variables.map(v=>v.key.toLowerCase());
    if(new Set(keys).size!==keys.length)return setError('Duplicate variable keys are not allowed.');
    const ok=await run(async()=>{
      if(editor.mode==='create'){
        const created=await onCreate(data.name);
        const next={...created,...data,id:created.id};
        setEditor({mode:'edit',draft:next});
        await onSave(next);
      }else await onSave(data);
    });
    if(ok){setEditor(null);setReveal({});}
  }
  async function importFile(event){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    if(file.size>3*1024*1024){setError('Maximum environment import size is 3 MB.');return;}
    await run(async()=>{
      if(!onImportFile)throw Error('Environment import is unavailable');
      await onImportFile(await file.text());
    });
  }
  async function duplicate(env){setMenu(null);await run(()=>onDuplicate(env));}
  async function remove(env){const ok=await run(()=>onDelete(env.id));if(ok){setConfirmDelete(null);setEditor(null);}}
  return <div className="pp-env-explorer pp-env-v17" aria-label="Environment explorer">
    <div className="pp-env-toolbar">
      <div className="pp-explorer-search"><Search size={14}/><input aria-label="Search environments" placeholder="Search environments..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="pp-env-toolbar-row"><RetroSelect ariaLabel="Sort environments" value={sort} onChange={setSort} options={[{value:'a-z',label:'Name A–Z'},{value:'z-a',label:'Name Z–A'}]}/><button type="button" className="pp-env-import-action" disabled={busy} onClick={()=>importInputRef.current?.click()} title="Import Postman, Hoppscotch, or Insomnia JSON environment"><FileUp size={14}/> Import</button><button type="button" className="pp-env-primary" onClick={()=>openEditor(null,'create')}><Plus size={14}/> New</button><input ref={importInputRef} type="file" hidden accept=".json,application/json" aria-label="Choose environment JSON" onChange={importFile}/></div>
    </div>
    <div className="pp-env-list" role="listbox" aria-label="Environments">
      <button role="option" aria-selected={!selected} className={!selected?'active':''} onClick={()=>onSelect('')}>No environment</button>
      {shown.map(env=><div key={env.id} className={`pp-env-v17-row ${selected===env.id?'active':''}`}>
        <button role="option" aria-selected={selected===env.id} className="pp-env-v17-select" onClick={()=>onSelect(env.id)} onDoubleClick={()=>openEditor(env)} title={`Select ${env.name}; double-click to edit`}>
          <span className={`pp-env-presence ${selected===env.id?'selected':''}`}/><span className="pp-env-item-name">{env.name}</span>{selected===env.id&&<Check size={13}/>}
        </button>
        <div className="pp-env-v17-actions" ref={menu?.id===env.id?menuRef:undefined}>
          <button aria-label={`Actions for ${env.name}`} title="Environment actions" className="pp-env-more" aria-expanded={menu?.id===env.id} onClick={e=>{if(menu?.id===env.id){setMenu(null);return;}const box=e.currentTarget.getBoundingClientRect();setMenu({id:env.id,x:Math.max(10,Math.min(window.innerWidth-245,box.right-230)),y:Math.max(10,Math.min(window.innerHeight-255,box.bottom+3))});}}><MoreHorizontal size={16}/></button>
          {menu?.id===env.id&&createPortal(<div ref={popupRef} className="pp-env-v17-menu" role="menu" style={{left:menu.x,top:menu.y}}>
            <MenuActionItem action="editVariables" onClick={()=>openEditor(env)}>Edit variables</MenuActionItem>
            <MenuActionItem action="rename" onClick={()=>openEditor(env,'rename')}>Rename</MenuActionItem>
            <MenuActionItem action="duplicate" disabled={busy} onClick={()=>duplicate(env)}>Duplicate</MenuActionItem>
            <MenuActionItem action="export" onClick={()=>{setMenu(null);onExport(env)}}>Export as...</MenuActionItem>
            <MenuActionItem action="delete" danger onClick={()=>{setMenu(null);setConfirmDelete(env)}}>Delete</MenuActionItem>
          </div>,document.body)}
        </div>
      </div>)}
      {!shown.length&&<p className="pp-env-empty">No matching environments.</p>}
    </div>
    <p className="pp-env-v17-hint">{scope} · Import Postman / Hoppscotch / Insomnia v4 JSON here. Names are never overwritten.</p>
    {error&&!editor&&!confirmDelete&&<p role="alert" className="pp-env-error">{error}</p>}
    {editor&&createPortal(<div className="pp-env-v17-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditor(null)}}>
      <section className="pp-env-v17-modal" role="dialog" aria-modal="true" aria-label={editor.mode==='create'?'Create environment':editor.mode==='rename'?'Rename environment':'Edit environment'}>
        <header><div><h2>{editor.mode==='create'?'New environment':editor.mode==='rename'?'Rename environment':'Edit environment'}</h2><p>{scope} · Changes are saved only when you confirm.</p></div><button aria-label="Close environment editor" disabled={busy} onClick={()=>setEditor(null)}><X size={17}/></button></header>
        <form onSubmit={submit}>
          <label className="pp-env-v17-name">Name<input autoFocus value={editor.draft.name} maxLength={120} placeholder="Development" onChange={e=>setEditor(old=>({...old,draft:{...old.draft,name:e.target.value}}))}/></label>
          {editor.mode!=='rename'&&<>{editor.draft.variables.some(v=>v.isRedacted)&&<p role="note" className="pp-env-v17-hint">Some workspace secrets are restricted to Owner/Admin. They cannot be resolved or exported by this account.</p>}<div className="pp-env-v17-table-head"><span>KEY</span><span>VALUE</span><span>SECRET</span></div>
            <div className="pp-env-v17-variables">{editor.draft.variables.map((v,i)=><div className="pp-env-v17-variable" key={i}>
              <input aria-label={`Variable ${i+1} key`} placeholder="variable" value={v.key} onChange={e=>editVariable(i,'key',e.target.value)}/>
              <div className="pp-env-v17-value"><input aria-label={`Variable ${i+1} value`} placeholder={v.isRedacted?'Restricted to Owner/Admin':'value'} disabled={!!v.isRedacted} type={v.isSecret&&!reveal[i]?'password':'text'} value={v.value} onChange={e=>editVariable(i,'value',e.target.value)}/>{v.isSecret&&<button type="button" title={reveal[i]?'Hide value':'Show value'} onClick={()=>setReveal(o=>({...o,[i]:!o[i]}))}>{reveal[i]?<EyeOff size={14}/>:<Eye size={14}/>}</button>}</div>
              <input type="checkbox" aria-label={`Variable ${i+1} secret`} disabled={!!v.isRedacted} checked={!!v.isSecret} onChange={e=>editVariable(i,'isSecret',e.target.checked)}/>
              <button type="button" title="Remove variable" aria-label={`Delete variable ${i+1}`} onClick={()=>setEditor(o=>({...o,draft:{...o.draft,variables:o.draft.variables.filter((_,j)=>j!==i)}}))}><X size={15}/></button>
            </div>)}</div>
            <button type="button" className="pp-env-v17-add" onClick={()=>setEditor(o=>({...o,draft:{...o.draft,variables:[...o.draft.variables,{key:'',value:'',isSecret:false}]}}))}><Plus size={15}/> Add variable</button>
          </>}
          {error&&<p role="alert" className="pp-env-error">{error}</p>}
          <footer><button type="button" disabled={busy} onClick={()=>{setEditor(null);setError('')}}>Cancel</button><button type="submit" className="pp-env-primary" disabled={busy}><Save size={15}/> {busy?'Saving...':editor.mode==='create'?'Create environment':'Save changes'}</button></footer>
        </form>
      </section>
    </div>,document.body)}
    {confirmDelete&&createPortal(<div className="pp-env-v17-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setConfirmDelete(null)}}><section className="pp-env-v17-confirm" role="dialog" aria-modal="true" aria-label="Delete environment"><h2>Delete environment?</h2><p>Delete <strong>{confirmDelete.name}</strong> and its variables? This cannot be undone.</p>{error&&<p role="alert" className="pp-env-error">{error}</p>}<footer><button disabled={busy} onClick={()=>setConfirmDelete(null)}>Cancel</button><button className="danger" disabled={busy} onClick={()=>remove(confirmDelete)}>Delete environment</button></footer></section></div>,document.body)}
  </div>;
}
