/** Conflict merge and reload never overwrite the Cloud resource without an explicit Save. */
export function createRequestConflictActions(dependencies) {
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

  async function showConflictDialog(tabId){
      const tab=openTabsRef.current.find(t=>t.id===tabId);
      if(!tab?.source?.requestId)return;
      if(activeTabRef.current!==tabId)selectTab(tabId);
      const source=tab.source;
      setConflictDialog({tabId,source,loading:true,latest:null,base:null,error:''});
      try{
        const rows=await api(`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests`,'GET',undefined,currentTokenRef.current);
        if(source.workspaceId!==selectedWorkspaceRef.current)return;
        const latest=rows.find(x=>x.id===source.requestId)||null;
        let base=null;
        if(source.revision>0){
          try{
            const detail=await api(`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests/${source.requestId}/history/${source.revision}`,'GET',undefined,currentTokenRef.current);
            base=detail.request;
          }catch{/* Older revisions may have expired or predate V8.5. Manual selection remains safe. */}
        }
        if(currentTokenRef.current!==token||source.workspaceId!==selectedWorkspaceRef.current)return;
        setConflictDialog({tabId,source,loading:false,latest,base,error:''});
      }catch(e){setConflictDialog({tabId,source,loading:false,latest:null,error:getMessage(e)});}
    }

  function reloadCloudConflict(){
      const dialog=conflictDialog;
      if(!dialog?.latest)return;
      const tab=openTabsRef.current.find(t=>t.id===dialog.tabId);
      if(!tab)return;
      const latest=dialog.latest;
      const updated={...freshRequest(latest.name),...workspaceDraft(latest),result:null,scriptLog:[],scriptTests:[],scriptError:'',scriptDiagnostic:null};
      draftsRef.current[tab.id]=updated;
      setOpenTabs(tabs=>tabs.map(t=>t.id===tab.id?tabSaved(t,{...dialog.source,revision:latest.revision},updated,latest.name):t));
      if(activeTabRef.current===tab.id)restoreDraft(updated);
      setRemoteAlerts(old=>{const next={...old};delete next[tab.id];return next;});
      setConflictDialog(null);setNotice('Reloaded latest Cloud version. Local unsaved changes were discarded.');
    }

  function saveConflictCopy(){
      const dialog=conflictDialog;
      if(!dialog)return;
      if(activeTabRef.current!==dialog.tabId)selectTab(dialog.tabId);
      setConflictDialog(null);
      // Open the existing Save As flow, explicitly targeting Local.
      openSaveAs({scope:'local',collectionId:localCollections[0]?.id||''});
      setNotice('Save your draft as a Local copy. The Cloud version will not be overwritten.');
    }

  function applyMergedRevision(tabId,remote,chosen,{resolveConflict=false}={}){
      const tab=openTabsRef.current.find(t=>t.id===tabId);
      if(!tab||!remote)return;
      const original=tabId===activeTabRef.current?snapshotRef.current():draftsRef.current[tabId];
      if(!original)return;
      const merged=applyFieldMerge({...original,name:tab.name},workspaceDraft(remote),chosen);
      const {name,...draft}=merged;
      draftsRef.current[tabId]=draft;
      setOpenTabs(tabs=>tabs.map(t=>t.id!==tabId?t:{...t,name:name||t.name,
        source:resolveConflict?{...t.source,revision:remote.revision}:t.source}));
      if(tabId===activeTabRef.current){restoreDraft(draft);setCurrentRequestName(name||tab.name);}
      if(resolveConflict){
        setRemoteAlerts(old=>{const next={...old};delete next[tabId];return next;});
        setConflictDialog(null);
      }
      setNotice(resolveConflict?'Merge applied to draft. Review and press Save; Cloud was NOT changed.':'Selected revision fields applied to your unsaved draft.');
    }

  return {showConflictDialog,reloadCloudConflict,saveConflictCopy,applyMergedRevision};
}
