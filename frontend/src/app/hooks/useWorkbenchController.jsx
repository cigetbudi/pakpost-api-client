import { useEnvironmentDataLifecycle } from '../../features/environments/hooks/useEnvironmentDataLifecycle.js';
import { useWorkbenchPreferencesPersistence } from './useWorkbenchPreferencesPersistence.js';
import { useCommandPaletteState } from './useCommandPaletteState.js';
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
import { useAuthOverlayState } from '../../features/auth/hooks/useAuthOverlayState.js';
import { useCollectionSessionState } from '../../features/collections/hooks/useCollectionSessionState.js';
import { createRealtimeActions } from '../../features/realtime/controllers/createRealtimeActions.js';
import { createRequestHistoryActions } from '../../features/requests/controllers/createRequestHistoryActions.js';
import { createRequestTabActions } from '../../features/requests/controllers/createRequestTabActions.js';
import { createCollectionActions } from '../../features/collections/controllers/createCollectionActions.js';
import { createCollectionRunnerActions } from '../../features/collections/controllers/createCollectionRunnerActions.js';
import { createInvitationActions } from '../../features/workspace/controllers/createInvitationActions.js';
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
import { invalidateBrowserSession, planSignedOutWorkbench } from '../../features/auth/services/logoutWorkbench.js';
import { useWorkspaceRealtimeLifecycle } from '../../features/realtime/hooks/useWorkspaceRealtimeLifecycle.js';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import { api } from '../../services/httpClient.js';
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
  ArrowDownToLine, ArrowRight, Braces, AlertTriangle, FileUp, Variable, ChevronRight, Code2, Columns2, Copy, FileJson, History, Layers3, LayoutPanelTop, LogIn, LogOut, Save, Search, Send, Pencil, Settings2, ShieldCheck, Users, X, PanelLeftClose, PanelLeftOpen, Link2,
} from 'lucide-react';
import {filterWorkspaceMembers,summarizeWorkspaceMembers} from '../../features/workspace/services/workspaceRoleInsights.js';
import {canWorkspace,currentWorkspaceMember} from '../../features/workspace/services/workspaceRoles.js';
import { KeyValueEditor } from '../../features/requests/components/KeyValueEditor';
import { DocumentationEditor } from '../../features/collections/components/DocumentationEditor';
import { isEnabled, encodeStoredHeaders, decodeStoredHeaders } from '../../features/requests/services/requestMetadata';
import {readWorkspaceCollectionDocs,writeWorkspaceCollectionDocs,clearWorkspaceCollectionDocs,workspaceDocKey} from '../../features/collections/services/documentationStore';
import { RetroSelect } from '../../components/ui/RetroSelect';
import { ImportDestinationPicker } from '../../components/ui/ImportDestinationPicker';
import { VariableUrlInput } from '../../features/requests/components/VariableUrlInput';
import {VariableAwareInput} from '../../features/requests/components/VariableAwareInput.jsx';
import {putEnvironmentVariable,isSensitiveVariable} from '../../features/environments/services/variableExperience.js';
import {sessionEnvironmentKey,readableEnvironmentValues,applySessionOverrides,sessionOverridesFromValues,storeSessionOverrides} from '../../features/environments/services/sessionEnvironment.js';
import { readEnvironmentSelections, writeEnvironmentSelections } from '../../features/environments/services/environmentContext.js';
import { FastTooltip } from '../../components/ui/FastTooltip';
import {sortCollectionRoots} from '../../features/collections/services/collectionSort';
import {isWorkspaceCollectionOpen, toggleWorkspaceCollection, setAllWorkspaceCollections, workspaceCollectionKey} from '../../features/collections/services/collectionExpansion';
import { blankDraft, parseCurl, isCurl, parseImportText } from '../../features/import-export/services/importExport';
import {parseEnvironmentDocument,uniqueEnvironmentImports} from '../../features/environments/services/environmentImport';
import { clearWorkbenchCache, readWorkbenchCache, writeWorkbenchCache } from '../../features/workspace/services/workspaceCache';
import {toLocalCollection,validateLibrary,readLocalCollections,writeLocalCollections} from '../../features/collections/services/localCollections';
import {planTabClose} from '../../features/requests/services/tabActions';
import {applyLocalAction,updateLocalRequest,createLocalSavedRequest} from '../../features/collections/services/localCollectionActions';
import {stripJsonComments,hasJsonComments} from '../../features/requests/services/jsonComments';
import {findBoundTab} from '../../features/requests/services/sourceTabs';
import {freshRequest, pendingSource, requestFingerprint, needsCloseConfirmation, tabSaved} from '../../features/requests/services/draftLifecycle';
import {isReadOnlyCloudTab, sandboxCacheTabIds,sandboxDocKey} from '../../features/requests/services/qaSandbox.js';
import {applyFieldMerge} from '../../features/requests/services/requestVersionMerge.js';
import {defaultStorageScope,allowedStorageScope,STORAGE_LOCAL,STORAGE_WORKSPACE,collectionImportSources,saveCloudCollections} from '../../features/import-export/services/storageScope';
import {MenuActionItem} from '../../components/ui/MenuActionItem';
import { isDarkAppearance, normalizeAppearance, readAppearance } from '../../features/settings/services/appearance';
import { bodyFormat, languageFromMime, formatSource, resolveVars } from '../../features/requests/services/requestTools';
import {createResponseExample,exampleToResult,renameResponseExample,sanitizeResponseExamples,statusTone,suggestExampleName,upsertResponseExample} from '../../features/requests/services/responseExamples';
import {AUTH_OPTIONS} from '../../features/requests/services/authorization';
import {readInterceptorMode,writeInterceptorMode,probeExtension,dispatchRequest,EXTENSION_CHANNEL} from '../../features/requests/services/interceptorClient';
import {discoverApiDestinations} from '../../features/requests/services/interceptorDiscovery';
import {appendConsoleEvent, subscribeConsoleEvents, clearConsoleEvents} from '../../features/console/services/pakpostConsoleStore.js';
import {collectionVariableKey, readCollectionVariables, writeCollectionVariables, resetCollectionVariables, savedCollectionVariableMap, validateCollectionVariableRows, resolvedScriptVariables} from '../../features/collections/services/collectionVariableSession.js';
import { TextEditor, WorkbenchSettings, CodeSidebar, ImportExportSidebar, PakpostConsole, CollectionRunner, WorkspaceManager, CollectionVariablesEditor, RequestRevisionPanel, RequestBody, ScriptEditor } from '../components/DeferredFeatures.jsx';

