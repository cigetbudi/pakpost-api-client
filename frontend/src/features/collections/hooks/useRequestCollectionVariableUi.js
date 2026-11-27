import {useEffect,useState} from 'react';
import {collectionVariableKey,readCollectionVariables,savedCollectionVariableMap,writeCollectionVariables,validateCollectionVariableRows} from '../services/collectionVariableSession.js';
import {mergeRequestVariableUi} from '../services/requestCollectionVariableUi.js';

/** Load only the active collection. Collection defaults and session overlays
 * stay in RAM for Cloud; never change the selected Environment. */
export function useRequestCollectionVariableUi({source,localCollections,collections,token,userId,selectedWs,membershipRevision,
  api,savedCollectionVariablesCache,sessionCollectionVariables,refreshSessionEnvironment,environmentUi,varsFromEnv,isSensitiveVariable,setNotice}) {
  const scope=source?.scope,collectionId=source?.collectionId,workspaceId=source?.workspaceId;
  const cloud=scope==='workspace'&&!!token&&!!userId&&workspaceId===selectedWs&&!!collectionId;
  const local=scope==='local'&&localCollections.find(item=>item.id===collectionId);
  const cloudCollection=cloud&&collections.find(item=>item.id===collectionId);
  const key=collectionVariableKey(source,'',userId||'guest');
  const [loaded,setLoaded]=useState(null);
  useEffect(()=>{
    if(!cloud)return;
    let cancelled=false;
    // Do not reuse a cached payload after a membership/token change.
    savedCollectionVariablesCache.current.delete(key);
    api(`/api/workspaces/${workspaceId}/collections/${collectionId}/variables`,'GET',undefined,token)
      .then(data=>{
        if(cancelled)return;
        savedCollectionVariablesCache.current.set(key,{data,at:Date.now()});
        if(savedCollectionVariablesCache.current.size>50)savedCollectionVariablesCache.current.delete(savedCollectionVariablesCache.current.keys().next().value);
        setLoaded({key,token,membershipRevision});
      }).catch(()=>{if(!cancelled)setLoaded(null);});
    return()=>{cancelled=true;};
  },[cloud,key,token,membershipRevision,workspaceId,collectionId,api,savedCollectionVariablesCache]);
  const cloudReady=cloud&&loaded?.key===key&&loaded.token===token&&loaded.membershipRevision===membershipRevision;
  const cloudData=cloudReady?savedCollectionVariablesCache.current.get(key)?.data:null;
  const rows=local?local.variables||[]:cloudData?.variables||[];
  const available=!!local||!!cloudData;
  const values=available?readCollectionVariables(sessionCollectionVariables.current,key,savedCollectionVariableMap(rows)):{};
  const name=local?.name||(cloud?(cloudCollection?.name||'Collection'):'');
  function editCollection(variable,value){
    if(!available)throw Error('Collection variables have not loaded. Open Collection Variables to retry.');
    const next={...values,[variable]:String(value)};
    validateCollectionVariableRows(Object.entries(next).map(([key,value])=>({key,value})));
    writeCollectionVariables(sessionCollectionVariables.current,key,next);
    refreshSessionEnvironment(v=>v+1);
    setNotice('Collection variable changed for this session only. Saved defaults are unchanged.');
  }
  return mergeRequestVariableUi({environmentUi,varsFromEnv,collectionRows:rows,collectionValues:values,
    collectionName:name,editCollection,isSensitiveVariable});
}
