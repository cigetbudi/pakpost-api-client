import React from 'react';
import {useWorkbenchPreferences,updateWorkbenchPreferences} from '../services/useWorkbenchPreferences.js';
import {DEFAULT_WORKBENCH_PREFERENCES} from '../services/workbenchPreferences.js';
export function WorkbenchExperience(){
  const prefs=useWorkbenchPreferences();
  return <section className="pp-ux-preferences" aria-label="Workbench preferences">
    <h3>Workbench experience</h3><p>These preferences stay on this device.</p>
    <fieldset><legend>Interface density</legend><div className="pp-ux-density-options">{['adaptive','compact','comfortable'].map(density=><button type="button" key={density} aria-pressed={prefs.density===density} onClick={()=>updateWorkbenchPreferences({density})}>{density[0].toUpperCase()+density.slice(1)}</button>)}</div></fieldset>
    <label className="pp-ux-font-label"><span>Editor font size <strong>{prefs.editorFontSize}px</strong></span><input type="range" min="10" max="20" value={prefs.editorFontSize} onChange={e=>updateWorkbenchPreferences({editorFontSize:Number(e.target.value)})}/></label>
    <pre className="pp-ux-editor-preview" style={{fontSize:prefs.editorFontSize}}>{'{\n  "name": "PakPost",\n  "status": "ready"\n}'}</pre>
    {[['wordWrap','Wrap long editor lines'],['motion','Enable interface animations'],['autoExpandResponse','Automatically expand response when sending']].map(([key,label])=><label key={key} className="pp-ux-check"><input type="checkbox" checked={prefs[key]} onChange={e=>updateWorkbenchPreferences({[key]:e.target.checked})}/>{label}</label>)}
    <button type="button" className="pp-ux-secondary" onClick={()=>updateWorkbenchPreferences(DEFAULT_WORKBENCH_PREFERENCES)}>Reset preferences</button>
  </section>;
}
