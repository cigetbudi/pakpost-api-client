import {useWorkbenchPreferences} from '../../features/settings/services/useWorkbenchPreferences.js';
import {Spinner} from '../../components/ui/AsyncFeedback.jsx';
import { WorkbenchOverlays } from './WorkbenchOverlays.jsx';
import React, { useEffect, useState } from 'react';
import { Play, Terminal } from 'lucide-react';
import { WorkbenchButton } from '../../components/ui/WorkbenchButton.jsx';
const CollectionWorkbenchPanel=React.lazy(()=>import('../../features/collections/components/CollectionWorkbenchPanel.jsx'));

/** Pure workbench renderer. No data fetching or workspace mutations. */
export function WorkbenchView({ model }) {
  const {
    X, AppHeader, GOOGLE_CLIENT_ID, Link2, LogIn, LogOut,
    RetroSelect, STORAGE_LOCAL, STORAGE_WORKSPACE, Search, Settings2, activeEnvId,
    activeWorkspace, currentEnvironments, envScope, googleLinked, isDarkAppearance, logout,
    me, openContext, selectedWs, setActiveEnvId, setAuthOpen, setCommandIndex,
    setCommandOpen, setCommandQuery, setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword, storageScope,
    theme, token, updateStorageScope, workspaces, page, settingsCategory, setSettingsCategory, sidebarCollapsed,
    rightWidth, WorkbenchNavigation, Code2, FileUp, History, Layers3,
    PanelLeftClose, PanelLeftOpen, Variable, endRightResize, explorerTab,
    resizeRight, resizingRight, setPage, setRightWidth, setSidebarCollapsed, WorkbenchExplorer,
    environmentContext, selfMember, openTabs, activeTabId, localEnvironments, localCollections,
    recent, collectionsScope, explorerSearch, collectionSort,
    busyAction, canEditCloud, creatingLocalCollection, localCollectionName, collections, visibleLocalCollections,
    localExpandAllSignal, revealLocalDraft, visibleCollections, expandedCollections, selectedCol, workspaceRequestLists,
    WORKSPACE_DRAG, workspaceSorted, expandedWorkspaceExamples, setSelectedWs, setExpandedCollections, navigate, setAuthMode,
    persistEnvironment, createEnvironment, deleteEnvironment, duplicateEnvironment, openExportChoice, importEnvironmentFile,
    codePreviewRequest, buildCodeRequest, snapshot, importRequestsAndEnvironments, setNotice, loadRequest,
    setWsTab, setExplorerSearch, setCollectionSort, expandOrCollapseAllCollections, openCollectionImport,
    setCreatingLocalCollection, createExplorerCollection, setLocalCollectionName, openLocalRequest, openLocalExample, handleLocalMenu,
    moveLocalRequest, moveLocalFolder, moveLocalCollection, moveWorkspaceCollection, selectTab, moveWorkspaceFolder, reorderWorkspaceRequest, moveWorkspaceRequest, showWorkspaceMenu, refreshCloudCollection, toggleWorkspaceCollectionById, createCollectionDraft,
    setExpandedWorkspaceExamples, loadSavedRequest, openWorkspaceExample, draftsRef, CodeSidebar, ImportExportSidebar,
    WorkbenchSettings, setTheme, split, setSplit, interceptorMode, setInterceptorMode,
    extensionStatus, refreshExtensionStatus, RequestTabs, requestWorkbenchStore, remoteAlerts, tabDragRef,
    closeTab, showTabContext, setTabMenu, addTab, runnerLoading, openRunnerForCurrentCollection,
    runnerTarget, CollectionRunner, closeRunner, api, dispatchRequest,
    consoleOpen, setConsoleOpen, PakpostConsole, consoleEvents, clearConsoleEvents, navigateConsoleEvent, realtimeStatus, openRequestHistory, workspaceMenu, MenuActionItem,
    handleWorkspaceMenu, setWorkspaceMenu, tabMenu, performTabAction, Copy, openSaveAs, Save,
    ArrowRight, AlertTriangle, showConflictDialog, RequestWorkbench, AUTH_OPTIONS, ChevronRight,
    Columns2, KeyValueEditor, LayoutPanelTop, METHODS, Pencil, RequestBody,
    ResponsePane, ScriptEditor, Send, ShieldCheck, Suspense, TextEditor,
    VariableAwareInput, VariableUrlInput, activeRequestName, apiKeyIn, apiKeyName, apiKeyValue,
    authType, basicPassword, basicUsername, bearerToken, beautifyBody, beautifyResult,
    beginRequestRename, binaryFile, body, cancelRequestRename, draggingRef, editingRequestName,
    finishRequestRename, formFields, format, headerCount, importCurlIntoCurrent, isCurl,
    isReadOnlyCloudTab, loading, method, onSplitterEnd, onSplitterMove, openSaveExampleDialog,
    panesRef, params, postScript, preScript, reqTab, requestNameInputRef,
    resTab, resetSandboxRequest, responseExamples, responsePretty, responseText, responseType,
    result, rows, saveCurrent, scriptDiagnostic, scriptError, scriptJump,
    scriptLog, scriptTests, selectFormat, sendRequest, cancelRequest, canCancelRequest, setApiKeyIn, setApiKeyName,
    setApiKeyValue, setAuthType, setBasicPassword, setBasicUsername, setBearerToken, setBinaryFile,
    setBody, setCurrentRequestName, setFormFields, setMethod, setOpenTabs, setParams,
    setPostScript, setPreScript, setReqTab, setResTab, setResponsePretty, setRows,
    setScriptDiagnostic, setScriptError, setScriptJump, setUrl, splitPercent, setSplitPercent, url,
    variableUi, WorkspaceManager, canCreateWorkspace, newWs, wsTab, newCollection,
    savedRequests, canManageMembers, showMemberAdd, inviteOpen, workspaceMemberStats, newMember, newMemberRoles,
    assignableRoles, inviteEmail, inviteRoles, invitationBusy, invitationRows, invitationError,
    memberSearch, memberRoleFilter, visibleWorkspaceMembers, canAssignRoles, expandedMemberAccess, editingMemberId,
    editingMemberRoles, doAction, setNewWs, loadWorkspaces, setNewCollection, setCollections,
    setSelectedCol, setSavedRequests,
    setShowMemberAdd, setInviteOpen, setNewMember, setNewMemberRoles, setMembers, inviteMember,
    setInviteEmail, setInviteRoles, actOnInvitation, setMemberSearch, setMemberRoleFilter, setExpandedMemberAccess,
    setEditingMemberId, setEditingMemberRoles, removeWorkspaceMember, selectedWorkspaceRef, currentTokenRef,
  } = model;
  const {collectionWorkbench,collectionPanelContext}=model;
  const collectionActive=page==='tester'&&!!collectionWorkbench.activeId;
  const [responseMode, setResponseMode] = useState(() => window.matchMedia('(max-width: 760px)').matches ? 'collapsed' : 'expanded');
  const preferences=useWorkbenchPreferences();
  useEffect(()=>{
    const root=document.documentElement;
    root.dataset.ppDensity=preferences.density;
    root.dataset.ppMotion=preferences.motion?'on':'off';
    return()=>{delete root.dataset.ppDensity;delete root.dataset.ppMotion;};
  },[preferences.density,preferences.motion]);
  useEffect(()=>{
    if(loading&&preferences.autoExpandResponse){
      setResponseMode(previous=>window.matchMedia('(max-width: 760px)').matches?'maximized':previous==='collapsed'?'expanded':previous);
    }
  },[loading,preferences.autoExpandResponse]);
  const [wideLayout, setWideLayout] = useState(() => window.matchMedia('(min-width: 981px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 981px)');
    const update = () => setWideLayout(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  const effectiveSplit = wideLayout ? split : 'horizontal';
  // Collapse once when entering a narrow window; manual toggles remain available.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 960px)');
    const adapt = () => { if (query.matches) setSidebarCollapsed(true); };
    adapt();
    query.addEventListener('change', adapt);
    return () => query.removeEventListener('change', adapt);
  }, [setSidebarCollapsed]);
  const [runnerMinimized, setRunnerMinimized] = useState(false);
  // A newly opened Runner opens in the bottom dock. Switching to Console
  // hides (rather than unmounts) Runner so its run state and results survive.
  useEffect(() => { if (runnerTarget) { setRunnerMinimized(false); setConsoleOpen(false); } }, [runnerTarget, setConsoleOpen]);
  return <div className="pp-app pp-adaptive-workbench">
<AppHeader {...{        GOOGLE_CLIENT_ID, Link2, LogIn, LogOut, RetroSelect, STORAGE_LOCAL,
        STORAGE_WORKSPACE, Search, Settings2, activeEnvId, activeWorkspace, currentEnvironments,
        envScope, googleLinked, isDarkAppearance, logout, me, openContext,
        selectedWs, setActiveEnvId, setAuthOpen, setCommandIndex, setCommandOpen, setCommandQuery,
        setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword, storageScope, theme, token,
        updateStorageScope, workspaces, setPage, setSettingsCategory,
        onOpenSecurity:()=>{setSettingsCategory('security');setPage('settings');},}}/>

    <div className={`pp-main-frame ${page==='settings'?'pp-view-settings':page==='workspace'?'pp-view-workspace':'pp-view-tester'} ${sidebarCollapsed?'pp-navigator-collapsed':''}`} style={{'--pp-context-panel-width':`${rightWidth}px`}}>
<WorkbenchNavigation {...{        Code2, FileUp, History, Layers3, PanelLeftClose, PanelLeftOpen,
        Settings2, Variable, endRightResize, explorerTab, openContext,
        page, resizeRight, resizingRight, setPage, setRightWidth, setSidebarCollapsed,
        sidebarCollapsed,}}/>

      {page==='tester' && !sidebarCollapsed && <button type="button" className="pp-aw-drawer-backdrop" aria-label="Dismiss context panel" onClick={()=>setSidebarCollapsed(true)}/>}
      {page==='tester' && !sidebarCollapsed && <WorkbenchExplorer
  data={{
    explorerTab, token, envScope, selectedWs, workspaces,
    environmentContext, currentEnvironments, activeEnvId, activeWorkspace, selfMember,
    theme, openTabs, activeTabId, localEnvironments, localCollections,
    recent, collectionsScope, explorerSearch,
    collectionSort, busyAction, canEditCloud, creatingLocalCollection, localCollectionName,
    storageScope, collections, visibleLocalCollections, localExpandAllSignal, revealLocalDraft,
    visibleCollections, expandedCollections, selectedCol, workspaceRequestLists, WORKSPACE_DRAG,
    workspaceSorted, expandedWorkspaceExamples,
  }}
  actions={{
    setSidebarCollapsed, setSelectedWs, setExpandedCollections, navigate, setAuthMode, setAuthOpen,
    setActiveEnvId, persistEnvironment, createEnvironment, deleteEnvironment, duplicateEnvironment,
    openExportChoice, importEnvironmentFile, codePreviewRequest, buildCodeRequest, snapshot,
    importRequestsAndEnvironments, setNotice, loadRequest,
    setExplorerSearch, setCollectionSort, expandOrCollapseAllCollections, openCollectionImport, setCreatingLocalCollection,
    createExplorerCollection, setLocalCollectionName, openLocalRequest, openLocalExample, handleLocalMenu,
    moveLocalRequest, moveLocalFolder, moveLocalCollection, moveWorkspaceCollection, selectTab, moveWorkspaceFolder, reorderWorkspaceRequest, moveWorkspaceRequest, showWorkspaceMenu, handleWorkspaceMenu, refreshCloudCollection, toggleWorkspaceCollectionById,
    createCollectionDraft, setExpandedWorkspaceExamples, loadSavedRequest, openWorkspaceExample,
  }}
  refs={{
    draftsRef,
  }}
  deferred={{
    CodeSidebar, ImportExportSidebar,
  }}
/>}
      <main className="pp-content">
        {page==='settings'&&<WorkbenchSettings category={settingsCategory} onCategoryChange={setSettingsCategory} theme={theme} onThemeChange={setTheme} token={token} me={me} split={split} onSplitChange={setSplit} interceptorMode={interceptorMode} onInterceptorChange={setInterceptorMode} extensionStatus={extensionStatus} onCheckExtension={refreshExtensionStatus} onBack={()=>setPage('tester')} onOpenEnvironments={()=>{setPage('tester');openContext('environments')}} onOpenImportExport={()=>{setPage('tester');openContext('exchange')}}/>}
        <RequestTabs collectionWorkbench={collectionWorkbench} onActivateCollection={id=>{collectionWorkbench.activate(id);setPage('tester');}} store={requestWorkbenchStore} page={page} remoteAlerts={remoteAlerts} snapshot={snapshot} draftsRef={draftsRef} tabDragRef={tabDragRef} selectTab={selectTab} closeTab={closeTab} showTabContext={showTabContext} setTabMenu={setTabMenu} addTab={addTab} navigate={navigate} token={token} collectionsScope={collectionsScope} realtimeStatus={realtimeStatus} openRequestHistory={openRequestHistory}/>
        {workspaceMenu&&<div className="pp-collection-popup" role="menu" style={{left:workspaceMenu.x,top:workspaceMenu.y}}>
          {(workspaceMenu.type==='collection'?[
            ['newRequest','New request'],['newFolder','New folder'],['organizeFolders','Move folder…'],['organizeCollection','Move collection…'],['runCollection','Run collection'],['variables','Variables'],['documentation','Documentation'],['renameCollection','Rename'],['duplicateCollection','Duplicate collection'],['sortCollection','Sort by name'],['exportCollection','Export collection'],['deleteCollection','Delete collection']
          ]:workspaceMenu.type==='example'?[
            ['renameExample','Rename example'],['deleteExample','Delete example']
          ]:[['versionHistory','Version history'],['documentation','Documentation'],['renameRequest','Rename'],['duplicateRequest','Duplicate'],['deleteRequest','Delete']]).map(([id,label])=>
            <MenuActionItem key={id} action={id} disabled={!canEditCloud && !['exportCollection','documentation','variables','runCollection','versionHistory'].includes(id)} danger={id.startsWith('delete')} onClick={()=>{if(id==='organizeCollection'){
              window.dispatchEvent(new CustomEvent('pakpost:collection-organizer',
                {detail:{scope:'workspace',workspaceId:selectedWs,collectionId:workspaceMenu.collectionId}}));
              setWorkspaceMenu(null);
            }else if(id==='organizeFolders'){
              window.dispatchEvent(new CustomEvent('pakpost:cloud-folder-organizer',
                {detail:{workspaceId:selectedWs,collectionId:workspaceMenu.collectionId}}));
              setWorkspaceMenu(null);
            }else handleWorkspaceMenu(id,workspaceMenu);}}>{label}</MenuActionItem>)}
        </div>}
        {tabMenu&&<div className="pp-tab-context" role="menu" style={{left:tabMenu.x,top:tabMenu.y}} onContextMenu={e=>e.preventDefault()}>
          <button role="menuitem" onClick={()=>performTabAction('pin',tabMenu.id)}>{openTabs.find(t=>t.id===tabMenu.id)?.pinned?'Unpin tab':'Pin tab'}</button>
          <button role="menuitem" onClick={()=>performTabAction('duplicate',tabMenu.id)}><Copy size={14}/> Duplicate tab</button>
          <button role="menuitem" onClick={()=>{selectTab(tabMenu.id);setTabMenu(null);setTimeout(()=>openSaveAs(),0);}}><Save size={14}/> Save as new request</button>

          <div className="pp-context-divider"/>
          <button role="menuitem" onClick={()=>performTabAction('close',tabMenu.id)}><X size={14}/> Close tab</button>
          <button role="menuitem" disabled={openTabs.length<=1} onClick={()=>performTabAction('others',tabMenu.id)}><Layers3 size={14}/> Close other tabs</button>
          <button role="menuitem" disabled={openTabs.findIndex(t=>t.id===tabMenu.id)>=openTabs.length-1} onClick={()=>performTabAction('right',tabMenu.id)}><ArrowRight size={14}/> Close tabs to the right</button>
        </div>}

        {page==='tester'&&!collectionActive&&remoteAlerts[activeTabId]&&<div className="pp-conflict-conflict-banner" role="status">
          <AlertTriangle size={17}/><span><strong>{remoteAlerts[activeTabId].kind==='deleted'?'Cloud request deleted or moved':'A newer Cloud version is available'}</strong><small>Your current draft was not overwritten. Review before saving.</small></span>
          <button type="button" onClick={()=>showConflictDialog(activeTabId)}>Review / Resync</button>
        </div>}
        {collectionWorkbench.tabs.map(tab=><Suspense key={tab.id} fallback={collectionActive&&collectionWorkbench.activeId===tab.id?<div className="pp-feature-loading"><Spinner label="Opening collection settings…"/></div>:null}>
          <CollectionWorkbenchPanel tab={tab} active={collectionActive&&collectionWorkbench.activeId===tab.id}
            context={collectionPanelContext} onReport={collectionWorkbench.report} onClose={collectionWorkbench.close}/>
        </Suspense>)}
        {page === 'tester' ? !collectionActive&&<RequestWorkbench key={`${me?.id||'guest'}:${selectedWs||'local'}:${activeTabId}`} responseMode={responseMode} setResponseMode={setResponseMode} {...{        AUTH_OPTIONS, ChevronRight, Code2, Columns2, History, KeyValueEditor,
        LayoutPanelTop, Link2, METHODS, Pencil, RequestBody, ResponsePane,
        RetroSelect, Save, ScriptEditor, Send, ShieldCheck, Suspense,
        TextEditor, VariableAwareInput, VariableUrlInput, activeRequestName, activeTabId, apiKeyIn,
        apiKeyName, apiKeyValue, authType, basicPassword, basicUsername, bearerToken,
        beautifyBody, beautifyResult, beginRequestRename, binaryFile, body, busyAction,
        canEditCloud, cancelRequestRename, draggingRef, editingRequestName, finishRequestRename, formFields,
        format, headerCount, importCurlIntoCurrent, isCurl, isDarkAppearance, isReadOnlyCloudTab,
        loading, method, onSplitterEnd, onSplitterMove, openSaveAs, openSaveExampleDialog,
        openTabs, panesRef, params, postScript, preScript, reqTab,
        requestNameInputRef, resTab, resetSandboxRequest, responseExamples, responsePretty, responseText,
        responseType, result, rows, saveCurrent, scriptDiagnostic, scriptError,
        scriptJump, scriptLog, scriptTests, selectFormat, selectedWs, sendRequest, cancelRequest, canCancelRequest,
        setApiKeyIn, setApiKeyName, setApiKeyValue, setAuthType, setBasicPassword, setBasicUsername,
        setBearerToken, setBinaryFile, setBody, setCurrentRequestName, setFormFields, setMethod,
        setNotice, setOpenTabs, setParams, setPostScript, setPreScript, setReqTab,
        setResTab, setResponsePretty, setRows, setScriptDiagnostic, setScriptError, setScriptJump,
        setSplit, setUrl, split: effectiveSplit, wideLayout, splitPercent, setSplitPercent, theme, url,
        variableUi,}}/> : page === 'workspace' ? <Suspense fallback={<div className="pp-feature-loading" role="status"><Spinner label="Opening Workspace…"/></div>}><WorkspaceManager
  data={{
    activeWorkspace, workspaces, canCreateWorkspace, newWs, token,
    busyAction, selectedWs, wsTab, canEditCloud, newCollection,
    collections, selectedCol, savedRequests,
    canManageMembers, showMemberAdd, inviteOpen, workspaceMemberStats, newMember,
    newMemberRoles, assignableRoles, inviteEmail, inviteRoles, invitationBusy,
    invitationRows, invitationError, memberSearch, memberRoleFilter, visibleWorkspaceMembers,
    me, canAssignRoles, expandedMemberAccess, editingMemberId, editingMemberRoles,
  }}
  actions={{
    setPage, doAction, setNewWs, loadWorkspaces, setSelectedWs,
    setNotice, setWsTab, setNewCollection, setCollections, setSelectedCol,
    loadSavedRequest, setSavedRequests, setShowMemberAdd, setInviteOpen, setNewMember,
    setNewMemberRoles, setMembers, inviteMember, setInviteEmail, setInviteRoles,
    actOnInvitation, setMemberSearch, setMemberRoleFilter, setExpandedMemberAccess, setEditingMemberId,
    setEditingMemberRoles, removeWorkspaceMember,
  }}
  refs={{
    selectedWorkspaceRef, currentTokenRef,
  }}
/></Suspense> : null}
      </main>
    </div>
    {runnerTarget && <div className="pp-aw-runner-dock" hidden={consoleOpen||runnerMinimized}>
      <Suspense fallback={<div className="pp-adaptive-console-loading" role="status"><Spinner label="Opening Collection Runner…"/></div>}>
        <CollectionRunner key={`${runnerTarget.scope}:${runnerTarget.workspaceId||''}:${runnerTarget.collectionId}`}
          target={runnerTarget} requests={runnerTarget.requests} environmentVariables={runnerTarget.environmentVariables}
          collectionVariables={runnerTarget.collectionVariables} onClose={closeRunner}
          send={command=>runnerTarget.transport==='proxy'
            ?api('/api/proxy/send','POST',command)
            :dispatchRequest(command,runnerTarget.transport)}/>
      </Suspense>
    </div>}
    {consoleOpen && <Suspense fallback={<div className="pp-adaptive-console-loading" role="status"><Spinner label="Opening Console…"/></div>}>
      <PakpostConsole events={consoleEvents} onClose={()=>setConsoleOpen(false)} onClear={clearConsoleEvents} onNavigate={navigateConsoleEvent}/>
    </Suspense>}
    <footer className="pp-global-footer"><div className="pp-bottom-tools">
      <WorkbenchButton icon={Terminal} active={consoleOpen} aria-label="Toggle PakPost Console" aria-expanded={consoleOpen} onClick={()=>setConsoleOpen(v=>!v)}>Console</WorkbenchButton>
      <WorkbenchButton icon={Play} active={!!runnerTarget&&!consoleOpen&&!runnerMinimized} aria-expanded={!!runnerTarget&&!consoleOpen&&!runnerMinimized} disabled={runnerLoading} onClick={()=>{if(!runnerTarget){openRunnerForCurrentCollection();return;}if(consoleOpen){setRunnerMinimized(false);setConsoleOpen(false);}else setRunnerMinimized(v=>!v);}} title="Open Collection Runner">{runnerLoading?'Loading…':'Runner'}</WorkbenchButton>
      <span className="pp-bottom-brand">PakPost</span>
    </div><span className="pp-footer-center">{interceptorMode==='native'?'Desktop Native · Direct from this computer':interceptorMode==='proxy'?'Secure proxy · Private networks blocked':interceptorMode==='extension'?'Browser extension · Destination access managed in popup':'Browser · CORS restrictions apply'}</span><span>UTF-8 <span className="pp-footer-divider">·</span> {effectiveSplit === 'horizontal' ? 'Stacked' : 'Side-by-side'}</span></footer>
      <WorkbenchOverlays model={model}/>
  </div>;
}
