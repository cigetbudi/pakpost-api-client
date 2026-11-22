// Response examples can be edited without replacing an unsaved parent draft.
// Both Local and Cloud updates preserve the source request's revision contract.
export function createCollectionExampleActions({
  activeTabRef, adoptSavedRevision, api, applyLocalAction, decodeStoredHeaders,
  draftsRef, encodeStoredHeaders, localCollections, openTabs, renameResponseExample,
  savedRequests, selectedCol, selectedWs, setLocalCollections, setResponseExamples,
  setSavedRequests, setWorkspaceRequestLists, snapshot, token,
  workspaceCollectionKey,
}) {
  function synchronizeSavedExamples(scope,workspaceId,collectionId,requestId,examples){
      // Editing an example must not discard unsaved edits to the parent request.
      for(const tab of openTabs){
        if(tab.source?.scope!==scope||tab.source.collectionId!==collectionId||tab.source.requestId!==requestId)continue;
        if(scope==='workspace'&&tab.source.workspaceId!==workspaceId)continue;
        const previous=tab.id===activeTabRef.current?snapshot():draftsRef.current[tab.id];
        if(previous)draftsRef.current[tab.id]={...previous,responseExamples:examples};
        if(tab.id===activeTabRef.current)setResponseExamples(examples);
      }
    }

  async function renameSavedExample(target,name){
      const {scope,collectionId,requestId,exampleId}=target;
      if(scope==='local'){
        const collection=localCollections.find(col=>col.id===collectionId);
        const request=collection?.requests.find(item=>item.id===requestId);
        if(!request)throw Error('Saved request not found');
        const examples=renameResponseExample(request.responseExamples,exampleId,name);
        // Dedicated action only touches saved response examples, not draft request fields.
        const next=applyLocalAction(localCollections,{type:'renameExample',collectionId,requestId,exampleId,name});
        setLocalCollections(next);
        synchronizeSavedExamples(scope,'',collectionId,requestId,examples);
        return;
      }
      if(!token)throw Error('Sign in to rename workspace examples');
      const workspaceId=selectedWs;
      const base=`/api/workspaces/${workspaceId}/collections/${collectionId}/requests`;
      const latest=await api(base,'GET',undefined,token);
      const request=latest.find(item=>item.id===requestId);
      if(!request)throw Error('Saved request not found');
      const metadata=decodeStoredHeaders(request.headersJson);
      const examples=renameResponseExample(metadata.responseExamples,exampleId,name);
      const saved=await api(`${base}/${requestId}`,'PUT',{
        ...request,headersJson:encodeStoredHeaders(metadata.headers,metadata.params,metadata.documentation,examples,metadata.auth)
      },token);
      adoptSavedRevision(saved);
      const updated=latest.map(item=>item.id===requestId?saved:item);
      setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(workspaceId,collectionId)]:updated}));
      if(selectedCol===collectionId)setSavedRequests(updated);
      synchronizeSavedExamples(scope,workspaceId,collectionId,requestId,examples);
    }  return { synchronizeSavedExamples, renameSavedExample };
}
