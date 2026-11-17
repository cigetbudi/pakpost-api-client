import { useEffect } from 'react';
import { api } from '../../../services/httpClient.js';

/** Cloud fetches are workspace-scoped; stale responses must never leak across accounts. */
export function useEnvironmentDataLifecycle({envScope, storageWorkspace, token, selectedWs,
  cloudEnvironmentContext, cloudEnvironmentContextRef, localEnvironments,
  setWorkspaceEnvironmentResult, setNotice, setStorageScope, storageLocal, getMessage}) {
  useEffect(()=>{if(!token&&envScope===storageWorkspace)setStorageScope(storageLocal);},[token,envScope]);
  useEffect(()=>{
    const safe=localEnvironments.map(e=>({...e,variables:e.variables.map(v=>v.isSecret?{...v,value:''}:v)}));
    const secrets=Object.fromEntries(localEnvironments.map(e=>[e.id,Object.fromEntries(e.variables.filter(v=>v.isSecret).map(v=>[v.key,v.value]))]));
    localStorage.setItem('pakpost_guest_envs',JSON.stringify(safe));
    sessionStorage.setItem('pakpost_guest_secrets',JSON.stringify(secrets));
  },[localEnvironments]);
  useEffect(()=>{
    if(envScope!==storageWorkspace||!token||!selectedWs||!cloudEnvironmentContext){
      setWorkspaceEnvironmentResult({context:'',items:[]});return;
    }
    const context=cloudEnvironmentContext;
    let cancelled=false;
    setWorkspaceEnvironmentResult(previous=>previous.context===context?previous:{context,items:[]});
    api(`/api/workspaces/${selectedWs}/environments`,'GET',undefined,token)
      .then(items=>{if(!cancelled&&cloudEnvironmentContextRef.current===context)setWorkspaceEnvironmentResult({context,items});})
      .catch(e=>{if(!cancelled&&cloudEnvironmentContextRef.current===context)setNotice(`Environments API: ${getMessage(e)}`);});
    return()=>{cancelled=true;};
  },[envScope,token,selectedWs,cloudEnvironmentContext]);
}
