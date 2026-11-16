import React, {useEffect,useRef,useState} from 'react';
import {Check,ClipboardPaste,Copy,Download,FileJson,FileUp,Import,ShieldAlert,Upload} from 'lucide-react';
import {GENERATORS,generateCode} from './requestTools';
import {TextEditor} from './Editors';
import {RetroSelect} from './RetroSelect';
import {createPostmanCollection,createLocalPostmanExport,createSessionExport,parseImportText} from './importExport';
import {exportCollectionByFormat,flattenLocalCollections} from './exportFormats';
import {ImportDestinationPicker} from './ImportDestinationPicker';
import {defaultStorageScope,allowedStorageScope,STORAGE_WORKSPACE} from './storageScope.js';

const IMPORT_PLACEHOLDER = String.raw`curl -X POST https://postman-echo.com/post \
  -H "Content-Type: application/json" \
  -d '{"hello":"world"}'`;

function saveJSON(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
}

export function CodeSidebar({request,buildResolved,theme='dark'}){
  const [language,setLanguage]=useState('curl');const [resolve,setResolve]=useState(false);const [secrets,setSecrets]=useState(false);const [copied,setCopied]=useState(false);
  let code='',error='';
  try{code=generateCode(resolve?buildResolved(secrets):request,language)}catch(e){error=e.message}
  async function onCopy(){try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{/* Browser requires HTTPS or permission. */}}
  return <div className="pp-side-tool">
    <p className="pp-side-hint">Generate code for the active request. Choose a language and copy the snippet.</p>
    <div className="pp-side-field">Language<RetroSelect ariaLabel="Code generator language" value={language} onChange={setLanguage} options={GENERATORS.map(([value,label])=>({value,label}))}/></div>
    <label className="pp-side-check"><input type="checkbox" checked={resolve} onChange={e=>setResolve(e.target.checked)}/> Resolve variables</label>
    <label className="pp-side-check"><input type="checkbox" disabled={!resolve} checked={secrets} onChange={e=>setSecrets(e.target.checked)}/> Include secret values</label>
    {secrets&&<p className="pp-side-alert"><ShieldAlert size={14}/> This snippet may contain credentials. Review before sharing.</p>}
    <div className="pp-side-code-toolbar"><span>{language.toUpperCase()} · preview</span><button disabled={!!error} onClick={onCopy}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copied':'Copy'}</button></div>
    {error?<p className="pp-side-alert">{error}</p>:<div className="pp-side-code pp-highlighted-code" aria-label="Generated request code"><TextEditor value={code} readOnly lint={false} theme={theme} lang={language==='curl'?'shell':language==='fetch'||language==='axios'?'javascript':language} minHeight="215px" lineNumbers={false}/></div>}
  </div>;
}

