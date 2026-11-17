import React from 'react';
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { APPEARANCE_THEMES } from '../services/appearance';

export function AppearanceSidebar({ value, onChange }) {
  return <div className="pp-appearance" aria-label="Appearance settings">
    <div className="pp-appearance-heading">
      <div className="pp-appearance-heading-icon"><Palette size={19}/></div>
      <div><strong>Appearance</strong><span>Choose your workspace theme</span></div>
    </div>
    <div className="pp-appearance-section-label">COLOR THEME</div>
    <div className="pp-appearance-options" role="radiogroup" aria-label="Color theme">
      {APPEARANCE_THEMES.map(t => <button key={t.id} type="button"
        role="radio" aria-checked={value===t.id}
        className={`pp-theme-option ${value===t.id ? 'active' : ''}`}
        onClick={()=>onChange(t.id)}>
        <span className="pp-theme-thumbnail" style={{background:t.swatches[0],borderColor:t.swatches[2]}} aria-hidden="true">
          <span className="pp-theme-thumb-rail" style={{background:t.swatches[1],borderColor:t.swatches[2]}}/>
          <span className="pp-theme-thumb-work" style={{background:t.swatches[1],borderColor:t.swatches[2]}}>
            <i style={{background:t.swatches[3]}}/><i style={{background:t.swatches[2]}}/><i style={{background:t.swatches[2]}}/>
          </span>
        </span>
        <span className="pp-theme-option-copy"><strong>{t.name}</strong><small>{t.description}</small></span>
        <span className="pp-theme-choice">{value===t.id ? <Check size={13}/> : t.mode==='light' ? <Sun size={13}/> : <Moon size={13}/>}</span>
      </button>)}
    </div>
    <div className="pp-appearance-note"><Monitor size={15}/><span>Applies instantly to the whole workbench and is remembered on this browser. This won't change request data or your active environment.</span></div>
  </div>;
}
