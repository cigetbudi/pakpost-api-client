import React, {useEffect,useMemo,useRef,useState} from 'react';
import {Terminal,Search,Trash2,Copy,X,ArrowUpRight} from 'lucide-react';
import {CONSOLE_EVENT_LIMIT,filterConsoleEvents,formatConsoleEvents} from './pakpostConsoleStore.js';
import './pakpost-console.css';

const LEVELS=['all','log','info','warn','error'];

export default function PakpostConsole({events,onClose,onClear,onNavigate}) {
  const [level,setLevel]=useState('all');
  const [phase,setPhase]=useState('all');
  const [query,setQuery]=useState('');
  const [execution,setExecution]=useState('all');
  const [follow,setFollow]=useState(true);
  const [height,setHeight]=useState('340px');
  const [copyStatus,setCopyStatus]=useState('');
  const scrollRef=useRef(null);
  const runs=useMemo(()=>[...new Set(events.map(e=>e.executionId).filter(Boolean))].reverse(),[events]);
  const phases=useMemo(()=>[...new Set(events.map(e=>e.phase))].sort(),[events]);
  // Once the ring buffer has dropped an old run/phase, reset stale filters.
  useEffect(()=>{if(execution!=='all'&&!runs.includes(execution))setExecution('all');},[runs,execution]);
  useEffect(()=>{if(phase!=='all'&&!phases.includes(phase))setPhase('all');},[phases,phase]);
  const filtered=useMemo(()=>filterConsoleEvents(events,{level,phase,execution,query}),[events,level,phase,execution,query]);
  const errors=useMemo(()=>events.filter(e=>e.level==='error').length,[events]);
  const warnings=useMemo(()=>events.filter(e=>e.level==='warn').length,[events]);
  useEffect(()=>{if(follow&&scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[filtered,follow]);
  const copy=async()=>{
    try {
      if(!navigator.clipboard?.writeText)throw Error('Clipboard is unavailable');
      await navigator.clipboard.writeText(formatConsoleEvents(filtered));
      setCopyStatus('Copied');
    } catch { setCopyStatus('Copy unavailable — check browser permissions'); }
  };
  const navigate=(event)=>{
    if(event.line&&['pre-script','post-script'].includes(event.phase))onNavigate?.(event);
  };
  return <section className="pp-console-drawer" style={{height}} role="region" aria-label="PakPost Console">
    <header className="pp-console-head">
      <strong><Terminal size={16}/> PakPost Console</strong>
      <span>{events.length} / {CONSOLE_EVENT_LIMIT} · {errors} errors · {warnings} warnings</span>
      <div className="pp-console-spacer"/>
      <select aria-label="Console height" title="Console drawer size" value={height} onChange={e=>setHeight(e.target.value)}><option value="240px">Compact</option><option value="340px">Normal</option><option value="min(480px, 70vh)">Tall</option></select>
      <button type="button" onClick={copy} title="Copy visible, sanitized events"><Copy size={14}/> Copy</button>
      <button type="button" onClick={onClear} title="Clear Console"><Trash2 size={14}/> Clear</button>
      <button type="button" onClick={onClose} aria-label="Close Console" title="Close Console"><X size={16}/></button>
    </header>
    <div className="pp-console-controls">
      <label className="pp-console-search"><Search size={14}/><input aria-label="Search Console" placeholder="Search logs…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <select aria-label="Console severity" value={level} onChange={e=>setLevel(e.target.value)}>{LEVELS.map(v=><option key={v} value={v}>{v==='all'?'All levels':v}</option>)}</select>
      <select aria-label="Console phase" value={phase} onChange={e=>setPhase(e.target.value)}><option value="all">All phases</option>{phases.map(v=><option key={v} value={v}>{v}</option>)}</select>
      <select aria-label="Console execution" value={execution} onChange={e=>setExecution(e.target.value)}><option value="all">All executions</option>{runs.map(id=><option key={id} value={id}>Execution {id.slice(0,8)}</option>)}</select>
      <label className="pp-console-follow"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/> Follow</label>
    </div>
    <div className="pp-console-scroll" ref={scrollRef} role="log" aria-live="off" onScroll={e=>{const node=e.currentTarget;if(node.scrollHeight-node.scrollTop-node.clientHeight>60&&follow)setFollow(false)}}>
      {filtered.length===0?<p className="pp-console-empty">No matching events. Send a request to see network and script activity.</p>
        :filtered.map(event=><div className={`pp-console-event pp-console-${event.level}`} key={event.id}>
          <time title={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time>
          <span className="pp-console-level">{event.level}</span>
          <span className="pp-console-phase">{event.phase}</span>
          <span className="pp-console-message">{event.message}{event.status!==undefined?` · HTTP ${event.status}`:''}{event.elapsedMs!==undefined?` · ${event.elapsedMs} ms`:''}</span>
          {event.line&&['pre-script','post-script'].includes(event.phase)&&<button className="pp-console-jump" type="button" title={`Open ${event.phase} line ${event.line}`} onClick={()=>navigate(event)}><ArrowUpRight size={13}/> L{event.line}</button>}
          <code title={event.executionId}>{event.executionId.slice(0,8)}</code>
        </div>)}
    </div>
    <footer className="pp-console-foot"><span>{filtered.length} matching events · session only · no HTTP bodies captured</span><span>Script output is masked best-effort; avoid printing secrets.</span>{copyStatus&&<span role="status">{copyStatus}</span>}</footer>
  </section>;
}
