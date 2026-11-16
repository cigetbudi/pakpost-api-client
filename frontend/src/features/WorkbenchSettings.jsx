import React,{useState} from 'react';
import {ArrowRight,Code2,FileUp,Info,Keyboard,LayoutPanelTop,Palette,ShieldCheck,Variable,Puzzle,Server,Globe2,RefreshCw,CheckCircle2,AlertCircle} from 'lucide-react';
import {AppearanceSidebar} from './AppearanceSidebar';

/** Full-workspace preferences; no extra router or UI dependencies. */
export function WorkbenchSettings({theme,onThemeChange,split,onSplitChange,interceptorMode='proxy',onInterceptorChange=()=>{},extensionStatus={state:'unknown'},onCheckExtension=()=>{},onBack,onOpenEnvironments,onOpenImportExport}){
  const [category,setCategory]=useState('appearance');
  const categories=[
    ['appearance','Appearance',Palette],['layout','Request layout',LayoutPanelTop],
    ['interceptor','Interceptor',Puzzle],['shortcuts','Keyboard shortcuts',Keyboard],
    ['environments','Environments',Variable],['exchange','Import / Export',FileUp],
    ['privacy','Privacy & proxy',ShieldCheck],['about','About Pakpost',Info]
  ];
  return <div className="pp-settings-screen pp-settings-v17">
    <header className="pp-settings-heading"><div><span>PAKPOST / PREFERENCES</span><h1>Settings</h1><p>Configure your API workbench. Preferences are stored in this browser.</p></div><button onClick={onBack}><ArrowRight size={15}/> Return to REST</button></header>
    <div className="pp-settings-inner"><nav aria-label="Settings categories" className="pp-settings-categories">
      {categories.map(([id,name,Icon])=><button key={id} className={category===id?'selected':''} onClick={()=>setCategory(id)}><Icon size={17}/><span>{name}</span></button>)}
    </nav><section className="pp-settings-details">
      {category==='appearance'&&<><h2>Appearance</h2><p>Choose a theme for the entire workbench, including code editors.</p><AppearanceSidebar value={theme} onChange={onThemeChange}/></>}
      {category==='layout'&&<><h2>Request layout</h2><p>Choose how request and response share the available space.</p><div className="pp-settings-layouts"><button className={split==='horizontal'?'chosen':''} onClick={()=>onSplitChange('horizontal')}><LayoutPanelTop size={22}/>Stacked <small>Request above response</small></button><button className={split==='vertical'?'chosen':''} onClick={()=>onSplitChange('vertical')}><Code2 size={22}/>Side by side<small>Request left of response</small></button></div></>}
      {category==='interceptor'&&<>
        <h2>Request Interceptor</h2><p>Choose how Pakpost sends requests. Internal APIs must never be sent through the public proxy by accident.</p>
        <div className="pp-v27-options" role="radiogroup" aria-label="Request interceptor">
          {[
            ['proxy','Secure Proxy',Server,'Pakpost backend. Private addresses are blocked.'],
            ['browser','Browser',Globe2,'Direct browser fetch, subject to CORS.'],
            ['extension','Browser Extension',Puzzle,'From your browser/VPN with manually approved hosts.']
          ].map(([mode,label,Icon,description])=><button type="button" key={mode} role="radio" aria-checked={interceptorMode===mode} className={interceptorMode===mode?'active':''} onClick={()=>onInterceptorChange(mode)}>
            <span className="pp-v27-option-radio"/><Icon size={18}/><span><strong>{label}</strong><small>{description}</small></span>
          </button>)}
        </div>
        {interceptorMode==='extension'&&<div className="pp-v27-extension-panel">
          <div className="pp-v27-status-head"><Puzzle size={19}/><strong>Pakpost Interceptor Extension</strong>
            <span className={`pp-v27-status ${extensionStatus.state}`}>
              {extensionStatus.state==='connected'?<CheckCircle2 size={13}/>:<AlertCircle size={13}/>}
              {extensionStatus.state==='connected'?`Connected · v${extensionStatus.version||'?'}`:extensionStatus.state==='checking'?'Checking…':'Not connected'}
            </span>
          </div>
          <p>Install the Chrome/Firefox extension. In its popup, add this website under <strong>Allowed Pakpost Origins</strong> then use <strong>Scan this Pakpost tab</strong> in the extension popup to review and approve multiple API destinations at once. Grant browser permissions, then reload Pakpost.</p>
          <button type="button" className="pp-v27-check" onClick={onCheckExtension}><RefreshCw size={14}/> Check connection</button>
          <p className="pp-v27-hint">The extension does not use Pakpost's backend proxy and does not follow redirects. You must be on the appropriate LAN/VPN.</p>
        </div>}
        {interceptorMode==='browser'&&<p className="pp-v27-hint">Requests run in your webpage. Cross-origin APIs must allow Pakpost's origin via CORS; otherwise choose Browser Extension.</p>}
      </>}
      {category==='shortcuts'&&<><h2>Keyboard shortcuts</h2><p>Available while working in REST.</p><dl className="pp-settings-shortcuts"><div><dt>Send request</dt><dd>Ctrl / Cmd + Enter</dd></div><div><dt>Save request</dt><dd>Ctrl / Cmd + S</dd></div><div><dt>Quick search</dt><dd>Ctrl / Cmd + K</dd></div><div><dt>Toggle comment</dt><dd>Ctrl / Cmd + / (editor)</dd></div></dl></>}
      {category==='environments'&&<><h2>Environments</h2><p>Manage local and workspace variables, secrets, and export formats in the right explorer.</p><button className="pp-settings-v17-link" onClick={onOpenEnvironments}><Variable size={17}/> Open Environments <ArrowRight size={15}/></button></>}
      {category==='exchange'&&<><h2>Import / Export</h2><p>Import requests from Postman, OpenAPI, Insomnia, Hoppscotch or cURL. Export collections and environments from their action menus.</p><button className="pp-settings-v17-link" onClick={onOpenImportExport}><FileUp size={17}/> Open Import / Export <ArrowRight size={15}/></button></>}
      {category==='privacy'&&<><h2>Privacy & proxy</h2><p>Current request execution safeguards.</p><div className="pp-settings-privacy"><ShieldCheck size={20}/><div><strong>Interceptor isolation</strong><p>The Secure Proxy blocks private targets. Browser Extension requests only approved destinations via your own network/VPN. Credentials are not saved in the extension; redirects are disabled.</p></div></div></>}
      {category==='about'&&<><h2>About Pakpost</h2><p>Pakpost is an API workbench with local guest drafts and signed-in workspaces.</p><div className="pp-settings-privacy"><Info size={20}/><div><strong>Pakpost Workbench</strong><p>React/Vite with Bun, isolated QuickJS scripting and selectable HTTP interceptors.</p></div></div></>}
    </section></div>
  </div>;
}
