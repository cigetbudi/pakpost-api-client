import React,{useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeftRight,GitCompareArrows,LockKeyhole,Search,X} from 'lucide-react';
import {compareEnvironments,filterEnvironmentCompare} from '../services/environmentCompare.js';
import '../../../styles/features/environment-compare.css';

const STATES = {
  matched:'Matched', different:'Different', onlyLeft:'Only left',
  onlyRight:'Only right', protected:'Protected'
};

/** Read-only view: uses only environments already loaded in the active storage context. */
export default function EnvironmentCompare({items=[],initialLeftId='',scope='',onClose}) {
  const first=items.some(env=>env.id===initialLeftId)?initialLeftId:items[0]?.id||'';
  const [leftId,setLeftId]=useState(first);
  const [rightId,setRightId]=useState(()=>items.find(env=>env.id!==first)?.id||'');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const [onlyChanges,setOnlyChanges]=useState(false);
  useEffect(()=>{
    function onKeyDown(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}}
    document.addEventListener('keydown',onKeyDown,true);
    return()=>document.removeEventListener('keydown',onKeyDown,true);
  },[onClose]);
  const left=items.find(env=>env.id===leftId);
  const right=items.find(env=>env.id===rightId);
  const comparison=useMemo(()=>left&&right&&left.id!==right.id?compareEnvironments(left,right):null,[left,right]);
  const rows=useMemo(()=>filterEnvironmentCompare(comparison?.rows||[],{query,status,onlyChanges}),[comparison,query,status,onlyChanges]);
  function swap(){setLeftId(rightId);setRightId(leftId);}
  function setLeft(id){setLeftId(id);if(id===rightId)setRightId(items.find(item=>item.id!==id)?.id||'');}
  function setRight(id){setRightId(id);if(id===leftId)setLeftId(items.find(item=>item.id!==id)?.id||'');}
  return createPortal(<div className="pp-compare-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="pp-compare-dialog" role="dialog" aria-modal="true" aria-label="Compare environments">
      <header className="pp-compare-header">
        <div><span className="pp-compare-kicker">ENVIRONMENT TOOLS · READ ONLY</span><h2><GitCompareArrows size={20}/> Compare environments</h2><p>{scope} · Compare any two environment names within this storage location.</p></div>
        <button type="button" className="pp-compare-close" aria-label="Close environment comparison" onClick={onClose}><X size={19}/></button>
      </header>
      <div className="pp-compare-controls">
        <label>Left environment<select aria-label="Left environment" value={leftId} onChange={e=>setLeft(e.target.value)}>{items.map(env=><option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
        <button type="button" aria-label="Swap environments" title="Swap sides" className="pp-compare-swap" onClick={swap}><ArrowLeftRight size={17}/></button>
        <label>Right environment<select aria-label="Right environment" value={rightId} onChange={e=>setRight(e.target.value)}>{items.map(env=><option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
      </div>
      <div className="pp-compare-stats" aria-label="Comparison summary">
        {Object.entries(STATES).map(([key,label])=><button type="button" key={key} className={`pp-compare-stat ${status===key?'active':''}`} aria-pressed={status===key} onClick={()=>setStatus(old=>old===key?'all':key)}><strong>{comparison?.totals[key]||0}</strong><span>{label}</span></button>)}
      </div>
      <div className="pp-compare-filter">
        <label className="pp-compare-search"><Search size={15}/><input aria-label="Search variable keys" placeholder="Search variable keys..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label className="pp-compare-changes"><input type="checkbox" checked={onlyChanges} onChange={e=>setOnlyChanges(e.target.checked)}/> Only changes</label>
        <span className="pp-compare-count">{rows.length} of {comparison?.total||0} keys</span>
      </div>
      <div className="pp-compare-scroll">
        <div className="pp-compare-table" role="table" aria-label="Variable differences">
          <div className="pp-compare-row pp-compare-column-head" role="row"><span role="columnheader">Variable</span><span role="columnheader">{left?.name||'Left'}</span><span role="columnheader">{right?.name||'Right'}</span><span role="columnheader">Status</span></div>
          {rows.map(row=><div className="pp-compare-row" role="row" key={row.key}>
            <div role="cell" className="pp-compare-key"><span title={row.key}>{row.key}</span>{row.sensitive&&<LockKeyhole size={12} aria-label="Sensitive"/>}</div>
            <div role="cell" className={`pp-compare-value ${row.sensitive?'secret':''}`}>{row.left}</div>
            <div role="cell" className={`pp-compare-value ${row.sensitive?'secret':''}`}>{row.right}</div>
            <div role="cell"><span className={`pp-compare-status ${row.status}`}>{STATES[row.status]}</span></div>
          </div>)}
        </div>
        {!rows.length&&<p className="pp-compare-empty">{comparison?.total?'No variables match the selected filter.':'Neither environment has variables to compare.'}</p>}
      </div>
      <footer className="pp-compare-footer"><span><LockKeyhole size={14}/> Secrets are masked. Restricted secrets cannot be compared. No environment is modified.</span><button type="button" onClick={onClose}>Close</button></footer>
    </section>
  </div>,document.body);
}
