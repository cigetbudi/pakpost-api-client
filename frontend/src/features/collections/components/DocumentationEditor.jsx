import React,{useEffect,useRef,useState} from 'react';
import {Bold,Italic,List,Save} from 'lucide-react';

/** Lightweight markdown source editor (no preview dependency and no HTML injection). */
export function DocumentationEditor({title,initial='',onSave,onCancel,busy=false}) {
  const [text,setText]=useState(initial);
  const input=useRef(null);
  useEffect(()=>{input.current?.focus();},[]);
  useEffect(()=>{function saveShortcut(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopPropagation();if(!busy)onSave(text)}}window.addEventListener('keydown',saveShortcut);return()=>window.removeEventListener('keydown',saveShortcut);},[text,busy,onSave]);
  function wrap(before,after=before){const el=input.current;if(!el)return;
    const from=el.selectionStart,to=el.selectionEnd;
    const value=text.slice(0,from)+before+text.slice(from,to)+after+text.slice(to);
    setText(value);requestAnimationFrame(()=>{el.focus();el.setSelectionRange(from+before.length,to+before.length)})}
  return <form className="pp-doc-form" onSubmit={e=>{e.preventDefault();onSave(text)}}>
    <p>Markdown documentation for <strong>{title}</strong>. This text is included in Postman and OpenAPI exports.</p>
    <div className="pp-doc-toolbar"><button type="button" title="Bold" onClick={()=>wrap('**')}><Bold size={15}/></button><button type="button" title="Italic" onClick={()=>wrap('*')}><Italic size={15}/></button><button type="button" title="Bullet" onClick={()=>wrap('- ','')}><List size={15}/></button><span>Markdown</span></div>
    <textarea ref={input} aria-label="Documentation markdown" value={text} maxLength={16000} spellCheck={true}
      placeholder={'## Overview\nDescribe what this endpoint/folder does, usage examples, constraints...'} onChange={e=>setText(e.target.value)}/>
    <div className="pp-doc-actions"><small>{text.length.toLocaleString()} / 16,000 characters</small><button type="button" onClick={onCancel}>Cancel</button><button type="submit" className="pp-modal-submit" disabled={busy}><Save size={15}/> Save documentation</button></div>
  </form>;
}
