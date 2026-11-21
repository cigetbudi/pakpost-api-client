import React, {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Dialog} from '../../../components/ui/WorkbenchPrimitives.jsx';
import { PanelLeftClose, Layers3, Settings2, LockKeyhole, ChevronRight, History, Plus, Search, ChevronsUpDown, ChevronsDownUp, FileUp, X, ChevronDown, FolderClosed, ArrowRight } from 'lucide-react';
import { RetroSelect } from '../../../components/ui/RetroSelect.jsx';
import { EnvironmentExplorer } from '../../environments/components/EnvironmentExplorer.jsx';
import { LocalCollectionsTree } from './LocalCollectionsTree.jsx';
import { CloudFolderTree, CLOUD_FOLDER_DRAG } from './CloudFolderTree.jsx';
import {activeCloudTabForCollection} from '../services/cloudActiveTab.js';
import { isDarkAppearance } from '../../settings/services/appearance.js';
import { canWorkspace } from '../../workspace/services/workspaceRoles.js';
import { STORAGE_LOCAL, STORAGE_WORKSPACE, cloudEndpointCount } from '../../import-export/services/storageScope.js';
import { isWorkspaceCollectionOpen, workspaceCollectionKey } from '../services/collectionExpansion.js';
import { decodeStoredHeaders } from '../../requests/services/requestMetadata.js';
import {CLOUD_SERVER_PAGING_THRESHOLD} from '../services/cloudRenderBudget.js';
import {isFolderDrag,readFolderDrag,endFolderDrag} from '../services/folderDrag.js';
import {startRequestDrag,peekRequestDrag,isRequestDrag,readRequestDrag,endRequestDrag,dragRowPlacement} from '../services/requestDrag.js';
import {visibleCollectionNodes,collectionParentChain,arrangeCollections,startCollectionDrag,isCollectionDrag,readCollectionDrag,endCollectionDrag,collectionDropPosition} from '../services/collectionHierarchy.js';
import { statusTone } from '../../requests/services/responseExamples.js';

