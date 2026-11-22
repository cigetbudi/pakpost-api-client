// Reset Cloud QA sandbox without altering the shared saved request.
export function createRequestSandboxActions(dependencies) {
  const {
    activeTabRef, api, body, canEditCloud, currentTokenRef,
    draftsRef, freshRequest, getMessage, isReadOnlyCloudTab, openTabs,
    resTab, result, sandboxDocKey, scriptError, scriptLog,
    scriptTests, selectedWs, sessionDocumentationOverlays, setNotice, setOpenTabs,
    tabSaved, token, workspaceDraft, restoreDraft,
  } = dependencies;

  async function resetSandboxRequest() {
      const tab=openTabs.find(t=>t.id===activeTabRef.current);
      if(!isReadOnlyCloudTab(tab,canEditCloud,selectedWs)||!tab?.source?.requestId)return;
      if(tab.source.workspaceId!==selectedWs){setNotice("Switch to the request's workspace before resetting its sandbox.");return;}
      const source=tab.source;
      const requestTabId=tab.id;
      const originalToken=token;
      const currentWorkspace=selectedWs;
      try {
        const path=`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests`;
        const requests=await api(path,'GET',undefined,originalToken);
        if(originalToken!==currentTokenRef.current||currentWorkspace!==selectedWs)throw Error('Workspace changed. Open the Cloud request again.');
        const saved=requests.find(r=>r.id===source.requestId);
        if(!saved)throw Error('Cloud request no longer exists.');
        const baseline={...freshRequest(saved.name),...workspaceDraft(saved),result:null,scriptLog:[],scriptTests:[],scriptError:'',resTab:'body'};
        draftsRef.current[requestTabId]=baseline;
        sessionDocumentationOverlays.current.delete(sandboxDocKey({...source,type:'request'}));
        setOpenTabs(tabs=>tabs.map(t=>t.id===requestTabId?{...tabSaved(t,{...source,revision:saved.revision},baseline,saved.name),status:undefined}:t));
        if(activeTabRef.current===requestTabId)restoreDraft(baseline);
        setNotice('Sandbox reset to the latest Cloud version. No shared data was changed.');
      }catch(error){setNotice(`Could not reset sandbox: ${getMessage(error)}`);}
    }

  return { resetSandboxRequest };
}
