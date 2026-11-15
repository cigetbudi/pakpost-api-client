import React,{useState} from 'react';
import {ArrowRight,Code2,FileUp,Info,Keyboard,LayoutPanelTop,Palette,ShieldCheck,Variable} from 'lucide-react';
import {AppearanceSidebar} from './AppearanceSidebar';

/** Full-workspace preferences; no extra router or UI dependencies. */
export function WorkbenchSettings({theme,onThemeChange,split,onSplitChange,onBack,onOpenEnvironments,onOpenImportExport}){
  const [category,setCategory]=useState('appearance');
  const categories=[
    ['appearance','Appearance',Palette],['layout','Request layout',LayoutPanelTop],
    ['shortcuts','Keyboard shortcuts',Keyboard],['environments','Environments',Variable],
    ['exchange','Import / Export',FileUp],['privacy','Privacy & proxy',ShieldCheck],['about','About Pakpost',Info]
  ];
  return <div className="pp-settings-screen pp-settings-v17">
    <header className="pp-settings-heading"><div><span>PAKPOST / PREFERENCES</span><h1>Settings</h1><p>Configure your API workbench. Preferences are stored in this browser.</p></div><button onClick={onBack}><ArrowRight size={15}/> Return to REST</button></header>
    <div className="pp-settings-inner"><nav aria-label="Settings categories" className="pp-settings-categories">
      {categories.map(([id,name,Icon])=><button key={id} className={category===id?'selected':''} onClick={()=>setCategory(id)}><Icon size={17}/><span>{name}</span></button>)}
    </nav><section className="pp-settings-details">
      {category==='appearance'&&<><h2>Appearance</h2><p>Choose a theme for the entire workbench, including code editors.</p><AppearanceSidebar value={theme} onChange={onThemeChange}/></>}
      {category==='layout'&&<><h2>Request layout</h2><p>Choose how request and response share the available space.</p><div className="pp-settings-layouts"><button className={split==='horizontal'?'chosen':''} onClick={()=>onSplitChange('horizontal')}><LayoutPanelTop size={22}/>Stacked <small>Request above response</small></button><button className={split==='vertical'?'chosen':''} onClick={()=>onSplitChange('vertical')}><Code2 size={22}/>Side by side<small>Request left of response</small></button></div></>}
      {category==='shortcuts'&&<><h2>Keyboard shortcuts</h2><p>Available while working in REST.</p><dl className="pp-settings-shortcuts"><div><dt>Send request</dt><dd>Ctrl / Cmd + Enter</dd></div><div><dt>Save request</dt><dd>Ctrl / Cmd + S</dd></div><div><dt>Quick search</dt><dd>Ctrl / Cmd + K</dd></div><div><dt>Toggle comment</dt><dd>Ctrl / Cmd + / (editor)</dd></div></dl></>}
      {category==='environments'&&<><h2>Environments</h2><p>Manage local and workspace variables, secrets, and export formats in the right explorer.</p><button className="pp-settings-v17-link" onClick={onOpenEnvironments}><Variable size={17}/> Open Environments <ArrowRight size={15}/></button></>}
      {category==='exchange'&&<><h2>Import / Export</h2><p>Import requests from cURL or Postman. Export collections or environments from their action menus.</p><button className="pp-settings-v17-link" onClick={onOpenImportExport}><FileUp size={17}/> Open Import / Export <ArrowRight size={15}/></button></>}
      {category==='privacy'&&<><h2>Privacy & proxy</h2><p>Current request execution safeguards.</p><div className="pp-settings-privacy"><ShieldCheck size={20}/><div><strong>Public proxy protected</strong><p>Guest requests are allowed, while private addresses are blocked by the backend proxy. Do not paste credentials into requests sent to untrusted servers.</p></div></div></>}
      {category==='about'&&<><h2>About Pakpost</h2><p>Pakpost is an API workbench with local guest drafts and signed-in workspaces.</p><div className="pp-settings-privacy"><Info size={20}/><div><strong>Pakpost Workbench v17 UI</strong><p>Appearance, explorer, export formats, and branding update. The HTTP runner and scripting sandbox are unchanged.</p></div></div></>}
    </section></div>
  </div>;
}
