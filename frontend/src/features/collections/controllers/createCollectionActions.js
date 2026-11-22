import { createCollectionOpenActions } from './createCollectionOpenActions.js';
import { createCollectionCreationActions } from './createCollectionCreationActions.js';
import {collectionParentChain} from '../services/collectionHierarchy.js';
import {createCollectionMoveActions} from './createCollectionMoveActions.js';
import {createCollectionExampleActions} from './createCollectionExampleActions.js';
import {createCollectionDialogActions} from './createCollectionDialogActions.js';
import {createWorkspaceCollectionMenuActions} from './createWorkspaceCollectionMenuActions.js';
// Collections workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createCollectionActions(dependencies) {
  const {
    EMPTY_HEADER, STORAGE_WORKSPACE, WORKSPACE_DRAG, actionDialog, actionName,
    activeSource, activeTabRef, addTab, adoptSavedRevision, api,
    applyLocalAction, blankDraft, canEditCloud, currentTokenRef, selectedWorkspaceRef,
    collections, collectionsScope, decodeStoredHeaders, doAction, draftsRef,
    encodeStoredHeaders, freshRequest, getMessage, loadSavedRequest, localCollections,
    openCollectionRunner, openCollectionVariables, openDocumentation, openExportChoice, openRequestHistory,
    openTabs, openTabsRef, pendingSource, readSavedCollectionVariables, renameResponseExample,
    requestFingerprint, responseExamples, rows, sanitizeResponseExamples, savedRequests,
    selectedCol, selectedWs, setActionDialog, setActionName, setAllWorkspaceCollections,
    setCollections, setExpandedCollections, setExplorerTab, setLocalCollections, setLocalExpandAllSignal,
    setNotice, setOpenTabs, setResponseExamples, setRevealLocalDraft, setSavedRequests,
    setSelectedCol, setSidebarCollapsed, setWorkspaceCollectionDocs, setWorkspaceMenu, setWorkspaceRequestLists,
    setWorkspaceSorted, snapshot, toggleWorkspaceCollection, token, url,
    validateLibrary, workspaceCollectionKey, workspaceDocKey, workspaceRequestLists,
  } = dependencies;
  const creationActions = createCollectionCreationActions(dependencies);
  const createExplorerCollection = creationActions.createExplorerCollection;
  const openCollectionImport = creationActions.openCollectionImport;
  const submitCollectionImport = creationActions.submitCollectionImport;
  // workspaceDraft comes from the Cloud menu factory below. Resolve it lazily
  // when the user opens an example, after all factories have been initialized.
  const openActions = createCollectionOpenActions(Object.assign(Object.create(dependencies), {
    workspaceDraft: (...args) => workspaceDraft(...args),
  }));
  const openBoundRequest = openActions.openBoundRequest;
  const openLocalRequest = openActions.openLocalRequest;
  const previewSavedExample = openActions.previewSavedExample;
  const openLocalExample = openActions.openLocalExample;
  const openWorkspaceExample = openActions.openWorkspaceExample;

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
