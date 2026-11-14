import React, {useRef,useState} from 'react';
import {Check,ClipboardPaste,Copy,Download,FileJson,FileUp,Import,ShieldAlert,Upload} from 'lucide-react';
import {GENERATORS,generateCode} from './requestTools';
import {createPostmanCollection,createLocalPostmanExport,createSessionExport,parseImportText} from './importExport';

function saveJSON(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
}

export function CodeSidebar({request,buildResolved}){
  const [language,setLanguage]=useState('curl');const [resolve,setResolve]=useState(false);const [secrets,setSecrets]=useState(false);const [copied,setCopied]=useState(false);
  let code='',error='';
  try{code=generateCode(resolve?buildResolved(secrets):request,language)}catch(e){error=e.message}
  async function onCopy(){try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{/* Browser requires HTTPS or permission. */}}
  return <div className="pp-side-tool">
    <p className="pp-side-hint">Generate code for the active request. Choose a language and copy the snippet.</p>
    <label className="pp-side-field">Language<select value={language} onChange={e=>setLanguage(e.target.value)}>{GENERATORS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="pp-side-check"><input type="checkbox" checked={resolve} onChange={e=>setResolve(e.target.checked)}/> Resolve variables</label>
    <label className="pp-side-check"><input type="checkbox" disabled={!resolve} checked={secrets} onChange={e=>setSecrets(e.target.checked)}/> Include secret values</label>
    {secrets&&<p className="pp-side-alert"><ShieldAlert size={14}/> This snippet may contain credentials. Review before sharing.</p>}
    <div className="pp-side-code-toolbar"><span>{language.toUpperCase()} · preview</span><button disabled={!!error} onClick={onCopy}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copied':'Copy'}</button></div>
    {error?<p className="pp-side-alert">{error}</p>:<pre className="pp-side-code" aria-label="Generated request code">{code}</pre>}
  </div>;
}

export function ImportExportSidebar({requests,environments,localCollections=[],onImport,onMessage}){
  const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [includeSecrets,setIncludeSecrets]=useState(false);
  const fileInput=useRef(null);
  async function doImport(source){
    if(!source.trim())return;
    setBusy(true);try{
      const parsed=parseImportText(source);
      await onImport(parsed);
      onMessage(parsed.kind==='postman'||parsed.kind==='curl' ? `Imported ${parsed.requests.length} request(s) into local Collections.` : `Restored ${parsed.requests.length} tab(s)${parsed.environments.length?' and '+parsed.environments.length+' environment(s)':''}.`);
      setText('');
    }catch(err){onMessage('Import failed: '+err.message)}finally{setBusy(false)}
  }
  async function pickFile(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(file.size>3*1024*1024){onMessage('Max import size is 3 MB.');return;}
    await doImport(await file.text());
  }
  return <div className="pp-side-tool pp-exchange-panel">
    <div className="pp-side-section-title">IMPORT</div>
    <p className="pp-side-hint">Postman collections and cURL imports are organized in local Collections. Pakpost session backups restore tabs.</p>
    <textarea className="pp-import-text" spellCheck="false" value={text} placeholder={'curl -X POST https://postman-echo.com/post \\\n  -H "Content-Type: application/json" \\\n  -d \'{"hello":"world"}\''} onChange={e=>setText(e.target.value)} aria-label="Paste cURL or JSON export"/>
    <div className="pp-side-actions"><button onClick={()=>doImport(text)} disabled={!text.trim()||busy}><ClipboardPaste size={14}/> Import pasted</button><button onClick={()=>fileInput.current?.click()} disabled={busy}><Upload size={14}/> Choose file</button><input ref={fileInput} type="file" hidden accept=".json,.txt,.sh,.curl,application/json,text/plain" onChange={pickFile}/></div>
    <div className="pp-side-divider"/>
    <div className="pp-side-section-title">EXPORT</div>
    <p className="pp-side-hint">Export open tabs without login. Files are downloaded locally, never uploaded.</p>
    <label className="pp-side-check"><input type="checkbox" checked={includeSecrets} onChange={e=>setIncludeSecrets(e.target.checked)}/> Include known sensitive headers, tokens and environment secrets</label>
    {includeSecrets&&<p className="pp-side-alert"><ShieldAlert size={14}/> Export can contain real secrets. Keep the downloaded file private.</p>}
    <div className="pp-export-buttons">
      <button onClick={()=>saveJSON(createSessionExport(requests,environments,{includeSecrets}),'pakpost-session.json')}><Download size={15}/><span><strong>Pakpost session</strong><small>Open tabs, scripts, local environments</small></span></button>
      <button onClick={()=>saveJSON(createPostmanCollection(requests,{includeSecrets}),'pakpost-open-tabs.postman_collection.json')}><FileJson size={15}/><span><strong>Open tabs as Postman</strong><small>Requests, headers, body, scripts</small></span></button>
      <button disabled={!localCollections.length} onClick={()=>saveJSON(createLocalPostmanExport(localCollections,{includeSecrets}),'pakpost-local-collections.postman_collection.json')}><FileJson size={15}/><span><strong>Local collections as Postman</strong><small>Preserves imported folder hierarchy</small></span></button>
    </div>
    <div className="pp-side-divider"/>
    <p className="pp-side-hint">Body text and scripts are exported as written and may contain credentials. Review export files before sharing. Imported collections stay in browser storage, available without login. They are not automatically synced to Neon workspaces.</p>
  </div>;
}
