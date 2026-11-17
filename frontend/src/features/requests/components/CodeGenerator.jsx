import {RetroSelect} from '../../../components/ui/RetroSelect';
import React, {useState} from 'react';
import {Copy, X, ShieldAlert} from 'lucide-react';
import {GENERATORS,generateCode} from '../services/requestTools';
import {TextEditor} from './Editors';
export function CodeGenerator({request,buildResolved,theme,onClose}) {
  const [lang,setLang]=useState('curl');
  const [resolve,setResolve]=useState(false);
  const [allowSecrets,setAllowSecrets]=useState(false);
  let code='';let error='';
  try {
    const input=resolve ? buildResolved(allowSecrets) : request;
    code=generateCode(input,lang);
  }catch(e){error=e.message}
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div role="dialog" aria-modal="true" aria-label="Generate code" className="dialog pp-code-dialog">
      <div className="dialog-top"><div><h2>Generate Code</h2><p>Generate a snippet from the current request</p></div><button className="icon-btn" onClick={onClose} title="Close"><X size={16}/></button></div>
      <div className="pp-code-controls"><RetroSelect ariaLabel="Programming language" value={lang} onChange={setLang} options={GENERATORS.map(([value,label])=>({value,label}))}/><label><input type="checkbox" checked={resolve} onChange={e=>setResolve(e.target.checked)}/> Resolve variables</label><label><input type="checkbox" disabled={!resolve} checked={allowSecrets} onChange={e=>setAllowSecrets(e.target.checked)}/> Include secrets</label><button className="pp-plain-btn" disabled={!!error} onClick={()=>navigator.clipboard.writeText(code)}><Copy size={15}/> Copy</button></div>
      {allowSecrets&&<div className="pp-response-warning"><ShieldAlert size={14}/> You are exporting real secrets. Review before sharing generated code.</div>}
      {error?<div className="form-error">{error}</div>:<TextEditor readOnly lang={lang==='fetch'?'javascript':'text'} theme={theme} value={code} minHeight="320px"/>}
    </div>
  </div>;
}
