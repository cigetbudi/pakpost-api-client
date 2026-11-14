import React,{useState} from 'react';
import {Code2,Keyboard,LayoutPanelTop,Palette,ShieldCheck} from 'lucide-react';
import {AppearanceSidebar} from './AppearanceSidebar';

/** App-level settings use the full canvas, leaving the request drafts intact. */
export function WorkbenchSettings({theme,onThemeChange,split,onSplitChange,onBack}){
  const [category,setCategory]=useState('appearance');
  const categories=[['appearance','Appearance',Palette],['layout','Request layout',LayoutPanelTop],['shortcuts','Keyboard shortcuts',Keyboard],['privacy','Privacy & proxy',ShieldCheck]];
  return <div className="pp-settings-screen">
    <header className="pp-settings-heading"><div><span>PAKPOST / PREFERENCES</span><h1>Settings</h1><p>Personalize your workbench. Preferences are stored in this browser.</p></div><button onClick={onBack}>Return to REST</button></header>
    <div className="pp-settings-inner"><nav aria-label="Settings categories" className="pp-settings-categories">{categories.map(([id,name,Icon])=><button key={id} className={category===id?'selected':''} onClick={()=>setCategory(id)}><Icon size={16}/>{name}</button>)}</nav>
      <section className="pp-settings-details">
        {category==='appearance'&&<><h2>Appearance</h2><p>Choose a consistent theme for editors and controls.</p><AppearanceSidebar value={theme} onChange={onThemeChange}/></>}
        {category==='layout'&&<><h2>Request layout</h2><p>Choose how request and response share the workbench.</p><div className="pp-settings-layouts"><button className={split==='horizontal'?'chosen':''} onClick={()=>onSplitChange('horizontal')}><LayoutPanelTop size={22}/>Stacked <small>Request above response</small></button><button className={split==='vertical'?'chosen':''} onClick={()=>onSplitChange('vertical')}><Code2 size={22}/>Side by side<small>Request left of response</small></button></div></>}
        {category==='shortcuts'&&<><h2>Keyboard shortcuts</h2><p>Available while working in REST.</p><dl className="pp-settings-shortcuts"><div><dt>Send request</dt><dd>Ctrl / Cmd + Enter</dd></div><div><dt>Save request</dt><dd>Ctrl / Cmd + S</dd></div><div><dt>Quick search</dt><dd>Ctrl / Cmd + K</dd></div><div><dt>Toggle comment</dt><dd>Ctrl / Cmd + / (editor)</dd></div></dl></>}
        {category==='privacy'&&<><h2>Privacy & proxy</h2><p>Current request execution safeguards.</p><div className="pp-settings-privacy"><ShieldCheck size={20}/><div><strong>Public proxy protected</strong><p>Guest requests are allowed, while private addresses are blocked by the backend proxy. Secret environment variables should not be pasted into public requests.</p></div></div></>}
      </section>
    </div>
  </div>;
}
