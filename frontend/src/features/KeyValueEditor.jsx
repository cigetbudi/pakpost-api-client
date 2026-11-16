import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Plus,X} from 'lucide-react';
import {emptyRow,isEnabled} from './requestMetadata.js';
import {VariableAwareInput,VariableOverlay} from './VariableAwareInput.jsx';

export const MIME_SUGGESTIONS=[
 'application/json','application/ld+json','application/xml','text/xml','text/plain',
 'text/html','application/x-www-form-urlencoded','multipart/form-data',
 'application/octet-stream','application/javascript','application/pdf','image/png','image/jpeg'
];

function ContentTypeInput({value,onChange,variableUi={}}){
  const ref=useRef(null);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [position,setPosition]=useState({left:0,top:0,width:240});
  const options=MIME_SUGGESTIONS.filter(s=>s.toLowerCase().includes(String(value||'').toLowerCase()));
  function measure(){const box=ref.current?.getBoundingClientRect();if(!box)return;
    const width=Math.max(220,box.width);
    setPosition({left:Math.max(8,Math.min(box.left,window.innerWidth-width-8)),top:box.bottom+4,width});}
  useEffect(()=>{if(!open)return;
    measure();const onPointer=e=>{if(!e.target.closest?.('.pp-mime-suggestion')&&!ref.current?.contains(e.target))setOpen(false)};
    const onScroll=()=>setOpen(false);
    document.addEventListener('pointerdown',onPointer);window.addEventListener('resize',measure);window.addEventListener('scroll',onScroll,true);
    return()=>{document.removeEventListener('pointerdown',onPointer);window.removeEventListener('resize',measure);window.removeEventListener('scroll',onScroll,true)};
  },[open]);
  function choose(option){onChange(option);setOpen(false);ref.current?.focus();}
  return <div className="pp-mime-input">
    <input ref={ref} spellCheck={false} aria-label="Header value" aria-autocomplete="list" aria-expanded={open} value={value}
      placeholder="application/json" onFocus={()=>{setOpen(true);setActive(0)}} onChange={e=>{onChange(e.target.value);setOpen(true);setActive(0)}}
      onKeyDown={e=>{if(e.key==='Escape'){setOpen(false)}else if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(i=>Math.min(options.length-1,i+1))}else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1))}else if(e.key==='Enter'&&open&&options.length){e.preventDefault();choose(options[active]||options[0]);}}}/>
    <VariableOverlay value={value} {...variableUi} className="pp-mime-highlight"/>
    <button className="pp-mime-arrow" type="button" aria-label="Suggest content types" onClick={()=>{if(open)setOpen(false);else{setOpen(true);ref.current?.focus();}setActive(0)}}><ChevronDown size={15}/></button>
    {open&&!!options.length&&createPortal(<div className="pp-mime-suggestion" style={{left:position.left,top:position.top,width:position.width}} role="listbox" aria-label="Common Content-Type values">
      {options.map((o,i)=><button key={o} type="button" role="option" aria-selected={value===o} className={i===active?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o)}>{o}{value===o&&<Check size={13}/>}</button>)}
    </div>,document.body)}
  </div>;
}

/** Shared Headers / Params editor. No new UI library, and no per-row timers. */
export function KeyValueEditor({kind,rows,onChange,variableUi={}}){
  const headers=kind==='headers';
  function update(index,patch){onChange(previous=>previous.map((row,i)=>i===index?{...row,...patch}:row));}
  return <>
    <div className="pp-form-caption"><span>{headers?'REQUEST HEADERS':'QUERY PARAMETERS'}</span><span>Disabled rows are saved but not sent</span></div>
    <div className="pp-kv21-heading"><span>ON</span><span>KEY</span><span>VALUE</span><span>DESCRIPTION (OPTIONAL)</span><span/></div>
    {(rows||[]).map((r,i)=><div className={`pp-kv21-row ${!isEnabled(r)?'disabled':''}`} key={i}>
      <label className="pp-kv21-checkbox" title={isEnabled(r)?'Disable row':'Enable row'}><input type="checkbox" aria-label={`${headers?'Header':'Query parameter'} ${i+1} enabled`} checked={isEnabled(r)} onChange={e=>update(i,{enabled:e.target.checked})}/></label>
      <VariableAwareInput value={r.key||''} placeholder={headers?'Content-Type':'parameter'} ariaLabel={headers?'Header key':'Query key'} onChange={value=>update(i,{key:value})} {...variableUi}/>
      {headers&&r.key?.trim().toLowerCase()==='content-type'?<ContentTypeInput value={r.value||''} onChange={value=>update(i,{value})} variableUi={variableUi}/>:
        <VariableAwareInput value={r.value||''} placeholder="value" ariaLabel={headers?'Header value':'Query value'} onChange={value=>update(i,{value})} {...variableUi}/>}
      <input value={r.description||''} placeholder="What is this used for?" aria-label={`${headers?'Header':'Query'} description`} onChange={e=>update(i,{description:e.target.value})}/>
      <button type="button" className="icon-btn" aria-label={headers?'Remove header':'Remove query parameter'} onClick={()=>onChange(previous=>previous.filter((_,j)=>j!==i))}><X size={15}/></button>
    </div>)}
    <button className="pp-inline-add" type="button" onClick={()=>onChange(previous=>[...previous,emptyRow()])}><Plus size={14}/> {headers?'Add header':'Add parameter'}</button>
  </>;
}
