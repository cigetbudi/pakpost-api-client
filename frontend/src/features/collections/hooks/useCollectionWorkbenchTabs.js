import {useEffect,useRef,useState} from 'react';
import {collectionTabId,openCollectionTab} from '../services/collectionWorkbenchTabs.js';

/** Memory-only collection drafts. Scope transitions discard private tab state. */
export function useCollectionWorkbenchTabs(scopeKey) {
  const [state,setState]=useState(()=>({scopeKey,tabs:[],activeId:null}));
  const scopeRef=useRef(scopeKey);scopeRef.current=scopeKey;
  const current=state.scopeKey===scopeKey?state:{scopeKey,tabs:[],activeId:null};
  useEffect(()=>{setState(s=>s.scopeKey===scopeKey?s:{scopeKey,tabs:[],activeId:null});},[scopeKey]);
  const update=fn=>setState(s=>scopeRef.current!==scopeKey?s:fn(s.scopeKey===scopeKey?s:{scopeKey,tabs:[],activeId:null}));
  function open(target){
    const id=collectionTabId(target);
    update(s=>({...s,tabs:openCollectionTab(s.tabs,target),activeId:id}));
  }
  function activate(id){update(s=>({...s,activeId:s.tabs.some(t=>t.id===id)?id:null}));}
  function request(){update(s=>s.activeId===null?s:{...s,activeId:null});}
  function report(id,dirty,busy){update(s=>{
    const tab=s.tabs.find(t=>t.id===id);
    if(!tab||(tab.dirty===dirty&&tab.busy===busy))return s;
    return {...s,tabs:s.tabs.map(t=>t.id===id?{...t,dirty,busy}:t)};
  });}
  function close(id){
    const tab=current.tabs.find(t=>t.id===id);
    if(!tab||tab.busy)return;
    if(tab.dirty&&!window.confirm('Discard unsaved collection settings?'))return;
    update(s=>({...s,tabs:s.tabs.filter(t=>t.id!==id),activeId:s.activeId===id?null:s.activeId}));
  }
  return {tabs:current.tabs,activeId:current.activeId,open,activate,request,report,close,scopeKey,scopeRef};
}
