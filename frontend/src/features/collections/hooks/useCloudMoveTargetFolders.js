import {useEffect,useState} from 'react';
import {api} from '../../../services/httpClient.js';

/** Reads move destinations only while the cross-collection dialog is open. */
export function useCloudMoveTargetFolders({moveDialog,collectionId,workspaceId,token,onNotice}) {
  const [targetFolders,setTargetFolders]=useState([]);
  useEffect(()=>{
    if(!moveDialog||!token||moveDialog.targetCollectionId===collectionId){setTargetFolders([]);return;}
    let active=true;
    api(`/api/workspaces/${workspaceId}/collections/${moveDialog.targetCollectionId}/folders`,
      'GET',undefined,token).then(items=>{if(active)setTargetFolders(Array.isArray(items)?items:[]);})
      .catch(error=>{if(active)onNotice?.(error.message||'Cannot load destination folders');});
    return()=>{active=false;};
  },[moveDialog?.targetCollectionId,collectionId,workspaceId,token]);
  return targetFolders;
}
