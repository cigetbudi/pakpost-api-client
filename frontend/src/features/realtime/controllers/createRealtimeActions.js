// Realtime workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createRealtimeActions(dependencies) {
  const {
    activeTabRef,
    currentTokenRef,
    draftsRef,
    expandedCollections,
    getWorkspaceCollections,
    getWorkspaceRequests,
    openTabsRef,
    realtimeHandlerRef,
    realtimeQueueRef,
    realtimeTimerRef,
    reconcileRequestTabs,
    restoreDraft,
    selectedColRef,
    selectedWorkspaceRef,
    setCollections,
    setOpenTabs,
    setRemoteAlerts,
    setSavedRequests,
    setSelectedCol,
    setWorkspaceRequestLists,
    snapshotRef,
    synchronizeWorkspaceChanges,
    workspaceDraft,
    workspaceRequestLists
  } = dependencies;

  function adoptSavedRevision(saved){
      if(!saved?.id || !Number.isInteger(saved.revision))return;
      setOpenTabs(tabs=>tabs.map(tab=>tab.source?.scope==='workspace' && tab.source.requestId===saved.id
        ? {...tab,source:{...tab.source,revision:saved.revision}}:tab));
    }

  function reconcileCloudRequests(workspaceId,collectionId,items){
      reconcileRequestTabs({workspaceId,collectionId,requests:items,tabs:openTabsRef.current,
        activeTabId:activeTabRef.current,
        readDraft:id=>id===activeTabRef.current?snapshotRef.current():draftsRef.current[id],
        transformRemote:workspaceDraft,
        markConflict:(id,value)=>setRemoteAlerts(old=>({...old,[id]:value})),
        updateDraft:(id,draft)=>{draftsRef.current[id]=draft},
        updateTab:(id,update)=>setOpenTabs(tabs=>tabs.map(tab=>tab.id===id?update(tab):tab)),
        clearConflict:id=>setRemoteAlerts(old=>{if(!old[id])return old;const next={...old};delete next[id];return next}),
        restoreActive:restoreDraft,
      });
    }

  async function refreshRealtimeChanges(events){
      const auth=currentTokenRef.current, workspaceId=selectedWorkspaceRef.current;
      return synchronizeWorkspaceChanges({events,token:auth,workspaceId,
        isCurrent:()=>auth===currentTokenRef.current&&workspaceId===selectedWorkspaceRef.current,
        tabs:openTabsRef.current,selectedCollectionId:selectedColRef.current,
        expandedCollections,requestLists:workspaceRequestLists,
        setCollections,setSelectedCollectionId:setSelectedCol,setRequestLists:setWorkspaceRequestLists,
        setSelectedRequests:setSavedRequests,
        markConflict:(id,value)=>setRemoteAlerts(old=>({...old,[id]:value})),
        reconcile:reconcileCloudRequests,
        fetchCollections:getWorkspaceCollections,
        fetchRequests:getWorkspaceRequests,
      });
    }

  function enqueueWorkspaceChange(event){
      realtimeQueueRef.current.push(event);
      if(realtimeTimerRef.current)return;
      realtimeTimerRef.current=setTimeout(()=>{
        realtimeTimerRef.current=null;
        const batch=realtimeQueueRef.current.splice(0,100);
        realtimeHandlerRef.current?.(batch);
      },180);
    }
  return { adoptSavedRevision, reconcileCloudRequests, refreshRealtimeChanges, enqueueWorkspaceChange };
}