// Only the visible explorer mounts. Code generator and import/export panels are
// still supplied lazily by the workbench; this module never fetches user data.
export function WorkbenchExplorer({ data, actions, refs, deferred }) {
  const { explorerTab, token, envScope, selectedWs, workspaces, environmentContext } = data;
  const { currentEnvironments, activeEnvId, activeWorkspace, selfMember, theme, openTabs } = data;
  const { activeTabId, localEnvironments, localCollections, recent } = data;
  const { collectionsScope, explorerSearch, collectionSort, busyAction, canEditCloud, creatingLocalCollection } = data;
  const { localCollectionName, storageScope, collections, visibleLocalCollections, localExpandAllSignal, revealLocalDraft } = data;
  const { visibleCollections, expandedCollections, selectedCol, workspaceRequestLists, WORKSPACE_DRAG, workspaceSorted } = data;
  const { expandedWorkspaceExamples } = data;
  const { setSidebarCollapsed, setSelectedWs, navigate, setAuthMode, setAuthOpen, setActiveEnvId, setExpandedCollections } = actions;
  const { persistEnvironment, createEnvironment, deleteEnvironment, duplicateEnvironment, openExportChoice, importEnvironmentFile } = actions;
  const { codePreviewRequest, buildCodeRequest, snapshot, importRequestsAndEnvironments, setNotice, loadRequest } = actions;
  const { setExplorerSearch, setCollectionSort, expandOrCollapseAllCollections, openCollectionImport } = actions;
  const { setCreatingLocalCollection, createExplorerCollection, setLocalCollectionName, openLocalRequest, openLocalExample, handleLocalMenu } = actions;
  const { moveLocalRequest, moveLocalFolder, moveLocalCollection, moveWorkspaceCollection,
    moveWorkspaceFolder, reorderWorkspaceRequest, selectTab, moveWorkspaceRequest, showWorkspaceMenu,
    toggleWorkspaceCollectionById, createCollectionDraft, handleWorkspaceMenu, refreshCloudCollection } = actions;
  const { setExpandedWorkspaceExamples, loadSavedRequest, openWorkspaceExample } = actions;
  const { draftsRef } = refs;
  const { CodeSidebar, ImportExportSidebar } = deferred;
  // Request index records are immutable in React. Cache parsed response-example
  // metadata per record, not per entire Collection (which would defeat paging).
  // Weak keys are garbage-collected when a Workspace or Collection is replaced.
  const [collectionOrganizer,setCollectionOrganizer]=useState(null);
  const [organizeDestination,setOrganizeDestination]=useState('root:');
  const [collectionDropTarget,setCollectionDropTarget]=useState('');
  const [requestDropTarget,setRequestDropTarget]=useState('');
  const [dragging,setDragging]=useState(null);
  useEffect(()=>{
    const listener=e=>setDragging(e.detail?.kind&&e.detail?.scope==='workspace'&&
      e.detail.workspaceId===selectedWs?e.detail:null);
    window.addEventListener('pakpost:explorer-drag',listener);
    return()=>window.removeEventListener('pakpost:explorer-drag',listener);
  },[selectedWs]);
  useEffect(()=>{
    const open=event=>{
      const detail=event.detail;
      if(detail?.scope==='workspace'&&detail.workspaceId===selectedWs){
        setCollectionOrganizer({scope:'workspace',sourceId:detail.collectionId});
        setOrganizeDestination('root:');
      }
    };
    window.addEventListener('pakpost:collection-organizer',open);
    return()=>window.removeEventListener('pakpost:collection-organizer',open);
  },[selectedWs]);
  const localMove=(source,target,placement)=>{setCollectionSort('manual');if(placement==='inside'&&target)window.dispatchEvent(new CustomEvent('pakpost:local-collection-reveal',{detail:{collectionId:target}}));moveLocalCollection(source,target,placement);};
  const cloudMove=(source,target,placement)=>{
    if(!canEditCloud)return;
    setCollectionSort('manual');
    if(placement==='inside'&&target)setExpandedCollections(old=>({...old,...Object.fromEntries(
      collectionParentChain(collections,target).map(id=>[workspaceCollectionKey(selectedWs,id),true]))}));
    moveWorkspaceCollection(source,target,placement);
  };
  const cloudNodes=useMemo(()=>visibleCollectionNodes(collections,{sort:collectionSort,search:explorerSearch,
    isOpen:col=>isWorkspaceCollectionOpen(expandedCollections,selectedWs,col.id,selectedCol),
    requestMatches:col=>(workspaceRequestLists[workspaceCollectionKey(selectedWs,col.id)]||[]).some(request=>
      `${request.name||''} ${request.url||''}`.toLowerCase().includes(explorerSearch.toLowerCase()))}),
    [collections,collectionSort,explorerSearch,expandedCollections,selectedWs,selectedCol,workspaceRequestLists]);
  const organizationList=collectionOrganizer?.scope==='local'?localCollections:collections;
  const chosen=organizationList.find(item=>item.id===collectionOrganizer?.sourceId);
  const organizationOptions=chosen?[{value:'root:',label:'Collection root (last)'},
    ...organizationList.flatMap(item=>['inside','before','after'].flatMap(placement=>{
      try{arrangeCollections(organizationList,chosen.id,item.id,placement);}
      catch{return [];}
      return [{value:`${placement}:${item.id}`,label:`${placement==='inside'?'Inside':placement==='before'?'Before':'After'} ${item.name}`}];
    }))]:[];
  const organize=async()=>{
    if(!chosen)return;
    const [placement,target]=organizeDestination.split(':');
    if(collectionOrganizer.scope==='local')localMove(chosen.id,target||null,placement);
    else cloudMove(chosen.id,target||null,placement);
    setCollectionOrganizer(null);
  };
  const requestMetadata = useRef(new WeakMap());
  const readRequestMetadata = request => {
    const cached = requestMetadata.current.get(request);
    if (cached?.raw === request.headersJson) return cached.value;
    const value = decodeStoredHeaders(request.headersJson);
    requestMetadata.current.set(request,{raw:request.headersJson,value});
    return value;
  };

  return (
<>
<aside className="pp-explorer">
        <div className="pp-explorer-title"><strong>{explorerTab === 'collections' ? 'Collections' : explorerTab === 'history' ? 'History' : explorerTab === 'code' ? 'Generate Code' : explorerTab === 'exchange' ? 'Import / Export' : 'Environments'}</strong><button title="Collapse sidebar" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={16}/></button></div>
        {explorerTab === 'environments' ? <>
          {token&&envScope===STORAGE_WORKSPACE&&<div className="pp-compact-workspace"><Layers3 size={15}/><span>Workspace</span><RetroSelect ariaLabel="Switch environment workspace" title="Switch workspace" value={selectedWs} onChange={setSelectedWs} options={workspaces.map(w=>({value:w.id,label:w.name}))}/><button type="button" title="Manage workspace" aria-label="Manage workspace" onClick={()=>navigate('workspace')}><Settings2 size={15}/></button></div>}
          {!token&&<button className="pp-link-row pp-login-hint" onClick={()=>{setAuthMode('login');setAuthOpen(true)}}><LockKeyhole size={14}/> Sign in to access Cloud environments <ChevronRight size={13}/></button>}
          <EnvironmentExplorer key={environmentContext||'cloud-pending'} items={currentEnvironments} selected={activeEnvId} onSelect={setActiveEnvId} onSave={persistEnvironment} onCreate={createEnvironment} onDelete={deleteEnvironment} onDuplicate={duplicateEnvironment} onExport={environment=>openExportChoice({kind:'environment',name:environment.name,environment})} onImportFile={importEnvironmentFile} authenticated={!!token} workspaceName={activeWorkspace?.name||''} readOnly={envScope===STORAGE_WORKSPACE&&!canWorkspace(selfMember,'environment.write')} onLogin={()=>{setAuthMode('login');setAuthOpen(true)}} scope={envScope===STORAGE_WORKSPACE?`Cloud · ${activeWorkspace?.name||'Choose workspace'}`:'Local · Browser'}/>
        </> : explorerTab === 'code' ? <CodeSidebar request={codePreviewRequest()} buildResolved={buildCodeRequest} theme={isDarkAppearance(theme)?'dark':'light'}/> : explorerTab === 'exchange' ?
          <ImportExportSidebar requests={openTabs.map(t=>({...draftsRef.current[t.id],...(t.id===activeTabId?snapshot():{}),name:t.name}))}
            environments={localEnvironments} localCollections={localCollections} onImport={importRequestsAndEnvironments} onMessage={setNotice} authenticated={!!token} workspaceName={activeWorkspace?.name||''} onLogin={()=>{setAuthMode('login');setAuthOpen(true)}} theme={isDarkAppearance(theme)?'dark':'light'}/> : explorerTab === 'history' ? <>
          <div className="pp-side-subhead"><span>RECENT REQUESTS</span><span>{recent.length}</span></div>
          {recent.length ? <div className="pp-side-scroll">{recent.map((r, i) => <button key={`${i}-${r.url}`} className="pp-history-item" onClick={() => loadRequest(r)}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span className="pp-history-main"><strong>{(() => { try { return new URL(r.url).pathname || '/'; } catch { return r.url; } })()}</strong><small>{r.url}</small></span><span className={r.status < 400 ? 'pp-history-ok' : 'pp-history-bad'}>{r.status}</span></button>)}</div> : <div className="pp-explorer-empty"><History size={23}/><strong>No history yet</strong><span>Requests you send during this session will appear here.</span></div>}
        </> : <>
          {token&&collectionsScope===STORAGE_WORKSPACE&&<div className="pp-compact-workspace"><Layers3 size={15}/><span>Workspace</span><RetroSelect ariaLabel="Switch workspace" title="Switch workspace" value={selectedWs} onChange={setSelectedWs} options={workspaces.map(w=>({value:w.id,label:w.name}))}/><button type="button" title="Manage workspace" aria-label="Manage workspace" onClick={()=>navigate('workspace')}><Settings2 size={15}/></button></div>}
          <div className="pp-collections-toolbar">
            <div className="pp-explorer-search"><Search size={14}/><input placeholder="Search collections" aria-label="Search collections" value={explorerSearch} onChange={e => setExplorerSearch(e.target.value)}/></div>
            <div className="pp-collections-toolbar-row">
              <RetroSelect ariaLabel="Sort all collections" title="Sort collections" value={collectionSort} onChange={setCollectionSort} options={[{value:'manual',label:'Manual order'},{value:'name-asc',label:'Name A–Z'},{value:'name-desc',label:'Name Z–A'},{value:'newest',label:'Recently updated'}]}/>
              <div className="pp-collection-expand-controls" role="group" aria-label="Expand or collapse collections">
                <button type="button" aria-label="Expand all collections and folders" title="Expand all" onClick={()=>expandOrCollapseAllCollections(true)}><ChevronsUpDown size={15}/></button>
                <button type="button" aria-label="Collapse all collections and folders" title="Collapse all" onClick={()=>expandOrCollapseAllCollections(false)}><ChevronsDownUp size={15}/></button>
              </div>
              <button type="button" className="pp-env-import-action" title="Import collection" onClick={openCollectionImport}><FileUp size={15}/> Import</button>
              <button type="button" className="pp-env-primary" title="New collection" disabled={busyAction||(collectionsScope===STORAGE_WORKSPACE&&!canEditCloud)} onClick={()=>setCreatingLocalCollection(true)}><Plus size={15}/> New</button>
            </div>
          </div>
          {creatingLocalCollection&&<form className="pp-local-create" onSubmit={createExplorerCollection}><input autoFocus maxLength={120} value={localCollectionName} onChange={e=>setLocalCollectionName(e.target.value)} placeholder={storageScope===STORAGE_WORKSPACE?'Cloud collection name':'Local collection name'}/><button type="submit" disabled={busyAction} title="Create collection">Add</button><button type="button" onClick={()=>setCreatingLocalCollection(false)} title="Cancel"><X size={13}/></button></form>}
          <div className="pp-side-subhead"><span>COLLECTIONS</span><span>{collectionsScope===STORAGE_LOCAL?localCollections.length:collections.length}</span></div>
          <div className="pp-side-scroll">
            {collectionsScope===STORAGE_LOCAL&&localCollections.length>0&&<>
              <LocalCollectionsTree collections={localCollections} collectionSort={collectionSort} search={explorerSearch} onOpen={openLocalRequest} onOpenExample={openLocalExample} onAction={handleLocalMenu} onMove={moveLocalRequest} onMoveFolder={moveLocalFolder} onMoveCollection={localMove}
                onOrganizeCollection={sourceId=>{setCollectionOrganizer({scope:'local',sourceId});setOrganizeDestination('root:');}} expandAllSignal={localExpandAllSignal} revealDraft={revealLocalDraft} pendingTabs={openTabs.filter(t=>t.source?.pending&&t.source.scope==='local')} onOpenPending={selectTab}/>
            </>}
            {token && collectionsScope===STORAGE_WORKSPACE ? <>
              {canEditCloud&&dragging&&<div className="pp-collection-root-zone" role="region" aria-label="Move collection or folder to Cloud root"
                onDragOver={e=>{if(isCollectionDrag(e.dataTransfer)||isFolderDrag(e.dataTransfer,CLOUD_FOLDER_DRAG)){
                  e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';
                }}}
                onDrop={e=>{
                  e.preventDefault();e.stopPropagation();
                  const collection=readCollectionDrag(e.dataTransfer);
                  if(collection?.scope==='workspace'&&collection.workspaceId===selectedWs){
                    endCollectionDrag();cloudMove(collection.collectionId,null,'root');return;
                  }
                  const folder=readFolderDrag(e.dataTransfer,CLOUD_FOLDER_DRAG);
                  if(folder?.workspaceId===selectedWs){
                    endFolderDrag();moveWorkspaceFolder({...folder,targetCollectionId:folder.collectionId,targetParentId:null});
                  }
                }}>
                Drop a collection or folder here to move it to root
              </div>}
              {cloudNodes.map(({collection:c,depth}) => {
                const opened=isWorkspaceCollectionOpen(expandedCollections,selectedWs,c.id,selectedCol);
                const requestKey=workspaceCollectionKey(selectedWs,c.id);
                const paged=Number(c.requestCount)>CLOUD_SERVER_PAGING_THRESHOLD;
                const requests=paged?[]:(workspaceRequestLists[requestKey]||[]);
                const endpointCount=paged?Number(c.requestCount)||0:cloudEndpointCount(c,workspaceRequestLists,requestKey);
                const activeCloud=activeCloudTabForCollection(openTabs,activeTabId,selectedWs,c.id);
                return <div key={c.id}>
                <div className={`pp-tree-item-container ${collectionDropTarget.startsWith(`${c.id}:`)?'pp-collection-drop-target':''} ${collectionDropTarget===`${c.id}:before`?'pp-collection-drop-before':''} ${collectionDropTarget===`${c.id}:after`?'pp-collection-drop-after':''}`} style={{'--pp-tree-depth':depth}}
                  draggable={canEditCloud}
                  onDragStart={e=>{if(!canEditCloud)return;e.stopPropagation();startCollectionDrag(e.dataTransfer,{scope:'workspace',workspaceId:selectedWs,collectionId:c.id});}}
                  onDragEnd={()=>{endCollectionDrag();setCollectionDropTarget('');}}
                  onDragOver={e=>{if(canEditCloud&&isCollectionDrag(e.dataTransfer)){
                    e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';
                    setCollectionDropTarget(`${c.id}:${collectionDropPosition(e)}`);
                  }else if(canEditCloud&&([...(e.dataTransfer.types||[])].includes(WORKSPACE_DRAG)||isFolderDrag(e.dataTransfer,CLOUD_FOLDER_DRAG))){
                    e.preventDefault();e.dataTransfer.dropEffect='move';
                  }}}
                  onDrop={e=>{
                    if(!canEditCloud)return;
                    const drag=readCollectionDrag(e.dataTransfer);
                    if(drag){e.preventDefault();e.stopPropagation();endCollectionDrag();setCollectionDropTarget('');
                      if(drag.scope==='workspace'&&drag.workspaceId===selectedWs)
                        cloudMove(drag.collectionId,c.id,collectionDropPosition(e));
                      return;
                    }
                    if(isFolderDrag(e.dataTransfer,CLOUD_FOLDER_DRAG)){
                      e.preventDefault();e.stopPropagation();
                      const item=readFolderDrag(e.dataTransfer,CLOUD_FOLDER_DRAG);
                      endFolderDrag();if(!item)return;
                      if(item.workspaceId!==selectedWs){setNotice('Folders cannot move across workspaces');return;}
                      if(item.collectionId!==c.id)
                        moveWorkspaceFolder({...item,targetCollectionId:c.id,targetParentId:null});
                      else window.dispatchEvent(new CustomEvent('pakpost:cloud-folder-drop-root',
                        {detail:{collectionId:c.id,folderId:item.folderId}}));
                      return;
                    }
                    moveWorkspaceRequest(e,c.id);
                  }}>
                  <button type="button" draggable={canEditCloud}
                    onDragStart={e=>{if(!canEditCloud)return;e.stopPropagation();startCollectionDrag(e.dataTransfer,{scope:'workspace',workspaceId:selectedWs,collectionId:c.id});}}
                    aria-expanded={opened} className={`pp-tree-row pp-cloud-collection-row pp-explorer-tree-row ${selectedCol === c.id ? 'active' : ''}`} onContextMenu={e=>showWorkspaceMenu(e,{type:'collection',collectionId:c.id,name:c.name})} title={`${c.name} · Drag to reorder, or drop into another collection`} onClick={() => toggleWorkspaceCollectionById(c.id)}>
                    {opened ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    <FolderClosed className="pp-cloud-folder-icon" size={15}/><span>{c.name}</span><small className="pp-cloud-endpoint-count" title={`${endpointCount} saved endpoints`} aria-label={`${endpointCount} saved endpoints`}>{endpointCount}</small>
                  </button>
                  <div className="pp-tree-actions">
                    <button className="pp-tree-action" type="button" title={canEditCloud?"New request in collection":"Cannot save Cloud requests with this role"} disabled={!canEditCloud} aria-label={`New request in ${c.name}`} onClick={e=>{e.stopPropagation();createCollectionDraft('workspace',c.id)}}><Plus size={15}/></button>
                    <button className="pp-tree-action" type="button" title="Collection actions" aria-label={`Actions for ${c.name}`} onClick={e=>showWorkspaceMenu(e,{type:'collection',collectionId:c.id,name:c.name})}><Settings2 size={14}/></button>
                  </div>
                </div>
                <div className={`pp-collection-motion ${opened?'is-open':''}`} aria-hidden={!opened} inert={!opened}><div className="pp-collection-motion-inner">
                <CloudFolderTree workspaceId={selectedWs} collectionId={c.id} token={token} open={opened} requests={requests}
                  collections={collections} onMoveFolder={moveWorkspaceFolder}
                  baseDepth={depth} paged={paged} virtualize={!Object.entries(expandedWorkspaceExamples).some(([key,value])=>key.startsWith(`${selectedWs}:${c.id}:`)&&value)}
                  activeTabId={activeTabId} activeRequestId={activeCloud.requestId}
                  search={explorerSearch} canEdit={canEditCloud} requestDrag={WORKSPACE_DRAG} sortByName={workspaceSorted[c.id]==='name'}
                  onNotice={setNotice} onCreateDraft={folderId=>createCollectionDraft('workspace',c.id,[],folderId)}
                  onMoveRequest={moveWorkspaceRequest} onRefreshRequests={()=>refreshCloudCollection(c.id)}
                  onRenameRequest={r=>handleWorkspaceMenu('renameRequest',{type:'request',collectionId:c.id,requestId:r.id,name:r.name})}
                  renderDraft={(folderId,depth)=>openTabs.filter(t=>t.source?.pending&&t.source.scope==='workspace'&&t.source.workspaceId===selectedWs&&t.source.collectionId===c.id&&
                    (t.source.folderId||null)===(folderId||null)).filter(t=>t.name.toLowerCase().includes(explorerSearch.toLowerCase()))
                    .map(t=><button key={t.id} type="button" className={`pp-tree-request pp-draft-request pp-explorer-tree-request ${t.id===activeCloud.pendingTabId?'pp-cloud-tab-active':''}`} aria-current={t.id===activeCloud.pendingTabId?'page':undefined} style={{'--pp-tree-depth':depth+1}} onClick={()=>selectTab(t.id)}>
                      <span className="pp-tree-disclosure-slot" aria-hidden="true"/><span className={`pp-http-label ${t.method.toLowerCase()}`}>{t.method}</span><span className="pp-tree-name">{t.name}</span><span className="pp-unsaved-dot"/>
                    </button>)}
                  renderRequest={(r,depth,selectionProps={})=>{
                  const meta=readRequestMetadata(r);
                  const examplesOpen=expandedWorkspaceExamples[`${selectedWs}:${c.id}:${r.id}`]??!!explorerSearch;
                  const tabActive=activeCloud.requestId===r.id;
                  return <React.Fragment key={r.id}><div className={`pp-tree-item-container ${requestDropTarget===`${c.id}:${r.id}:before`?'pp-request-drop-before':''} ${requestDropTarget===`${c.id}:${r.id}:after`?'pp-request-drop-after':''}`}
                    style={{'--pp-tree-depth':depth+1}} draggable={canEditCloud}
                    onDragStart={e=>{if(!canEditCloud)return;e.stopPropagation();
                      startRequestDrag(e.dataTransfer,WORKSPACE_DRAG,{collectionId:c.id,folderId:r.folderId||null,requestId:r.id});}}
                    onDragEnd={()=>{endRequestDrag();setRequestDropTarget('');}}
                    onDragOver={e=>{
                      const drag=peekRequestDrag(WORKSPACE_DRAG);
                      if(!canEditCloud||!drag||drag.collectionId!==c.id||
                        (drag.folderId||null)!==(r.folderId||null)||drag.requestId===r.id)return;
                      e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';
                      setRequestDropTarget(`${c.id}:${r.id}:${dragRowPlacement(e)}`);
                    }}
                    onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setRequestDropTarget('');}}
                    onDrop={e=>{
                      const drag=readRequestDrag(e.dataTransfer,WORKSPACE_DRAG);
                      if(!drag||drag.collectionId!==c.id||(drag.folderId||null)!==(r.folderId||null)||
                        drag.requestId===r.id)return;
                      e.preventDefault();e.stopPropagation();setRequestDropTarget('');endRequestDrag();
                      reorderWorkspaceRequest(c.id,drag.requestId,r.id,dragRowPlacement(e));
                    }}>
                    {!!meta.responseExamples?.length&&<button type="button" className="pp-endpoint-example-toggle pp-workspace-example-toggle" aria-expanded={examplesOpen} title={`${examplesOpen?'Hide':'Show'} ${meta.responseExamples.length} response examples`} aria-label={`${examplesOpen?'Collapse':'Expand'} examples for ${r.name}`} onClick={e=>{e.stopPropagation();setExpandedWorkspaceExamples(old=>({...old,[`${selectedWs}:${c.id}:${r.id}`]:!examplesOpen}));}}>{examplesOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>}
                    <button className={`pp-tree-request pp-cloud-request-row pp-explorer-tree-request ${tabActive?'pp-cloud-tab-active':''} ${selectionProps.className||''}`} data-cloud-select-key={selectionProps['data-cloud-select-key']} aria-pressed={selectionProps['aria-pressed']} aria-current={tabActive?'page':undefined} title={r.url}
                      onContextMenu={e=>{selectionProps.onContextMenu?.(e);showWorkspaceMenu(e,{type:'request',collectionId:c.id,requestId:r.id,name:r.name})}}
                      onClick={e=>{if(selectionProps.onClick?.(e)!==false)loadSavedRequest({...r,collectionId:c.id});}}><span className="pp-tree-disclosure-slot" aria-hidden="true"/><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span className="pp-tree-name">{r.name}</span></button>
                    <button className="pp-tree-action" title="Request actions" aria-label={`Actions for ${r.name}`} onClick={e=>showWorkspaceMenu(e,{type:'request',collectionId:c.id,requestId:r.id,name:r.name})}><Settings2 size={14}/></button>
                  </div>
                  {!!meta.responseExamples?.length&&<div className={`pp-collection-motion pp-example-motion ${examplesOpen?'is-open':''}`} aria-hidden={!examplesOpen} inert={!examplesOpen}><div className="pp-collection-motion-inner">{examplesOpen&&(meta.responseExamples||[]).map(example=><div key={`${r.id}:${example.id}`} className="pp-tree-item-container" style={{'--pp-tree-depth':depth+2}}>
                    <button type="button" className="pp-tree-example pp-explorer-tree-example" title={example.description||example.name} onContextMenu={e=>showWorkspaceMenu(e,{type:'example',collectionId:c.id,requestId:r.id,exampleId:example.id,name:example.name})} onClick={()=>openWorkspaceExample(r,c.id,example)}>
                      <span className="pp-tree-disclosure-slot" aria-hidden="true"/><span className={`pp-example-status ${statusTone(example.statusCode)}`}>{example.statusCode}</span><span className="pp-tree-name">{example.name}</span>
                    </button>
                    <button type="button" className="pp-tree-action" aria-label={`Actions for example ${example.name}`} onClick={e=>showWorkspaceMenu(e,{type:'example',collectionId:c.id,requestId:r.id,exampleId:example.id,name:example.name})}><Settings2 size={14}/></button>
                  </div>)}</div></div>}
                  </React.Fragment>}} />
                {opened && !paged && !Object.prototype.hasOwnProperty.call(workspaceRequestLists,workspaceCollectionKey(selectedWs,c.id)) && <div className="pp-tree-hint">Loading requests…</div>}
                </div></div>
              </div>})}
              {!collections.length && <div className="pp-tree-hint">{selectedWs?'No collections yet. Start by creating one.':'No workspace selected. Create one to store Cloud collections.'}</div>}
            </> : <>
              {!localCollections.length&&<div className="pp-tree-hint">No local collections yet. Create a collection or import one from a file.</div>}
              {!token&&<button className="pp-add-side pp-login-hint" onClick={() => setAuthOpen(true)}><LockKeyhole size={14}/> Sign in to access Cloud collections</button>}
            </>}
          </div>
          <div className="pp-explorer-bottom">
            {token&&collectionsScope===STORAGE_WORKSPACE ? <button onClick={() => navigate('workspace')}><Layers3 size={15}/> Workspace settings <ArrowRight size={14}/></button> : token ? <div className="pp-guest-notice"><span className="pp-guest-live"/><div><strong>Local storage</strong><small>Collections stay in this browser.</small></div></div> : <div className="pp-guest-notice"><span className="pp-guest-live"/><div><strong>You're in guest mode</strong><small>Sending requests doesn't require an account.</small></div></div>}
          </div>
        </>}
      </aside>
      {collectionOrganizer&&createPortal(<Dialog title="Move collection" subtitle="Reorder on the same level or nest a collection inside another. Its requests and folders stay unchanged." onClose={()=>setCollectionOrganizer(null)}>
        <form className="pp-folder-move-form" onSubmit={e=>{e.preventDefault();organize();}}>
          <label htmlFor="pp-collection-source">Collection to move</label>
          <select id="pp-collection-source" value={collectionOrganizer.sourceId}
            onChange={e=>{setCollectionOrganizer(old=>({...old,sourceId:e.target.value}));setOrganizeDestination('root:');}}>
            {organizationList.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label htmlFor="pp-collection-target">Destination</label>
          <select id="pp-collection-target" value={organizeDestination} onChange={e=>setOrganizeDestination(e.target.value)}>
            {organizationOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="pp-action-dialog-buttons"><button type="button" onClick={()=>setCollectionOrganizer(null)}>Cancel</button>
            <button type="submit" disabled={!chosen||collectionOrganizer.scope==='workspace'&&!canEditCloud} className="pp-modal-submit">Move collection</button>
          </div>
        </form>
      </Dialog>,document.body)}
</>
  );
}
