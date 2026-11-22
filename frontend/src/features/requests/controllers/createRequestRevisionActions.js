/** Revision history and restoration; stale workspace responses are discarded. */
export function createRequestRevisionActions(dependencies) {
  const {
    activeTabRef,
    api,
    applyFieldMerge,
    canEditCloud,
    conflictDialog,
    currentTokenRef,
    draftsRef,
    freshRequest,
    getMessage,
    localCollections,
    openSaveAs,
    openTabsRef,
    reconcileCloudRequests,
    restoreDraft,
    rows,
    selectTab,
    selectedColRef,
    selectedWorkspaceRef,
    setConflictDialog,
    setCurrentRequestName,
    setNotice,
    setOpenTabs,
    setRemoteAlerts,
    setSavedRequests,
    setVersionDialog,
    setWorkspaceRequestLists,
    snapshotRef,
    tabSaved,
    token,
    versionDialog,
    workspaceCollectionKey,
    workspaceDraft
  } = dependencies;

  async function openRequestHistory(tabId=activeTabRef.current,sourceOverride=null){
      const tab=openTabsRef.current.find(t=>t.id===tabId);
      const source=sourceOverride||tab?.source;
      if(source?.scope!=='workspace'||source.pending||!source.requestId){setNotice('Version History is available for saved Cloud requests.');return;}
      if(source.workspaceId!==selectedWorkspaceRef.current){setNotice('Switch to the request Workspace first.');return;}
      if(tab&&tabId!==activeTabRef.current)selectTab(tabId);
      const path=`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests/${source.requestId}`;
      setVersionDialog({tabId,source,path,entries:[],selectedRevision:null,detail:null,latest:null,loading:true,busy:false,error:''});
      try{
        const [entries,requests]=await Promise.all([
          api(`${path}/history`,'GET',undefined,currentTokenRef.current),
          api(`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests`,'GET',undefined,currentTokenRef.current)]);
        if(source.workspaceId!==selectedWorkspaceRef.current)return;
        const latest=requests.find(req=>req.id===source.requestId);
        setVersionDialog(old=>old?.tabId===tabId?{...old,entries,latest,loading:false}:old);
        if(entries.length)await selectRequestHistoryRevision(tabId,path,entries[0].revision);
      }catch(err){setVersionDialog(old=>old?.tabId===tabId?{...old,error:getMessage(err),loading:false}:old);}
    }

  async function selectRequestHistoryRevision(tabId,path,revision){
      setVersionDialog(old=>old?.tabId===tabId?{...old,selectedRevision:revision,detail:null,loading:true,error:''}:old);
      try{
        const detail=await api(`${path}/history/${revision}`,'GET',undefined,currentTokenRef.current);
        setVersionDialog(old=>old?.tabId===tabId&&old.selectedRevision===revision?{...old,detail,loading:false}:old);
      }catch(err){setVersionDialog(old=>old?.tabId===tabId?{...old,error:getMessage(err),loading:false}:old);}
    }

  async function restoreRequestRevision(revision,expectedRevision){
      const dialog=versionDialog;
      if(!dialog||!canEditCloud||dialog.source.workspaceId!==selectedWorkspaceRef.current)return;
      setVersionDialog(old=>({...old,busy:true,error:''}));
      try{
        await api(`${dialog.path}/history/${revision}/restore`,'POST',{expectedRevision},currentTokenRef.current);
        setVersionDialog(null);
        setNotice(`Revision ${revision} restored as a NEW Cloud revision. Unsaved drafts were preserved.`);
        try{
          const updated=await api(`/api/workspaces/${dialog.source.workspaceId}/collections/${dialog.source.collectionId}/requests`,'GET',undefined,currentTokenRef.current);
          if(dialog.source.workspaceId!==selectedWorkspaceRef.current)return;
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(dialog.source.workspaceId,dialog.source.collectionId)]:updated}));
          if(selectedColRef.current===dialog.source.collectionId)setSavedRequests(updated);
          await reconcileCloudRequests(dialog.source.workspaceId,dialog.source.collectionId,updated);
        }catch{setNotice('Restore succeeded. Reload the Collection to see the latest revision.');}
      }catch(err){setVersionDialog(old=>old?{...old,busy:false,error:getMessage(err)}:old);}
    }
  return {openRequestHistory,selectRequestHistoryRevision,restoreRequestRevision};
}
