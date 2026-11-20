import {hydrateOpenCloudDetails} from '../services/workspaceSync.js';
import {scheduleWorkspaceBatch} from '../services/workspaceBatch.js';
import {CLOUD_SERVER_PAGING_THRESHOLD} from '../../collections/services/cloudRenderBudget.js';

// Realtime workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createRealtimeActions(dependencies) {
  const {
    activeTabRef,
    api,
    currentTokenRef,
    collections,
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

  async function reconcileCloudRequests(workspaceId,collectionId,items,{onlyRequestId=null}={}){
      const auth = currentTokenRef.current;
      const isCurrent = () => auth === currentTokenRef.current
        && workspaceId === selectedWorkspaceRef.current;
      const scopedTabs=onlyRequestId?openTabsRef.current.filter(tab=>tab.source?.requestId===onlyRequestId):openTabsRef.current;
      const ready = await hydrateOpenCloudDetails({workspaceId,collectionId,requests:items,
        tabs:scopedTabs,
        readDraft:id=>id===activeTabRef.current?snapshotRef.current():draftsRef.current[id],
        fetchDetail:id=>api(`/api/workspaces/${workspaceId}/collections/${collectionId}/requests/${id}`,'GET',undefined,auth),
        isCurrent});
      if (!ready || !isCurrent()) return;
      reconcileRequestTabs({workspaceId,collectionId,requests:ready,tabs:scopedTabs,
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
        isSelectedCollection:id=>id===selectedColRef.current,
        isPagedCollection:id=>Number(collections.find(item=>item.id===id)?.requestCount)>CLOUD_SERVER_PAGING_THRESHOLD,
      });
    }

  function enqueueWorkspaceChange(event){
      realtimeQueueRef.current.push(event);
      scheduleWorkspaceBatch(realtimeQueueRef, realtimeTimerRef, realtimeHandlerRef);
    }
  return { adoptSavedRevision, reconcileCloudRequests, refreshRealtimeChanges, enqueueWorkspaceChange };
}
