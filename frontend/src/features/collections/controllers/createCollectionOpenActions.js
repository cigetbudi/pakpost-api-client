// Open Local/Cloud saved requests and response examples in existing editor tabs.
export function createCollectionOpenActions(dependencies) {
  const {
    activeTabRef, addTab, draftsRef, exampleToResult, findBoundTab,
    openTabs, restoreDraft, selectTab, selectedWs, setActiveTabId,
    setOpenTabs, setPage, setResTab, setResult, snapshot, workspaceDraft,
  } = dependencies;

  function openBoundRequest(request,source){
      const current=findBoundTab(openTabs,source);
      if(current){selectTab(current.id);return;}
      addTab(request,source);
    }
  function openLocalRequest(request,collectionId){
      openBoundRequest({...request,name:request.requestName||request.name},
        {scope:'local',collectionId,requestId:request.id});
    }
  function previewSavedExample(request,source,example){
      const resultExample=exampleToResult(example);
      const current=findBoundTab(openTabs,source);
      if(current){
        const stored=current.id===activeTabRef.current?snapshot():draftsRef.current[current.id];
        const next={...stored,result:resultExample,resTab:'body'};
        draftsRef.current[current.id]=next;
        activeTabRef.current=current.id;setActiveTabId(current.id);restoreDraft(next);setPage('tester');
        setOpenTabs(tabs=>tabs.map(tab=>tab.id===current.id?{...tab,status:resultExample.statusCode}:tab));
        return;
      }
      addTab(request,source);
      draftsRef.current[activeTabRef.current]={...draftsRef.current[activeTabRef.current],result:resultExample,resTab:'body'};
      setResult(resultExample);setResTab('body');
      const newTabId=activeTabRef.current;
      setOpenTabs(tabs=>tabs.map(tab=>tab.id===newTabId?{...tab,status:resultExample.statusCode}:tab));
    }
  function openLocalExample(request,collectionId,example){
      previewSavedExample({...request,name:request.requestName||request.name},{scope:'local',collectionId,requestId:request.id},example);
    }
  function openWorkspaceExample(request,collectionId,example){
      const draft=workspaceDraft({...request,collectionId});
      previewSavedExample({...draft,name:request.name||draft.name},{scope:'workspace',workspaceId:selectedWs,collectionId,requestId:request.id,revision:request.revision},example);
    }

  return { openBoundRequest, openLocalRequest, previewSavedExample, openLocalExample, openWorkspaceExample };
}
