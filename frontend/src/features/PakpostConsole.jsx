import React, {useMemo,useState} from 'react';
import {Terminal,Search,Trash2,Copy,X} from 'lucide-react';
import './pakpost-console.css';

export default function PakpostConsole({events,onClose,onClear}) {
  const [filter,setFilter]=useState('all');
  const [query,setQuery]=useState('');
  const [execution,setExecution]=useState('all');
  const runs=useMemo(()=>[...new Set(events.map(e=>e.executionId).filter(Boolean))].reverse(),[events]);
  const filtered=useMemo(()=>events.filter(e=>(filter==='all'||e.level===filter)&&(execution==='all'||e.executionId===execution)&&`${e.message} ${e.phase} ${e.method||''} ${e.status||''}`.toLowerCase().includes(query.toLowerCase())),[events,filter,query,execution]);
  const copy=()=>navigator.clipboard?.writeText(filtered.map(e=>`${e.timestamp} [${e.executionId.slice(0,8)}] ${e.level.toUpperCase()} ${e.phase}: ${e.message}`).join('\n'));
  return <section className="pp-console-drawer" role="region" aria-label="PakPost Console">
    <header className="pp-console-head"><strong><Terminal size={16}/> PakPost Console</strong><span>{events.length} / 500 events · session only</span><div className="pp-console-spacer"/><button onClick={copy} title="Copy filtered events"><Copy size={14}/> Copy</button><button onClick={onClear} title="Clear Console"><Trash2 size={14}/> Clear</button><button onClick={onClose} aria-label="Close Console" title="Close Console"><X size={16}/></button></header>
    <div className="pp-console-controls"><label><Search size={14}/><input aria-label="Search Console" placeholder="Search logs…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Console severity" value={filter} onChange={e=>setFilter(e.target.value)}>{['all','log','info','warn','error'].map(v=><option key={v} value={v}>{v==='all'?'All levels':v}</option>)}</select><select aria-label="Console execution" value={execution} onChange={e=>setExecution(e.target.value)}><option value="all">All executions</option>{runs.map(id=><option key={id} value={id}>Execution {id.slice(0,8)}</option>)}</select></div>
    <div className="pp-console-scroll" role="log" aria-live="off">{filtered.length===0?<p className="pp-console-empty">No matching events. Send a request to see network and script activity.</p>:filtered.map(event=><div className={`pp-console-event pp-console-${event.level}`} key={event.id}><time title={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time><span className="pp-console-level">{event.level}</span><span className="pp-console-phase">{event.phase}</span><span className="pp-console-message">{event.message}{event.status!==undefined?` · HTTP ${event.status}`:''}{event.elapsedMs!==undefined?` · ${event.elapsedMs} ms`:''}</span><code title={event.executionId}>{event.executionId.slice(0,8)}</code></div>)}</div>
  </section>;
}
