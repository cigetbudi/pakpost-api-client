import React,{useEffect,useRef,useState} from 'react';
import {createCollectionVariableActions} from '../controllers/collectionVariableActions.js';
import {collectionVariableKey,readCollectionVariables,resetCollectionVariables,validateCollectionVariableRows,writeCollectionVariables} from '../services/collectionVariableSession.js';
import CollectionVariablesEditor from './CollectionVariablesEditor.jsx';
import '../../../styles/features/collection-workbench-tabs.css';

export default function CollectionWorkbenchPanel({tab,active,context,onReport,onClose}) {
  const target=tab.target;
  const {api,canWorkspace,localCollections,me,refreshSessionEnvironment,savedCollectionVariablesCache,selfMember,sessionCollectionVariables,setLocalCollections,token,theme,scopeKey,scopeRef}=context;
  const [collectionVariablesTarget,setCollectionVariablesTarget]=useState(target);
  const [collectionVariablesData,setCollectionVariablesData]=useState(null);
  const [collectionVariablesLoading,setCollectionVariablesLoading]=useState(true);
  const [collectionVariablesError,setCollectionVariablesError]=useState('');
  const [collectionVariablesBusy,setCollectionVariablesBusy]=useState(false);
  const collectionVariablesFetchId=useRef(0);
  const mounted=useRef(false);
  const guardedApi=async(...args)=>{
    if(!mounted.current||scopeRef.current!==scopeKey)throw Error('Collection context changed');
    const response=await api(...args);
    if(!mounted.current||scopeRef.current!==scopeKey)throw Error('Collection context changed');
    return response;
  };
  const actions=createCollectionVariableActions({api:guardedApi,canWorkspace,collectionVariableKey,
    collectionVariablesData,collectionVariablesFetchId,collectionVariablesTarget,
    getMessage:error=>error?.message||String(error),localCollections,me,refreshSessionEnvironment,resetCollectionVariables,
    savedCollectionVariablesCache,selfMember,sessionCollectionVariables,setCollectionVariablesBusy,
    setCollectionVariablesData,setCollectionVariablesError,setCollectionVariablesLoading,setCollectionVariablesTarget,
    setLocalCollections,token,validateCollectionVariableRows,writeCollectionVariables});
  useEffect(()=>{
    mounted.current=true;
    void actions.openCollectionVariables(target);
    return()=>{mounted.current=false;collectionVariablesFetchId.current++;};
  },[tab.id]);
  const key=actions.collectionTargetKey(target);
  const current=sessionCollectionVariables.current.has(key)?readCollectionVariables(sessionCollectionVariables.current,key):null;
  return <section hidden={!active} className="pp-collection-workbench" aria-label={`Collection settings: ${target.name}`}>
    <CollectionVariablesEditor target={target} initial={collectionVariablesData} current={current}
      active={active} theme={theme==='light'?'light':'dark'}
      readOnly={target.scope==='workspace'&&(!canWorkspace(selfMember,'collection.write')||!!collectionVariablesError)}
      busy={collectionVariablesLoading||collectionVariablesBusy} loadError={collectionVariablesError}
      onReport={(dirty,busy)=>onReport(tab.id,dirty,busy)} onClose={()=>onClose(tab.id)}
      onSave={(rows,scripts)=>{if(target.scope==='local'&&!localCollections.some(c=>c.id===target.collectionId))throw Error('Local collection no longer exists');return actions.saveCollectionVariableDefaults(rows,scripts);}} onApplySession={actions.applyCollectionVariableSession}
      onReset={actions.resetCollectionVariableSession} onReload={actions.reloadCollectionVariables}/>
  </section>;
}
