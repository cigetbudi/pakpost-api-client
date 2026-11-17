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
        try{setLocalCollections(validateLibrary([...localCollections,toLocalCollection({name,requests:[]})]));setLocalCollectionName('');setCreatingLocalCollection(false);}
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

  function createCollectionDraft(scope,collectionId,folderPath=[]){
      const draft=freshRequest('New Request');
      const source=pendingSource(scope,collectionId,{
        workspaceId:scope==='workspace'?selectedWs:'',folderPath,
        pendingId:typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
          ?crypto.randomUUID():`draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
      });
      addTab(draft,source,{focusName:true});
      setExplorerTab('collections');setSidebarCollapsed(false);
      if(scope==='workspace'){
        setSelectedCol(collectionId);
        setExpandedCollections(previous=>({...previous,[workspaceCollectionKey(selectedWs,collectionId)]:true}));
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
        loadSavedRequest({...request,collectionId:item.collectionId});
        openRequestHistory(activeTabRef.current,{scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId,requestId:item.requestId,revision:request.revision});return;
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

  function invalidateWorkspaceRequestLists(workspaceId,ids) {
      setWorkspaceRequestLists(previous => {
        const next={...previous};
        for(const id of ids)delete next[workspaceCollectionKey(workspaceId,id)];
        return next;
      });
    }

  function moveLocalRequest({collectionId,requestId,targetCollectionId,targetFolderPath,beforeRequestId}){
      updateLocal({type:'moveRequest',collectionId,requestId,targetCollectionId,targetFolderPath,beforeRequestId});
      if(collectionId!==targetCollectionId)setOpenTabs(ts=>ts.map(t=>t.source?.scope==='local'&&t.source.collectionId===collectionId&&t.source.requestId===requestId?
        {...t,source:{...t.source,collectionId:targetCollectionId}}:t));
    }

  async function moveWorkspaceRequest(e,targetCollectionId){
      e.preventDefault();e.stopPropagation();
      if(!token)return;
      try{
        const raw=e.dataTransfer.getData(WORKSPACE_DRAG);
        if(!raw)return;
        const {collectionId,requestId}=JSON.parse(raw);
        if(collectionId===targetCollectionId)return;
        await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests/${requestId}/move`,'PATCH',
          {targetCollectionId},token);
        setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.workspaceId===selectedWs&&t.source.requestId===requestId?
          {...t,source:{...t.source,collectionId:targetCollectionId}}:t));
        invalidateWorkspaceRequestLists(selectedWs,[collectionId,targetCollectionId]);
        if(selectedCol===collectionId){
          const latest=await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests`,'GET',undefined,token);
          setSavedRequests(latest);
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:latest}));
        }
        setNotice('Request moved to workspace collection');
      }catch(err){setNotice(getMessage(err));}
    }

  function showWorkspaceMenu(e,item){
      e.preventDefault();e.stopPropagation();
      const rect=e.currentTarget.getBoundingClientRect();
      setWorkspaceMenu({...item,x:Math.max(8,Math.min(e.clientX||rect.right,window.innerWidth-245)),y:Math.max(8,Math.min(e.clientY||rect.bottom,window.innerHeight-365))});
    }

  function workspaceDraft(item){
      const saved=decodeStoredHeaders(item.headersJson);
      let fields=[];try{fields=JSON.parse(item.formFieldsJson||'[]')}catch{}
      return {...blankDraft(),...item,rows:[...saved.headers,{...EMPTY_HEADER}],params:saved.params.length?saved.params:[{...EMPTY_HEADER}],documentation:saved.documentation,responseExamples:saved.responseExamples,...saved.auth,format:item.contentType||'application/json',
        formFields:fields,preScript:item.preRequestScript||'',postScript:item.postResponseScript||''};
    }

  async function handleWorkspaceMenu(action,item){
      setWorkspaceMenu(null);
      if(action==='renameExample'||action==='deleteExample'){
        setActionName(item.name||'');setActionDialog({scope:'workspace',action,...item});return;
      }
      if(action==='variables'){openCollectionVariables({scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId,name:collections.find(c=>c.id===item.collectionId)?.name||item.name});return;}
      if(action==='runCollection'){openCollectionRunner({scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId,name:collections.find(c=>c.id===item.collectionId)?.name||item.name});return;}
      if(action==='documentation'){openDocumentation({scope:'workspace',type:item.type==='request'?'request':'collection',collectionId:item.collectionId,requestId:item.requestId,name:item.name});return;}
      if(action==='renameCollection'||action==='deleteCollection'||action==='renameRequest'||action==='deleteRequest'){
        setActionName(item.name||'');setActionDialog({scope:'workspace',action,...item});return;
      }
      if(action==='exportCollection'){
        openExportChoice({kind:'collection',scope:'workspace',collectionId:item.collectionId,name:collections.find(c=>c.id===item.collectionId)?.name||'Workspace collection'});return;
      }
      if(action==='newRequest'){
        createCollectionDraft('workspace',item.collectionId);
        return;
      }
      const base=`/api/workspaces/${selectedWs}/collections`;
      await doAction(async()=>{
        if(action==='sortCollection'){
          setWorkspaceSorted(old=>({...old,[item.collectionId]:'name'}));
          return;
        }
        const list=await api(`${base}/${item.collectionId}/requests`,'GET',undefined,token);
        if(action==='duplicateCollection'){
          if(list.length>100)throw Error('Duplicate limit: 100 saved requests');
          const source=collections.find(c=>c.id===item.collectionId);
          const destination=await api(base,'POST',{name:`${source?.name||'Collection'} (copy)`},token);
          setWorkspaceCollectionDocs(old=>({...old,[workspaceDocKey(selectedWs,destination.id)]:old[workspaceDocKey(selectedWs,item.collectionId)]||''}));
          const variables=await readSavedCollectionVariables({scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId});
          if(variables.variables?.length){
            await api(`${base}/${destination.id}/variables`,'PUT',{version:0,variables:variables.variables.filter(v=>!v.isRedacted)},token);
          }
          for(const req of list)await api(`${base}/${destination.id}/requests`,'POST',
            {name:req.name,method:req.method,url:req.url,headersJson:req.headersJson,body:req.body,bodyMode:req.bodyMode,contentType:req.contentType,formFieldsJson:req.formFieldsJson,preRequestScript:req.preRequestScript,postResponseScript:req.postResponseScript},token);
          setCollections(await api(base,'GET',undefined,token));return;
        }
        if(action==='duplicateRequest'){
          const req=list.find(x=>x.id===item.requestId);if(!req)return;
          await api(`${base}/${item.collectionId}/requests`,'POST',
            {name:`${req.name} (copy)`,method:req.method,url:req.url,headersJson:req.headersJson,body:req.body,bodyMode:req.bodyMode,contentType:req.contentType,formFieldsJson:req.formFieldsJson,preRequestScript:req.preRequestScript,postResponseScript:req.postResponseScript},token);
          invalidateWorkspaceRequestLists(selectedWs,[item.collectionId]);
          if(selectedCol===item.collectionId){
            const latest=await api(`${base}/${item.collectionId}/requests`,'GET',undefined,token);
            setSavedRequests(latest);
            setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,item.collectionId)]:latest}));
          }
        }
      });
    }

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
    }

  async function executeActionDialog(e){
      e.preventDefault();if(!actionDialog)return;
      const {scope,action,collectionId,requestId,folderPath}=actionDialog;
      const name=actionName.trim();
      if(action.startsWith('rename')&&!name)return;
      if(action==='renameExample'){
        const success=await doAction(async()=>{
          await renameSavedExample(actionDialog,name);
          setNotice(`Renamed example to ${name}`);
        });
        if(success)setActionDialog(null);
        return;
      }
      if(scope==='local')updateLocal({type:action,collectionId,requestId,folderPath,name});
      else { const success=await doAction(async()=>{
        const base=`/api/workspaces/${selectedWs}/collections/${collectionId}`;
        if(action==='renameCollection'){
          await api(base,'PUT',{name},token);setCollections(await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token));
        }else if(action==='deleteCollection'){
          await api(base,'DELETE',undefined,token);setCollections(old=>old.filter(c=>c.id!==collectionId));
          setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.collectionId===collectionId&&t.source.workspaceId===selectedWs?{...t,source:null}:t));
          if(selectedCol===collectionId)setSelectedCol('');
        }else if(action==='renameRequest'){
          const item=(workspaceRequestLists[workspaceCollectionKey(selectedWs,collectionId)]||savedRequests).find(x=>x.id===requestId);if(!item)return;
          const saved=await api(`${base}/requests/${requestId}`,'PUT',{...item,name},token);
          adoptSavedRevision(saved);
          setSavedRequests(old=>old.map(x=>x.id===requestId?saved:x));
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:(old[workspaceCollectionKey(selectedWs,collectionId)]||[]).map(x=>x.id===requestId?saved:x)}));
          setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.requestId===requestId?{...t,name,savedName:name,source:{...t.source,revision:saved.revision},savedFingerprint:requestFingerprint(t.id===activeTabRef.current?snapshot():draftsRef.current[t.id],name)}:t));
        }else if(action==='deleteRequest'){
          await api(`${base}/requests/${requestId}`,'DELETE',undefined,token);
          setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.requestId===requestId?{...t,source:null}:t));
          setSavedRequests(old=>old.filter(x=>x.id!==requestId));
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:(old[workspaceCollectionKey(selectedWs,collectionId)]||[]).filter(x=>x.id!==requestId)}));
        }else if(action==='deleteExample'){
          const list=await api(`${base}/requests`,'GET',undefined,token);
          const original=list.find(x=>x.id===requestId);
          if(!original)throw Error('Saved request not found');
          const metadata=decodeStoredHeaders(original.headersJson);
          const examples=metadata.responseExamples.filter(example=>example.id!==actionDialog.exampleId);
          const saved=await api(`${base}/requests/${requestId}`,'PUT',{
            ...original,headersJson:encodeStoredHeaders(metadata.headers,metadata.params,metadata.documentation,examples,metadata.auth)
          },token);
          adoptSavedRevision(saved);
          const updated=list.map(req=>req.id===requestId?saved:req);
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:updated}));
          if(selectedCol===collectionId)setSavedRequests(updated);
          const affected=openTabs.filter(tab=>tab.source?.scope==='workspace'&&tab.source.workspaceId===selectedWs&&tab.source.collectionId===collectionId&&tab.source.requestId===requestId);
          for(const tab of affected){
            if(draftsRef.current[tab.id])draftsRef.current[tab.id]={...draftsRef.current[tab.id],responseExamples:examples};
            if(tab.id===activeTabRef.current)setResponseExamples(examples);
          }
        }
      }); if(!success)return; }
      setActionDialog(null);
    }
  return { createExplorerCollection, openCollectionImport, submitCollectionImport, openBoundRequest, openLocalRequest, previewSavedExample, openLocalExample, openWorkspaceExample, downloadJson, updateLocal, createCollectionDraft, handleLocalMenu, expandOrCollapseAllCollections, toggleWorkspaceCollectionById, invalidateWorkspaceRequestLists, moveLocalRequest, moveWorkspaceRequest, showWorkspaceMenu, workspaceDraft, handleWorkspaceMenu, synchronizeSavedExamples, renameSavedExample, executeActionDialog };
}
