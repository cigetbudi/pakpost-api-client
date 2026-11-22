// Response-example storage and draft updates; shared with both Local and Cloud requests.
export function createResponseExampleSaveActions(dependencies) {
  const {
    activeTabRef, adoptSavedRevision, api, applyLocalAction, canEditCloud,
    createResponseExample, decodeStoredHeaders, doAction, documentation, draftsRef,
    encodeStoredHeaders, exampleDescription, exampleName, isReadOnlyCloudTab, openTabs,
    params, responseExamples, result, selectedCol, selectedWs,
    setExampleDescription, setExampleName, setLocalCollections, setNotice, setResponseExamples,
    setSaveExampleOpen, setSavedRequests, setWorkspaceRequestLists, snapshot, suggestExampleName,
    token, upsertResponseExample, workspaceCollectionKey, workspaces, activeSource,
  } = dependencies;

  function openSaveExampleDialog(){
    if(!result||result.error)return;
    setExampleName(suggestExampleName(result));
    setExampleDescription('');
    setSaveExampleOpen(true);
  }
  async function persistResponseExamples(nextExamples){
    const source=activeSource();
    if(source?.scope==='local'&&!source.pending){
      setLocalCollections(old=>applyLocalAction(old,{type:'saveExamples',collectionId:source.collectionId,requestId:source.requestId,responseExamples:nextExamples}));
    }
    if(source?.scope==='workspace'&&!source.pending&&!isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabRef.current),canEditCloud,selectedWs)){
      if(!token)throw Error('Sign in to update workspace examples');
      const base=`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests`;
      const latest=await api(base,'GET',undefined,token);
      const original=latest.find(request=>request.id===source.requestId);
      if(!original)throw Error('Saved request not found');
      const metadata=decodeStoredHeaders(original.headersJson);
      const saved=await api(`${base}/${source.requestId}`,'PUT',{
        ...original,headersJson:encodeStoredHeaders(metadata.headers,metadata.params,metadata.documentation,nextExamples,metadata.auth)
      },token);
      adoptSavedRevision(saved);
    const updated=latest.map(request=>request.id===saved.id?saved:request);
      setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(source.workspaceId,source.collectionId)]:updated}));
      if(source.workspaceId===selectedWs&&source.collectionId===selectedCol)setSavedRequests(updated);
    }
    const tabId=activeTabRef.current;
    draftsRef.current[tabId]={...snapshot(),responseExamples:nextExamples};
    setResponseExamples(nextExamples);
  }
  async function saveResponseExample(e){
    e?.preventDefault?.();
    if(!result||result.error)return;
    const name=(exampleName||'').trim()||suggestExampleName(result);
    const example=createResponseExample(result,{name,description:exampleDescription});
    const nextExamples=upsertResponseExample(responseExamples,example);
    const source=activeSource();
    const success=await doAction(async()=>{
      await persistResponseExamples(nextExamples);
      const sandbox=isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabRef.current),canEditCloud,selectedWs);
      setNotice(sandbox?`Example ${name} added to sandbox only. Cloud is unchanged.`:
        !source||source.pending?`Added ${name} to draft. Save the request to keep it in a collection.`:`Saved example ${name}`);
    });
    if(success)setSaveExampleOpen(false);
  }

  return { openSaveExampleDialog, persistResponseExamples, saveResponseExample };
}
