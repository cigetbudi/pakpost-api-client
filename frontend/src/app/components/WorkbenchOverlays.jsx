import {NoticeIcon} from '../../components/ui/AsyncFeedback.jsx';
import React from 'react';
import { PlatformCreatorInvitationOverlay } from '../../features/auth/components/PlatformCreatorInvitationOverlay.jsx';

/** Dialogs, menus and transient overlays owned by the Workbench. */
export function WorkbenchOverlays({ model }) {
  const {
    X, CommandPalette, ArrowRight, Code2, Search, commandIndex,
    commandOpen, commandQuery, setCommandIndex, setCommandOpen, setCommandQuery, visibleCommandItems,
    notice, undoLocalDelete, undoDeletedLocalRequest, setUndoLocalDelete, createPortal, setNotice, body, CollectionDialogs, ArrowDownToLine,
    Braces, CollectionVariablesEditor, Dialog, DocumentationEditor, FileJson, Suspense,
    applyCollectionVariableSession, canWorkspace, collectionTargetKey, collectionVariablesBusy, collectionVariablesData, collectionVariablesError,
    collectionVariablesFetchId, collectionVariablesLoading, collectionVariablesTarget, confirmExport, docBusy, documentationTarget,
    exportChoice, exportFormat, exportIncludeSecrets, readCollectionVariables, reloadCollectionVariables, resetCollectionVariableSession,
    saveCollectionVariableDefaults, saveDocumentation, selfMember, sessionCollectionVariables, setCollectionVariablesTarget, setDocumentationTarget,
    setExportChoice, setExportFormat, setExportIncludeSecrets, AuthOverlays, inviteToken, inviteAcceptError,
    me, token, acceptingInvite, googleLinked, authOpen, authMode, loadWorkspaces,
    authError, authBusy, googleLinkOpen, googleLinkPassword, googleLinkError,
    setInviteToken, setInviteAcceptError, acceptInvitation, setAuthMode, setAuthOpen,
    submitGoogleAuth, setAuthError, setGoogleLinkOpen, setGoogleLinkPassword, submitGoogleLink,
    setGoogleLinkError, RequestDialogs, FileUp, ImportDestinationPicker, RequestRevisionPanel, RetroSelect,
    Save, actionDialog, actionName, activeSource, activeTabId, activeWorkspace,
    applyMergedRevision, busyAction, canEditCloud, closeConfirmation, collectionImportBusy, collectionImportDestination,
    collectionImportError, collectionImportFile, collectionImportOpen, conflictDialog, draftsRef, exampleDescription,
    exampleName, executeActionDialog, isReadOnlyCloudTab, localCollections, collections, workspaceRequestLists, openTabs, performTabAction,
    reloadCloudConflict, restoreRequestRevision, result, saveCollection, saveCols, saveConflictCopy,
    saveExampleOpen, saveLocalCollection, saveName, saveOpen, saveRequest, saveResponseExample,
    saveScope, saveWs, selectRequestHistoryRevision, selectedWs, setActionDialog, setActionName,
    setCloseConfirmation, setCollectionImportDestination, setCollectionImportError, setCollectionImportFile, setCollectionImportOpen, setConflictDialog,
    setExampleDescription, setExampleName, setSaveCollection, setSaveExampleOpen, setSaveLocalCollection, setSaveName,
    setSaveOpen, setSaveScope, setSaveWs, setVersionDialog, snapshot, statusTone,
    submitCollectionImport, versionDialog, workspaceDraft, workspaces,
    api, FastTooltip,
  } = model;
  return <>
<CommandPalette {...{        ArrowRight, Code2, Search, commandIndex, commandOpen, commandQuery,
        setCommandIndex, setCommandOpen, setCommandQuery, visibleCommandItems,}}/>    {undoLocalDelete && (!notice || notice==='Deleted from local collection. Open drafts are preserved.') ? createPortal(<div className="pp-toast pp-toast-note" role="status"><NoticeIcon/><span>Local request deleted</span><button type="button" onClick={undoDeletedLocalRequest}>Undo</button><button type="button" onClick={()=>setUndoLocalDelete(null)} aria-label="Dismiss undo"><X size={15}/></button></div>,document.body) : notice && createPortal(<div className="pp-toast pp-toast-note" role="status" aria-live="polite"><NoticeIcon/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={15}/></button></div>,document.body)}
<CollectionDialogs theme={model.theme} {...{        ArrowDownToLine, Braces, CollectionVariablesEditor, Dialog, DocumentationEditor, FileJson,
        Suspense, applyCollectionVariableSession, canWorkspace, collectionTargetKey, collectionVariablesBusy, collectionVariablesData,
        collectionVariablesError, collectionVariablesFetchId, collectionVariablesLoading, collectionVariablesTarget, confirmExport, docBusy,
        documentationTarget, exportChoice, exportFormat, exportIncludeSecrets, readCollectionVariables, reloadCollectionVariables,
        resetCollectionVariableSession, saveCollectionVariableDefaults, saveDocumentation, selfMember, sessionCollectionVariables, setCollectionVariablesTarget,
        setDocumentationTarget, setExportChoice, setExportFormat, setExportIncludeSecrets,}}/>    <AuthOverlays
  data={{
    inviteToken, inviteAcceptError, me, token, acceptingInvite,
    googleLinked, authOpen, authMode, authError,
    authBusy, googleLinkOpen, googleLinkPassword, googleLinkError,
  }}
  actions={{
    setInviteToken, setInviteAcceptError, acceptInvitation, setAuthMode, setAuthOpen,
    submitGoogleAuth, setAuthError, setGoogleLinkOpen,
    setGoogleLinkPassword, submitGoogleLink, setGoogleLinkError,
  }}
/>
<PlatformCreatorInvitationOverlay {...{
  token, me, authOpen, workspaceInviteToken: inviteToken, setAuthOpen, api,
  onAccepted: loadWorkspaces, setNotice,
}}/>
<RequestDialogs {...{        Dialog, FileUp, ImportDestinationPicker, RequestRevisionPanel, RetroSelect, Save,
        Suspense, actionDialog, actionName, activeSource, activeTabId, activeWorkspace,
        applyMergedRevision, busyAction, canEditCloud, closeConfirmation, collectionImportBusy, collectionImportDestination,
        collectionImportError, collectionImportFile, collectionImportOpen, conflictDialog, draftsRef, exampleDescription,
        exampleName, executeActionDialog, isReadOnlyCloudTab, localCollections, collections, workspaceRequestLists, openTabs, performTabAction,
        reloadCloudConflict, restoreRequestRevision, result, saveCollection, saveCols, saveConflictCopy,
        saveExampleOpen, saveLocalCollection, saveName, saveOpen, saveRequest, saveResponseExample,
        saveScope, saveWs, selectRequestHistoryRevision, selectedWs, setActionDialog, setActionName,
        setAuthMode, setAuthOpen, setCloseConfirmation, setCollectionImportDestination, setCollectionImportError, setCollectionImportFile,
        setCollectionImportOpen, setConflictDialog, setExampleDescription, setExampleName, setSaveCollection, setSaveExampleOpen,
        setSaveLocalCollection, setSaveName, setSaveOpen, setSaveScope, setSaveWs, setVersionDialog,
        snapshot, statusTone, submitCollectionImport, token, versionDialog, workspaceDraft,
        workspaces,}}/>
  <FastTooltip/></>;
}
