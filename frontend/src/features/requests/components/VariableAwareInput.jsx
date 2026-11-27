import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Eye,EyeOff,Pencil,X} from 'lucide-react';
import {currentVariablePrefix,insertVariable,suggestVariables} from '../services/urlSuggestions.js';
import {variableDescriptors} from '../../environments/services/variableExperience.js';

/** Portal keeps hover cards outside clipped panes; previews mask secrets until explicit reveal. */
export function VariablePopover({item,anchor,source,onEditVariable,onOpenEnvironments,onClose,onMouseEnter,onMouseLeave}){
  const [editing,setEditing]=useState(false);
  const [revealed,setRevealed]=useState(false);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const input=useRef(null);
  useEffect(()=>{setEditing(false);setRevealed(false);setError('');setDraft(item?.value??'');},[item?.key,item?.value]);
  useEffect(()=>{if(editing)input.current?.focus();},[editing]);
  useEffect(()=>{if(!item)return;const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[item,onClose]);
  if(!item||!anchor)return null;
  const width=Math.min(300,Math.max(220,window.innerWidth-16));
  const left=Math.max(8,Math.min(anchor.left,window.innerWidth-width-8));
  const top=anchor.bottom+8+198>window.innerHeight?Math.max(8,anchor.top-218):anchor.bottom+8;
  const known=item.type==='known';
  const restricted=item.type==='restricted';
  const masked=item.sensitive&&!revealed;
  async function save(e){e.preventDefault();if(!onEditVariable)return;
    setBusy(true);setError('');try{await onEditVariable(item.key,draft);onClose();}catch(err){setError(err?.message||'Could not save variable.');}finally{setBusy(false);}}
  return createPortal(<div className="pp-var-popover" role="dialog" aria-label={`Variable ${item.key}`} style={{left,top,width}}
    onMouseDown={e=>e.stopPropagation()} onMouseEnter={onMouseEnter} onMouseLeave={e=>{if(!editing)onMouseLeave?.(e)}}>
    <div className="pp-var-popover-head"><span className="pp-var-popover-name">{'{{'+item.key+'}}'}</span><span className={`pp-var-status pp-var-status-${item.type}`}>{restricted?'Restricted':known?'Resolved':'Unresolved'}</span><button type="button" className="pp-var-close" onClick={onClose} aria-label="Close variable details"><X size={14}/></button></div>
    <div className="pp-var-popover-source">{source||'Active environment'}</div>
    {editing?<form onSubmit={save} className="pp-var-edit-form">
      <label>Variable value<input ref={input} type={item.sensitive&&!revealed?'password':'text'} value={draft} onChange={e=>setDraft(e.target.value)} autoComplete="off" spellCheck={false}/></label>
      {item.sensitive&&<button type="button" className="pp-var-reveal" onClick={()=>setRevealed(v=>!v)}>{revealed?<EyeOff size={14}/>:<Eye size={14}/>} {revealed?'Hide':'Reveal'}</button>}
      {error&&<p role="alert" className="pp-var-edit-error">{error}</p>}
      <div className="pp-var-edit-actions"><button type="button" onClick={()=>setEditing(false)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}><Check size={13}/> {busy?'Saving…':'Save'}</button></div>
    </form>:<>
      {known?<div className="pp-var-value-row"><span className="pp-var-value" aria-label={masked?'Hidden secret value':'Resolved variable value'}>{masked?'••••••••••••':item.value||'(empty value)'}</span>{item.sensitive&&<button type="button" className="pp-var-reveal" aria-label={revealed?'Hide value':'Reveal value'} onClick={()=>setRevealed(v=>!v)}>{revealed?<EyeOff size={15}/>:<Eye size={15}/>}</button>}</div>
      :<p className="pp-var-message">{restricted?'This workspace variable is restricted for your account.':'No value in the active variable scopes.'}</p>}
      {restricted?<p className="pp-var-message">Ask a workspace administrator to manage this value.</p>
      :onEditVariable?<button type="button" className="pp-var-edit-trigger" onClick={()=>{setDraft(known?item.value:'');setEditing(true);}}><Pencil size={14}/> {known?'Edit variable':'Create variable'}</button>
      :<button type="button" className="pp-var-edit-trigger" onClick={onOpenEnvironments}>Select an environment to edit</button>}
    </>}
  </div>,document.body);
}

/** Reusable inline text highlighting for URL, auth, headers, params and form data. */
export function VariableOverlay({value,variables={},definitions=[],source,onEditVariable,onOpenEnvironments,visualRef,className=''}){
  const [active,setActive]=useState(null);
  const timer=useRef(null);
  const [position,setPosition]=useState(null);
  const items=variableDescriptors(value,variables,definitions);
  const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
  const close=()=>{clear();setActive(null);setPosition(null);};
  const leave=()=>{clear();timer.current=setTimeout(close,180);};
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  // A changed environment or edited input must close obsolete previews.
  useEffect(()=>{close();},[value,source]);
  const current=active?items.find(x=>x.key===active):null;
  return <>
    {value&&<div className={`pp-variable-highlight ${className}`} aria-hidden="false" ref={visualRef}>
      {items.map((part,i)=>!part.key?<span className="pp-var-text" aria-hidden="true" key={i}>{part.text}</span>
        :<button type="button" key={i} className={`pp-env-token pp-env-token-${part.type} pp-var-token`} aria-label={`Variable ${part.key}, ${part.type==='known'?'resolved':part.type==='restricted'?'restricted':'unresolved'}`} onMouseEnter={e=>{clear();setActive(part.key);setPosition(e.currentTarget.getBoundingClientRect());}}
          onMouseLeave={leave} onFocus={e=>{clear();setActive(part.key);setPosition(e.currentTarget.getBoundingClientRect());}}
          onClick={e=>{e.preventDefault();clear();setActive(part.key);setPosition(e.currentTarget.getBoundingClientRect());}}>{part.text}</button>)}
    </div>}
    {current&&<VariablePopover item={current} anchor={position} source={source} onEditVariable={onEditVariable} onOpenEnvironments={onOpenEnvironments} onClose={close} onMouseEnter={clear} onMouseLeave={leave}/>}
  </>;
}

export function VariableAwareInput({value='',onChange,variables={},definitions=[],source='',onEditVariable,onOpenEnvironments,onSend,onPaste,placeholder='',className='',ariaLabel='Variable-aware input',autoComplete='off',type='text'}){
  const input=useRef(null),visual=useRef(null);
  const [cursor,setCursor]=useState(null),[open,setOpen]=useState(false),[selected,setSelected]=useState(0);
  const suggestions=open?suggestVariables(value,cursor,variables):[];
  function refresh(el){setCursor(el.selectionStart);setSelected(0);setOpen(Boolean(currentVariablePrefix(el.value,el.selectionStart)));}
  function insert(name){const change=insertVariable(value,cursor,name);if(!change)return;onChange(change.url);setOpen(false);
    requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(change.cursor,change.cursor);});}
  function keyDown(e){if(open&&suggestions.length){if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setSelected(i=>(i+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);return;}
    if(['Tab','Enter'].includes(e.key)){e.preventDefault();insert(suggestions[selected]||suggestions[0]);return;}}
    if(e.key==='Escape'){setOpen(false);return;}if(e.key==='Enter'&&onSend)onSend();}
  return <div className={`pp-variable-field ${className}`}>
    <input ref={input} className="pp-variable-input" aria-label={ariaLabel} aria-expanded={Boolean(open&&suggestions.length)} autoComplete={autoComplete} spellCheck={false} type={type} placeholder={placeholder} value={value}
      onChange={e=>{onChange(e.target.value);refresh(e.currentTarget);}} onClick={e=>refresh(e.currentTarget)} onSelect={e=>{if(document.activeElement===e.currentTarget&&e.currentTarget.selectionStart!==cursor)refresh(e.currentTarget);}}
      onScroll={e=>{if(visual.current)visual.current.scrollLeft=e.currentTarget.scrollLeft;}} onPaste={onPaste} onKeyDown={keyDown} onBlur={()=>setOpen(false)}/>
    <VariableOverlay value={value} variables={variables} definitions={definitions} source={source} onEditVariable={onEditVariable} onOpenEnvironments={onOpenEnvironments} visualRef={visual} className="pp-value-highlight"/>
    {open&&suggestions.length>0&&<div className="pp-url-suggestions" role="listbox" aria-label="Variable suggestions"><div className="pp-url-suggestions-title">Available variables <span>Tab to insert</span></div>
      {suggestions.map((name,i)=><button type="button" role="option" aria-selected={i===selected} className={i===selected?'selected':''} key={name} onMouseDown={e=>e.preventDefault()} onClick={()=>insert(name)}><span className="pp-url-suggest-label">{'{{'}<strong>{name}</strong>{'}}'}</span><small>Available</small></button>)}
    </div>}
  </div>;
}