export function ImportExportSidebar({requests,environments,localCollections=[],onImport,onMessage,theme='dark',authenticated=false,workspaceName='',onLogin}){
  const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [includeSecrets,setIncludeSecrets]=useState(false);
  const [exportFormat,setExportFormat]=useState('postman');
  const [destination,setDestination]=useState(()=>defaultStorageScope(authenticated));
  useEffect(()=>setDestination(defaultStorageScope(authenticated)),[authenticated]);
  const importDestination=allowedStorageScope(authenticated,destination);
  const fileInput=useRef(null);
  async function doImport(source){
    if(!source.trim())return;
    setBusy(true);try{
      const parsed=parseImportText(source);
      const message=await onImport(parsed,importDestination);
      onMessage(message||`Import complete · ${importDestination===STORAGE_WORKSPACE?'Cloud · Neon':'Local · Browser'}`);
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
    <p className="pp-side-hint">Import Postman v2.1, OpenAPI 3.0/3.1 JSON, Insomnia v4 JSON, environments or cURL. Pakpost session backups restore tabs.</p>
    <ImportDestinationPicker authenticated={authenticated} workspaceName={workspaceName} value={importDestination} onChange={setDestination} onLogin={onLogin}/>
    <div className="pp-import-text pp-highlighted-import" aria-label="Paste cURL or JSON export"><TextEditor value={text} onChange={setText} theme={theme} lint={false} lang={text.length > 80000 ? 'text' : /^[\s]*[\[{]/.test(text) ? 'json' : 'shell'} minHeight="155px" placeholder={IMPORT_PLACEHOLDER}/></div>
    <div className="pp-side-actions"><button onClick={()=>doImport(text)} disabled={!text.trim()||busy}><ClipboardPaste size={14}/> Import pasted</button><button onClick={()=>fileInput.current?.click()} disabled={busy}><Upload size={14}/> Choose file</button><input ref={fileInput} type="file" hidden accept=".json,.txt,.sh,.curl,application/json,text/plain" onChange={pickFile}/></div>
    <div className="pp-side-divider"/>
    <div className="pp-side-section-title">EXPORT</div>
    <p className="pp-side-hint">Export open tabs without login. Files are downloaded locally, never uploaded.</p>
    <label className="pp-side-check"><input type="checkbox" checked={includeSecrets} onChange={e=>setIncludeSecrets(e.target.checked)}/> Include known sensitive headers, tokens and environment secrets</label>
    {includeSecrets&&<p className="pp-side-alert"><ShieldAlert size={14}/> Export can contain real secrets. Keep the downloaded file private.</p>}
    <div className="pp-side-field">Export format
      <RetroSelect ariaLabel="Export format" value={exportFormat} onChange={setExportFormat} options={[
        {value:'postman',label:'Postman Collection v2.1'},{value:'openapi',label:'OpenAPI 3.1 JSON'},
        {value:'insomnia',label:'Insomnia v4 JSON (legacy)'}
      ]}/>
    </div>
    <div className="pp-export-buttons">
      <button onClick={()=>saveJSON(createSessionExport(requests,environments,{includeSecrets}),'pakpost-session.json')}><Download size={15}/><span><strong>Pakpost session</strong><small>Open tabs, scripts, local environments</small></span></button>
      <button onClick={()=>{
        const output=exportCollectionByFormat(requests,{name:'Pakpost open tabs',format:exportFormat,includeSecrets});
        saveJSON(output,exportFormat==='openapi'?'pakpost-open-tabs.openapi.json':exportFormat==='insomnia'?'pakpost-open-tabs.insomnia_v4.json':'pakpost-open-tabs.postman_collection.json');
      }}><FileJson size={15}/><span><strong>Open tabs as {exportFormat==='postman'?'Postman':exportFormat==='openapi'?'OpenAPI 3.1':'Insomnia v4'}</strong><small>{exportFormat==='postman'?'Requests, headers, body, scripts':exportFormat==='openapi'?'Endpoint contract and saved response examples':'Legacy JSON for Insomnia import'}</small></span></button>
      <button disabled={!localCollections.length} onClick={()=>{
        if(exportFormat==='postman')saveJSON(createLocalPostmanExport(localCollections,{includeSecrets}),'pakpost-local-collections.postman_collection.json');
        else {
          const flattened=flattenLocalCollections(localCollections);
          const output=exportCollectionByFormat(flattened.requests,{name:'Pakpost local collections',format:exportFormat,includeSecrets,folderDocs:flattened.folderDocs});
          saveJSON(output,exportFormat==='openapi'?'pakpost-local-collections.openapi.json':'pakpost-local-collections.insomnia_v4.json');
        }
      }}><FileJson size={15}/><span><strong>Local collections as {exportFormat==='postman'?'Postman':exportFormat==='openapi'?'OpenAPI 3.1':'Insomnia v4'}</strong><small>{exportFormat==='postman'?'Preserves imported folder hierarchy':exportFormat==='openapi'?'Local collection tags, docs and examples':'Folders and HTTP requests (legacy v4)'}</small></span></button>
    </div>
    <div className="pp-side-divider"/>
    <p className="pp-side-hint">OpenAPI is a contract format and cannot execute Postman scripts. Insomnia v4 JSON is a legacy interchange format; current Insomnia v5 YAML is not supported here. Cloud imports use the selected workspace; Local imports never sync automatically.</p>
  </div>;
}
