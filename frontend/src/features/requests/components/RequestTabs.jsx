import React from 'react';
import { useStore } from 'zustand';
import { AlertTriangle, History, Layers3, Play, Plus, Terminal, X } from 'lucide-react';
import { hasUnsavedMarker, freshRequest } from '../../draftLifecycle';
import { reorderTabs } from '../../tabActions';
import { STORAGE_WORKSPACE } from '../../storageScope';

export function RequestTabs({ store, page, remoteAlerts, snapshot, draftsRef,
  tabDragRef, selectTab, closeTab, showTabContext, setTabMenu, addTab,
  navigate, runnerLoading, openRunnerForCurrentCollection, consoleOpen,
  setConsoleOpen, token, collectionsScope, realtimeStatus, openRequestHistory }) {
  // Select individual store slices so only relevant tab mutations notify this UI.
  const openTabs = useStore(store, state => state.openTabs);
  const activeTabId = useStore(store, state => state.activeTabId);
  const setOpenTabs = useStore(store, state => state.setOpenTabs);
  return (
        <div className="pp-tabs-bar">
          <div className="pp-open-tabs" role="tablist" aria-label="Open requests">
            {openTabs.map(t => <button role="tab" aria-selected={page === 'tester' && activeTabId === t.id} key={t.id} className={`pp-open-tab ${page === 'tester' && activeTabId === t.id ? 'current' : ''}`} onClick={() => selectTab(t.id)} draggable onDragStart={e=>{tabDragRef.current=t.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',t.id);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=tabDragRef.current;if(from)setOpenTabs(ts=>reorderTabs(ts,from,t.id));tabDragRef.current=null;}} onDragEnd={()=>{tabDragRef.current=null;}} onContextMenu={e=>showTabContext(e,t.id)} onKeyDown={e=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();setTabMenu({id:t.id,x:Math.max(8,Math.min(rect.left,window.innerWidth-224)),y:Math.max(8,Math.min(rect.bottom,window.innerHeight-190))});}}}><span className={`pp-http-label ${t.method.toLowerCase()}`}>{t.method}</span><span className="pp-tab-name">{t.name}</span>{remoteAlerts[t.id]&&<AlertTriangle size={13} className="pp-v84-conflict-icon" aria-label="Cloud changed elsewhere"/>}{hasUnsavedMarker(t,t.id===activeTabId?snapshot():draftsRef.current[t.id]) && <span className="pp-unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes"/>}{t.status && <span className={`pp-tab-status ${t.status >= 400 ? 'error' : ''}`}>{t.status}</span>}<span className="pp-tab-x" title="Close tab" onClick={e => { e.stopPropagation(); closeTab(t.id); }}><X size={13}/></span></button>)}
            {page === 'workspace' && <button className="pp-open-tab current pp-manage-tab" onClick={() => navigate('workspace')}><Layers3 size={14}/> Workspace</button>}
            <button className="pp-new-tab" title="New request tab" onClick={() => addTab(freshRequest('Untitled Request'))}><Plus size={17}/></button>
          </div>
          <div className="pp-tabs-actions"><button type="button" className="pp-runner-toolbar" onClick={openRunnerForCurrentCollection} disabled={runnerLoading} title="Run saved requests from a Collection"><Play size={15}/> {runnerLoading?'Loading…':'Runner'}</button><button type="button" className={consoleOpen?'pp-console-toggle active':'pp-console-toggle'} title="Toggle PakPost Console" aria-label="Toggle PakPost Console" aria-expanded={consoleOpen} onClick={()=>setConsoleOpen(v=>!v)}><Terminal size={15}/> Console</button><span><span className="pp-working-dot"/> {token&&collectionsScope===STORAGE_WORKSPACE?({'live':'Live','connecting':'Connecting…','reconnecting':'Reconnecting…','offline':'Offline'}[realtimeStatus]||'Offline'):token?'Local':'Guest'}</span><button title="Request Version History" disabled={openTabs.find(t=>t.id===activeTabId)?.source?.scope!=='workspace'||openTabs.find(t=>t.id===activeTabId)?.source?.pending} onClick={()=>openRequestHistory(activeTabId)}><History size={16}/> Versions</button></div>
        </div>
  );
}
