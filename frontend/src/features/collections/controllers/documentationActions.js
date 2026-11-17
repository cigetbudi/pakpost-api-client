// Feature controller. Actions execute with the current Workbench context supplied
// by App; no global state, persistence middleware or extra network requests.
export function createDocumentationActions(dependencies) {
  const {
    activeTabRef, adoptSavedRevision, api, applyLocalAction, canEditCloud, decodeStoredHeaders, documentationTarget,
    draftsRef, encodeStoredHeaders, getMessage, localCollections, openTabs, sandboxDocKey, savedRequests,
    selectedCol, selectedWs, sessionDocumentationOverlays, setDocBusy, setDocumentation, setDocumentationTarget, setLocalCollections,
    setNotice, setSavedRequests, setWorkspaceCollectionDocs, setWorkspaceRequestLists, token, workspaceCollectionDocs, workspaceCollectionKey,
    workspaceDocKey, workspaceRequestLists,
  } = dependencies;
  function openDocumentation(target){
    let initial='';
    if(target.scope==='local'){
      const collection=localCollections.find(c=>c.id===target.collectionId);
      if(target.type==='collection')initial=collection?.documentation||'';
      if(target.type==='folder')initial=collection?.folderDocs?.[JSON.stringify(target.folderPath||[])]||'';
      if(target.type==='request')initial=collection?.requests?.find(r=>r.id===target.requestId)?.documentation||'';
    }else if(target.type==='collection'){
      initial=workspaceCollectionDocs[workspaceDocKey(selectedWs,target.collectionId)]||'';
    }else{
      const request=(workspaceRequestLists[workspaceCollectionKey(selectedWs,target.collectionId)]||savedRequests).find(r=>r.id===target.requestId);
      initial=decodeStoredHeaders(request?.headersJson).documentation||'';
    }
    const docTarget={...target,workspaceId:selectedWs};
    const temporary=sessionDocumentationOverlays.current.get(sandboxDocKey(docTarget));
    setDocumentationTarget({...docTarget,initial:temporary??initial});
  }
  async function saveDocumentation(text){
    if(!documentationTarget)return;
    const target=documentationTarget;const value=String(text||'').slice(0,16000);
    if(target.scope==='workspace'&&!canEditCloud){
      // QA / Technical Writer can prepare Markdown notes in RAM only.
      // Do not send request documentation edits to Neon or persist to localStorage.
      sessionDocumentationOverlays.current.set(sandboxDocKey(target),value);
      if(target.type==='request')for(const tab of openTabs){
        if(tab.source?.scope==='workspace'&&tab.source?.workspaceId===target.workspaceId&&
           tab.source.collectionId===target.collectionId&&tab.source.requestId===target.requestId){
          if(draftsRef.current[tab.id])draftsRef.current[tab.id]={...draftsRef.current[tab.id],documentation:value};
          if(tab.id===activeTabRef.current)setDocumentation(value);
        }
      }
      setDocumentationTarget(null);
      setNotice('Documentation drafted in this sandbox only. Cloud remains unchanged.');
      return;
    }
    setDocBusy(true);
    try{
      if(target.scope==='local'){
        setLocalCollections(old=>applyLocalAction(old,{type:'saveDocumentation',collectionId:target.collectionId,requestId:target.requestId,folderPath:target.folderPath,documentation:value}));
      }else if(target.type==='collection'){
        // Current Neon collection DTO has no description property. Persist browser-locally.
        setWorkspaceCollectionDocs(old=>({...old,[workspaceDocKey(target.workspaceId,target.collectionId)]:value}));
      }else{
        const base=`/api/workspaces/${target.workspaceId}/collections/${target.collectionId}/requests`;
        const requests=await api(base,'GET',undefined,token);
        const request=requests.find(r=>r.id===target.requestId);
        if(!request)throw Error('Saved request was not found');
        const meta=decodeStoredHeaders(request.headersJson);
        const saved=await api(`${base}/${target.requestId}`,'PUT',{
          ...request,headersJson:encodeStoredHeaders(meta.headers,meta.params,value,meta.responseExamples,meta.auth)
        },token);
        adoptSavedRevision(saved);
        setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(target.workspaceId,target.collectionId)]:requests.map(r=>r.id===saved.id?saved:r)}));
        if(selectedCol===target.collectionId)setSavedRequests(requests.map(r=>r.id===saved.id?saved:r));
      }
      if(target.type==='request'){
        // Keep open tab's draft metadata in sync so later Save doesn't erase docs.
        for(const tab of openTabs){if(tab.source?.scope===target.scope&&tab.source?.collectionId===target.collectionId&&tab.source?.requestId===target.requestId){
          if(draftsRef.current[tab.id])draftsRef.current[tab.id]={...draftsRef.current[tab.id],documentation:value};
          if(tab.id===activeTabRef.current)setDocumentation(value);
        }}
      }
      setDocumentationTarget(null);setNotice('Documentation saved');
    }catch(e){setNotice(`Cannot save documentation: ${getMessage(e)}`)}finally{setDocBusy(false)}
  }
  return { openDocumentation, saveDocumentation };
}
