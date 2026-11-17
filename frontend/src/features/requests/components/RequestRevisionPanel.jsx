import React,{useEffect,useMemo,useState} from 'react';
import {compareRequestVersions,applyFieldMerge,safeVersionSummary} from '../services/requestVersionMerge.js';
import '../../../styles/features/request-version-history.css';

export default function RequestRevisionPanel({mode='history',localDraft={},remoteDraft=null,baseDraft=null,
  history=[],selectedRevision=null,onSelectRevision,onMerge,onRestore,onClose,
  canRestore=false,busy=false,error='',currentRevision=null}){
  const [selected,setSelected]=useState([]);
  const [restoreConfirmed,setRestoreConfirmed]=useState(false);
  const comparison=useMemo(()=>compareRequestVersions(localDraft,remoteDraft||{},baseDraft),[localDraft,remoteDraft,baseDraft]);
  const different=comparison.filter(field=>!field.same);
  useEffect(()=>{
    setSelected(comparison.filter(f=>f.suggestedCloud&&!f.same).map(f=>f.key));
    setRestoreConfirmed(false);
    // Changing the compared revision must never reuse a destructive selection.
  },[selectedRevision,remoteDraft?.revision,mode]);
  return <div className="pp-revision-panel">
    {mode==='history'&&<aside className="pp-revision-timeline" aria-label="Request revision history">
      <strong>Saved revisions</strong>
      {!history.length&&<p>No snapshot yet. Existing requests start keeping history on their next save.</p>}
      {history.map(entry=><button type="button" key={entry.revision} className={entry.revision===selectedRevision?'active':''}
        onClick={()=>onSelectRevision?.(entry.revision)}>
        <span>v{entry.revision} · {entry.action}</span>
        <small>{new Date(entry.createdAt).toLocaleString()} · {String(entry.actorId).slice(0,8)}</small>
      </button>)}
    </aside>}
    <section className="pp-revision-compare">
      <div className="pp-revision-compare-heading"><strong>{mode==='conflict'?'Your draft vs latest Cloud':`Your draft vs revision ${selectedRevision??'—'}`}</strong>
        <small>{different.length} different of {comparison.length} field groups</small></div>
      {error&&<p role="alert" className="pp-revision-error">{error}</p>}
      {!remoteDraft?<p className="pp-revision-empty">Select a revision to compare. Your unsaved draft is preserved.</p>:<>
        <p className="pp-revision-info">Choose <strong>Take version</strong> for the fields you want. All other fields stay as your draft. Nothing is saved automatically.</p>
        {baseDraft&&<p className="pp-revision-info">Three-way comparison uses your original saved revision. Fields changed on both sides are marked <strong>Conflict</strong>.</p>}
        <div className="pp-revision-field-list" role="group" aria-label="Fields for selective merge">
          <div className="pp-revision-field-header"><span>Take</span><span>Field</span><span>My draft</span><span>Other version</span></div>
          {comparison.map(field=><label key={field.key} className={'pp-revision-field '+(field.conflict?'conflict':'')}>
            <input type="checkbox" checked={selected.includes(field.key)} disabled={field.same||busy}
              onChange={e=>setSelected(old=>e.target.checked?[...old,field.key]:old.filter(x=>x!==field.key))}/>
            <span className="pp-revision-field-name">{field.label}<small>{field.same?'Matched':field.conflict?'Conflict — both changed':field.suggestedCloud?'Only Cloud changed':field.yourChange&&!field.cloudChange?'Only you changed':'Different'}</small></span>
            <span className="pp-revision-field-preview" title="Content redacted for safe comparison">{safeVersionSummary(field.key,localDraft[field.key])}</span>
            <span className="pp-revision-field-preview" title="Content redacted for safe comparison">{safeVersionSummary(field.key,remoteDraft[field.key])}</span>
          </label>)}
        </div>
        <div className="pp-revision-actions">
          <button type="button" disabled={busy||!selected.length} onClick={()=>onMerge?.(selected,applyFieldMerge(localDraft,remoteDraft,selected))}>Apply selected fields to draft</button>
        </div>
        {mode==='history'&&canRestore&&<div className="pp-revision-restore">
          <label><input type="checkbox" checked={restoreConfirmed} onChange={e=>setRestoreConfirmed(e.target.checked)} disabled={busy}/>
            I understand: restoring creates a NEW Cloud revision and affects everyone in this Workspace. My unsaved draft will not be silently discarded.</label>
          <button type="button" disabled={!restoreConfirmed||busy||!Number.isInteger(currentRevision)} onClick={()=>onRestore?.(selectedRevision,currentRevision)}>
            {busy?'Restoring…':`Restore revision ${selectedRevision}`}
          </button>
        </div>}
      </>}
      <div className="pp-revision-footer"><button type="button" onClick={onClose} disabled={busy}>Close</button></div>
    </section>
  </div>;
}
