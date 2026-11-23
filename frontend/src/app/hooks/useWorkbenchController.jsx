import { loadDesktopEnvironments, saveDesktopEnvironments } from '../../features/environments/services/desktopEnvironmentRepository.js';
import { loadDesktopHistory, saveDesktopHistory } from '../../features/requests/services/desktopHistoryRepository.js';
import { createActiveEnvironmentBridge } from '../../features/environments/controllers/createActiveEnvironmentBridge.js';
import { createRequestPresentationActions } from '../../features/requests/controllers/createRequestPresentationActions.js';
import { createCloudRequestOpenActions } from '../../features/collections/controllers/createCloudRequestOpenActions.js';
import { useCollectionDialogState } from '../../features/collections/hooks/useCollectionDialogState.js';
import { useRequestAuthorizationFields } from '../../features/requests/hooks/useRequestAuthorizationFields.js';
import { useRequestTabSession } from '../../features/requests/hooks/useRequestTabSession.js';
import { useWorkspaceViewPreferencePersistence } from '../../features/workspace/hooks/useWorkspaceViewPreferencePersistence.js';
import { useWorkbenchMenuDismissal } from './useWorkbenchMenuDismissal.js';
import {useWorkbenchNoticeTimeout} from './useWorkbenchNoticeTimeout.js';
import {useGoogleConnectionStatus} from '../../features/auth/hooks/useGoogleConnectionStatus.js';
import { useRequestDraftRecovery } from '../../features/requests/hooks/useRequestDraftRecovery.js';
import { useWorkbenchKeyboardShortcuts } from './useWorkbenchKeyboardShortcuts.js';
import { createCommandPaletteItems, filterCommandPaletteItems } from '../services/commandPaletteItems.js';
import { useEnvironmentDataLifecycle } from '../../features/environments/hooks/useEnvironmentDataLifecycle.js';
import { useWorkbenchPreferencesPersistence } from './useWorkbenchPreferencesPersistence.js';
import { useCommandPaletteState } from './useCommandPaletteState.js';
import { useExplorerPanelLayout } from './useExplorerPanelLayout.js';
import { useRequestSplitLayout } from './useRequestSplitLayout.js';
import { useWorkbenchTheme } from '../../features/settings/hooks/useWorkbenchTheme.js';
import { useConsoleDrawer } from '../../features/console/hooks/useConsoleDrawer.js';
import { useRunnerDialogState } from '../../features/collections/hooks/useRunnerDialogState.js';
/**
 * Workbench composition: store instances, request orchestration and lifecycle.
 * View-only markup lives in ../components/WorkbenchView.jsx.
 * Cloud authorization remains enforced in the backend; these handlers only
 * coordinate per-workbench state and never persist secret Zustand state.
 */
import { useRequestDraftEditor } from '../../features/requests/hooks/useRequestDraftEditor.js';
import { useInterceptorLifecycle } from '../../features/requests/hooks/useInterceptorLifecycle.js';
import { useAuthOverlayState } from '../../features/auth/hooks/useAuthOverlayState.js';
import { useBrowserSessionBootstrap } from '../../features/auth/hooks/useBrowserSessionBootstrap.js';
import {createWorkbenchLogoutActions} from '../../features/auth/controllers/createWorkbenchLogoutActions.js';
import { useCollectionSessionState } from '../../features/collections/hooks/useCollectionSessionState.js';
import { useCloudCollectionLifecycle } from '../../features/collections/hooks/useCloudCollectionLifecycle.js';
import { createRealtimeActions } from '../../features/realtime/controllers/createRealtimeActions.js';
import { createRequestHistoryActions } from '../../features/requests/controllers/createRequestHistoryActions.js';
import { createRequestTabActions } from '../../features/requests/controllers/createRequestTabActions.js';
import { createCollectionActions } from '../../features/collections/controllers/createCollectionActions.js';
import { createCollectionRunnerActions } from '../../features/collections/controllers/createCollectionRunnerActions.js';
import { createInvitationActions } from '../../features/workspace/controllers/createInvitationActions.js';
import { useWorkspaceInvitationListing } from '../../features/workspace/hooks/useWorkspaceInvitationListing.js';
import { createRequestExecutionActions } from '../../features/requests/controllers/createRequestExecutionActions.js';
import { createDocumentationActions } from '../../features/collections/controllers/documentationActions.js';
import { createEnvironmentActions } from '../../features/environments/controllers/environmentActions.js';
import { createAuthActions } from '../../features/auth/controllers/authActions.js';
import { createRequestSaveActions } from '../../features/requests/controllers/requestSaveActions.js';
import { createCollectionImportActions } from '../../features/collections/controllers/collectionImportActions.js';
import { createCollectionVariableActions } from '../../features/collections/controllers/collectionVariableActions.js';
import { AppHeader } from '../../components/layout/AppHeader.jsx';
import { WorkbenchNavigation } from '../../components/layout/WorkbenchNavigation.jsx';
import { RequestWorkbench } from '../../features/requests/components/RequestWorkbench.jsx';
import { CommandPalette } from '../../components/layout/CommandPalette.jsx';
import { CollectionDialogs } from '../../features/collections/components/CollectionDialogs.jsx';
import { RequestDialogs } from '../../features/requests/components/RequestDialogs.jsx';
import { getWorkspaceCollections, getWorkspaceRequests, createWorkspaceRequest, updateWorkspaceRequest } from '../../features/collections/services/workspaceRequestRepository.js';
import { reconcileRequestTabs, synchronizeWorkspaceChanges } from '../../features/realtime/services/workspaceSync.js';
import { executeWorkbenchRequest } from '../../features/requests/services/executeWorkbenchRequest.js';
import { buildRequestCommand, buildRedactedCodeRequest, buildRequestPreview } from '../../features/requests/services/requestCommand.js';
import { useWorkspaceRealtimeLifecycle } from '../../features/realtime/hooks/useWorkspaceRealtimeLifecycle.js';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import {api} from '../../services/httpClient.js';
import { prettyJson, initialLocalEnvs } from '../../utils/workbenchHelpers.js';
import { Dialog } from '../../components/ui/WorkbenchPrimitives.jsx';
import { ResponsePane } from '../../components/workbench/ResponsePane.jsx';
import { useStore } from 'zustand';
import { createWorkspaceUiStore } from '../../features/workspace/store/createWorkspaceUiStore.js';
import { AuthOverlays } from '../../features/auth/components/AuthOverlays.jsx';
import { WorkbenchExplorer } from '../../features/collections/components/WorkbenchExplorer.jsx';
import { createRequestWorkbenchStore } from '../../features/requests/store/createRequestWorkbenchStore.js';
import { RequestTabs } from '../../features/requests/components/RequestTabs.jsx';
import { createCollectionWorkbenchStore } from '../../features/collections/store/createCollectionWorkbenchStore.js';
import { useCollectionWorkbench } from '../../features/collections/store/useCollectionWorkbench.js';
import { createEnvironmentWorkbenchStore } from '../../features/environments/store/createEnvironmentWorkbenchStore.js';
import { useEnvironmentWorkbench } from '../../features/environments/store/useEnvironmentWorkbench.js';
import { useScopedEnvironmentView } from '../../features/environments/hooks/useScopedEnvironmentView.js';
import {
  ArrowDownToLine, ArrowRight, Braces, AlertTriangle, FileUp, Variable, ChevronRight, Code2, Columns2, Copy, FileJson, History, Layers3, LayoutPanelTop, LogIn, LogOut, Save, Search, Send, Pencil, Settings2, ShieldCheck, X, PanelLeftClose, PanelLeftOpen, Link2,
} from 'lucide-react';
import {filterWorkspaceMembers,summarizeWorkspaceMembers} from '../../features/workspace/services/workspaceRoleInsights.js';
import {canWorkspace,currentWorkspaceMember} from '../../features/workspace/services/workspaceRoles.js';
import { KeyValueEditor } from '../../features/requests/components/KeyValueEditor';
import { DocumentationEditor } from '../../features/collections/components/DocumentationEditor';
import { isEnabled, encodeStoredHeaders, decodeStoredHeaders } from '../../features/requests/services/requestMetadata';
import {workspaceDocKey} from '../../features/collections/services/documentationStore';
import { RetroSelect } from '../../components/ui/RetroSelect';
import { ImportDestinationPicker } from '../../components/ui/ImportDestinationPicker';
import { VariableUrlInput } from '../../features/requests/components/VariableUrlInput';
import {VariableAwareInput} from '../../features/requests/components/VariableAwareInput.jsx';
import {putEnvironmentVariable,isSensitiveVariable} from '../../features/environments/services/variableExperience.js';
import {sessionEnvironmentKey,readableEnvironmentValues,applySessionOverrides,sessionOverridesFromValues,storeSessionOverrides} from '../../features/environments/services/sessionEnvironment.js';
import { readEnvironmentSelections, writeEnvironmentSelections } from '../../features/environments/services/environmentContext.js';
import { FastTooltip } from '../../components/ui/FastTooltip';
import {useVisibleWorkbenchCollections} from '../../features/collections/hooks/useVisibleWorkbenchCollections.js';
import {requestResponseView} from '../../features/requests/services/requestResponseView.js';
import {toggleWorkspaceCollection, setAllWorkspaceCollections, workspaceCollectionKey} from '../../features/collections/services/collectionExpansion';
import { blankDraft, parseCurl, isCurl, parseImportText } from '../../features/import-export/services/importExport';
import {parseEnvironmentDocument,uniqueEnvironmentImports} from '../../features/environments/services/environmentImport';
import {readWorkbenchCache} from '../../features/workspace/services/workspaceCache';
import {toLocalCollection,validateLibrary,readLocalCollections,writeLocalCollections} from '../../features/collections/services/localCollections';
import {isTauriDesktop,loadDesktopCollections} from '../../features/collections/services/desktopLocalRepository.js';
import {planTabClose} from '../../features/requests/services/tabActions';
import {applyLocalAction,updateLocalRequest,createLocalSavedRequest} from '../../features/collections/services/localCollectionActions';
import {stripJsonComments,hasJsonComments} from '../../features/requests/services/jsonComments';
import {findBoundTab} from '../../features/requests/services/sourceTabs';
import {freshRequest, pendingSource, requestFingerprint, needsCloseConfirmation, tabSaved} from '../../features/requests/services/draftLifecycle';
import {isReadOnlyCloudTab,sandboxDocKey} from '../../features/requests/services/qaSandbox.js';
import {applyFieldMerge} from '../../features/requests/services/requestVersionMerge.js';
import {defaultStorageScope,allowedStorageScope,STORAGE_LOCAL,STORAGE_WORKSPACE,collectionImportSources,saveCloudCollections} from '../../features/import-export/services/storageScope';
import {readWorkspaceViewPreference} from '../../features/workspace/services/workspaceViewPreference.js';
import {MenuActionItem} from '../../components/ui/MenuActionItem';
import { isDarkAppearance, normalizeAppearance, readAppearance } from '../../features/settings/services/appearance';
import { bodyFormat, languageFromMime, formatSource, resolveVars } from '../../features/requests/services/requestTools';
import {createResponseExample,exampleToResult,renameResponseExample,sanitizeResponseExamples,statusTone,suggestExampleName,upsertResponseExample} from '../../features/requests/services/responseExamples';
import {AUTH_OPTIONS} from '../../features/requests/services/authorization';
import {readInterceptorMode,dispatchRequest} from '../../features/requests/services/interceptorClient';
import {appendConsoleEvent, subscribeConsoleEvents, clearConsoleEvents} from '../../features/console/services/pakpostConsoleStore.js';
import {collectionVariableKey, readCollectionVariables, writeCollectionVariables, resetCollectionVariables, savedCollectionVariableMap, validateCollectionVariableRows, resolvedScriptVariables} from '../../features/collections/services/collectionVariableSession.js';
import { TextEditor, WorkbenchSettings, CodeSidebar, ImportExportSidebar, PakpostConsole, CollectionRunner, WorkspaceManager, CollectionVariablesEditor, RequestRevisionPanel, RequestBody, ScriptEditor } from '../components/DeferredFeatures.jsx';

