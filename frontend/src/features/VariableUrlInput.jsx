import React, {useEffect,useRef,useState} from 'react';
import {currentVariablePrefix, insertVariable, splitUrlVariables, suggestVariables} from './urlSuggestions';

export function VariableUrlInput({value,onChange,variables={},onPaste,onSend}) {
  const input = useRef(null);
  const visual = useRef(null);
  const [cursor,setCursor] = useState(null);
  const [open,setOpen] = useState(false);
  const [selected,setSelected] = useState(0);
  const suggestions = open ? suggestVariables(value,cursor,variables) : [];
  const prefix = open ? currentVariablePrefix(value,cursor) : null;
  function refreshSuggestions(el) {
    setCursor(el.selectionStart);setSelected(0);
    setOpen(Boolean(currentVariablePrefix(el.value, el.selectionStart)));
  }
  function insert(name) {
    const change = insertVariable(value,cursor,name);
    if (!change) return;
    onChange(change.url);setOpen(false);
    requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(change.cursor,change.cursor);});
  }
  function keyDown(e) {
    if (open && suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault();setSelected(n=>(n+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);return; }
      if (e.key === 'Tab' || e.key === 'Enter') {e.preventDefault();insert(suggestions[selected] || suggestions[0]);return;}
    }
    if (e.key === 'Escape') {setOpen(false);return;}
    if (e.key === 'Enter') onSend();
  }
  useEffect(()=>{if(!open)return;setSelected(n=>Math.min(n,Math.max(0,suggestions.length-1)));},[value,open,variables]);
  return <div className="pp-url-field">
    {value && <div className="pp-url-highlight" aria-hidden="true" ref={visual}>
      {splitUrlVariables(value,variables).map((part,i)=><span key={i} className={part.type==='plain'?'':`pp-env-token pp-env-token-${part.type}`}>{part.text}</span>)}
    </div>}
    <input ref={input} aria-label="Request URL" role="combobox" aria-expanded={Boolean(prefix&&suggestions.length)}
      aria-controls="pp-variable-suggestions" aria-autocomplete="list" autoComplete="off"
      spellCheck={false} type="text" placeholder="Enter URL or paste a cURL command…" value={value}
      onChange={e=>{onChange(e.target.value);refreshSuggestions(e.target)}}
      onClick={e=>refreshSuggestions(e.currentTarget)}
      onSelect={e=>{if(document.activeElement===e.currentTarget && e.currentTarget.selectionStart!==cursor)refreshSuggestions(e.currentTarget)}}
      onBlur={()=>setOpen(false)}
      onScroll={e=>{if(visual.current)visual.current.scrollLeft=e.currentTarget.scrollLeft}}
      onPaste={onPaste} onKeyDown={keyDown}/>
    {prefix && suggestions.length > 0 && <div className="pp-url-suggestions" role="listbox" id="pp-variable-suggestions">
      <div className="pp-url-suggestions-title">Environment variables <span>Tab to insert</span></div>
      {suggestions.map((name,i)=><button type="button" key={name} role="option" aria-selected={selected===i}
        className={selected===i?'selected':''} onMouseDown={e=>e.preventDefault()} onClick={()=>insert(name)}>
        <span className="pp-url-suggest-label">{'{{'}<strong>{name}</strong>{'}}'}</span><small>{String(variables[name] ?? '') ? 'Defined' : 'Empty value'}</small>
      </button>)}
    </div>}
  </div>;
}