const CACHED = readWorkbenchCache();
const RECOVERED = CACHED?.drafts?.[CACHED.activeTabId] || {};
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const EMPTY_HEADER = { key: '', value: '', description: '', enabled: true };
const storedToken = () => sessionStorage.getItem('pakpost_token') || '';
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
  const {consoleOpen, setConsoleOpen, consoleEvents} = useConsoleDrawer();
  const {runnerTarget, setRunnerTarget, runnerLoading, setRunnerLoading, runnerFetchId} = useRunnerDialogState();
  const [interceptorMode,setInterceptorMode]=useState(()=>readInterceptorMode(localStorage));
  const [extensionStatus,setExtensionStatus]=useState({state:'unknown',version:''});
  const { commandOpen, setCommandOpen, commandQuery, setCommandQuery, commandIndex, setCommandIndex } = useCommandPaletteState();
  const {theme, setTheme} = useWorkbenchTheme();
  const [token, setToken] = useState(storedToken);
  useEffect(()=>{if(new URLSearchParams(window.location.search).has('invite')){const u=new URL(window.location.href);u.searchParams.delete('invite');window.history.replaceState({},'',u.pathname+u.search+u.hash)}},[]);
  const currentTokenRef=useRef(token);
  currentTokenRef.current=token;
  // Shared header storage context for both Collections and Environments.
  // The legacy cached envScope keeps existing users on their last chosen storage.
  const [storageScope,setStorageScope] = useState(()=>allowedStorageScope(!!storedToken(),CACHED?.envScope || defaultStorageScope(!!storedToken())));
  const collectionsScope=storageScope;
  const envScope=storageScope;
  const [me, setMe] = useState(null);
  const {
    authOpen, setAuthOpen, authMode, setAuthMode, authBusy, setAuthBusy,
    authError, setAuthError, authForm, setAuthForm, googleLinkOpen, setGoogleLinkOpen,
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
    localEnvironments: initialLocalEnvs(),
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
  const [workspaceUiStore] = useState(createWorkspaceUiStore);
  const { workspaces, setWorkspaces, selectedWs, setSelectedWs, members, setMembers, membersWorkspaceId, setMembersWorkspaceId, teams, setTeams, wsTab, setWsTab, selectedTeam, setSelectedTeam, teamMembers, setTeamMembers, newWs, setNewWs, newCollection, setNewCollection, newTeam, setNewTeam, newMember, setNewMember, newMemberRoles, setNewMemberRoles, editingMemberId, setEditingMemberId, editingMemberRoles, setEditingMemberRoles, memberSearch, setMemberSearch, memberRoleFilter, setMemberRoleFilter, showMemberAdd, setShowMemberAdd, inviteOpen, setInviteOpen, inviteEmail, setInviteEmail, inviteRoles, setInviteRoles, invitationRows, setInvitationRows, invitationError, setInvitationError, invitationBusy, setInvitationBusy, expandedMemberAccess, setExpandedMemberAccess, canCreateWorkspace, setCanCreateWorkspace, newTeamMember, setNewTeamMember } = useStore(workspaceUiStore);
  const selectedWorkspaceRef=useRef(selectedWs);
  selectedWorkspaceRef.current=selectedWs;
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
    localCollections: readLocalCollections(),
    collectionSort: localStorage.getItem('pakpost_v14_global_collection_sort') || 'manual',
  }));
  const { collections, setCollections, localCollections, setLocalCollections,
    selectedCol, setSelectedCol, savedRequests, setSavedRequests,
    collectionSort, setCollectionSort, expandedCollections, setExpandedCollections,
    expandedWorkspaceExamples, setExpandedWorkspaceExamples,
    localExpandAllSignal, setLocalExpandAllSignal, revealLocalDraft, setRevealLocalDraft,
    workspaceRequestLists, setWorkspaceRequestLists } = useCollectionWorkbench(collectionStore);
  const [creatingLocalCollection, setCreatingLocalCollection] = useState(false);
  const [collectionImportOpen,setCollectionImportOpen] = useState(false);
  const [collectionImportFile,setCollectionImportFile] = useState(null);
  const [collectionImportDestination,setCollectionImportDestination] = useState(()=>defaultStorageScope(!!storedToken()));
  const [collectionImportError,setCollectionImportError] = useState('');
  const [collectionImportBusy,setCollectionImportBusy] = useState(false);
  const [localCollectionName, setLocalCollectionName] = useState('');
  const selectedColRef=useRef(selectedCol);selectedColRef.current=selectedCol;
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveExampleOpen, setSaveExampleOpen] = useState(false);
  const [exampleName, setExampleName] = useState('');
  const [exampleDescription, setExampleDescription] = useState('');
  const [saveScope,setSaveScope] = useState('local');
  const [saveLocalCollection,setSaveLocalCollection] = useState('');
  const [actionDialog,setActionDialog] = useState(null);
  const [actionName,setActionName] = useState('');
  const [workspaceMenu,setWorkspaceMenu] = useState(null);
  const [documentationTarget,setDocumentationTarget]=useState(null);
  const [docBusy,setDocBusy]=useState(false);
  const [workspaceCollectionDocs,setWorkspaceCollectionDocs]=useState(()=>readWorkspaceCollectionDocs(localStorage));
  const [workspaceSorted,setWorkspaceSorted]=useState(()=>{try{return JSON.parse(localStorage.getItem('pakpost_workspace_sort')||'{}')}catch{return {}}});
  const tabDragRef=useRef(null);
  const [saveName, setSaveName] = useState('New request');
  const [saveWs, setSaveWs] = useState('');
  const [saveCollection, setSaveCollection] = useState('');
  const [saveCols, setSaveCols] = useState([]);
  const [busyAction, setBusyAction] = useState(false);
  const [split, setSplit] = useState(() => CACHED?.split || localStorage.getItem('pakpost_split') || 'horizontal');
  const [splitPercent, setSplitPercent] = useState(56);
  const [explorerTab, setExplorerTab] = useState(CACHED?.explorerTab === 'appearance' ? 'collections' : (CACHED?.explorerTab || 'collections'));
  const [explorerSearch, setExplorerSearch] = useState('');
  const [rightWidth,setRightWidth] = useState(()=>Math.min(650,Math.max(280,Number(localStorage.getItem('pakpost_v14_right_width'))||340)));
  const resizingRight=useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(CACHED?.sidebarCollapsed || false);
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
  const [params, setParams] = useState(RECOVERED.params || [{ ...EMPTY_HEADER }]);
  const [authType, setAuthType] = useState(RECOVERED.authType || 'none');
  const [bearerToken, setBearerToken] = useState(RECOVERED.bearerToken || '');
  const [basicUsername,setBasicUsername] = useState(RECOVERED.basicUsername||'');
  const [basicPassword,setBasicPassword] = useState(RECOVERED.basicPassword||'');
  const [apiKeyName,setApiKeyName] = useState(RECOVERED.apiKeyName||'X-API-Key');
  const [apiKeyValue,setApiKeyValue] = useState(RECOVERED.apiKeyValue||'');
  const [apiKeyIn,setApiKeyIn] = useState(RECOVERED.apiKeyIn||'header');
  const openTabs = useStore(requestWorkbenchStore, s => s.openTabs);
  const setOpenTabs = useStore(requestWorkbenchStore, s => s.setOpenTabs);
  const openTabsRef=useRef(openTabs);openTabsRef.current=openTabs;
  const [remoteAlerts,setRemoteAlerts]=useState({});
  const [conflictDialog,setConflictDialog]=useState(null);
  const [versionDialog,setVersionDialog]=useState(null);
  const [realtimeStatus,setRealtimeStatus]=useState('offline');
  const realtimeHandlerRef=useRef(null);
  const realtimeQueueRef=useRef([]);
  const realtimeTimerRef=useRef(null);
  const [tabMenu, setTabMenu] = useState(null);
  const [editingRequestName, setEditingRequestName] = useState(false);
  const requestNameInputRef = useRef(null);
  const originalRequestNameRef = useRef('');
  const cancelledRequestNameRef = useRef(false);
  const [closeConfirmation, setCloseConfirmation] = useState(null);
  const activeTabId = useStore(requestWorkbenchStore, s => s.activeTabId);
  const setActiveTabId = useStore(requestWorkbenchStore, s => s.setActiveTabId);
  const activeTabRef = useRef(CACHED?.activeTabId || 't1');
  const tabSequence = useRef(Math.max(1,...(CACHED?.openTabs || []).map(t=>Number(String(t.id).replace(/^t/,'')) || 0)));
  const draftsRef = useRef(CACHED?.drafts || {});
  const panesRef = useRef(null);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!editingRequestName || page !== 'tester') return;
    const input=requestNameInputRef.current;
    if (input) { input.focus(); input.select(); }
  }, [editingRequestName, activeTabId, page]);
  function beginRequestRename(...args) { return tabActions.beginRequestRename(...args); }
  function setCurrentRequestName(...args) { return tabActions.setCurrentRequestName(...args); }
  function finishRequestRename(...args) { return tabActions.finishRequestRename(...args); }
  function cancelRequestRename(...args) { return tabActions.cancelRequestRename(...args); }

  const currentAuth=()=>({authType,bearerToken,basicUsername,basicPassword,apiKeyName,apiKeyValue,apiKeyIn});
  function snapshot(...args) { return tabActions.snapshot(...args); }
  const snapshotRef=useRef(snapshot);snapshotRef.current=snapshot;
  function restoreDraft(...args) { return tabActions.restoreDraft(...args); }
  function stashActive(...args) { return tabActions.stashActive(...args); }
  useWorkbenchPreferencesPersistence({localCollections,workspaceCollectionDocs,collectionSort,rightWidth});
  function openContext(view){setExplorerTab(view);setSidebarCollapsed(false);setPage('tester');}
  function resizeRight(event){if(!resizingRight.current)return;setRightWidth(Math.max(280,Math.min(650,window.innerWidth-event.clientX-4)));}
  function endRightResize(event){if(resizingRight.current){resizingRight.current=false;try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}}}

  useEffect(()=>{
    if(!tabMenu)return;
    const dismiss=e=>{if(!e.target.closest?.('.pp-tab-context'))setTabMenu(null)};
    const escape=e=>{if(e.key==='Escape')setTabMenu(null)};
    const resized=()=>setTabMenu(null);
    window.addEventListener('pointerdown',dismiss);window.addEventListener('keydown',escape);window.addEventListener('resize',resized);
    return ()=>{window.removeEventListener('pointerdown',dismiss);window.removeEventListener('keydown',escape);window.removeEventListener('resize',resized)};
  },[tabMenu]);
  useEffect(()=>{if(!workspaceMenu)return;
    const click=e=>{if(!e.target.closest?.('.pp-collection-popup'))setWorkspaceMenu(null)};
    const key=e=>{if(e.key==='Escape')setWorkspaceMenu(null)};
    window.addEventListener('pointerdown',click);window.addEventListener('keydown',key);
    return ()=>{window.removeEventListener('pointerdown',click);window.removeEventListener('keydown',key)};
  },[workspaceMenu]);
  useEffect(()=>{try{localStorage.setItem('pakpost_workspace_sort',JSON.stringify(workspaceSorted))}catch{}},[workspaceSorted]);
  // Persist drafts for refresh recovery (debounced, plus a beforeunload flush).
  useEffect(()=>{
    const persist=()=>writeWorkbenchCache({openTabs,activeTabId:activeTabRef.current,
      drafts:draftsRef.current,active:snapshot(),recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope,
      // Cloud requests are RAM-only for ALL roles, not only QA/Writer.
      sandboxTabIds:sandboxCacheTabIds(openTabs,selectedWs,membersWorkspaceId===selectedWs&&canWorkspace(currentWorkspaceMember(members,me),'collection.write'))});
    const timer=setTimeout(persist,600);
    window.addEventListener('beforeunload',persist);
    return ()=>{clearTimeout(timer);window.removeEventListener('beforeunload',persist)};
  },[method,url,rows,body,documentation,format,formFields,binaryFile,preScript,postScript,responseExamples,scriptLog,scriptTests,scriptError,scriptDiagnostic,
    reqTab,resTab,result,params,authType,bearerToken,basicUsername,basicPassword,apiKeyName,apiKeyValue,apiKeyIn,openTabs,activeTabId,recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope,selectedWs,members,membersWorkspaceId,me]);
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
  async function openWorkspaceExample(request,collectionId,example) {
    const selection=++cloudOpenEpoch.current;
    if(!request?.isIndex)return collectionActions.openWorkspaceExample(request,collectionId,example);
    const workspaceId=selectedWs,auth=token;
    try {
      const full=await api(`/api/workspaces/${workspaceId}/collections/${collectionId}/requests/${request.id}`,'GET',undefined,auth);
      if(currentTokenRef.current!==auth||selectedWorkspaceRef.current!==workspaceId||selection!==cloudOpenEpoch.current)return;
      return collectionActions.openWorkspaceExample(full,collectionId,example);
    } catch(error) {
      if(currentTokenRef.current===auth&&selection===cloudOpenEpoch.current)setNotice(`Cannot open response example: ${getMessage(error)}`);
    }
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
  const WORKSPACE_DRAG='application/x-pakpost-workspace-request';
  async function moveWorkspaceRequest(...args) { return collectionActions.moveWorkspaceRequest(...args); }
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
  useEffect(() => { localStorage.setItem('pakpost_split', split); setSplitPercent(50); }, [split]);
  function onSplitterMove(e) {
    if (!draggingRef.current || !panesRef.current) return;
    const bounds = panesRef.current.getBoundingClientRect();
    const isSideBySide = split === 'vertical' && window.matchMedia('(min-width: 981px)').matches;
    const val = isSideBySide
      ? ((e.clientX - bounds.left) / bounds.width) * 100
      : ((e.clientY - bounds.top) / bounds.height) * 100;
    setSplitPercent(Math.min(78, Math.max(22, val)));
  }
  function onSplitterEnd(e) {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  async function loadSavedRequest(item) {
    const selection=++cloudOpenEpoch.current;
    if (!item?.isIndex) { tabActions.loadSavedRequest(item); return true; }
    const workspaceId=selectedWs;
    const collectionId=item.collectionId||selectedCol;
    const auth=token;
    const existing=openTabs.find(tab=>tab.source?.scope==='workspace'
      &&tab.source.workspaceId===workspaceId&&tab.source.collectionId===collectionId
      &&tab.source.requestId===item.id);
    if (existing) { tabActions.selectTab(existing.id); return true; }
    try {
      const full=await api(`/api/workspaces/${workspaceId}/collections/${collectionId}/requests/${item.id}`,'GET',undefined,auth);
      if (currentTokenRef.current!==auth||selectedWorkspaceRef.current!==workspaceId||selection!==cloudOpenEpoch.current)return false;
      tabActions.loadSavedRequest(full);
      return true;
    } catch(error) {
      if(currentTokenRef.current===auth&&selection===cloudOpenEpoch.current)setNotice(`Cannot open Cloud request: ${getMessage(error)}`);
      return false;
    }
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
  const varsFromEnv=(allowSecrets=true)=>{
    const base=readableEnvironmentValues(activeEnvironment);
    const variables=envScope===STORAGE_WORKSPACE?applySessionOverrides(base,activeSessionOverrides):base;
    if(!allowSecrets){
      for(const key of Object.keys(variables)){
        const definition=activeEnvironment?.variables?.find(v=>v.key===key);
        if(isSensitiveVariable(key,definition))variables[key]='[REDACTED]';
      }
    }
    return variables;
  };
  function rememberSessionValues(key,environment,values){
    if(!key||!environment)return;
    const next=sessionOverridesFromValues(readableEnvironmentValues(environment),values);
    if(storeSessionOverrides(sessionEnvironmentOverlays.current,key,next))refreshSessionEnvironment(v=>v+1);
  }
  async function quickEditVariable(key,value){
    if(!activeEnvironment)throw Error('Select an environment in the top toolbar first.');
    if(envScope===STORAGE_WORKSPACE&&!canWriteEnvironment){
      // Validate the key and reject edits to restricted server-side secrets.
      putEnvironmentVariable(activeEnvironment.variables,key,value);
      rememberSessionValues(activeSessionEnvironmentKey,activeEnvironment,{...varsFromEnv(),[key]:String(value)});
      setNotice('Variable changed for this session only. Cloud environment is unchanged.');
      return;
    }
    if(envScope===STORAGE_WORKSPACE&&(activeEnvironment.variables||[]).some(v=>v.isRedacted))
      throw Error('This environment contains restricted variables. Open Environments to edit with appropriate permissions.');
    const variables=putEnvironmentVariable(activeEnvironment.variables,key,value);
    await persistEnvironment({...activeEnvironment,variables});
  }
  const variableUi={variables:varsFromEnv(),definitions:activeEnvironment?.variables||[],
    source:activeEnvironment?`${envScope===STORAGE_WORKSPACE?`Cloud · ${workspaces.find(w=>w.id===selectedWs)?.name||'Workspace'}`:'Local · Browser'} / ${activeEnvironment.name}${envScope===STORAGE_WORKSPACE&&!canWriteEnvironment?' · Session-only edits':''}`:'No active environment',
    onEditVariable:activeEnvironment?quickEditVariable:null,
    onOpenEnvironments:()=>setExplorerTab('environments')};
  const { updateStorageScope, importEnvironmentFile, createEnvironment, duplicateEnvironment, openExportChoice, confirmExport, persistEnvironment, deleteEnvironment, applyScriptVariables } = createEnvironmentActions({
    STORAGE_WORKSPACE, allowedStorageScope, api, currentEnvironments, documentation, downloadJson,
    envScope, exportChoice, exportFormat, exportIncludeSecrets, getMessage, importPreparedEnvironments,
    isSensitiveVariable, localCollections, parseEnvironmentDocument, readSavedCollectionVariables, rememberSessionValues, selectedWs,
    setActiveEnvId, setCreatingLocalCollection, setExportChoice, setExportFormat, setExportIncludeSecrets, setLocalEnvironments,
    setNotice, setStorageScope, setWorkspaceEnvironments, token, workspaceCollectionDocs, workspaceDocKey,
    workspaceDraft,
  });
  const selectFormat=(v)=>{setFormat(v);};
  async function beautifyBody(){
    try{if(languageFromMime(format)==='json'&&hasJsonComments(body))throw Error('Remove JSON comments before Beautify (to avoid losing them).');setBody(await formatSource(body,languageFromMime(format)));setNotice('Body formatted');}
    catch(e){setNotice(`Cannot format: ${getMessage(e)}`)}
  }
  async function beautifyResult(){
    if(!result||result.error)return;
    try{setPrettyResponse(await formatSource(result.body||'',languageFromMime(result.headers?.['Content-Type']||result.headers?.['content-type']||'')));setResponsePretty(true);}
    catch(e){setNotice(`Cannot format response: ${getMessage(e)}`)}
  }
  const commandRequest = () => ({method,url,rows,params,body,format,formFields,binaryFile,auth:currentAuth()});
  function buildOutgoing(vars=varsFromEnv()) {
    return buildRequestCommand(commandRequest(), vars);
  }
  function buildCodeRequest(allowSecrets=false){
    if (allowSecrets) return buildOutgoing(varsFromEnv(true));
    return buildRedactedCodeRequest({request:commandRequest(),variableMap:varsFromEnv(false),allVariableMap:varsFromEnv(false)});
  }
  function codePreviewRequest(){
    return buildRequestPreview(commandRequest());
  }
  useEffect(() => {
    let ignore = false;
    if (!token) { setMe(null); setWorkspaces([]); return; }
    api('/api/auth/me', 'GET', undefined, token).then(user => { if (!ignore) setMe(user); })
      .catch(() => { if (!ignore) logout(); });
    return () => { ignore = true; };
  }, [token]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(t);
  }, [notice]);

  function logout() {
    // Auth invalidation must happen BEFORE reading any cached draft: missing
    // Local snapshots previously threw inside restoreDraft and aborted logout.
    currentTokenRef.current='';
    invalidateBrowserSession(sessionStorage, clearWorkbenchCache);
    clearWorkspaceCollectionDocs(localStorage);
    setWorkspaceCollectionDocs({});
    setToken('');setMe(null);setStorageScope(STORAGE_LOCAL);setPage('tester');
    setAuthOpen(false);setGoogleLinkOpen(false);setGoogleLinked(false);
    setGoogleLinkPassword('');setAuthForm({displayName:'',email:'',password:''});
    setRecent([]);setCollections([]);setSavedRequests([]);setWorkspaceRequestLists({});
    setRemoteAlerts({});setConflictDialog(null);setVersionDialog(null);
    workspaceUiStore.getState().resetWorkspaceUi();
    sessionEnvironmentOverlays.current.clear();sessionCollectionVariables.current.clear();
    savedCollectionVariablesCache.current.clear();sessionDocumentationOverlays.current.clear();
    setWorkspaceEnvironmentResult({context:'',items:[]});
    // Only retain Local requests, with a guaranteed draft for every tab.
    let planned;
    try {
      planned=planSignedOutWorkbench(openTabsRef.current,activeTabRef.current,
        draftsRef.current,snapshotRef.current());
    } catch {
      planned=planSignedOutWorkbench([],null,{},null);
    }
    draftsRef.current=planned.drafts;
    activeTabRef.current=planned.activeTabId;
    setOpenTabs(planned.tabs);setActiveTabId(planned.activeTabId);
    restoreDraft(planned.activeDraft);
    setNotice('Signed out. Your Local requests remain available.');
  }
  const { requiresLogin, navigate, completeSignIn, submitAuth, submitGoogleAuth, submitGoogleLink, loadWorkspaces } = createAuthActions({
    STORAGE_WORKSPACE, api, authBusy, authForm, authMode, currentTokenRef,
    getMessage, googleLinkPassword, setAuthBusy, setAuthError, setAuthForm, setAuthMode,
    setAuthOpen, setCanCreateWorkspace, setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword, setGoogleLinked,
    setMe, setNotice, setPage, setSelectedWs, setStorageScope, setToken,
    setWorkspaceEnvironmentResult, setWorkspaces, token,
  });
  useEffect(() => { if (token) loadWorkspaces(token); }, [token]);
  useWorkspaceRealtimeLifecycle({
    enabled: collectionsScope===STORAGE_WORKSPACE,
    token, workspaceId:selectedWs,
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

  useEffect(()=>{let current=true;if(!token){setGoogleLinked(false);return;}
    api('/api/auth/google/status','GET',undefined,token).then(x=>{if(current)setGoogleLinked(!!x.connected)}).catch(()=>{if(current)setGoogleLinked(false)});
    return()=>{current=false};},[token]);
  // Role editor state is scoped to the selected Workspace, never carried to another team.
  useEffect(()=>{setEditingMemberId('');setEditingMemberRoles([]);setNewMemberRoles(['Developer']);setInviteOpen(false);setInviteEmail('');setInviteRoles(['Developer']);setInvitationRows([]);setInvitationError('');setMemberSearch('');setMemberRoleFilter('all');setShowMemberAdd(false);setExpandedMemberAccess('');},[selectedWs]);
  useEffect(() => {
    if (!token || !selectedWs) { setCollections([]); setMembers([]); setMembersWorkspaceId(''); setTeams([]); return; }
    let cancelled=false;
    const epoch=workspaceFetchEpoch.current;
    // Show no stale workspace metadata while a different team is loading.
    setCollections([]);setMembers([]);setMembersWorkspaceId('');setTeams([]);
    Promise.all([
      api(`/api/workspaces/${selectedWs}/collections`, 'GET', undefined, token),
      api(`/api/workspaces/${selectedWs}/members`, 'GET', undefined, token),
      api(`/api/workspaces/${selectedWs}/teams`, 'GET', undefined, token),
    ]).then(([cols, mems, tms]) => {
      if(cancelled||epoch!==workspaceFetchEpoch.current)return;
      setCollections(cols); setMembers(mems); setMembersWorkspaceId(selectedWs); setTeams(tms);
      setSelectedCol(current => cols.some(x => x.id === current) ? current : cols[0]?.id || '');
      setSelectedTeam(current => tms.some(x => x.id === current) ? current : tms[0]?.id || '');
    }).catch(e => {if(!cancelled&&epoch===workspaceFetchEpoch.current)setNotice(getMessage(e));});
    return()=>{cancelled=true;};
  }, [selectedWs, token]);
  useEffect(() => {
    if (!token || !selectedWs || !selectedCol) { setSavedRequests([]); return; }
    let cancelled=false;
    const key=workspaceCollectionKey(selectedWs,selectedCol);
    const epoch=workspaceFetchEpoch.current;
    setSavedRequests(workspaceRequestLists[key]||[]);
    api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests/index`, 'GET', undefined, token)
      .then(items=>{if(cancelled||epoch!==workspaceFetchEpoch.current)return;setSavedRequests(items);setWorkspaceRequestLists(old=>({...old,[key]:items}));})
      .catch(e=>{if(!cancelled&&epoch===workspaceFetchEpoch.current)setNotice(getMessage(e));});
    return ()=>{cancelled=true;};
  }, [selectedWs, selectedCol, token]);
  // Fetch children for *every* expanded Neon collection, not only the selected one.
  // Fetch at most four new lists per render to avoid flooding the backend on Expand all.
  useEffect(()=>{
    if(!token||!selectedWs||explorerTab!=='collections'||collectionsScope!==STORAGE_WORKSPACE)return;
    const next=collections.filter(col=>col.id!==selectedCol
      && isWorkspaceCollectionOpen(expandedCollections,selectedWs,col.id,selectedCol)
      && !Object.prototype.hasOwnProperty.call(workspaceRequestLists,workspaceCollectionKey(selectedWs,col.id))
      && !workspaceRequestsPending.current.has(workspaceCollectionKey(selectedWs,col.id))).slice(0,4);
    for(const col of next){
      const key=workspaceCollectionKey(selectedWs,col.id);
      workspaceRequestsPending.current.add(key);
      const epoch=workspaceFetchEpoch.current;
      api(`/api/workspaces/${selectedWs}/collections/${col.id}/requests/index`,'GET',undefined,token)
        .then(items=>{if(epoch===workspaceFetchEpoch.current)setWorkspaceRequestLists(old=>({...old,[key]:items}));})
        .catch(e=>{if(epoch!==workspaceFetchEpoch.current)return;setNotice(`Cannot load ${col.name}: ${getMessage(e)}`);setWorkspaceRequestLists(old=>({...old,[key]:[]}));})
        .finally(()=>workspaceRequestsPending.current.delete(key));
    }
  },[token,selectedWs,selectedCol,collections,explorerTab,collectionsScope,expandedCollections,workspaceRequestLists]);
  useEffect(() => {
    if (!token || !selectedWs || !selectedTeam) { setTeamMembers([]); return; }
    api(`/api/workspaces/${selectedWs}/teams/${selectedTeam}/members`, 'GET', undefined, token)
      .then(setTeamMembers).catch(e => setNotice(getMessage(e)));
  }, [selectedWs, selectedTeam, token]);
  useEffect(() => {
    if (!token || !saveWs) { setSaveCols([]); return; }
    api(`/api/workspaces/${saveWs}/collections`, 'GET', undefined, token)
      .then(cols => { setSaveCols(cols); setSaveCollection(c => cols.some(x => x.id === c) ? c : cols[0]?.id || ''); })
      .catch(e => setNotice(getMessage(e)));
  }, [saveWs, token]);

  useEffect(() => {
    const onKeyboard = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if(page === 'tester' && !busyAction && !saveOpen && !saveExampleOpen && !actionDialog && !documentationTarget)saveCurrent();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && page === 'tester') {
        e.preventDefault();
        if (!loading) sendRequest();
      }
    };
    window.addEventListener('keydown', onKeyboard);
    return () => window.removeEventListener('keydown', onKeyboard);
  }, [page, loading, method, url, rows, body, documentation, params, authType, bearerToken,basicUsername,basicPassword,apiKeyName,apiKeyValue,apiKeyIn,format,formFields,activeEnvId,localEnvironments,workspaceEnvironments,preScript,postScript,responseExamples,openTabs,localCollections,token,selectedWs,selectedCol,busyAction,saveOpen,saveExampleOpen,actionDialog,documentationTarget]);

  useEffect(()=>{writeInterceptorMode(localStorage,interceptorMode)},[interceptorMode]);
  async function refreshExtensionStatus(){
    setExtensionStatus({state:'checking',version:''});
    try{const info=await probeExtension();setExtensionStatus({state:'connected',version:String(info?.version||'')});}
    catch{setExtensionStatus({state:'disconnected',version:''});}
  }
  useEffect(()=>{if(interceptorMode==='extension')refreshExtensionStatus();},[interceptorMode]);

  // User-invoked extension discovery: only scheme/host/port are exposed (no paths,
  // headers, tokens, or environment contents). The extension still prompts for permission.
  useEffect(()=>{
    const onDiscover=event=>{
      if(event.source!==window||event.origin!==window.location.origin)return;
      const data=event.data;
      if(data?.channel!==EXTENSION_CHANNEL||data?.type!=='DISCOVER_HOSTS_REQUEST'||typeof data.id!=='string'||data.id.length>100)return;
      const origins=discoverApiDestinations({
        url,openTabs,drafts:draftsRef.current,localCollections,workspaceRequestLists,
        localEnvironments,workspaceEnvironments
      });
      window.postMessage({channel:EXTENSION_CHANNEL,type:'DISCOVER_HOSTS_RESPONSE',id:data.id,origins},window.location.origin);
    };
    window.addEventListener('message',onDiscover);
    return ()=>window.removeEventListener('message',onDiscover);
  },[url,openTabs,localCollections,workspaceRequestLists,localEnvironments,workspaceEnvironments]);

  const activeWorkspace = workspaces.find(x => x.id === selectedWs);
  const canManageMembers=canWorkspace(selfMember,'member.manage');
  useEffect(()=>{
    let active=true;
    if(!token||!selectedWs||!canManageMembers){setInvitationRows([]);return;}
    const workspaceId=selectedWs;
    api(`/api/workspaces/${workspaceId}/invitations`,'GET',undefined,token)
      .then(data=>{if(active&&workspaceId===selectedWorkspaceRef.current)setInvitationRows(data)})
      .catch(e=>{if(active&&workspaceId===selectedWorkspaceRef.current)setInvitationError(getMessage(e))});
    return()=>{active=false};
  },[token,selectedWs,canManageMembers]);
  async function inviteMember(...args) { return invitationActions.inviteMember(...args); }
  async function actOnInvitation(...args) { return invitationActions.actOnInvitation(...args); }
  async function acceptInvitation(...args) { return invitationActions.acceptInvitation(...args); }

  const canManageTeams=canWorkspace(selfMember,'team.manage');
  const canAssignRoles=canWorkspace(selfMember,'role.assign');
  const assignableRoles=selfMember?.roles||[];
  const visibleWorkspaceMembers=filterWorkspaceMembers(membersWorkspaceId===selectedWs?members:[],{query:memberSearch,role:memberRoleFilter});
  const workspaceMemberStats=summarizeWorkspaceMembers(membersWorkspaceId===selectedWs?members:[]);
  const activeTeam = teams.find(x => x.id === selectedTeam);
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
    activeTabRef, currentTokenRef, draftsRef, expandedCollections, getWorkspaceCollections, getWorkspaceRequests,
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
  // The request editor rerenders on each keystroke. Explorer filtering and sorting
  // are derived only when collection data or the search/sort inputs change.
  const visibleCollections = useMemo(() => {
    const term = explorerSearch.trim().toLowerCase();
    const matching = !term ? collections : collections.filter(collection =>
      collection.name.toLowerCase().includes(term) ||
      (workspaceRequestLists[workspaceCollectionKey(selectedWs, collection.id)] || []).some(request =>
        `${request.name || ''} ${request.url || ''}`.toLowerCase().includes(term)));
    return sortCollectionRoots(matching, collectionSort);
  }, [collections, workspaceRequestLists, explorerSearch, collectionSort, selectedWs]);
  const visibleLocalCollections = useMemo(
    () => sortCollectionRoots(localCollections, collectionSort), [localCollections, collectionSort]);
  const responseType = result && !result.error ? (result.headers?.['Content-Type'] || result.headers?.['content-type'] || 'text/plain') : 'text/plain';
  const commandItems = commandOpen ? [
    {key:'new-request', title:'New HTTP request', subtitle:'Open an empty request tab', icon:'action', run:()=>addTab()},
    {key:'open-collections',title:'Show collections',subtitle:'Browse saved API requests',icon:'action',run:()=>{setExplorerTab('collections');setSidebarCollapsed(false);setPage('tester')}},
    {key:'open-history',title:'Open request history',subtitle:'Previously sent requests',icon:'action',run:()=>{setExplorerTab('history');setSidebarCollapsed(false);setPage('tester')}},
    {key:'environments',title:'Manage environments',subtitle:'Edit local and workspace variables',icon:'action',run:()=>openContext('environments')},
    {key:'code',title:'Generate code',subtitle:'cURL, Fetch, Go, C#, Python',icon:'action',run:()=>{setExplorerTab('code');setSidebarCollapsed(false);setPage('tester')}},
    ...openTabs.map(t=>({key:`tab-${t.id}`,title:t.name,subtitle:`${t.method} · Open tab`,method:t.method,run:()=>selectTab(t.id)})),
    ...localCollections.flatMap(col => (col.requests || []).map(req => ({key:`local-${col.id}-${req.id}`,title:req.requestName||req.name||'Untitled Request',subtitle:`${col.name} · ${req.url || ''}`,method:req.method||'GET',run:()=>openLocalRequest(req,col.id)}))),
    ...(token?savedRequests.map(req=>({key:`neon-${req.id}`,title:req.name,subtitle:`Workspace · ${req.url||''}`,method:req.method||'GET',run:()=>loadSavedRequest(req)})):[])
  ] : [];
  const visibleCommandItems = commandItems.filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(commandQuery.trim().toLowerCase())).slice(0,30);
  const responseText = result && !result.error ? (resTab === 'body' ? (responsePretty ? (prettyResponse||prettyJson(result.body||'')) : (result.body||'')) : JSON.stringify(result.headers || {}, null, 2)) : '';
  // Explicit UI contract. Runtime-only secret/session refs stay inside this hook.
  return {
    AppHeader, GOOGLE_CLIENT_ID, Link2, LogIn, LogOut, RetroSelect, STORAGE_LOCAL,
    STORAGE_WORKSPACE, Search, Settings2, activeEnvId, activeWorkspace, currentEnvironments, envScope,
    googleLinked, isDarkAppearance, logout, me, openContext, selectedWs, setActiveEnvId,
    setAuthOpen, setCommandIndex, setCommandOpen, setCommandQuery, setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword,
    storageScope, theme, token, updateStorageScope, workspaces, page, sidebarCollapsed,
    rightWidth, WorkbenchNavigation, Code2, FileUp, History, Layers3, PanelLeftClose,
    PanelLeftOpen, Users, Variable, endRightResize, explorerTab, resizeRight, resizingRight,
    setPage, setRightWidth, setSidebarCollapsed, WorkbenchExplorer, environmentContext, selfMember, openTabs,
    activeTabId, localEnvironments, localCollections, recent, teams, selectedTeam, collectionsScope,
    explorerSearch, collectionSort, busyAction, canEditCloud, creatingLocalCollection, localCollectionName, collections,
    visibleLocalCollections, localExpandAllSignal, revealLocalDraft, visibleCollections, expandedCollections, selectedCol, workspaceRequestLists,
    WORKSPACE_DRAG, workspaceSorted, expandedWorkspaceExamples, setSelectedWs, navigate, setAuthMode, persistEnvironment,
    createEnvironment, deleteEnvironment, duplicateEnvironment, openExportChoice, importEnvironmentFile, codePreviewRequest, buildCodeRequest,
    snapshot, importRequestsAndEnvironments, setNotice, loadRequest, setSelectedTeam, setWsTab, setExplorerSearch,
    setCollectionSort, expandOrCollapseAllCollections, openCollectionImport, setCreatingLocalCollection, createExplorerCollection, setLocalCollectionName, openLocalRequest,
    openLocalExample, handleLocalMenu, moveLocalRequest, selectTab, moveWorkspaceRequest, showWorkspaceMenu, refreshCloudCollection, toggleWorkspaceCollectionById,
    createCollectionDraft, setExpandedWorkspaceExamples, loadSavedRequest, openWorkspaceExample, draftsRef, CodeSidebar, ImportExportSidebar,
    WorkbenchSettings, setTheme, split, setSplit, interceptorMode, setInterceptorMode, extensionStatus,
    refreshExtensionStatus, RequestTabs, requestWorkbenchStore, remoteAlerts, tabDragRef, closeTab, showTabContext,
    setTabMenu, addTab, runnerLoading, openRunnerForCurrentCollection, consoleOpen, setConsoleOpen, realtimeStatus,
    openRequestHistory, workspaceMenu, MenuActionItem, handleWorkspaceMenu, tabMenu, performTabAction, Copy,
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
    savedRequests, canManageTeams, newTeam, activeTeam, newTeamMember, teamMembers, canManageMembers,
    showMemberAdd, inviteOpen, workspaceMemberStats, newMember, newMemberRoles, assignableRoles, inviteEmail,
    inviteRoles, invitationBusy, invitationRows, invitationError, memberSearch, memberRoleFilter, visibleWorkspaceMembers,
    canAssignRoles, expandedMemberAccess, editingMemberId, editingMemberRoles, doAction, setNewWs, loadWorkspaces,
    setNewCollection, setCollections, setSelectedCol, setSavedRequests, setNewTeam, setTeams, setNewTeamMember,
    setTeamMembers, setShowMemberAdd, setInviteOpen, setNewMember, setNewMemberRoles, setMembers, inviteMember,
    setInviteEmail, setInviteRoles, actOnInvitation, setMemberSearch, setMemberRoleFilter, setExpandedMemberAccess, setEditingMemberId,
    setEditingMemberRoles, selectedWorkspaceRef, currentTokenRef, CommandPalette, commandIndex, commandOpen, commandQuery,
    visibleCommandItems, notice, createPortal, CollectionDialogs, ArrowDownToLine, Braces, CollectionVariablesEditor,
    Dialog, DocumentationEditor, FileJson, applyCollectionVariableSession, canWorkspace, collectionTargetKey, collectionVariablesBusy,
    collectionVariablesData, collectionVariablesError, collectionVariablesFetchId, collectionVariablesLoading, collectionVariablesTarget, confirmExport, docBusy,
    documentationTarget, exportChoice, exportFormat, exportIncludeSecrets, readCollectionVariables, reloadCollectionVariables, resetCollectionVariableSession,
    saveCollectionVariableDefaults, saveDocumentation, sessionCollectionVariables, setCollectionVariablesTarget, setDocumentationTarget, setExportChoice, setExportFormat,
    setExportIncludeSecrets, AuthOverlays, inviteToken, inviteAcceptError, acceptingInvite, authOpen, authMode,
    authForm, authError, authBusy, googleLinkOpen, googleLinkPassword, googleLinkError, setInviteToken,
    setInviteAcceptError, acceptInvitation, setAuthForm, submitAuth, submitGoogleAuth, setAuthError, submitGoogleLink,
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
