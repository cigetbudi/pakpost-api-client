import {collectionParentChain} from '../services/collectionHierarchy.js';
import {createCollectionMoveActions} from './createCollectionMoveActions.js';
import {createCollectionExampleActions} from './createCollectionExampleActions.js';
import {createCollectionDialogActions} from './createCollectionDialogActions.js';
import {createWorkspaceCollectionMenuActions} from './createWorkspaceCollectionMenuActions.js';
// Collections workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createCollectionActions(dependencies) {
  const {
    EMPTY_HEADER,
    STORAGE_LOCAL,
    STORAGE_WORKSPACE,
    WORKSPACE_DRAG,
    actionDialog,
    actionName,
    activeSource,
    activeTabRef,
    addTab,
    adoptSavedRevision,
    allowedStorageScope,
    api,
    applyLocalAction,
    blankDraft,
    busyAction,
    canEditCloud,
    currentTokenRef,
    selectedWorkspaceRef,
    collectionImportBusy,
    collectionImportDestination,
    collectionImportFile,
    collectionImportSources,
    collections,
    collectionsScope,
    decodeStoredHeaders,
    doAction,
    draftsRef,
    encodeStoredHeaders,
    exampleToResult,
    findBoundTab,
    freshRequest,
    getMessage,
    importRequestsAndEnvironments,
    loadSavedRequest,
    localCollectionName,
    localCollections,
    openCollectionRunner,
    openCollectionVariables,
    openDocumentation,
    openExportChoice,
    openRequestHistory,
    openTabs,
    openTabsRef,
    parseImportText,
    pendingSource,
    readSavedCollectionVariables,
    renameResponseExample,
    requestFingerprint,
    responseExamples,
    restoreDraft,
    rows,
    sanitizeResponseExamples,
    savedRequests,
    selectTab,
    selectedCol,
    selectedWs,
    setActionDialog,
    setActionName,
    setActiveTabId,
    setAllWorkspaceCollections,
    setCollectionImportBusy,
    setCollectionImportDestination,
    setCollectionImportError,
    setCollectionImportFile,
    setCollectionImportOpen,
    setCollections,
    setCreatingLocalCollection,
    setExpandedCollections,
    setExplorerTab,
    setLocalCollectionName,
    setLocalCollections,
    setLocalExpandAllSignal,
    setNotice,
    setOpenTabs,
    setPage,
    setResTab,
    setResponseExamples,
    setResult,
    setRevealLocalDraft,
    setSavedRequests,
    setSelectedCol,
    setSidebarCollapsed,
    setWorkspaceCollectionDocs,
    setWorkspaceMenu,
    setWorkspaceRequestLists,
    setWorkspaceSorted,
    snapshot,
    storageScope,
    toLocalCollection,
    toggleWorkspaceCollection,
    token,
    url,
    validateLibrary,
    workspaceCollectionKey,
    workspaceDocKey,
    workspaceRequestLists
  } = dependencies;

  async function createExplorerCollection(e){
      e.preventDefault();
      const name=localCollectionName.trim();if(!name||busyAction)return;
      if(storageScope===STORAGE_WORKSPACE&&token){
        if(!selectedWs){setNotice('Select a workspace before creating a Cloud collection.');return;}
        await doAction(async()=>{
          const created=await api(`/api/workspaces/${selectedWs}/collections`,'POST',{name},token);
          setCollections(current=>[...current,created]);
          setSelectedCol(created.id);
          setLocalCollectionName('');setCreatingLocalCollection(false);
          setNotice('Cloud collection created.');
        });
      }else{
        try{
          const next=toLocalCollection({name,requests:[]});
          next.sortOrder=1+Math.max(0,...localCollections.filter(item=>!item.parentCollectionId).map(item=>Number(item.sortOrder)||0));
          setLocalCollections(validateLibrary([...localCollections,next]));
          setLocalCollectionName('');setCreatingLocalCollection(false);
        }
        catch(err){setNotice(getMessage(err));}
      }
    }

  function openCollectionImport(){
      setCollectionImportDestination(token&&canEditCloud?STORAGE_WORKSPACE:STORAGE_LOCAL);
      setCollectionImportFile(null);setCollectionImportError('');setCollectionImportOpen(true);
    }

  async function submitCollectionImport(){
      if(!collectionImportFile||collectionImportBusy)return;
      setCollectionImportBusy(true);setCollectionImportError('');
      try{
        const parsed=parseImportText(await collectionImportFile.text());
        if(parsed.kind==='environment'||(parsed.kind==='pakpost'&&!parsed.requests?.length))
          throw Error('This file has no collections. Use Environments or Import / Export to import it.');
        if(!collectionImportSources(parsed).length)
          throw Error('This file has no HTTP collections. Choose Postman, OpenAPI, Insomnia v4 JSON or cURL.');
        if(collectionImportDestination===STORAGE_WORKSPACE&&!canEditCloud)
          throw Error('You cannot import Cloud collections with your current workspace roles. Choose Local.');
        const message=await importRequestsAndEnvironments(parsed,allowedStorageScope(!!token,collectionImportDestination));
        setNotice(message);setCollectionImportOpen(false);setCollectionImportFile(null);
      }catch(error){setCollectionImportError(getMessage(error));}
      finally{setCollectionImportBusy(false);}
    }

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

  function downloadJson(data,filename){
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
      anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    }

  function updateLocal(action){
      try{setLocalCollections(old=>applyLocalAction(old,action));
        if(action.type==='deleteRequest'||action.type==='deleteCollection')setOpenTabs(ts=>ts.map(t=>t.source?.scope==='local'&&(action.type==='deleteCollection'?t.source.collectionId===action.collectionId:(t.source.collectionId===action.collectionId&&t.source.requestId===action.requestId))?{...t,source:null}:t));
        if(action.type==='renameRequest')setOpenTabs(ts=>ts.map(t=>t.source?.scope==='local'&&t.source.collectionId===action.collectionId&&t.source.requestId===action.requestId?{...t,name:action.name,savedName:action.name}:t));
        if(action.type==='deleteExample'){
          const source=activeSource();
          if(source?.scope==='local'&&source.collectionId===action.collectionId&&source.requestId===action.requestId){
            const current=sanitizeResponseExamples(responseExamples).filter(example=>example.id!==action.exampleId);
            setResponseExamples(current);
            draftsRef.current[activeTabRef.current]={...snapshot(),responseExamples:current};
          }
        }
        if(action.type==='deleteRequest'||action.type==='deleteCollection')setNotice('Deleted from local collection. Open drafts are preserved.');
      }catch(e){setNotice(getMessage(e));}
    }

  function createCollectionDraft(scope,collectionId,folderPath=[],folderId=null){
      const draft=freshRequest('New Request');
      const source=pendingSource(scope,collectionId,{
        workspaceId:scope==='workspace'?selectedWs:'',folderPath,folderId,
        pendingId:typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
          ?crypto.randomUUID():`draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
      });
      addTab(draft,source,{focusName:true});
      setExplorerTab('collections');setSidebarCollapsed(false);
      if(scope==='workspace'){
        setSelectedCol(collectionId);
        setExpandedCollections(previous=>({...previous,...Object.fromEntries(
          collectionParentChain(collections,collectionId).map(id=>[workspaceCollectionKey(selectedWs,id),true]))}));
      }else setRevealLocalDraft({collectionId,folderPath,nonce:Date.now()});
      setNotice('Draft created in collection. Save to persist it.');
    }

  function handleLocalMenu(item){
      const {action,collectionId,requestId,folderPath}=item;
      const collection=localCollections.find(c=>c.id===collectionId);
      if(!collection)return;
      if(action==='versionHistory'){
        const tab=openTabsRef.current.find(t=>t.source?.scope==='workspace'&&t.source?.requestId===item.requestId);
        if(tab){openRequestHistory(tab.id);return;}
        const rows=workspaceRequestLists[workspaceCollectionKey(selectedWs,item.collectionId)]||savedRequests;
        const request=rows.find(x=>x.id===item.requestId);
        if(!request){setNotice('Open the Cloud request first, then select Versions.');return;}
        const source={scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId,requestId:item.requestId,revision:request.revision};
        if(request.isIndex){
          Promise.resolve(loadSavedRequest({...request,collectionId:item.collectionId}))
            .then(opened=>{if(opened)openRequestHistory(activeTabRef.current,source);});
        }else{
          loadSavedRequest({...request,collectionId:item.collectionId});
          openRequestHistory(activeTabRef.current,source);
        }
        return;
      }
      if(action==='variables'){openCollectionVariables({scope:'local',collectionId,name:collection.name});return;}
      if(action==='runCollection'){openCollectionRunner({scope:'local',collectionId,name:collection.name});return;}
      if(action==='exportCollection'){openExportChoice({kind:'collection',scope:'local',collectionId,name:collection.name});return;}
      if(action==='documentation'){openDocumentation({scope:'local',type:requestId?'request':folderPath?.length?'folder':'collection',collectionId,requestId,folderPath,name:item.name||collection.name});return;}
      if(action==='newRequest'){
        createCollectionDraft('local',collectionId,folderPath||[]);
        return;
      }
      if(action==='renameExample'){
        setActionName(item.name||'');setActionDialog({scope:'local',...item});return;
      }
      const immediate={duplicateCollection:'duplicateCollection',duplicateFolder:'duplicateFolder',duplicateRequest:'duplicateRequest',sortCollection:'sortCollection',sortMethod:'sortCollection',sortFolder:'sortFolder',deleteExample:'deleteExample'};
      if(immediate[action]){updateLocal({...item,type:immediate[action],sort:action==='sortMethod'?'method':'name'});return;}
      setActionName(item.name||'');setActionDialog({scope:'local',...item});
    }

  function expandOrCollapseAllCollections(open) {
      setLocalExpandAllSignal(previous => ({open, nonce: (previous?.nonce||0)+1}));
      if(token && selectedWs && collectionsScope===STORAGE_WORKSPACE)
        setExpandedCollections(previous => setAllWorkspaceCollections(previous,selectedWs,collections.map(c=>c.id),open));
    }

  function toggleWorkspaceCollectionById(id) {
      setExpandedCollections(previous => toggleWorkspaceCollection(previous,selectedWs,id,selectedCol));
      setSelectedCol(id);
    }

  async function refreshCloudCollection(collectionId) {
      const workspaceId=selectedWs,auth=token;
      const valid=()=>selectedWorkspaceRef.current===workspaceId&&currentTokenRef.current===auth;
      const base=`/api/workspaces/${workspaceId}/collections`;
      if(!valid())return;
      try {
        const collection=collections.find(item=>item.id===collectionId);
        if(Number(collection?.requestCount)>800){
          window.dispatchEvent(new CustomEvent('pakpost:cloud-paged-refresh',
            {detail:{workspaceId,collectionId}}));
          const fresh=await api(base,'GET',undefined,auth);
          if(valid())setCollections(fresh);
          return;
        }
        const latest=await api(`${base}/${collectionId}/requests/index`,'GET',undefined,auth);
        if(!valid())return;
        const current=workspaceRequestLists[workspaceCollectionKey(workspaceId,collectionId)]||[];
        const retained=new Set(latest.map(r=>r.id));
        const removed=new Set(current.filter(r=>!retained.has(r.id)).map(r=>r.id));
        // Detach deleted saved sources, preserve the editor's unsaved contents.
        if(removed.size)setOpenTabs(tabs=>tabs.map(tab=>tab.source?.scope==='workspace'&&
          tab.source.workspaceId===workspaceId&&tab.source.collectionId===collectionId&&
          removed.has(tab.source.requestId)?{...tab,source:null}:tab));
        setWorkspaceRequestLists(prev=>({...prev,[workspaceCollectionKey(workspaceId,collectionId)]:latest}));
        if(selectedCol===collectionId)setSavedRequests(latest);
        const fresh=await api(base,'GET',undefined,auth);
        if(valid())setCollections(fresh);
      }catch(error){if(valid())setNotice(getMessage(error));}
    }

  const {
    invalidateWorkspaceRequestLists,
    moveLocalRequest, moveLocalFolder, moveLocalCollection,
    moveWorkspaceCollection, moveWorkspaceFolder, reorderWorkspaceRequest, moveWorkspaceRequest,
  } = createCollectionMoveActions({
    WORKSPACE_DRAG, api, applyLocalAction, canEditCloud, collections, currentTokenRef,
    getMessage, localCollections, refreshCloudCollection, selectedCol,
    selectedWorkspaceRef, selectedWs, setCollections, setLocalCollections,
    setNotice, setOpenTabs, setSavedRequests, setWorkspaceRequestLists,
    setWorkspaceSorted, token, updateLocal, validateLibrary,
    workspaceCollectionKey, workspaceRequestLists,
  });

  const { showWorkspaceMenu, workspaceDraft, handleWorkspaceMenu } = createWorkspaceCollectionMenuActions({
    EMPTY_HEADER, api, blankDraft, collections, createCollectionDraft,
    decodeStoredHeaders, doAction, invalidateWorkspaceRequestLists,
    openCollectionRunner, openCollectionVariables, openDocumentation,
    openExportChoice, readSavedCollectionVariables, selectedCol, selectedWs,
    setActionDialog, setActionName, setCollections, setExpandedCollections,
    setSavedRequests, setWorkspaceCollectionDocs, setWorkspaceMenu,
    setWorkspaceRequestLists, setWorkspaceSorted, token,
    workspaceCollectionKey, workspaceDocKey,
  });

  const { synchronizeSavedExamples, renameSavedExample } = createCollectionExampleActions({
    activeTabRef, adoptSavedRevision, api, applyLocalAction, decodeStoredHeaders,
    draftsRef, encodeStoredHeaders, localCollections, openTabs, renameResponseExample,
    savedRequests, selectedCol, selectedWs, setLocalCollections, setResponseExamples,
    setSavedRequests, setWorkspaceRequestLists, snapshot, token,
    workspaceCollectionKey,
  });

  const { executeActionDialog } = createCollectionDialogActions({
    actionDialog, actionName, activeTabRef, adoptSavedRevision, api, collections,
    decodeStoredHeaders, doAction, draftsRef, encodeStoredHeaders, getMessage,
    localCollections, openTabs, renameSavedExample, requestFingerprint,
    savedRequests, selectedCol, selectedWs, setActionDialog, setCollections,
    setNotice, setOpenTabs, setResponseExamples, setSavedRequests, setSelectedCol,
    setWorkspaceRequestLists, snapshot, token, updateLocal, workspaceCollectionKey,
    workspaceRequestLists,
  });
  return { refreshCloudCollection, createExplorerCollection, openCollectionImport, submitCollectionImport, openBoundRequest, openLocalRequest, previewSavedExample, openLocalExample, openWorkspaceExample, downloadJson, updateLocal, createCollectionDraft, handleLocalMenu, expandOrCollapseAllCollections, toggleWorkspaceCollectionById, invalidateWorkspaceRequestLists, moveLocalRequest, moveLocalFolder, moveLocalCollection, moveWorkspaceCollection, moveWorkspaceFolder, reorderWorkspaceRequest, moveWorkspaceRequest, showWorkspaceMenu, workspaceDraft, handleWorkspaceMenu, synchronizeSavedExamples, renameSavedExample, executeActionDialog };
}
