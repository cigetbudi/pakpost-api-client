import { useEffect } from 'react';
import { CLOUD_SERVER_PAGING_THRESHOLD } from '../services/cloudRenderBudget.js';
import { isWorkspaceCollectionOpen } from '../services/collectionExpansion.js';

/**
 * Read-only Cloud hydration and expanded-tree pagination. Epoch counters
 * remain owned by Workbench so changing workspace or logging out invalidates
 * outstanding requests. Never merge rows fetched under an old workspace.
 */
export function useCloudCollectionLifecycle({
  STORAGE_WORKSPACE, api, collections, collectionsScope, expandedCollections,
  explorerTab, getMessage, membersWorkspaceId, saveWs, selectedCol, selectedWs,
  setCollections, setEditingMemberId, setEditingMemberRoles, setExpandedMemberAccess,
  setInvitationError, setInvitationRows, setInviteEmail, setInviteOpen, setInviteRoles,
  setMemberRoleFilter, setMemberSearch, setMembers, setMembersWorkspaceId,
  setNewMemberRoles, setNotice, setSaveCollection, setSaveCols, setSavedRequests,
  setSelectedCol, setShowMemberAdd, setWorkspaceRequestLists, token,
  workspaceCollectionKey, workspaceFetchEpoch, workspaceRequestLists,
  workspaceRequestsPending, membersLoadVersion,
}) {
  // Role editor state is scoped to the selected Workspace.
  useEffect(()=>{setEditingMemberId('');setEditingMemberRoles([]);setNewMemberRoles(['Developer']);setInviteOpen(false);setInviteEmail('');setInviteRoles(['Developer']);setInvitationRows([]);setInvitationError('');setMemberSearch('');setMemberRoleFilter('all');setShowMemberAdd(false);setExpandedMemberAccess('');},[selectedWs]);
  useEffect(() => {
    if (!token || !selectedWs) { setCollections([]); setMembers([]); setMembersWorkspaceId(''); return; }
    let cancelled=false;
    const epoch=workspaceFetchEpoch.current;
    const memberVersion=membersLoadVersion?.current;
    // Show no stale metadata while another workspace is loading.
    setCollections([]);setMembers([]);setMembersWorkspaceId('');
    Promise.all([
      api(`/api/workspaces/${selectedWs}/collections`, 'GET', undefined, token),
      api(`/api/workspaces/${selectedWs}/members`, 'GET', undefined, token),
    ]).then(([cols, mems]) => {
      if(cancelled||epoch!==workspaceFetchEpoch.current)return;
      setCollections(cols);
      if(membersLoadVersion?.current===memberVersion){setMembers(mems);setMembersWorkspaceId(selectedWs);}
      setSelectedCol(current => cols.some(x => x.id === current) ? current : cols[0]?.id || '');
    }).catch(e => {if(!cancelled&&epoch===workspaceFetchEpoch.current)setNotice(getMessage(e));});
    return()=>{cancelled=true;};
  }, [selectedWs, token]);
  useEffect(() => {
    if (!token || !selectedWs || !selectedCol) { setSavedRequests([]); return; }
    let cancelled=false;
    const key=workspaceCollectionKey(selectedWs,selectedCol);
    const epoch=workspaceFetchEpoch.current;
    // Large Collection indices are paged by CloudFolderTree instead of being
    // preloaded in full. Keep full list API for export and Collection Runner.
    if(!collections.some(col=>col.id===selectedCol)){setSavedRequests([]);return;}
    if(Number(collections.find(col=>col.id===selectedCol)?.requestCount)>CLOUD_SERVER_PAGING_THRESHOLD){
      setSavedRequests([]);return;
    }
    setSavedRequests(workspaceRequestLists[key]||[]);
    api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests/index`, 'GET', undefined, token)
      .then(items=>{if(cancelled||epoch!==workspaceFetchEpoch.current)return;setSavedRequests(items);setWorkspaceRequestLists(old=>({...old,[key]:items}));})
      .catch(e=>{if(!cancelled&&epoch===workspaceFetchEpoch.current)setNotice(getMessage(e));});
    return ()=>{cancelled=true;};
  }, [selectedWs, selectedCol, token, collections]);
  // Fetch children for *every* expanded Neon collection, not only the selected one.
  // Fetch at most four new lists per render to avoid flooding the backend on Expand all.
  useEffect(()=>{
    if(!token||!selectedWs||explorerTab!=='collections'||collectionsScope!==STORAGE_WORKSPACE)return;
    const next=collections.filter(col=>col.id!==selectedCol
      && Number(col.requestCount)<=CLOUD_SERVER_PAGING_THRESHOLD
      && isWorkspaceCollectionOpen(expandedCollections,selectedWs,col.id,selectedCol)
      && !Object.prototype.hasOwnProperty.call(workspaceRequestLists,workspaceCollectionKey(selectedWs,col.id))
      && !workspaceRequestsPending.current.has(workspaceCollectionKey(selectedWs,col.id))).slice(0,4);
    for(const col of next){
      const key=workspaceCollectionKey(selectedWs,col.id);
      workspaceRequestsPending.current.add(key);
      const epoch=workspaceFetchEpoch.current;
      api(`/api/workspaces/${selectedWs}/collections/${col.id}/requests/index`,'GET',undefined,token)
        .then(items=>{if(epoch===workspaceFetchEpoch.current)setWorkspaceRequestLists(old=>({...old,[key]:items}));})
        .catch(e=>{if(epoch!==workspaceFetchEpoch.current)return;setNotice(`Cannot load ${col.name}: ${getMessage(e)}`);setWorkspaceRequestLists(old=>({...old,[key]:[]}));})
        .finally(()=>workspaceRequestsPending.current.delete(key));
    }
  },[token,selectedWs,selectedCol,collections,explorerTab,collectionsScope,expandedCollections,workspaceRequestLists]);
  useEffect(() => {
    if (!token || !saveWs) { setSaveCols([]); return; }
    api(`/api/workspaces/${saveWs}/collections`, 'GET', undefined, token)
      .then(cols => { setSaveCols(cols); setSaveCollection(c => cols.some(x => x.id === c) ? c : cols[0]?.id || ''); })
      .catch(e => setNotice(getMessage(e)));
  }, [saveWs, token]);
}
