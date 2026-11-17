import React from 'react';
import { PanelLeftClose, Layers3, Settings2, LockKeyhole, ChevronRight, History, Users, Plus, Search, ChevronsUpDown, ChevronsDownUp, FileUp, X, ChevronDown, FolderClosed, ArrowRight } from 'lucide-react';
import { RetroSelect } from '../../RetroSelect.jsx';
import { EnvironmentExplorer } from '../../EnvironmentExplorer.jsx';
import { LocalCollectionsTree } from '../../LocalCollectionsTree.jsx';
import { isDarkAppearance } from '../../appearance.js';
import { canWorkspace } from '../../workspaceRoles.js';
import { STORAGE_LOCAL, STORAGE_WORKSPACE, cloudEndpointCount } from '../../storageScope.js';
import { isWorkspaceCollectionOpen, workspaceCollectionKey } from '../../collectionExpansion.js';
import { decodeStoredHeaders } from '../../requestMetadata.js';
import { statusTone } from '../../responseExamples.js';

// Only the visible explorer mounts. Code generator and import/export panels are
// still supplied lazily by the workbench; this module never fetches user data.
export function WorkbenchExplorer({ data, actions, refs, deferred }) {
  const { explorerTab, token, envScope, selectedWs, workspaces, environmentContext } = data;
  const { currentEnvironments, activeEnvId, activeWorkspace, selfMember, theme, openTabs } = data;
  const { activeTabId, localEnvironments, localCollections, recent, teams, selectedTeam } = data;
  const { collectionsScope, explorerSearch, collectionSort, busyAction, canEditCloud, creatingLocalCollection } = data;
  const { localCollectionName, storageScope, collections, visibleLocalCollections, localExpandAllSignal, revealLocalDraft } = data;
  const { visibleCollections, expandedCollections, selectedCol, workspaceRequestLists, WORKSPACE_DRAG, workspaceSorted } = data;
  const { expandedWorkspaceExamples } = data;
  const { setSidebarCollapsed, setSelectedWs, navigate, setAuthMode, setAuthOpen, setActiveEnvId } = actions;
  const { persistEnvironment, createEnvironment, deleteEnvironment, duplicateEnvironment, openExportChoice, importEnvironmentFile } = actions;
  const { codePreviewRequest, buildCodeRequest, snapshot, importRequestsAndEnvironments, setNotice, loadRequest } = actions;
  const { setSelectedTeam, setWsTab, setExplorerSearch, setCollectionSort, expandOrCollapseAllCollections, openCollectionImport } = actions;
  const { setCreatingLocalCollection, createExplorerCollection, setLocalCollectionName, openLocalRequest, openLocalExample, handleLocalMenu } = actions;
  const { moveLocalRequest, selectTab, moveWorkspaceRequest, showWorkspaceMenu, toggleWorkspaceCollectionById, createCollectionDraft } = actions;
  const { setExpandedWorkspaceExamples, loadSavedRequest, openWorkspaceExample } = actions;
  const { draftsRef } = refs;
  const { CodeSidebar, ImportExportSidebar } = deferred;

  return (
<aside className="pp-explorer">
        <div className="pp-explorer-title"><strong>{explorerTab === 'collections' ? 'Collections' : explorerTab === 'history' ? 'History' : explorerTab === 'code' ? 'Generate Code' : explorerTab === 'exchange' ? 'Import / Export' : explorerTab === 'environments' ? 'Environments' : 'Teams'}</strong><button title="Collapse sidebar" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={16}/></button></div>
        {explorerTab === 'environments' ? <>
          {token&&envScope===STORAGE_WORKSPACE&&<div className="pp-compact-workspace"><Layers3 size={15}/><span>Workspace</span><RetroSelect ariaLabel="Switch environment workspace" title="Switch workspace" value={selectedWs} onChange={setSelectedWs} options={workspaces.map(w=>({value:w.id,label:w.name}))}/><button type="button" title="Manage workspace" aria-label="Manage workspace" onClick={()=>navigate('workspace')}><Settings2 size={15}/></button></div>}
          {!token&&<button className="pp-link-row pp-login-hint" onClick={()=>{setAuthMode('login');setAuthOpen(true)}}><LockKeyhole size={14}/> Sign in to access Cloud environments <ChevronRight size={13}/></button>}
          <EnvironmentExplorer key={environmentContext||'cloud-pending'} items={currentEnvironments} selected={activeEnvId} onSelect={setActiveEnvId} onSave={persistEnvironment} onCreate={createEnvironment} onDelete={deleteEnvironment} onDuplicate={duplicateEnvironment} onExport={environment=>openExportChoice({kind:'environment',name:environment.name,environment})} onImportFile={importEnvironmentFile} authenticated={!!token} workspaceName={activeWorkspace?.name||''} readOnly={envScope===STORAGE_WORKSPACE&&!canWorkspace(selfMember,'environment.write')} onLogin={()=>{setAuthMode('login');setAuthOpen(true)}} scope={envScope===STORAGE_WORKSPACE?`Cloud · ${activeWorkspace?.name||'Choose workspace'}`:'Local · Browser'}/>
        </> : explorerTab === 'code' ? <CodeSidebar request={codePreviewRequest()} buildResolved={buildCodeRequest} theme={isDarkAppearance(theme)?'dark':'light'}/> : explorerTab === 'exchange' ?
          <ImportExportSidebar requests={openTabs.map(t=>({...draftsRef.current[t.id],...(t.id===activeTabId?snapshot():{}),name:t.name}))}
            environments={localEnvironments} localCollections={localCollections} onImport={importRequestsAndEnvironments} onMessage={setNotice} authenticated={!!token} workspaceName={activeWorkspace?.name||''} onLogin={()=>{setAuthMode('login');setAuthOpen(true)}} theme={isDarkAppearance(theme)?'dark':'light'}/> : explorerTab === 'history' ? <>
          <div className="pp-side-subhead"><span>RECENT REQUESTS</span><span>{recent.length}</span></div>
          {recent.length ? <div className="pp-side-scroll">{recent.map((r, i) => <button key={`${i}-${r.url}`} className="pp-history-item" onClick={() => loadRequest(r)}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span className="pp-history-main"><strong>{(() => { try { return new URL(r.url).pathname || '/'; } catch { return r.url; } })()}</strong><small>{r.url}</small></span><span className={r.status < 400 ? 'pp-history-ok' : 'pp-history-bad'}>{r.status}</span></button>)}</div> : <div className="pp-explorer-empty"><History size={23}/><strong>No history yet</strong><span>Requests you send during this session will appear here.</span></div>}
        </> : explorerTab === 'teams' ? <>
          {token ? <><div className="pp-side-subhead"><span>TEAMS · {activeWorkspace?.name || 'WORKSPACE'}</span></div><div className="pp-side-scroll">{teams.map(t => <button key={t.id} className={`pp-tree-row ${selectedTeam === t.id ? 'active' : ''}`} onClick={() => { setSelectedTeam(t.id); navigate('workspace'); setWsTab('teams'); }}><Users size={15}/><span>{t.name}</span></button>)}<button className="pp-add-side" onClick={() => { navigate('workspace'); setWsTab('teams'); }}><Plus size={15}/> Manage teams</button></div></> : <div className="pp-explorer-empty"><LockKeyhole size={22}/><strong>Teams are private</strong><span>Sign in to collaborate with other members.</span><button className="pp-small-primary" onClick={() => setAuthOpen(true)}>Sign in</button></div>}
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
              <LocalCollectionsTree collections={visibleLocalCollections} search={explorerSearch} onOpen={openLocalRequest} onOpenExample={openLocalExample} onAction={handleLocalMenu} onMove={moveLocalRequest} expandAllSignal={localExpandAllSignal} revealDraft={revealLocalDraft} pendingTabs={openTabs.filter(t=>t.source?.pending&&t.source.scope==='local')} onOpenPending={selectTab}/>
            </>}
            {token && collectionsScope===STORAGE_WORKSPACE ? <>
              {visibleCollections.map(c => {
                const opened=isWorkspaceCollectionOpen(expandedCollections,selectedWs,c.id,selectedCol);
                const requestKey=workspaceCollectionKey(selectedWs,c.id);
                const requests=workspaceRequestLists[requestKey]||[];
                const endpointCount=cloudEndpointCount(c,workspaceRequestLists,requestKey);
                return <div key={c.id}>
                <div className="pp-tree-item-container" onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(WORKSPACE_DRAG))e.preventDefault()}} onDrop={e=>moveWorkspaceRequest(e,c.id)}>
                  <button type="button" aria-expanded={opened} className={`pp-tree-row ${selectedCol === c.id ? 'active' : ''}`} onContextMenu={e=>showWorkspaceMenu(e,{type:'collection',collectionId:c.id,name:c.name})} onClick={() => toggleWorkspaceCollectionById(c.id)}>
                    {opened ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    <FolderClosed size={15}/><span>{c.name}</span><small className="pp-cloud-endpoint-count" title={`${endpointCount} saved endpoints`} aria-label={`${endpointCount} saved endpoints`}>{endpointCount}</small>
                  </button>
                  <div className="pp-tree-actions">
                    <button className="pp-tree-action" type="button" title={canEditCloud?"New request in collection":"Cannot save Cloud requests with this role"} disabled={!canEditCloud} aria-label={`New request in ${c.name}`} onClick={e=>{e.stopPropagation();createCollectionDraft('workspace',c.id)}}><Plus size={15}/></button>
                    <button className="pp-tree-action" type="button" title="Collection actions" aria-label={`Actions for ${c.name}`} onClick={e=>showWorkspaceMenu(e,{type:'collection',collectionId:c.id,name:c.name})}><Settings2 size={14}/></button>
                  </div>
                </div>
                <div className={`pp-collection-motion ${opened?'is-open':''}`} aria-hidden={!opened} inert={!opened}><div className="pp-collection-motion-inner">
                {[...requests].filter(r => `${r.name} ${r.url}`.toLowerCase().includes(explorerSearch.toLowerCase())).sort((a,b)=>workspaceSorted[c.id]==='name'?a.name.localeCompare(b.name):0).map(r => {
                  const meta=decodeStoredHeaders(r.headersJson);
                  const examplesOpen=expandedWorkspaceExamples[`${selectedWs}:${c.id}:${r.id}`]??!!explorerSearch;
                  return <React.Fragment key={r.id}><div className="pp-tree-item-container" draggable={canEditCloud} onDragStart={e=>{if(!canEditCloud)return;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(WORKSPACE_DRAG,JSON.stringify({collectionId:c.id,requestId:r.id}));}}>
                    {!!meta.responseExamples?.length&&<button type="button" className="pp-endpoint-example-toggle pp-workspace-example-toggle" aria-expanded={examplesOpen} title={`${examplesOpen?'Hide':'Show'} ${meta.responseExamples.length} response examples`} aria-label={`${examplesOpen?'Collapse':'Expand'} examples for ${r.name}`} onClick={e=>{e.stopPropagation();setExpandedWorkspaceExamples(old=>({...old,[`${selectedWs}:${c.id}:${r.id}`]:!examplesOpen}));}}>{examplesOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>}
                    <button className="pp-tree-request" title={r.url} onContextMenu={e=>showWorkspaceMenu(e,{type:'request',collectionId:c.id,requestId:r.id,name:r.name})} onClick={() => loadSavedRequest({...r,collectionId:c.id})}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span>{r.name}</span></button>
                    <button className="pp-tree-action" title="Request actions" aria-label={`Actions for ${r.name}`} onClick={e=>showWorkspaceMenu(e,{type:'request',collectionId:c.id,requestId:r.id,name:r.name})}><Settings2 size={14}/></button>
                  </div>
                  {!!meta.responseExamples?.length&&<div className={`pp-collection-motion pp-example-motion ${examplesOpen?'is-open':''}`} aria-hidden={!examplesOpen} inert={!examplesOpen}><div className="pp-collection-motion-inner">{(meta.responseExamples||[]).map(example=><div key={`${r.id}:${example.id}`} className="pp-tree-item-container">
                    <button type="button" className="pp-tree-example" style={{paddingLeft:46}} title={example.description||example.name} onContextMenu={e=>showWorkspaceMenu(e,{type:'example',collectionId:c.id,requestId:r.id,exampleId:example.id,name:example.name})} onClick={()=>openWorkspaceExample(r,c.id,example)}>
                      <span className={`pp-example-status ${statusTone(example.statusCode)}`}>{example.statusCode}</span><span>{example.name}</span>
                    </button>
                    <button type="button" className="pp-tree-action" aria-label={`Actions for example ${example.name}`} onClick={e=>showWorkspaceMenu(e,{type:'example',collectionId:c.id,requestId:r.id,exampleId:example.id,name:example.name})}><Settings2 size={14}/></button>
                  </div>)}</div></div>}
                  </React.Fragment>})}
                {openTabs.filter(t=>t.source?.pending&&t.source.scope==='workspace'&&t.source.workspaceId===selectedWs&&t.source.collectionId===c.id)
                  .filter(t=>t.name.toLowerCase().includes(explorerSearch.toLowerCase()))
                  .map(t=><button key={t.id} type="button" className="pp-tree-request pp-draft-request" onClick={()=>selectTab(t.id)} title="Unsaved draft — click to edit">
                    <span className={`pp-http-label ${t.method.toLowerCase()}`}>{t.method}</span><span>{t.name}</span><span className="pp-unsaved-dot" title="Not saved"/>
                  </button>)}
                {opened && !Object.prototype.hasOwnProperty.call(workspaceRequestLists,workspaceCollectionKey(selectedWs,c.id)) && <div className="pp-tree-hint">Loading requests…</div>}
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
  );
}
