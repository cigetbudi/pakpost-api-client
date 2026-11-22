import { createResponseExampleSaveActions } from './createResponseExampleSaveActions.js';
// Feature controller. Actions execute with the current Workbench context supplied
// by App; no global state, persistence middleware or extra network requests.
export function createRequestSaveActions(dependencies) {
  const {
    activeRequestName, activeTabRef, addTab, body, bodyFormat,
    canEditCloud, createLocalSavedRequest, createWorkspaceRequest, currentAuth, doAction,
    documentation, encodeStoredHeaders, formFields, format, getWorkspaceRequests,
    invalidateWorkspaceRequestLists, loadSavedRequest, localCollections, method, openTabs,
    params, postScript, preScript, remoteAlerts, responseExamples,
    rows, saveCollection, saveLocalCollection, saveName, saveScope,
    saveWs, selectedCol, selectedWs, setLocalCollections, setNotice,
    setOpenTabs, setRemoteAlerts, setSaveCollection, setSaveLocalCollection, setSaveName,
    setSaveOpen, setSaveScope, setSaveWs, setSavedRequests, setWorkspaceRequestLists,
    showConflictDialog, snapshot, tabSaved, token, updateLocalRequest,
    updateWorkspaceRequest, url, workspaceCollectionKey, workspaces,
  } = dependencies;
  function loadRequest(item) {
    if (Array.isArray(item.rows)) addTab({ ...item, name: item.name || 'From history' });
    else loadSavedRequest(item);
  }

  const activeSource=()=>openTabs.find(t=>t.id===activeTabRef.current)?.source;
  const currentSavePayload=(name,examples=responseExamples)=>({name,method,url,headersJson:encodeStoredHeaders(rows,params,documentation,examples,currentAuth()),body,
    bodyMode:bodyFormat(format).mode,contentType:format,
    formFieldsJson:JSON.stringify(formFields.map(({key,value,fileName,contentType})=>({key,value,fileName,contentType}))),
    preRequestScript:preScript,postResponseScript:postScript});
  function openSaveAs(destination=null){
    const origin=destination||activeSource();
    setSaveScope(origin?.scope==='workspace'&&!canEditCloud?'local':origin?.scope||'local');
    setSaveLocalCollection(origin?.scope==='local'?origin.collectionId:localCollections[0]?.id||'');
    setSaveWs(origin?.workspaceId||selectedWs||workspaces[0]?.id||'');
    setSaveCollection(origin?.scope==='workspace'?origin.collectionId:selectedCol||'');
    setSaveName(activeRequestName==='Untitled Request'?`${method} ${url||'request'}`:activeRequestName);
    setSaveOpen(true);
  }
  async function saveCurrent(){
    const origin=activeSource();
    if(origin?.scope==='workspace' && (!canEditCloud || origin.workspaceId!==selectedWs)){
      setNotice('Sandbox request: Cloud save is disabled. Use Save as… to create a Local copy.');return;
    }
    if(!origin){openSaveAs();return;}
    const name=activeRequestName.trim();
    if(!name){setNotice('Request name cannot be empty');return;}
    const tabId=activeTabRef.current;
    if(remoteAlerts[tabId]){showConflictDialog(tabId);return;}
    const savedDraft=snapshot();
    await doAction(async()=>{
      let savedSource={...origin};
      if(origin.scope==='local'){
        if(origin.pending){
          const next=createLocalSavedRequest(localCollections,origin.collectionId,
            {...savedDraft,name,folderPath:origin.folderPath||[]});
          setLocalCollections(next.collections);
          savedSource={scope:'local',collectionId:origin.collectionId,requestId:next.request.id};
        }else setLocalCollections(updateLocalRequest(localCollections,origin.collectionId,origin.requestId,{...savedDraft,name}));
      }else{
        if(!token)throw Error('Sign in to save workspace requests');
        if(!url.trim())throw Error('Request URL is required. Please enter a URL before saving.');
        const savedPayload={...currentSavePayload(name),...(origin.pending&&origin.folderId?{folderId:origin.folderId}:{})};
        if(origin.pending){
          const saved=await createWorkspaceRequest(origin.workspaceId,origin.collectionId,savedPayload,token);
          savedSource={scope:'workspace',workspaceId:origin.workspaceId,collectionId:origin.collectionId,requestId:saved.id,revision:saved.revision};
        }else{
          try{
            const saved=await updateWorkspaceRequest(origin.workspaceId,origin.collectionId,origin.requestId,{...savedPayload,revision:origin.revision},token);
            savedSource={...origin,revision:saved.revision};
          }catch(error){
            if(error.status===409||error.status===428){
              setRemoteAlerts(old=>({...old,[tabId]:{kind:'conflict',revision:null}}));
              showConflictDialog(tabId);return;
            }
            throw error;
          }
        }
        invalidateWorkspaceRequestLists(origin.workspaceId,[origin.collectionId]);
        if(origin.workspaceId===selectedWs){
          // Saving has already completed; a list refresh failure must not turn it into an unsaved draft.
          try {
            const latest=await getWorkspaceRequests(origin.workspaceId,origin.collectionId,token);
            setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(origin.workspaceId,origin.collectionId)]:latest}));
            if(origin.collectionId===selectedCol)setSavedRequests(latest);
          }catch{ /* The next explorer fetch can retry. */ }
        }
      }
      // The request now belongs to a real saved entity; later Save calls update that same ID.
      setOpenTabs(tabs=>tabs.map(t=>t.id===tabId?tabSaved(t,savedSource,savedDraft,name):t));
      setRemoteAlerts(old=>{if(!old[tabId])return old;const next={...old};delete next[tabId];return next;});
      setNotice(origin.pending?`Created ${name} in collection`:`Saved changes to ${name}`);
    });
  }
  async function saveRequest(e){
    e.preventDefault();
    if(!saveName.trim())return;
    const savedDraft=snapshot();
    const tabId=activeTabRef.current;
    await doAction(async()=>{
      let source;
      if(saveScope==='local'){
        const next=createLocalSavedRequest(localCollections,saveLocalCollection,{...savedDraft,name:saveName});
        setLocalCollections(next.collections);
        source={scope:'local',collectionId:saveLocalCollection,requestId:next.request.id};
      }else{
        if(!token)throw Error('Sign in to save to workspace');
        if(!canEditCloud||saveWs!==selectedWs)throw Error('Cloud destination is not writable in your current workspace.');
        const saved=await createWorkspaceRequest(saveWs,saveCollection,currentSavePayload(saveName),token);
        source={scope:'workspace',workspaceId:saveWs,collectionId:saveCollection,requestId:saved.id,revision:saved.revision};
        invalidateWorkspaceRequestLists(saveWs,[saveCollection]);
        if(saveWs===selectedWs){
          try {
            const latest=await getWorkspaceRequests(saveWs,saveCollection,token);
            setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(saveWs,saveCollection)]:latest}));
            if(saveCollection===selectedCol)setSavedRequests(latest);
          }catch{ /* Save succeeded; keep the source ID and retry the list later. */ }
        }
      }
      setOpenTabs(ts=>ts.map(t=>t.id===tabId?tabSaved(t,source,savedDraft,saveName):t));
      setSaveOpen(false);setNotice(`Saved ${saveName}`);
    });
  }

  const {openSaveExampleDialog, persistResponseExamples, saveResponseExample} =
    createResponseExampleSaveActions(Object.assign(Object.create(dependencies), { activeSource }));

  return { loadRequest, activeSource, currentSavePayload, openSaveAs, saveCurrent, saveRequest, openSaveExampleDialog, persistResponseExamples, saveResponseExample };
}