const CACHED = readWorkbenchCache();
const RECOVERED = CACHED?.drafts?.[CACHED.activeTabId] || {};
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const EMPTY_HEADER = { key: '', value: '', description: '', enabled: true };
const storedToken = () => ''; // Auth comes only from a server session, asynchronously.
const getMessage = (e) => e?.message || 'Something went wrong';



const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

export function useWorkbenchController() {
  // Scoped to this Workbench instance: no global request data and no persist middleware.
  const [requestWorkbenchStore] = useState(() => createRequestWorkbenchStore({
    reqTab: RECOVERED.reqTab || 'params',
    resTab: RECOVERED.resTab || 'body',
    activeTabId: CACHED?.activeTabId || 't1',
    openTabs: (CACHED?.openTabs || [{ id: 't1', name: 'Untitled Request', method: 'GET' }]).map(t => ({
      ...t,
      savedName: t.savedName ?? t.name,
      savedFingerprint: t.savedFingerprint ?? requestFingerprint(CACHED?.drafts?.[t.id] || freshRequest(t.name), t.name),
    })),
  }));
  const [page, setPage] = useState('tester');
  const [settingsCategory,setSettingsCategory]=useState('appearance');
  const {consoleOpen, setConsoleOpen, consoleEvents} = useConsoleDrawer();
  const {runnerTarget, setRunnerTarget, runnerLoading, setRunnerLoading, runnerFetchId} = useRunnerDialogState();
  const [interceptorMode,setInterceptorMode]=useState(()=>readInterceptorMode(localStorage));
  const [extensionStatus,setExtensionStatus]=useState({state:'unknown',version:''});
  const { commandOpen, setCommandOpen, commandQuery, setCommandQuery, commandIndex, setCommandIndex } = useCommandPaletteState();
  const {theme, setTheme} = useWorkbenchTheme();
  const [token, setToken] = useState(storedToken);
  const [authSessionRevision,setAuthSessionRevision]=useState(0);
  useEffect(()=>{if(new URLSearchParams(window.location.search).has('invite')){const u=new URL(window.location.href);u.searchParams.delete('invite');window.history.replaceState({},'',u.pathname+u.search+u.hash)}},[]);
  const currentTokenRef=useRef(token);
  const authEpochRef=useRef(0);
  currentTokenRef.current=token;
  const authTabSyncRef=useRef(null);
  // Shared header storage context for both Collections and Environments.
  // The legacy cached envScope keeps existing users on their last chosen storage.
  const [storageScope,setStorageScope] = useState(STORAGE_LOCAL); // Until /auth/session verifies the cookie, Cloud stays unavailable.
  const collectionsScope=storageScope;
  const envScope=storageScope;
  const [me, setMe] = useState(null);
  const currentUserRef=useRef(me);currentUserRef.current=me;
  const {
    authOpen, setAuthOpen, authMode, setAuthMode, authBusy, setAuthBusy,
    authError, setAuthError, googleLinkOpen, setGoogleLinkOpen,
    googleLinkPassword, setGoogleLinkPassword, googleLinkError, setGoogleLinkError, googleLinked, setGoogleLinked,
    inviteToken, setInviteToken, acceptingInvite, setAcceptingInvite, inviteAcceptError, setInviteAcceptError,
  } = useAuthOverlayState();
  const [notice, setNotice] = useState('');
  const [exportChoice,setExportChoice] = useState(null);
  const [exportFormat,setExportFormat] = useState('postman');
  const [exportIncludeSecrets,setExportIncludeSecrets] = useState(false);
  const {
    method, setMethod, url, setUrl, rows, setRows,
    body, setBody, documentation, setDocumentation, format, setFormat,
    formFields, setFormFields, binaryFile, setBinaryFile, preScript, setPreScript,
    postScript, setPostScript, responseExamples, setResponseExamples, scriptLog, setScriptLog,
    scriptTests, setScriptTests, scriptError, setScriptError, scriptDiagnostic, setScriptDiagnostic,
    scriptJump, setScriptJump, responsePretty, setResponsePretty, prettyResponse, setPrettyResponse,
  } = useRequestDraftEditor(RECOVERED, EMPTY_HEADER);
  // Each workbench has its own memory-only Environment store. Existing Local
  // persistence, Cloud authorization, and QA session overlays are unchanged.
  const [environmentStore] = useState(() => createEnvironmentWorkbenchStore({
    localEnvironments: isTauriDesktop() ? [] : initialLocalEnvs(),
    environmentSelections: readEnvironmentSelections(localStorage, CACHED),
  }));
  const { localEnvironments, setLocalEnvironments,
    workspaceEnvironmentResult, setWorkspaceEnvironmentResult,
    environmentSelections, setEnvironmentSelections } = useEnvironmentWorkbench(environmentStore);
  const {
    sessionEnvironmentOverlays, sessionCollectionVariables, savedCollectionVariablesCache, collectionVariablesTarget, setCollectionVariablesTarget, collectionVariablesData,
    setCollectionVariablesData, collectionVariablesLoading, setCollectionVariablesLoading, collectionVariablesError, setCollectionVariablesError, collectionVariablesBusy,
    setCollectionVariablesBusy, collectionVariablesFetchId, sessionDocumentationOverlays, refreshSessionEnvironment,
  } = useCollectionSessionState(token);
  // Request tab state comes from the per-App Zustand store, not one huge context.
  const reqTab = useStore(requestWorkbenchStore, s => s.reqTab);
  const setReqTab = useStore(requestWorkbenchStore, s => s.setReqTab);
  const resTab = useStore(requestWorkbenchStore, s => s.resTab);
  const setResTab = useStore(requestWorkbenchStore, s => s.setResTab);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(RECOVERED.result || null);
  const [recent, setRecent] = useState(CACHED?.recent || []);
  const [desktopEnvReady,setDesktopEnvReady] = useState(()=>!isTauriDesktop());
  const [desktopHistoryReady,setDesktopHistoryReady] = useState(()=>!isTauriDesktop());
  const desktopEnvSaveQueue=useRef(Promise.resolve());
  const desktopHistorySaveQueue=useRef(Promise.resolve());
  useEffect(()=>{
    if(!isTauriDesktop())return;
    let active=true;
    loadDesktopEnvironments().then(envs=>{if(active){setLocalEnvironments(envs);setDesktopEnvReady(true);}})
      .catch(err=>{if(active){console.error('Desktop environment recovery failed (saving disabled):',err);setNotice('Cannot load Local Environments. SQLite saving is disabled to protect existing data. Check desktop console.');}});
    loadDesktopHistory().then(entries=>{if(active){setRecent(entries);setDesktopHistoryReady(true);}})
      .catch(err=>console.error('Desktop history load failed (saving disabled):',err));
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    if(!isTauriDesktop()||!desktopEnvReady)return;
    desktopEnvSaveQueue.current=desktopEnvSaveQueue.current.catch(()=>{}).then(()=>saveDesktopEnvironments(localEnvironments));
    desktopEnvSaveQueue.current.catch(err=>{console.error('Desktop environments write failed:',err);setNotice('Local Environment could not be saved to SQLite. Check desktop console.');});
  },[localEnvironments,desktopEnvReady]);
  useEffect(()=>{
    if(!isTauriDesktop()||!desktopHistoryReady)return;
    desktopHistorySaveQueue.current=desktopHistorySaveQueue.current.catch(()=>{}).then(()=>saveDesktopHistory(recent));
    desktopHistorySaveQueue.current.catch(err=>console.error('Desktop history write failed:',err));
  },[recent,desktopHistoryReady]);
  const [workspaceUiStore] = useState(createWorkspaceUiStore);
  const { workspaces, setWorkspaces, selectedWs, setSelectedWs, members, setMembers, membersWorkspaceId, setMembersWorkspaceId, wsTab, setWsTab, newWs, setNewWs, newCollection, setNewCollection, newMember, setNewMember, newMemberRoles, setNewMemberRoles, editingMemberId, setEditingMemberId, editingMemberRoles, setEditingMemberRoles, memberSearch, setMemberSearch, memberRoleFilter, setMemberRoleFilter, showMemberAdd, setShowMemberAdd, inviteOpen, setInviteOpen, inviteEmail, setInviteEmail, inviteRoles, setInviteRoles, invitationRows, setInvitationRows, invitationError, setInvitationError, invitationBusy, setInvitationBusy, expandedMemberAccess, setExpandedMemberAccess, canCreateWorkspace, setCanCreateWorkspace } = useStore(workspaceUiStore);
  const selectedWorkspaceRef=useRef(selectedWs);
  selectedWorkspaceRef.current=selectedWs;
  useWorkspaceViewPreferencePersistence({
    token, me, storageScope, selectedWs, workspaces, storage: localStorage,
  });
  // Context selection & Cloud stale-response guards live with Environment state.
  const {
    cloudEnvironmentContext, environmentContext, cloudEnvironmentContextRef,
    workspaceEnvironments, currentEnvironments, activeEnvId,
    selectEnvironmentForContext, setActiveEnvId, setWorkspaceEnvironments,
  } = useScopedEnvironmentView({
    envScope, selectedWs, userId: me?.id, localEnvironments,
    workspaceEnvironmentResult, environmentSelections,
    setEnvironmentSelections, setWorkspaceEnvironmentResult,
  });
  useEffect(()=>writeEnvironmentSelections(localStorage,environmentSelections),[environmentSelections]);
  // Collections have an independent, per-workbench Zustand store. Keeping
  // remote API operations in App avoids bypassing workspace RBAC checks.
  const [collectionStore] = useState(() => createCollectionWorkbenchStore({
    localCollections: isTauriDesktop() ? [] : readLocalCollections(),
    collectionSort: localStorage.getItem('pakpost_v14_global_collection_sort') || 'manual',
  }));
  const { collections, setCollections, localCollections, setLocalCollections,
    selectedCol, setSelectedCol, savedRequests, setSavedRequests,
    collectionSort, setCollectionSort, expandedCollections, setExpandedCollections,
    expandedWorkspaceExamples, setExpandedWorkspaceExamples,
    localExpandAllSignal, setLocalExpandAllSignal, revealLocalDraft, setRevealLocalDraft,
    workspaceRequestLists, setWorkspaceRequestLists } = useCollectionWorkbench(collectionStore);
  const {
    creatingLocalCollection, setCreatingLocalCollection, collectionImportOpen, setCollectionImportOpen,
    collectionImportFile, setCollectionImportFile, collectionImportDestination, setCollectionImportDestination,
    collectionImportError, setCollectionImportError, collectionImportBusy, setCollectionImportBusy,
    localCollectionName, setLocalCollectionName, selectedColRef, saveOpen, setSaveOpen,
    saveExampleOpen, setSaveExampleOpen, exampleName, setExampleName,
    exampleDescription, setExampleDescription, saveScope, setSaveScope,
    saveLocalCollection, setSaveLocalCollection, actionDialog, setActionDialog,
    actionName, setActionName, workspaceMenu, setWorkspaceMenu,
    documentationTarget, setDocumentationTarget, docBusy, setDocBusy,
    workspaceCollectionDocs, setWorkspaceCollectionDocs, workspaceSorted, setWorkspaceSorted,
    tabDragRef, saveName, setSaveName, saveWs, setSaveWs, saveCollection, setSaveCollection,
    saveCols, setSaveCols, busyAction, setBusyAction,
  } = useCollectionDialogState({
    initialImportScope: () => defaultStorageScope(!!storedToken()),
    storage: localStorage,
  });
  selectedColRef.current = selectedCol;
  const { split, setSplit, splitPercent, setSplitPercent, panesRef, draggingRef,
    onSplitterMove, onSplitterEnd } = useRequestSplitLayout({cachedSplit: CACHED?.split});
  const { explorerTab, setExplorerTab, explorerSearch, setExplorerSearch,
    rightWidth, setRightWidth, resizingRight, sidebarCollapsed, setSidebarCollapsed,
    openContext, resizeRight, endRightResize } = useExplorerPanelLayout({
      cachedExplorerTab: CACHED?.explorerTab,
      cachedSidebarCollapsed: CACHED?.sidebarCollapsed,
      setPage,
    });
  const workspaceRequestsPending = useRef(new Set());
  const workspaceFetchEpoch = useRef(0);
  const cloudOpenEpoch = useRef(0);
  useEffect(()=>{
    // Clear cached private workspace data after switching accounts or workspaces.
    workspaceFetchEpoch.current+=1;
    workspaceRequestsPending.current.clear();
    setWorkspaceRequestLists({});
    setRemoteAlerts({});setConflictDialog(null);setVersionDialog(null);
  },[selectedWs,token]);
  const {
    params, setParams, authType, setAuthType, bearerToken, setBearerToken,
    basicUsername, setBasicUsername, basicPassword, setBasicPassword,
    apiKeyName, setApiKeyName, apiKeyValue, setApiKeyValue,
    apiKeyIn, setApiKeyIn, currentAuth,
  } = useRequestAuthorizationFields(RECOVERED, EMPTY_HEADER);
  const {
    openTabs, setOpenTabs, openTabsRef, remoteAlerts, setRemoteAlerts,
    conflictDialog, setConflictDialog, versionDialog, setVersionDialog,
    realtimeStatus, setRealtimeStatus, realtimeHandlerRef, realtimeQueueRef,
    realtimeTimerRef, tabMenu, setTabMenu, editingRequestName, setEditingRequestName,
    requestNameInputRef, originalRequestNameRef, cancelledRequestNameRef,
    closeConfirmation, setCloseConfirmation, activeTabId, setActiveTabId,
    activeTabRef, tabSequence, draftsRef,
  } = useRequestTabSession({ requestWorkbenchStore, cached: CACHED, page });
  function beginRequestRename(...args) { return tabActions.beginRequestRename(...args); }
  function setCurrentRequestName(...args) { return tabActions.setCurrentRequestName(...args); }
  function finishRequestRename(...args) { return tabActions.finishRequestRename(...args); }
  function cancelRequestRename(...args) { return tabActions.cancelRequestRename(...args); }

  function snapshot(...args) { return tabActions.snapshot(...args); }
  const snapshotRef=useRef(snapshot);snapshotRef.current=snapshot;
  function restoreDraft(...args) { return tabActions.restoreDraft(...args); }
  function stashActive(...args) { return tabActions.stashActive(...args); }
  const [desktopLocalReady,setDesktopLocalReady]=useState(()=>!isTauriDesktop());
  useEffect(()=>{
    if(!isTauriDesktop())return;
    let active=true;
    loadDesktopCollections().then(collections=>{
      if(!active)return;
      setLocalCollections(collections);
      setDesktopLocalReady(true);
    }).catch(error=>{
      // Fail closed: do not overwrite a database that could not be read.
      console.error('PakPost desktop local database unavailable:',error);
    });
    return ()=>{active=false};
  },[setLocalCollections]);
  useWorkbenchPreferencesPersistence({localCollections,workspaceCollectionDocs,collectionSort,rightWidth,desktopLocalReady});

  useWorkbenchMenuDismissal({ tabMenu, setTabMenu, workspaceMenu, setWorkspaceMenu });
  useEffect(()=>{try{localStorage.setItem('pakpost_workspace_sort',JSON.stringify(workspaceSorted))}catch{}},[workspaceSorted]);
  useRequestDraftRecovery({
    openTabs, activeTabRef, draftsRef, snapshot, recent, split, explorerTab, sidebarCollapsed,
    activeEnvId, envScope, selectedWs, membersWorkspaceId, members, me,
    method, url, rows, body, documentation, format, formFields, binaryFile,
    preScript, postScript, responseExamples, scriptLog, scriptTests, scriptError,
    scriptDiagnostic, reqTab, resTab, result, params, authType, bearerToken,
    basicUsername, basicPassword, apiKeyName, apiKeyValue, apiKeyIn, activeTabId,
  });
  function adoptSavedRevision(...args) { return realtimeActions.adoptSavedRevision(...args); }
  // Draft reconciliation is isolated from SignalR, without touching dirty tabs.
  function reconcileCloudRequests(...args) { return realtimeActions.reconcileCloudRequests(...args); }
  async function refreshRealtimeChanges(...args) { return realtimeActions.refreshRealtimeChanges(...args); }
  realtimeHandlerRef.current=refreshRealtimeChanges;
  function enqueueWorkspaceChange(...args) { return realtimeActions.enqueueWorkspaceChange(...args); }
  async function showConflictDialog(...args) { return historyActions.showConflictDialog(...args); }
  function reloadCloudConflict(...args) { return historyActions.reloadCloudConflict(...args); }
  function saveConflictCopy(...args) { return historyActions.saveConflictCopy(...args); }

  // V8.5: explicit field merge; never silently overwrite the editor or Cloud.
  function applyMergedRevision(...args) { return historyActions.applyMergedRevision(...args); }
  async function openRequestHistory(...args) { return historyActions.openRequestHistory(...args); }
  async function selectRequestHistoryRevision(...args) { return historyActions.selectRequestHistoryRevision(...args); }
  async function restoreRequestRevision(...args) { return historyActions.restoreRequestRevision(...args); }

  function selectTab(...args) { cloudOpenEpoch.current++; return tabActions.selectTab(...args); }
  function navigateConsoleEvent(...args) { return tabActions.navigateConsoleEvent(...args); }
  function addTab(...args) { cloudOpenEpoch.current++; return tabActions.addTab(...args); }
  const { importPreparedEnvironments, importCloudCollections, importRequestsAndEnvironments } = createCollectionImportActions({
    STORAGE_LOCAL, STORAGE_WORKSPACE, activeTabRef, allowedStorageScope, api, blankDraft,
    collectionImportSources, collections, draftsRef, getMessage, localCollections, localEnvironments,
    me, restoreDraft, saveCloudCollections, selectEnvironmentForContext, selectedWs, setActiveTabId,
    setCollections, setExpandedCollections, setExplorerTab, setLocalCollections, setLocalEnvironments, setOpenTabs,
    setPage, setSelectedCol, setSidebarCollapsed, setStorageScope, setWorkspaceEnvironments, stashActive,
    tabSequence, toLocalCollection, token, uniqueEnvironmentImports, validateLibrary, workspaceCollectionKey,
    workspaceFetchEpoch,
  });
  const selfMember=membersWorkspaceId===selectedWs?currentWorkspaceMember(members,me):null;
  const canEditCloud=canWorkspace(selfMember,'collection.write');
  const { openDocumentation, saveDocumentation } = createDocumentationActions({
    activeTabRef, adoptSavedRevision, api, applyLocalAction, canEditCloud, decodeStoredHeaders,
    documentationTarget, draftsRef, encodeStoredHeaders, getMessage, localCollections, openTabs,
    sandboxDocKey, savedRequests, selectedCol, selectedWs, sessionDocumentationOverlays, setDocBusy,
    setDocumentation, setDocumentationTarget, setLocalCollections, setNotice, setSavedRequests, setWorkspaceCollectionDocs,
    setWorkspaceRequestLists, token, workspaceCollectionDocs, workspaceCollectionKey, workspaceDocKey, workspaceRequestLists,
  });
  async function createExplorerCollection(...args) { return collectionActions.createExplorerCollection(...args); }
  function openCollectionImport(...args) { return collectionActions.openCollectionImport(...args); }
  async function submitCollectionImport(...args) { return collectionActions.submitCollectionImport(...args); }
  function openBoundRequest(...args) { return collectionActions.openBoundRequest(...args); }
  function openLocalRequest(...args) { cloudOpenEpoch.current++; return collectionActions.openLocalRequest(...args); }
  function previewSavedExample(...args) { return collectionActions.previewSavedExample(...args); }
  function openLocalExample(...args) { cloudOpenEpoch.current++; return collectionActions.openLocalExample(...args); }
  async function openWorkspaceExample(...args) {
    return cloudRequestOpenActions.openWorkspaceExample(...args);
  }
  function downloadJson(...args) { return collectionActions.downloadJson(...args); }
  function updateLocal(...args) { return collectionActions.updateLocal(...args); }
  function createCollectionDraft(...args) { return collectionActions.createCollectionDraft(...args); }
  const { collectionTargetKey, readSavedCollectionVariables, openCollectionVariables, reloadCollectionVariables, saveCollectionVariableDefaults, applyCollectionVariableSession, resetCollectionVariableSession } = createCollectionVariableActions({
    api, canWorkspace, collectionVariableKey, collectionVariablesData, collectionVariablesFetchId, collectionVariablesTarget,
    getMessage, localCollections, me, refreshSessionEnvironment, resetCollectionVariables, rows,
    savedCollectionVariablesCache, selfMember, sessionCollectionVariables, setCollectionVariablesBusy, setCollectionVariablesData, setCollectionVariablesError,
    setCollectionVariablesLoading, setCollectionVariablesTarget, setLocalCollections, token, validateCollectionVariableRows, writeCollectionVariables,
  });
  async function openCollectionRunner(...args) { return runnerActions.openCollectionRunner(...args); }
  function openRunnerForCurrentCollection(...args) { return runnerActions.openRunnerForCurrentCollection(...args); }
  function closeRunner(...args) { return runnerActions.closeRunner(...args); }
  // Switching account/workspace/storage must stop the old Runner and discard
  // its private variable snapshot, even when Cloud and Local IDs overlap.
  useEffect(()=>{runnerFetchId.current++;setRunnerTarget(null);},[token,selectedWs,storageScope,activeEnvId]);
  function handleLocalMenu(...args) { return collectionActions.handleLocalMenu(...args); }
  function expandOrCollapseAllCollections(...args) { return collectionActions.expandOrCollapseAllCollections(...args); }
  function toggleWorkspaceCollectionById(...args) { return collectionActions.toggleWorkspaceCollectionById(...args); }
  function invalidateWorkspaceRequestLists(...args) { return collectionActions.invalidateWorkspaceRequestLists(...args); }
  function refreshCloudCollection(...args) { return collectionActions.refreshCloudCollection(...args); }
  function moveLocalRequest(...args) { return collectionActions.moveLocalRequest(...args); }
  function moveLocalFolder(...args) { return collectionActions.moveLocalFolder(...args); }
  function moveLocalCollection(...args) { return collectionActions.moveLocalCollection(...args); }
  async function moveWorkspaceCollection(...args) { return collectionActions.moveWorkspaceCollection(...args); }
  const WORKSPACE_DRAG='application/x-pakpost-workspace-request';
  async function moveWorkspaceRequest(...args) { return collectionActions.moveWorkspaceRequest(...args); }
  async function moveWorkspaceFolder(...args) { return collectionActions.moveWorkspaceFolder(...args); }
  async function reorderWorkspaceRequest(...args) { return collectionActions.reorderWorkspaceRequest(...args); }
  function showWorkspaceMenu(...args) { return collectionActions.showWorkspaceMenu(...args); }
  function workspaceDraft(...args) { return collectionActions.workspaceDraft(...args); }
  async function handleWorkspaceMenu(...args) { return collectionActions.handleWorkspaceMenu(...args); }
  function synchronizeSavedExamples(...args) { return collectionActions.synchronizeSavedExamples(...args); }
  async function renameSavedExample(...args) { return collectionActions.renameSavedExample(...args); }
  async function executeActionDialog(...args) { return collectionActions.executeActionDialog(...args); }
  function importCurlIntoCurrent(...args) { return tabActions.importCurlIntoCurrent(...args); }
  function closeTab(...args) { return tabActions.closeTab(...args); }
  function performTabAction(...args) { return tabActions.performTabAction(...args); }
  function showTabContext(...args) { return tabActions.showTabContext(...args); }
  function selectTabFromDraft(...args) { return tabActions.selectTabFromDraft(...args); }
  async function loadSavedRequest(...args) {
    return cloudRequestOpenActions.loadSavedRequest(...args);
  }
  async function resetSandboxRequest(...args) { return tabActions.resetSandboxRequest(...args); }


  useEnvironmentDataLifecycle({
    envScope, storageWorkspace:STORAGE_WORKSPACE, token, selectedWs,
    cloudEnvironmentContext, cloudEnvironmentContextRef, localEnvironments,
    setWorkspaceEnvironmentResult, setNotice, setStorageScope, storageLocal:STORAGE_LOCAL, getMessage,
  });
  const activeEnvironment=currentEnvironments.find(e=>e.id===activeEnvId);
  // Do not resolve masked Cloud secrets in the browser, even for a request executor.
  // Read-only members can create temporary personal values without writing to Neon.
  const activeSessionEnvironmentKey=envScope===STORAGE_WORKSPACE?sessionEnvironmentKey(environmentContext,activeEnvId):'';
  const activeSessionOverrides=sessionEnvironmentOverlays.current.get(activeSessionEnvironmentKey)||{};
  const canWriteEnvironment=envScope!==STORAGE_WORKSPACE||(membersWorkspaceId===selectedWs&&canWorkspace(currentWorkspaceMember(members,me),'environment.write'));
  const { varsFromEnv, rememberSessionValues, variableUi } = createActiveEnvironmentBridge({
    STORAGE_WORKSPACE, activeEnvironment, activeSessionEnvironmentKey,
    activeSessionOverrides, applySessionOverrides, canWriteEnvironment,
    envScope, isSensitiveVariable,
    // The callback is invoked only on edit, after the environment factory is initialized.
    persistEnvironment: next => persistEnvironment(next), putEnvironmentVariable,
    readableEnvironmentValues, refreshSessionEnvironment, selectedWs,
    sessionEnvironmentOverlays, sessionOverridesFromValues, setExplorerTab,
    setNotice, storeSessionOverrides, workspaces,
  });
  const { updateStorageScope, importEnvironmentFile, createEnvironment, duplicateEnvironment, openExportChoice, confirmExport, persistEnvironment, deleteEnvironment, applyScriptVariables } = createEnvironmentActions({
    STORAGE_WORKSPACE, allowedStorageScope, api, currentEnvironments, documentation, downloadJson,
    envScope, exportChoice, exportFormat, exportIncludeSecrets, getMessage, importPreparedEnvironments,
    isSensitiveVariable, localCollections, parseEnvironmentDocument, readSavedCollectionVariables, rememberSessionValues, selectedWs,
    setActiveEnvId, setCreatingLocalCollection, setExportChoice, setExportFormat, setExportIncludeSecrets, setLocalEnvironments,
    setNotice, setStorageScope, setWorkspaceEnvironments, token, workspaceCollectionDocs, workspaceDocKey,
    workspaceDraft,
  });
  const { selectFormat, beautifyBody, beautifyResult,
    buildOutgoing, buildCodeRequest, codePreviewRequest } = createRequestPresentationActions({
    binaryFile, body, buildRedactedCodeRequest, buildRequestCommand,
    buildRequestPreview, currentAuth, formFields, format, formatSource,
    getMessage, hasJsonComments, languageFromMime, method, params, result,
    rows, setBody, setFormat, setNotice, setPrettyResponse,
    setResponsePretty, url, varsFromEnv,
  });
  useEffect(() => {
    let ignore = false;
    if (!token) { setMe(null); setWorkspaces([]); return; }
    api('/api/auth/me', 'GET', undefined, token).then(user => { if (!ignore) setMe(user); })
      .catch(error => { if (!ignore && error?.status === 401) performLogout(false); });
    return () => { ignore = true; };
  }, [token]);
  useWorkbenchNoticeTimeout(notice,setNotice);

  const {logout,performLogout} = createWorkbenchLogoutActions({
    authEpochRef,api,currentTokenRef,authTabSyncRef,getMessage,setNotice,sessionStorage,localStorage,
    setWorkspaceCollectionDocs,setToken,setMe,setStorageScope,STORAGE_LOCAL,setPage,
    setAuthOpen,setGoogleLinkOpen,setGoogleLinked,setGoogleLinkPassword,
    setRecent,setCollections,setSavedRequests,setWorkspaceRequestLists,
    setRemoteAlerts,setConflictDialog,setVersionDialog,workspaceUiStore,
    sessionEnvironmentOverlays,sessionCollectionVariables,savedCollectionVariablesCache,
    sessionDocumentationOverlays,setWorkspaceEnvironmentResult,
    openTabsRef,activeTabRef,draftsRef,snapshotRef,setOpenTabs,setActiveTabId,restoreDraft,
  });
  const { requiresLogin, navigate, completeSignIn, submitGoogleAuth, submitGoogleLink, loadWorkspaces } = createAuthActions({
    STORAGE_WORKSPACE, api, authBusy, currentTokenRef,
    getMessage, googleLinkPassword, setAuthBusy, setAuthError, setAuthMode,
    setAuthOpen, setCanCreateWorkspace, setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword, setGoogleLinked,
    setMe, setNotice, setPage, setSelectedWs, setStorageScope, setToken,
    setWorkspaceEnvironmentResult, setWorkspaces, token, currentUserRef,
    preferredWorkspaceId:userId=>readWorkspaceViewPreference(localStorage,userId).workspaceId,
    announceSession:()=>{authEpochRef.current += 1;setAuthSessionRevision(v=>v+1);authTabSyncRef.current?.announceSession();},
  });
  useBrowserSessionBootstrap({
    api, authEpochRef, authTabSyncRef, currentTokenRef, currentUserRef,
    performLogout, loadWorkspaces, setAuthOpen, setAuthSessionRevision,
    setMe, setStorageScope, setToken,
  });
  useEffect(() => { if (token) loadWorkspaces(token); }, [token]);
  useWorkspaceRealtimeLifecycle({
    enabled: collectionsScope===STORAGE_WORKSPACE,
    token, workspaceId:selectedWs, sessionRevision:authSessionRevision,
    onEvent:enqueueWorkspaceChange,
    onStatus:setRealtimeStatus,
    onReset:()=>{
      realtimeQueueRef.current=[];
      if(realtimeTimerRef.current){clearTimeout(realtimeTimerRef.current);realtimeTimerRef.current=null;}
    },
    onAccessChanged:(workspaceId,auth)=>api(`/api/workspaces/${workspaceId}/members`,'GET',undefined,auth)
      .then(data=>{if(auth===currentTokenRef.current&&workspaceId===selectedWorkspaceRef.current){setMembers(data);setMembersWorkspaceId(workspaceId)}})
      .catch(error=>{
        if(auth!==currentTokenRef.current||workspaceId!==selectedWorkspaceRef.current)return;
        setMembers([]);
        setMembersWorkspaceId('');
        if(error.status===403||error.status===404)loadWorkspaces(auth);
      }),
  });

  useGoogleConnectionStatus({token,setGoogleLinked,api});
  useCloudCollectionLifecycle({
    STORAGE_WORKSPACE, api, collections, collectionsScope, expandedCollections,
    explorerTab, getMessage, membersWorkspaceId, saveWs, selectedCol, selectedWs,
    setCollections, setEditingMemberId, setEditingMemberRoles, setExpandedMemberAccess,
    setInvitationError, setInvitationRows, setInviteEmail, setInviteOpen, setInviteRoles,
    setMemberRoleFilter, setMemberSearch, setMembers, setMembersWorkspaceId,
    setNewMemberRoles, setNotice, setSaveCollection, setSaveCols, setSavedRequests,
    setSelectedCol, setShowMemberAdd, setWorkspaceRequestLists, token,
    workspaceCollectionKey, workspaceFetchEpoch, workspaceRequestLists,
    workspaceRequestsPending,
  });
  useWorkbenchKeyboardShortcuts({
    page, loading, busyAction, saveOpen, saveExampleOpen, actionDialog,
    documentationTarget, saveCurrent: () => saveCurrent(), sendRequest,
  });

  const { refreshExtensionStatus } = useInterceptorLifecycle({
    draftsRef, interceptorMode, localCollections, localEnvironments, openTabs,
    setExtensionStatus, url, workspaceEnvironments, workspaceRequestLists,
  });

  const activeWorkspace = workspaces.find(x => x.id === selectedWs);
  const canManageMembers=canWorkspace(selfMember,'member.manage');
  useWorkspaceInvitationListing({
    api, canManageMembers, getMessage, selectedWorkspaceRef, selectedWs,
    setInvitationError, setInvitationRows, token,
  });
  async function inviteMember(...args) { return invitationActions.inviteMember(...args); }
  async function actOnInvitation(...args) { return invitationActions.actOnInvitation(...args); }
  async function acceptInvitation(...args) { return invitationActions.acceptInvitation(...args); }

  const canAssignRoles=canWorkspace(selfMember,'role.assign');
  const assignableRoles=selfMember?.roles||[];
  const visibleWorkspaceMembers=filterWorkspaceMembers(membersWorkspaceId===selectedWs?members:[],{query:memberSearch,role:memberRoleFilter});
  const workspaceMemberStats=summarizeWorkspaceMembers(membersWorkspaceId===selectedWs?members:[]);
  const headerCount = rows.filter(x => x.key.trim()&&isEnabled(x)).length;
  const requestHeaderObject = () => Object.fromEntries(rows.filter(x => x.key.trim()&&isEnabled(x)).map(x => [x.key.trim(), x.value]));
  async function sendRequest(...args) { return requestActions.sendRequest(...args); }

  const doAction = async fn => {
    setBusyAction(true);
    try { await fn(); return true; } catch (e) { setNotice(getMessage(e)); return false; } finally { setBusyAction(false); }
  };
  const activeRequestName = openTabs.find(t => t.id === activeTabId)?.name || 'Untitled Request';
  const { loadRequest, activeSource, currentSavePayload, openSaveAs, saveCurrent, saveRequest, openSaveExampleDialog, persistResponseExamples, saveResponseExample } = createRequestSaveActions({
    activeRequestName, activeTabRef, addTab, adoptSavedRevision, api, applyLocalAction,
    body, bodyFormat, canEditCloud, createLocalSavedRequest, createResponseExample, createWorkspaceRequest,
    currentAuth, decodeStoredHeaders, doAction, documentation, draftsRef, encodeStoredHeaders,
    exampleDescription, exampleName, formFields, format, getWorkspaceRequests, invalidateWorkspaceRequestLists,
    isReadOnlyCloudTab, loadSavedRequest, localCollections, method, openTabs, params,
    postScript, preScript, remoteAlerts, responseExamples, result, rows,
    saveCollection, saveLocalCollection, saveName, saveScope, saveWs, selectedCol,
    selectedWs, setExampleDescription, setExampleName, setLocalCollections, setNotice, setOpenTabs,
    setRemoteAlerts, setResponseExamples, setSaveCollection, setSaveExampleOpen, setSaveLocalCollection, setSaveName,
    setSaveOpen, setSaveScope, setSaveWs, setSavedRequests, setWorkspaceRequestLists, showConflictDialog,
    snapshot, suggestExampleName, tabSaved, token, updateLocalRequest, updateWorkspaceRequest,
    upsertResponseExample, url, workspaceCollectionKey, workspaces,
  });
  // Realtime operations use the same Workbench state as the old inline handlers.
  const realtimeActions = createRealtimeActions({
    api, activeTabRef, currentTokenRef, collections, draftsRef, expandedCollections, getWorkspaceCollections, getWorkspaceRequests,
    openTabsRef, realtimeHandlerRef, realtimeQueueRef, realtimeTimerRef, reconcileRequestTabs, restoreDraft,
    selectedColRef, selectedWorkspaceRef, setCollections, setOpenTabs, setRemoteAlerts, setSavedRequests,
    setSelectedCol, setWorkspaceRequestLists, snapshotRef, synchronizeWorkspaceChanges, workspaceDraft, workspaceRequestLists,
  });
  // History operations use the same Workbench state as the old inline handlers.
  const historyActions = createRequestHistoryActions({
    activeTabRef, api, applyFieldMerge, canEditCloud, conflictDialog, currentTokenRef,
    draftsRef, freshRequest, getMessage, localCollections, openSaveAs, openTabsRef,
    reconcileCloudRequests, restoreDraft, rows, selectTab, selectedColRef, selectedWorkspaceRef,
    setConflictDialog, setCurrentRequestName, setNotice, setOpenTabs, setRemoteAlerts, setSavedRequests,
    setVersionDialog, setWorkspaceRequestLists, snapshotRef, tabSaved, token, versionDialog,
    workspaceCollectionKey, workspaceDraft,
  });
  // Tabs operations use the same Workbench state as the old inline handlers.
  const tabActions = createRequestTabActions({
    EMPTY_HEADER, activeTabRef, api, binaryFile, body, canEditCloud,
    cancelledRequestNameRef, currentAuth, currentTokenRef, documentation, draftsRef, formFields,
    format, freshRequest, getMessage, isReadOnlyCloudTab, method, needsCloseConfirmation,
    openBoundRequest, openTabs, originalRequestNameRef, params, parseCurl, planTabClose,
    postScript, preScript, prettyResponse, reqTab, requestFingerprint, resTab,
    responseExamples, responsePretty, result, rows, sandboxDocKey, sanitizeResponseExamples,
    scriptDiagnostic, scriptError, scriptLog, scriptTests, selectedCol, selectedWs,
    sessionDocumentationOverlays, setActiveTabId, setApiKeyIn, setApiKeyName, setApiKeyValue, setAuthType,
    setBasicPassword, setBasicUsername, setBearerToken, setBinaryFile, setBody, setCloseConfirmation,
    setConsoleOpen, setDocumentation, setEditingRequestName, setFormFields, setFormat, setMethod,
    setNotice, setOpenTabs, setPage, setParams, setPostScript, setPreScript,
    setPrettyResponse, setReqTab, setResTab, setResponseExamples, setResponsePretty, setResult,
    setRows, setScriptDiagnostic, setScriptError, setScriptJump, setScriptLog, setScriptTests,
    setTabMenu, setUrl, tabSaved, tabSequence, token, url,
    workspaceDraft,
  });
  // Collections operations use the same Workbench state as the old inline handlers.
  const collectionActions = createCollectionActions({
    EMPTY_HEADER, STORAGE_LOCAL, STORAGE_WORKSPACE, WORKSPACE_DRAG, actionDialog, actionName,
    activeSource, activeTabRef, addTab, adoptSavedRevision, allowedStorageScope, api,
    applyLocalAction, blankDraft, busyAction, canEditCloud, currentTokenRef, selectedWorkspaceRef, collectionImportBusy, collectionImportDestination,
    collectionImportFile, collectionImportSources, collections, collectionsScope, decodeStoredHeaders, doAction,
    draftsRef, encodeStoredHeaders, exampleToResult, findBoundTab, freshRequest, getMessage,
    importRequestsAndEnvironments, loadSavedRequest, localCollectionName, localCollections, openCollectionRunner, openCollectionVariables,
    openDocumentation, openExportChoice, openRequestHistory, openTabs, openTabsRef, parseImportText,
    pendingSource, readSavedCollectionVariables, renameResponseExample, requestFingerprint, responseExamples, restoreDraft,
    rows, sanitizeResponseExamples, savedRequests, selectTab, selectedCol, selectedWs,
    setActionDialog, setActionName, setActiveTabId, setAllWorkspaceCollections, setCollectionImportBusy, setCollectionImportDestination,
    setCollectionImportError, setCollectionImportFile, setCollectionImportOpen, setCollections, setCreatingLocalCollection, setExpandedCollections,
    setExplorerTab, setLocalCollectionName, setLocalCollections, setLocalExpandAllSignal, setNotice, setOpenTabs,
    setPage, setResTab, setResponseExamples, setResult, setRevealLocalDraft, setSavedRequests,
    setSelectedCol, setSidebarCollapsed, setWorkspaceCollectionDocs, setWorkspaceMenu, setWorkspaceRequestLists, setWorkspaceSorted,
    snapshot, storageScope, toLocalCollection, toggleWorkspaceCollection, token, url,
    validateLibrary, workspaceCollectionKey, workspaceDocKey, workspaceRequestLists,
  });
  // Both collection and tab actions are ready: the helpers only run on user events.
  const cloudRequestOpenActions = createCloudRequestOpenActions({
    api, cloudOpenEpoch, currentTokenRef, selectedWorkspaceRef,
    selectedWs, selectedCol, token, openTabs, tabActions, collectionActions,
    setNotice, getMessage,
  });
  // Runner operations use the same Workbench state as the old inline handlers.
  const runnerActions = createCollectionRunnerActions({
    STORAGE_WORKSPACE, activeEnvironment, activeTabRef, api, collectionVariableKey, collections,
    collectionsScope, getMessage, interceptorMode, localCollections, me, openTabs,
    readCollectionVariables, readSavedCollectionVariables, runnerFetchId, savedCollectionVariableMap, selectedCol, selectedWs,
    sessionCollectionVariables, setNotice, setRunnerLoading, setRunnerTarget, token, varsFromEnv,
    workspaceDraft,
  });
  // Invitations operations use the same Workbench state as the old inline handlers.
  const invitationActions = createInvitationActions({
    acceptingInvite, api, canManageMembers, currentTokenRef, getMessage, invitationBusy,
    inviteEmail, inviteRoles, inviteToken, loadWorkspaces, selectedWorkspaceRef, selectedWs,
    setAcceptingInvite, setInvitationBusy, setInvitationError, setInvitationRows, setInviteAcceptError, setInviteEmail,
    setInviteOpen, setInviteRoles, setInviteToken, setNotice, setPage, setSelectedWs,
    setWsTab, token,
  });
  // Request operations use the same Workbench state as the old inline handlers.
  const requestActions = createRequestExecutionActions({
    activeEnvironment, activeSessionEnvironmentKey, activeTabRef, api, appendConsoleEvent, applyScriptVariables,
    binaryFile, body, buildOutgoing, canEditCloud, canWriteEnvironment, collectionVariableKey,
    currentTokenRef, dispatchRequest, draftsRef, envScope, executeWorkbenchRequest, formFields,
    format, getMessage, interceptorMode, isReadOnlyCloudTab, loading, me,
    method, openTabsRef, postScript, preScript, readCollectionVariables, readSavedCollectionVariables,
    rows, savedCollectionVariableMap, scriptDiagnostic, scriptError, selectedWs, sessionCollectionVariables,
    setLoading, setNotice, setOpenTabs, setPrettyResponse, setRecent, setResTab,
    setResponsePretty, setResult, setScriptDiagnostic, setScriptError, setScriptJump, setScriptLog,
    setScriptTests, stashActive, url, varsFromEnv, writeCollectionVariables,
  });
  // Collection search and presentation derivation stay outside the large controller.
  const {visibleCollections,visibleLocalCollections}=useVisibleWorkbenchCollections({
    collections,workspaceRequestLists,explorerSearch,collectionSort,selectedWs,localCollections,
  });
  const {responseType,responseText}=requestResponseView(result,resTab,responsePretty,prettyResponse);
  const commandItems = createCommandPaletteItems({
    commandOpen, addTab, setExplorerTab, setSidebarCollapsed, setPage,
    openContext, openTabs, localCollections, token, savedRequests, selectTab,
    openLocalRequest, loadSavedRequest,
  });
  const visibleCommandItems = filterCommandPaletteItems(commandItems, commandQuery);
  // Explicit UI contract. Runtime-only secret/session refs stay inside this hook.
  return {
    AppHeader, GOOGLE_CLIENT_ID, Link2, LogIn, LogOut, RetroSelect, STORAGE_LOCAL,
    STORAGE_WORKSPACE, Search, Settings2, activeEnvId, activeWorkspace, currentEnvironments, envScope,
    googleLinked, isDarkAppearance, logout, me, openContext, selectedWs, setActiveEnvId,
    setAuthOpen, setCommandIndex, setCommandOpen, setCommandQuery, setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword,
    storageScope, theme, token, updateStorageScope, workspaces, page, settingsCategory, setSettingsCategory, sidebarCollapsed,
    rightWidth, WorkbenchNavigation, Code2, FileUp, History, Layers3, PanelLeftClose,
    PanelLeftOpen, Variable, endRightResize, explorerTab, resizeRight, resizingRight,
    setPage, setRightWidth, setSidebarCollapsed, WorkbenchExplorer, environmentContext, selfMember, openTabs,
    activeTabId, localEnvironments, localCollections, recent, collectionsScope,
    explorerSearch, collectionSort, busyAction, canEditCloud, creatingLocalCollection, localCollectionName, collections,
    visibleLocalCollections, localExpandAllSignal, revealLocalDraft, visibleCollections, expandedCollections, selectedCol, workspaceRequestLists,
    WORKSPACE_DRAG, workspaceSorted, expandedWorkspaceExamples, setSelectedWs, setExpandedCollections, navigate, setAuthMode, persistEnvironment,
    createEnvironment, deleteEnvironment, duplicateEnvironment, openExportChoice, importEnvironmentFile, codePreviewRequest, buildCodeRequest,
    snapshot, importRequestsAndEnvironments, setNotice, loadRequest, setWsTab, setExplorerSearch,
    setCollectionSort, expandOrCollapseAllCollections, openCollectionImport, setCreatingLocalCollection, createExplorerCollection, setLocalCollectionName, openLocalRequest,
    openLocalExample, handleLocalMenu, moveLocalRequest, moveLocalFolder, moveLocalCollection, moveWorkspaceCollection, selectTab, moveWorkspaceFolder, reorderWorkspaceRequest, moveWorkspaceRequest, showWorkspaceMenu, refreshCloudCollection, toggleWorkspaceCollectionById,
    createCollectionDraft, setExpandedWorkspaceExamples, loadSavedRequest, openWorkspaceExample, draftsRef, CodeSidebar, ImportExportSidebar,
    WorkbenchSettings, setTheme, split, setSplit, interceptorMode, setInterceptorMode, extensionStatus,
    refreshExtensionStatus, RequestTabs, requestWorkbenchStore, remoteAlerts, tabDragRef, closeTab, showTabContext,
    setTabMenu, addTab, runnerLoading, openRunnerForCurrentCollection, consoleOpen, setConsoleOpen, realtimeStatus,
    openRequestHistory, workspaceMenu, MenuActionItem, handleWorkspaceMenu, setWorkspaceMenu, tabMenu, performTabAction, Copy,
    openSaveAs, Save, X, ArrowRight, AlertTriangle, showConflictDialog, RequestWorkbench,
    AUTH_OPTIONS, ChevronRight, Columns2, KeyValueEditor, LayoutPanelTop, METHODS, Pencil,
    RequestBody, ResponsePane, ScriptEditor, Send, ShieldCheck, Suspense, TextEditor,
    VariableAwareInput, VariableUrlInput, activeRequestName, apiKeyIn, apiKeyName, apiKeyValue, authType,
    basicPassword, basicUsername, bearerToken, beautifyBody, beautifyResult, beginRequestRename, binaryFile,
    body, cancelRequestRename, draggingRef, editingRequestName, finishRequestRename, formFields, format,
    headerCount, importCurlIntoCurrent, isCurl, isReadOnlyCloudTab, loading, method, onSplitterEnd,
    onSplitterMove, openSaveExampleDialog, panesRef, params, postScript, preScript, reqTab,
    requestNameInputRef, resTab, resetSandboxRequest, responseExamples, responsePretty, responseText, responseType,
    result, rows, saveCurrent, scriptDiagnostic, scriptError, scriptJump, scriptLog,
    scriptTests, selectFormat, sendRequest, setApiKeyIn, setApiKeyName, setApiKeyValue, setAuthType,
    setBasicPassword, setBasicUsername, setBearerToken, setBinaryFile, setBody, setCurrentRequestName, setFormFields,
    setMethod, setOpenTabs, setParams, setPostScript, setPreScript, setReqTab, setResTab,
    setResponsePretty, setRows, setScriptDiagnostic, setScriptError, setScriptJump, setUrl, splitPercent,
    url, variableUi, WorkspaceManager, canCreateWorkspace, newWs, wsTab, newCollection,
    savedRequests, canManageMembers,
    showMemberAdd, inviteOpen, workspaceMemberStats, newMember, newMemberRoles, assignableRoles, inviteEmail,
    inviteRoles, invitationBusy, invitationRows, invitationError, memberSearch, memberRoleFilter, visibleWorkspaceMembers,
    canAssignRoles, expandedMemberAccess, editingMemberId, editingMemberRoles, doAction, setNewWs, loadWorkspaces,
    setNewCollection, setCollections, setSelectedCol, setSavedRequests, setShowMemberAdd, setInviteOpen, setNewMember, setNewMemberRoles, setMembers, inviteMember,
    setInviteEmail, setInviteRoles, actOnInvitation, setMemberSearch, setMemberRoleFilter, setExpandedMemberAccess, setEditingMemberId,
    setEditingMemberRoles, selectedWorkspaceRef, currentTokenRef, CommandPalette, commandIndex, commandOpen, commandQuery,
    visibleCommandItems, notice, createPortal, CollectionDialogs, ArrowDownToLine, Braces, CollectionVariablesEditor,
    Dialog, DocumentationEditor, FileJson, applyCollectionVariableSession, canWorkspace, collectionTargetKey, collectionVariablesBusy,
    collectionVariablesData, collectionVariablesError, collectionVariablesFetchId, collectionVariablesLoading, collectionVariablesTarget, confirmExport, docBusy,
    documentationTarget, exportChoice, exportFormat, exportIncludeSecrets, readCollectionVariables, reloadCollectionVariables, resetCollectionVariableSession,
    saveCollectionVariableDefaults, saveDocumentation, sessionCollectionVariables, setCollectionVariablesTarget, setDocumentationTarget, setExportChoice, setExportFormat,
    setExportIncludeSecrets, AuthOverlays, inviteToken, inviteAcceptError, acceptingInvite, authOpen, authMode,
    authError, authBusy, googleLinkOpen, googleLinkPassword, googleLinkError, setInviteToken,
    setInviteAcceptError, acceptInvitation, submitGoogleAuth, setAuthError, submitGoogleLink,
    RequestDialogs, ImportDestinationPicker, RequestRevisionPanel, actionDialog, actionName, activeSource, applyMergedRevision,
    closeConfirmation, collectionImportBusy, collectionImportDestination, collectionImportError, collectionImportFile, collectionImportOpen, conflictDialog,
    exampleDescription, exampleName, executeActionDialog, reloadCloudConflict, restoreRequestRevision, saveCollection, saveCols,
    saveConflictCopy, saveExampleOpen, saveLocalCollection, saveName, saveOpen, saveRequest, saveResponseExample,
    saveScope, saveWs, selectRequestHistoryRevision, setActionDialog, setActionName, setCloseConfirmation, setCollectionImportDestination,
    setCollectionImportError, setCollectionImportFile, setCollectionImportOpen, setConflictDialog, setExampleDescription, setExampleName, setSaveCollection,
    setSaveExampleOpen, setSaveLocalCollection, setSaveName, setSaveOpen, setSaveScope, setSaveWs, setVersionDialog,
    statusTone, submitCollectionImport, versionDialog, workspaceDraft, runnerTarget, CollectionRunner, closeRunner,
    api, dispatchRequest, PakpostConsole, consoleEvents, clearConsoleEvents, navigateConsoleEvent, FastTooltip,
  };
}
