import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Check, ChevronDown} from 'lucide-react';

// Lightweight, accessible listbox: no additional dependencies and no native white popup.
// The portal keeps the menu above split panes / overflow-hidden request panels.
export function RetroSelect({value, onChange, options=[], ariaLabel='Choose an option', className='', disabled=false, placeholder='Select…', title}) {
  const id=useId();
  const trigger=useRef(null);
  const menu=useRef(null);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [position,setPosition]=useState({top:0,left:0,width:180,maxHeight:280});
  const choices=useMemo(()=>options.map(o=>typeof o==='string'?{value:o,label:o}:o),[options]);
  const selected=choices.findIndex(o=>String(o.value)===String(value));
  const label=selected<0?placeholder:choices[selected].label;
  const available=choices.map((o,i)=>({...o,index:i})).filter(o=>!o.disabled);
  function measure(){
    if(!trigger.current)return;
    const b=trigger.current.getBoundingClientRect();
    const w=Math.max(b.width,Math.min(310,window.innerWidth-24));
    const max=Math.min(300,window.innerHeight-24);
    const up=window.innerHeight-b.bottom<Math.min(max,choices.length*39+12) && b.top>window.innerHeight-b.bottom;
    setPosition({left:Math.max(12,Math.min(b.left,window.innerWidth-w-12)),top:up?Math.max(12,b.top-Math.min(max,choices.length*39+12)-5):Math.min(window.innerHeight-12,b.bottom+5),width:w,maxHeight:up?Math.min(max,b.top-17):Math.min(max,window.innerHeight-b.bottom-17)});
  }
  function close(restoreFocus=false){setOpen(false);if(restoreFocus)trigger.current?.focus();}
  function choose(index){if(choices[index]?.disabled)return;onChange(choices[index].value);close(true);}
  function move(delta){
    if(!available.length)return;
    const idx=available.findIndex(o=>o.index===active);
    setActive(available[(idx+delta+available.length)%available.length].index);
  }
  function onKeyDown(e){
    if(e.key==='Escape'){if(open){e.preventDefault();close(true);}return;}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();if(!open){setActive(selected>=0?selected:(available[0]?.index??0));setOpen(true)}else move(e.key==='ArrowDown'?1:-1);return;
    }
    if(e.key==='Home'&&open){e.preventDefault();setActive(available[0]?.index??0);return;}
    if(e.key==='End'&&open){e.preventDefault();setActive(available.at(-1)?.index??0);return;}
    if((e.key==='Enter'||e.key===' ')&&open){e.preventDefault();choose(active);return;}
    if((e.key==='Enter'||e.key===' ')&&!open){e.preventDefault();setOpen(true);return;}
    if(open&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      const found=available.find(o=>String(o.label).toLowerCase().startsWith(e.key.toLowerCase()));
      if(found)setActive(found.index);
    }
  }
  useLayoutEffect(()=>{if(open)measure();},[open,choices.length]);
  useEffect(()=>{
    if(!open)return;
    function outside(e){if(!trigger.current?.contains(e.target)&&!menu.current?.contains(e.target))close();}
    function focusOutside(e){if(!trigger.current?.contains(e.target)&&!menu.current?.contains(e.target))close();}
    function resized(){measure();}
    function scrolled(e){if(!menu.current?.contains(e.target))close();}
    function esc(e){if(e.key==='Escape'){e.stopPropagation();close(true);}}
    document.addEventListener('pointerdown',outside);
    document.addEventListener('focusin',focusOutside);
    document.addEventListener('keydown',esc,true);
    window.addEventListener('resize',resized);
    window.addEventListener('scroll',scrolled,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',focusOutside);document.removeEventListener('keydown',esc,true);window.removeEventListener('resize',resized);window.removeEventListener('scroll',scrolled,true);};
  },[open]);
  return <div className={`pp-retro-select ${className}`}>
    <button ref={trigger} type="button" className="pp-select-trigger" role="combobox" aria-label={ariaLabel}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} aria-activedescendant={open?`${id}-option-${active}`:undefined}
      title={title} disabled={disabled} onKeyDown={onKeyDown} onClick={()=>{if(!open){setActive(selected>=0?selected:0);setOpen(true)}else close()}}>
      <span className="pp-select-label">{label}</span><ChevronDown size={15} aria-hidden="true" className={open?'pp-select-chevron open':'pp-select-chevron'}/>
    </button>
    {open&&createPortal(<div ref={menu} className="pp-select-popover" id={id} role="listbox" aria-label={ariaLabel}
      style={{position:'fixed',left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight}}
      onKeyDown={onKeyDown}>
      {choices.map((o,i)=><React.Fragment key={`${o.value}-${i}`}>
        {(i===0||o.group&&o.group!==choices[i-1]?.group)&&o.group&&<div className="pp-select-group" role="presentation">{o.group}</div>}
        <button type="button" id={`${id}-option-${i}`} role="option" aria-selected={selected===i} aria-disabled={!!o.disabled} disabled={!!o.disabled}
          className={`pp-select-option ${active===i?'focused':''} ${selected===i?'selected':''} ${o.method?`pp-option-${String(o.value).toLowerCase()}`:''}`}
          onMouseEnter={()=>setActive(i)} onClick={()=>choose(i)}>
          <span>{o.label}</span>{selected===i&&<Check size={14} aria-hidden="true"/>}
        </button>
      </React.Fragment>)}
    </div>,document.body)}
  </div>;
}
