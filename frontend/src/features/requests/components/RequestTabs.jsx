import React,{useLayoutEffect,useRef,useState} from 'react';
import { useStore } from 'zustand';
import { AlertTriangle, FolderClosed, History, Layers3, Plus, Pin, X } from 'lucide-react';
import { hasUnsavedMarker, freshRequest } from '../services/draftLifecycle';
import { activeTabScrollDelta } from '../services/tabActions';
import {mixedTabOrder,moveMixedTab} from '../../collections/services/collectionWorkbenchTabs.js';
import { STORAGE_WORKSPACE } from '../../import-export/services/storageScope';

export function RequestTabs({ store, page, remoteAlerts, snapshot, draftsRef,
  tabDragRef, selectTab, closeTab, showTabContext, setTabMenu, addTab,
  navigate, token, collectionsScope, realtimeStatus, openRequestHistory, collectionWorkbench, onActivateCollection }) {
  // Select individual store slices so only relevant tab mutations notify this UI.
  const openTabs = useStore(store, state => state.openTabs);
  const activeTabId = useStore(store, state => state.activeTabId);
  const setOpenTabs = useStore(store, state => state.setOpenTabs);
  const [dropTarget,setDropTarget]=useState(null);
  const [order,setOrder]=useState([]);
  const collectionTabs=collectionWorkbench?.tabs||[];
  const activeCollectionId=collectionWorkbench?.activeId;
  const ordered=mixedTabOrder(openTabs,collectionTabs,order);
  useLayoutEffect(()=>{if(order.length!==ordered.length||order.some((id,i)=>id!==ordered[i]))setOrder(ordered);},[order,ordered]);
  function dropTab(from,to,placement){
    const next=moveMixedTab(ordered,from,to,placement);
    setOrder(next);
    const positions=new Map(next.map((id,i)=>[id,i]));
    setOpenTabs(tabs=>[...tabs].sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity)));
  }
  const tabStripRef=useRef(null);
  // Scroll only the horizontal tab strip, never the workbench/page itself.
  useLayoutEffect(()=>{
    const strip=tabStripRef.current;
    if(!strip||page!=='tester')return;
    const active=strip.querySelector('[aria-selected="true"]');
    if(!active)return;
    const bounds=strip.getBoundingClientRect(),tab=active.getBoundingClientRect();
    const plus=strip.querySelector('.pp-new-tab');
    const plusBounds=active===plus?.previousElementSibling?plus.getBoundingClientRect():null;
    const delta=activeTabScrollDelta(bounds,tab,plusBounds);
    if(delta)strip.scrollLeft+=delta;
  },[activeTabId,activeCollectionId,openTabs.length,collectionTabs.length,page]);
  const position=e=>{
    const bounds=e.currentTarget.getBoundingClientRect();
    return e.clientX < bounds.left + bounds.width/2?'before':'after';
  };
  return (
        <div className="pp-tabs-bar">
          <div ref={tabStripRef} className="pp-open-tabs" role="tablist" aria-label="Open requests"
            onDragEnd={()=>setDropTarget(null)} onDrop={()=>setDropTarget(null)}>
            {ordered.map(id=>{
              const collection=collectionTabs.find(t=>t.id===id);
              if(collection)return <button type="button" role="tab" key={id} aria-selected={page==='tester'&&activeCollectionId===id}
                className={`pp-open-tab pp-collection-tab ${page==='tester'&&activeCollectionId===id?'current':''} ${dropTarget?.id===id?`pp-tab-drop-${dropTarget.placement}`:''}`}
                onClick={()=>onActivateCollection(id)} draggable
                onDragStart={e=>{tabDragRef.current=id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id);}}
                onDragOver={e=>{if(!tabDragRef.current||tabDragRef.current===id)return;e.preventDefault();e.dataTransfer.dropEffect='move';setDropTarget({id,placement:position(e)});}}
                onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget(null);}}
                onDrop={e=>{e.preventDefault();e.stopPropagation();if(tabDragRef.current)dropTab(tabDragRef.current,id,position(e));tabDragRef.current=null;setDropTarget(null);}}
                onDragEnd={()=>{tabDragRef.current=null;setDropTarget(null);}}>
                <FolderClosed size={14} className="pp-collection-tab-icon"/><span className="pp-tab-name">{collection.target.name}</span>
                {collection.dirty&&<span className="pp-unsaved-dot" title="Unsaved collection settings" aria-label="Unsaved changes"/>}
                <span className="pp-tab-x" title="Close collection tab" onClick={e=>{e.stopPropagation();collectionWorkbench.close(id);}}><X size={13}/></span>
              </button>;
              const t=openTabs.find(t=>t.id===id);if(!t)return null;
              return <button role="tab" aria-selected={page === 'tester' && !activeCollectionId && activeTabId === t.id} key={t.id} className={`pp-open-tab ${page === 'tester' && !activeCollectionId && activeTabId === t.id ? 'current' : ''} ${dropTarget?.id===t.id?`pp-tab-drop-${dropTarget.placement}`:''}`} onClick={() => selectTab(t.id)} draggable onDragStart={e=>{tabDragRef.current=t.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',t.id);}} onDragOver={e=>{if(!tabDragRef.current||tabDragRef.current===t.id)return;
              e.preventDefault();e.dataTransfer.dropEffect='move';setDropTarget({id:t.id,placement:position(e)});}}
              onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget(null);}}
              onDrop={e=>{e.preventDefault();e.stopPropagation();const from=tabDragRef.current;
                if(from&&from!==t.id)dropTab(from,t.id,position(e));
                tabDragRef.current=null;setDropTarget(null);}}
              onDragEnd={()=>{tabDragRef.current=null;setDropTarget(null);}} onContextMenu={e=>showTabContext(e,t.id)} onKeyDown={e=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();setTabMenu({id:t.id,x:Math.max(8,Math.min(rect.left,window.innerWidth-224)),y:Math.max(8,Math.min(rect.bottom,window.innerHeight-190))});}}}><span className={`pp-http-label ${t.method.toLowerCase()}`}>{t.method}</span>{t.pinned&&<Pin size={12} aria-label="Pinned tab"/>}<span className="pp-tab-name">{t.name}</span>{remoteAlerts[t.id]&&<AlertTriangle size={13} className="pp-conflict-conflict-icon" aria-label="Cloud changed elsewhere"/>}{hasUnsavedMarker(t,t.id===activeTabId?snapshot():draftsRef.current[t.id]) && <span className="pp-unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes"/>}{t.status && <span className={`pp-tab-status ${t.status >= 400 ? 'error' : ''}`}>{t.status}</span>}<span className="pp-tab-x" title="Close tab" onClick={e => { e.stopPropagation(); closeTab(t.id); }}><X size={13}/></span></button>;})}
            {page === 'workspace' && <button className="pp-open-tab current pp-manage-tab" onClick={() => navigate('workspace')}><Layers3 size={14}/> Workspace</button>}
            <button className="pp-new-tab" title="New request tab" onClick={() => addTab(freshRequest('Untitled Request'))}><Plus size={17}/></button>
          </div>
          <div className="pp-tabs-actions"><span><span className="pp-working-dot"/> {token&&collectionsScope===STORAGE_WORKSPACE?({'live':'Live','syncing':'Auto-sync ~5s','connecting':'Connecting…','reconnecting':'Reconnecting…','offline':'Offline'}[realtimeStatus]||'Offline'):token?'Local':'Guest'}</span><button className="pp-versions-action" aria-label="Request Version History" title="Request Version History" disabled={!!activeCollectionId||openTabs.find(t=>t.id===activeTabId)?.source?.scope!=='workspace'||openTabs.find(t=>t.id===activeTabId)?.source?.pending} onClick={()=>openRequestHistory(activeTabId)}><History size={15} aria-hidden="true"/><span>Versions</span></button></div>
        </div>
  );
}
