import React from 'react';

/** Dialogs, menus and transient overlays owned by the Workbench. */
export function WorkbenchOverlays({ model }) {
  const {
    X, CommandPalette, ArrowRight, Code2, Search, commandIndex,
    commandOpen, commandQuery, setCommandIndex, setCommandOpen, setCommandQuery, visibleCommandItems,
    notice, createPortal, setNotice, body, CollectionDialogs, ArrowDownToLine,
    Braces, CollectionVariablesEditor, Dialog, DocumentationEditor, FileJson, Suspense,
    applyCollectionVariableSession, canWorkspace, collectionTargetKey, collectionVariablesBusy, collectionVariablesData, collectionVariablesError,
    collectionVariablesFetchId, collectionVariablesLoading, collectionVariablesTarget, confirmExport, docBusy, documentationTarget,
    exportChoice, exportFormat, exportIncludeSecrets, readCollectionVariables, reloadCollectionVariables, resetCollectionVariableSession,
    saveCollectionVariableDefaults, saveDocumentation, selfMember, sessionCollectionVariables, setCollectionVariablesTarget, setDocumentationTarget,
    setExportChoice, setExportFormat, setExportIncludeSecrets, AuthOverlays, inviteToken, inviteAcceptError,
    me, token, acceptingInvite, googleLinked, authOpen, authMode,
    authForm, authError, authBusy, googleLinkOpen, googleLinkPassword, googleLinkError,
    setInviteToken, setInviteAcceptError, acceptInvitation, setAuthMode, setAuthOpen, setAuthForm,
    submitAuth, submitGoogleAuth, setAuthError, setGoogleLinkOpen, setGoogleLinkPassword, submitGoogleLink,
    setGoogleLinkError, RequestDialogs, FileUp, ImportDestinationPicker, RequestRevisionPanel, RetroSelect,
    Save, actionDialog, actionName, activeSource, activeTabId, activeWorkspace,
    applyMergedRevision, busyAction, canEditCloud, closeConfirmation, collectionImportBusy, collectionImportDestination,
    collectionImportError, collectionImportFile, collectionImportOpen, conflictDialog, draftsRef, exampleDescription,
    exampleName, executeActionDialog, isReadOnlyCloudTab, localCollections, openTabs, performTabAction,
    reloadCloudConflict, restoreRequestRevision, result, saveCollection, saveCols, saveConflictCopy,
    saveExampleOpen, saveLocalCollection, saveName, saveOpen, saveRequest, saveResponseExample,
    saveScope, saveWs, selectRequestHistoryRevision, selectedWs, setActionDialog, setActionName,
    setCloseConfirmation, setCollectionImportDestination, setCollectionImportError, setCollectionImportFile, setCollectionImportOpen, setConflictDialog,
    setExampleDescription, setExampleName, setSaveCollection, setSaveExampleOpen, setSaveLocalCollection, setSaveName,
    setSaveOpen, setSaveScope, setSaveWs, setVersionDialog, snapshot, statusTone,
    submitCollectionImport, versionDialog, workspaceDraft, workspaces, runnerTarget, CollectionRunner,
    closeRunner, api, dispatchRequest, consoleOpen, PakpostConsole, consoleEvents,
    setConsoleOpen, clearConsoleEvents, navigateConsoleEvent, FastTooltip,
  } = model;
  return <>
<CommandPalette {...{        ArrowRight, Code2, Search, commandIndex, commandOpen, commandQuery,
        setCommandIndex, setCommandOpen, setCommandQuery, visibleCommandItems,}}/>    {notice && createPortal(<div className="pp-toast pp-toast-note" role="status" aria-live="polite"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={15}/></button></div>,document.body)}
<CollectionDialogs {...{        ArrowDownToLine, Braces, CollectionVariablesEditor, Dialog, DocumentationEditor, FileJson,
        Suspense, applyCollectionVariableSession, canWorkspace, collectionTargetKey, collectionVariablesBusy, collectionVariablesData,
        collectionVariablesError, collectionVariablesFetchId, collectionVariablesLoading, collectionVariablesTarget, confirmExport, docBusy,
        documentationTarget, exportChoice, exportFormat, exportIncludeSecrets, readCollectionVariables, reloadCollectionVariables,
        resetCollectionVariableSession, saveCollectionVariableDefaults, saveDocumentation, selfMember, sessionCollectionVariables, setCollectionVariablesTarget,
        setDocumentationTarget, setExportChoice, setExportFormat, setExportIncludeSecrets,}}/>    <AuthOverlays
  data={{
    inviteToken, inviteAcceptError, me, token, acceptingInvite,
    googleLinked, authOpen, authMode, authForm, authError,
    authBusy, googleLinkOpen, googleLinkPassword, googleLinkError,
  }}
  actions={{
    setInviteToken, setInviteAcceptError, acceptInvitation, setAuthMode, setAuthOpen,
    setAuthForm, submitAuth, submitGoogleAuth, setAuthError, setGoogleLinkOpen,
    setGoogleLinkPassword, submitGoogleLink, setGoogleLinkError,
  }}
/>
<RequestDialogs {...{        Dialog, FileUp, ImportDestinationPicker, RequestRevisionPanel, RetroSelect, Save,
        Suspense, actionDialog, actionName, activeSource, activeTabId, activeWorkspace,
        applyMergedRevision, busyAction, canEditCloud, closeConfirmation, collectionImportBusy, collectionImportDestination,
        collectionImportError, collectionImportFile, collectionImportOpen, conflictDialog, draftsRef, exampleDescription,
        exampleName, executeActionDialog, isReadOnlyCloudTab, localCollections, openTabs, performTabAction,
        reloadCloudConflict, restoreRequestRevision, result, saveCollection, saveCols, saveConflictCopy,
        saveExampleOpen, saveLocalCollection, saveName, saveOpen, saveRequest, saveResponseExample,
        saveScope, saveWs, selectRequestHistoryRevision, selectedWs, setActionDialog, setActionName,
        setAuthMode, setAuthOpen, setCloseConfirmation, setCollectionImportDestination, setCollectionImportError, setCollectionImportFile,
        setCollectionImportOpen, setConflictDialog, setExampleDescription, setExampleName, setSaveCollection, setSaveExampleOpen,
        setSaveLocalCollection, setSaveName, setSaveOpen, setSaveScope, setSaveWs, setVersionDialog,
        snapshot, statusTone, submitCollectionImport, token, versionDialog, workspaceDraft,
        workspaces,}}/>  {runnerTarget&&<Suspense fallback={<div className="pp-console-loading">Opening Collection Runner…</div>}>
    <CollectionRunner key={`${runnerTarget.scope}:${runnerTarget.workspaceId||''}:${runnerTarget.collectionId}`}
      target={runnerTarget} requests={runnerTarget.requests} environmentVariables={runnerTarget.environmentVariables}
      collectionVariables={runnerTarget.collectionVariables} onClose={closeRunner}
      send={command=>runnerTarget.transport==='proxy'
        ?api('/api/proxy/send','POST',command)
        :dispatchRequest(command,runnerTarget.transport)}/>
  </Suspense>}
  {consoleOpen && <Suspense fallback={<div className="pp-console-loading">Opening PakPost Console…</div>}><PakpostConsole events={consoleEvents} onClose={()=>setConsoleOpen(false)} onClear={clearConsoleEvents} onNavigate={navigateConsoleEvent}/></Suspense>}
  <FastTooltip/></>;
}
