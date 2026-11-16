import React, { useEffect, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import {
  ArrowDownToLine, ArrowRight, Braces, WandSparkles, AlertTriangle, FileUp, Variable, Bolt, ChevronDown, ChevronRight, Clock3, Code2, Columns2, Copy, FileJson, FolderClosed, FolderPlus, History, Layers3, LayoutPanelTop, LockKeyhole, LogIn, LogOut, Moon, Plus, Save, Search, Send, Pencil, Settings2, ShieldCheck, Sun, Terminal, Trash2, Users, X, Zap, PanelLeftClose, PanelLeftOpen, Link2, ChevronsUpDown, ChevronsDownUp,
} from 'lucide-react';
import { TextEditor } from './features/Editors';
import { GoogleSignInButton } from './features/GoogleSignInButton';
import { WorkspaceRolePicker } from './features/WorkspaceRolePicker.jsx';
import {canGrantRole,canWorkspace,currentWorkspaceMember,normalizeRoles,WORKSPACE_ROLES} from './features/workspaceRoles.js';
import { KeyValueEditor } from './features/KeyValueEditor';
import { DocumentationEditor } from './features/DocumentationEditor';
import { emptyRow, isEnabled, encodeStoredHeaders, decodeStoredHeaders } from './features/requestMetadata';
import {readWorkspaceCollectionDocs,writeWorkspaceCollectionDocs,workspaceDocKey} from './features/documentationStore';
import { RetroSelect } from './features/RetroSelect';
import { ImportDestinationPicker } from './features/ImportDestinationPicker';
import { VariableUrlInput } from './features/VariableUrlInput';
import {VariableAwareInput} from './features/VariableAwareInput.jsx';
import {putEnvironmentVariable,isSensitiveVariable} from './features/variableExperience.js';
import {sessionEnvironmentKey,readableEnvironmentValues,applySessionOverrides,sessionOverridesFromValues,storeSessionOverrides} from './features/sessionEnvironment.js';
import {environmentContextKey,environmentsForContext,readEnvironmentSelections,selectionForContext,setSelectionForContext,writeEnvironmentSelections} from './features/environmentContext.js';
import { FastTooltip } from './features/FastTooltip';
import { EnvironmentExplorer } from './features/EnvironmentExplorer';
import { WorkbenchSettings } from './features/WorkbenchSettings';
import {sortCollectionRoots} from './features/collectionSort';
import {isWorkspaceCollectionOpen, toggleWorkspaceCollection, setAllWorkspaceCollections, workspaceCollectionKey} from './features/collectionExpansion';
import { CodeSidebar, ImportExportSidebar } from './features/WorkbenchSidebars';
import { blankDraft, parseCurl, isCurl, parseImportText } from './features/importExport';
import {parseEnvironmentDocument,uniqueEnvironmentImports} from './features/environmentImport';
import { readWorkbenchCache, writeWorkbenchCache } from './features/workspaceCache';
import {toLocalCollection,validateLibrary,readLocalCollections,writeLocalCollections} from './features/localCollections';
import {planTabClose,reorderTabs} from './features/tabActions';
import {applyLocalAction,updateLocalRequest,createLocalSavedRequest} from './features/localCollectionActions';
import {exportCollectionByFormat,exportEnvironmentByFormat,exportFileName} from './features/exportFormats';
import {stripJsonComments,hasJsonComments} from './features/jsonComments';
import {findBoundTab} from './features/sourceTabs';
import {freshRequest, pendingSource, requestFingerprint, needsCloseConfirmation, hasUnsavedMarker, tabSaved} from './features/draftLifecycle';
import {LocalCollectionsTree} from './features/LocalCollectionsTree';
import {defaultStorageScope,allowedStorageScope,STORAGE_LOCAL,STORAGE_WORKSPACE,cloudEndpointCount,collectionImportSources,saveCloudCollections} from './features/storageScope';
import {MenuActionItem} from './features/MenuActionItem';
import { isDarkAppearance, normalizeAppearance, readAppearance } from './features/appearance';
import { BODY_FORMATS, bodyFormat, languageFromMime, syntaxProblem, formatSource, resolveVars, resolveRows, buildCommand } from './features/requestTools';
import { runSandbox } from './features/runScript';
import { postmanRequestSnapshot } from './features/postmanCompat';
import {createResponseExample,exampleToResult,renameResponseExample,sanitizeResponseExamples,statusTone,suggestExampleName,upsertResponseExample} from './features/responseExamples';
import {applyAuthorization,AUTH_OPTIONS} from './features/authorization';
import {readInterceptorMode,writeInterceptorMode,probeExtension,dispatchRequest,EXTENSION_CHANNEL} from './features/interceptorClient';
import {discoverApiDestinations} from './features/interceptorDiscovery';

const CACHED = readWorkbenchCache();
const RECOVERED = CACHED?.drafts?.[CACHED.activeTabId] || {};
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const EMPTY_HEADER = { key: '', value: '', description: '', enabled: true };
const storedToken = () => sessionStorage.getItem('pakpost_token') || '';
const getMessage = (e) => e?.message || 'Something went wrong';

async function api(path, method = 'GET', body, token = '') {
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const messages=Array.isArray(data?.errors)?data.errors.map(e=>e.message||String(e)):
      data?.errors&&typeof data.errors==='object'?Object.entries(data.errors).flatMap(([key,items])=>
        (Array.isArray(items)?items:[items]).map(message=>`${key}: ${message}`)):[];
    throw new Error(data?.message||data?.detail||messages.join(', ')||data?.title||`HTTP ${res.status}`);
  }
  return data;
}
const toRows = (headers = {}) => Object.entries(headers).map(([key, value]) => ({ key, value }));
function prettyJson(text) { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } }
const initialLocalEnvs=()=>{
  try {
    const data=JSON.parse(localStorage.getItem('pakpost_guest_envs')||'[]');
    const secrets=JSON.parse(sessionStorage.getItem('pakpost_guest_secrets')||'{}');
    return data.map(env=>({...env,variables:env.variables.map(v=>v.isSecret?{...v,value:secrets[env.id]?.[v.key]||''}:v)}));
  }catch{return []}
};
const rowFromFile = (file,base64) => ({key:'file',value:'',fileName:file.name,fileBase64:base64,contentType:file.type||'application/octet-stream'});
async function encodeFile(file) {
  if(file.size>5*1024*1024)throw new Error('Maximum file size is 5 MB');
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary=''; for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}


function IconButton({ icon: Icon, onClick, label, disabled = false }) {
  return <button type="button" className="icon-btn" aria-label={label} title={label} disabled={disabled} onClick={onClick}><Icon size={16}/></button>;
}
function Empty({ icon: Icon, title, description }) {
  return <div className="empty"><div className="empty-icon"><Icon size={23}/></div><strong>{title}</strong><p>{description}</p></div>;
}
function Dialog({ title, subtitle, onClose, children }) {
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog-top"><div><h2>{title}</h2><p>{subtitle}</p></div><IconButton icon={X} label="Close" onClick={onClose}/></div>{children}
    </div>
  </div>;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

export default function App() {
  const [page, setPage] = useState('tester');
  const [interceptorMode,setInterceptorMode]=useState(()=>readInterceptorMode(localStorage));
  const [extensionStatus,setExtensionStatus]=useState({state:'unknown',version:''});
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [theme, setTheme] = useState(() => readAppearance(localStorage));
  const [token, setToken] = useState(storedToken);
  const currentTokenRef=useRef(token);
  currentTokenRef.current=token;
  // Shared header storage context for both Collections and Environments.
  // The legacy cached envScope keeps existing users on their last chosen storage.
  const [storageScope,setStorageScope] = useState(()=>allowedStorageScope(!!storedToken(),CACHED?.envScope || defaultStorageScope(!!storedToken())));
  const collectionsScope=storageScope;
  const envScope=storageScope;
  const [me, setMe] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ displayName: '', email: '', password: '' });
  const [googleLinkOpen, setGoogleLinkOpen] = useState(false);
  const [googleLinkPassword, setGoogleLinkPassword] = useState('');
  const [googleLinkError, setGoogleLinkError] = useState('');
  const [notice, setNotice] = useState('');
  const [exportChoice,setExportChoice] = useState(null);
  const [exportFormat,setExportFormat] = useState('postman');
  const [exportIncludeSecrets,setExportIncludeSecrets] = useState(false);
  const [method, setMethod] = useState(RECOVERED.method || 'GET');
  const [url, setUrl] = useState(RECOVERED.url ?? 'https://httpbin.org/get');
  const [rows, setRows] = useState(RECOVERED.rows || [{ ...EMPTY_HEADER }]);
  const [body, setBody] = useState(RECOVERED.body || '');
  const [documentation,setDocumentation]=useState(RECOVERED.documentation||'');
  const [format, setFormat] = useState(RECOVERED.format || 'application/json');
  const [formFields, setFormFields] = useState(RECOVERED.formFields || [{key:'',value:''}]);
  const [binaryFile, setBinaryFile] = useState({name:RECOVERED.binaryFile?.name || '',base64:''});
  const [preScript, setPreScript] = useState(RECOVERED.preScript || '');
  const [postScript, setPostScript] = useState(RECOVERED.postScript || '');
  const [responseExamples, setResponseExamples] = useState(sanitizeResponseExamples(RECOVERED.responseExamples));
  const [scriptLog, setScriptLog] = useState(RECOVERED.scriptLog || []);
  const [scriptTests, setScriptTests] = useState(RECOVERED.scriptTests || []);
  const [scriptError, setScriptError] = useState(RECOVERED.scriptError || '');
  const [responsePretty, setResponsePretty] = useState(true);
  const [prettyResponse, setPrettyResponse] = useState('');
  const [localEnvironments, setLocalEnvironments] = useState(initialLocalEnvs);
  // Results and selected IDs are keyed to the actual workspace (and user) to avoid cross-team leaks.
  const [workspaceEnvironmentResult,setWorkspaceEnvironmentResult] = useState({context:'',items:[]});
  const [environmentSelections,setEnvironmentSelections] = useState(()=>readEnvironmentSelections(localStorage,CACHED));
  // Never persist QA/Writer Cloud environment edits. Their script changes are RAM-only.
  const sessionEnvironmentOverlays=useRef(new Map());
  const [,refreshSessionEnvironment]=useState(0);
  useEffect(()=>{sessionEnvironmentOverlays.current.clear();refreshSessionEnvironment(v=>v+1);},[token]);
  const [reqTab, setReqTab] = useState(RECOVERED.reqTab || 'params');
  const [resTab, setResTab] = useState(RECOVERED.resTab || 'body');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(RECOVERED.result || null);
  const [recent, setRecent] = useState(CACHED?.recent || []);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState('');
  const cloudEnvironmentContext=environmentContextKey(STORAGE_WORKSPACE,selectedWs,me?.id);
  const environmentContext=environmentContextKey(envScope,selectedWs,me?.id);
  const cloudEnvironmentContextRef=useRef(cloudEnvironmentContext);
  cloudEnvironmentContextRef.current=cloudEnvironmentContext;
  const workspaceEnvironments=environmentsForContext(workspaceEnvironmentResult,cloudEnvironmentContext);
  const currentEnvironments=envScope===STORAGE_WORKSPACE?workspaceEnvironments:localEnvironments;
  const selectedEnvironmentId=selectionForContext(environmentSelections,environmentContext);
  // An ID is never active until the matching environment has actually been loaded.
  const activeEnvId=currentEnvironments.some(env=>env.id===selectedEnvironmentId)?selectedEnvironmentId:'';
  function selectEnvironmentForContext(scope,workspaceId,userId,id) {
    const context=environmentContextKey(scope,workspaceId,userId);
    if(context)setEnvironmentSelections(previous=>setSelectionForContext(previous,context,id));
  }
  function setActiveEnvId(id) {
    selectEnvironmentForContext(envScope,selectedWs,me?.id,id);
  }
  function setWorkspaceEnvironments(updater) {
    const context=cloudEnvironmentContext;
    if(!context||context!==cloudEnvironmentContextRef.current)return;
    setWorkspaceEnvironmentResult(previous=>{
      if(context!==cloudEnvironmentContextRef.current)return previous;
      const before=environmentsForContext(previous,context);
      return {context,items:typeof updater==='function'?updater(before):updater};
    });
  }
  useEffect(()=>writeEnvironmentSelections(localStorage,environmentSelections),[environmentSelections]);
  const [collections, setCollections] = useState([]);
  const [localCollections, setLocalCollections] = useState(readLocalCollections);
  const [creatingLocalCollection, setCreatingLocalCollection] = useState(false);
  const [collectionImportOpen,setCollectionImportOpen] = useState(false);
  const [collectionImportFile,setCollectionImportFile] = useState(null);
  const [collectionImportDestination,setCollectionImportDestination] = useState(()=>defaultStorageScope(!!storedToken()));
  const [collectionImportError,setCollectionImportError] = useState('');
  const [collectionImportBusy,setCollectionImportBusy] = useState(false);
  const [localCollectionName, setLocalCollectionName] = useState('');
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [wsTab, setWsTab] = useState('collections');
  const [selectedCol, setSelectedCol] = useState('');
  const [savedRequests, setSavedRequests] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [newWs, setNewWs] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newMember, setNewMember] = useState('');
  const [newMemberRoles,setNewMemberRoles]=useState(['Developer']);
  const [editingMemberId,setEditingMemberId]=useState('');
  const [editingMemberRoles,setEditingMemberRoles]=useState([]);
  const [canCreateWorkspace,setCanCreateWorkspace]=useState(false);
  const [newTeamMember, setNewTeamMember] = useState('');
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
  const [collectionSort,setCollectionSort] = useState(()=>localStorage.getItem('pakpost_v14_global_collection_sort')||'manual');
  const [rightWidth,setRightWidth] = useState(()=>Math.min(650,Math.max(280,Number(localStorage.getItem('pakpost_v14_right_width'))||340)));
  const resizingRight=useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(CACHED?.sidebarCollapsed || false);
  const [expandedCollections, setExpandedCollections] = useState({});
  const [expandedWorkspaceExamples,setExpandedWorkspaceExamples] = useState({});
  const [localExpandAllSignal, setLocalExpandAllSignal] = useState(null);
  const [revealLocalDraft,setRevealLocalDraft] = useState(null);
  const [workspaceRequestLists, setWorkspaceRequestLists] = useState({});
  const workspaceRequestsPending = useRef(new Set());
  const workspaceFetchEpoch = useRef(0);
  useEffect(()=>{
    // Clear cached private workspace data after switching accounts or workspaces.
    workspaceFetchEpoch.current+=1;
    workspaceRequestsPending.current.clear();
    setWorkspaceRequestLists({});
  },[selectedWs,token]);
  const [params, setParams] = useState(RECOVERED.params || [{ ...EMPTY_HEADER }]);
  const [authType, setAuthType] = useState(RECOVERED.authType || 'none');
  const [bearerToken, setBearerToken] = useState(RECOVERED.bearerToken || '');
  const [basicUsername,setBasicUsername] = useState(RECOVERED.basicUsername||'');
  const [basicPassword,setBasicPassword] = useState(RECOVERED.basicPassword||'');
  const [apiKeyName,setApiKeyName] = useState(RECOVERED.apiKeyName||'X-API-Key');
  const [apiKeyValue,setApiKeyValue] = useState(RECOVERED.apiKeyValue||'');
  const [apiKeyIn,setApiKeyIn] = useState(RECOVERED.apiKeyIn||'header');
  const [openTabs, setOpenTabs] = useState(() => (CACHED?.openTabs || [{ id: 't1', name: 'Untitled Request', method: 'GET' }]).map(t=>({
    ...t,savedName:t.savedName ?? t.name,savedFingerprint:t.savedFingerprint ?? requestFingerprint(CACHED?.drafts?.[t.id] || freshRequest(t.name),t.name)
  })));
  const [tabMenu, setTabMenu] = useState(null);
  const [editingRequestName, setEditingRequestName] = useState(false);
  const requestNameInputRef = useRef(null);
  const originalRequestNameRef = useRef('');
  const cancelledRequestNameRef = useRef(false);
  const [closeConfirmation, setCloseConfirmation] = useState(null);
  const [activeTabId, setActiveTabId] = useState(CACHED?.activeTabId || 't1');
  const activeTabRef = useRef(CACHED?.activeTabId || 't1');
  const tabSequence = useRef(Math.max(1,...(CACHED?.openTabs || []).map(t=>Number(String(t.id).replace(/^t/,'')) || 0)));
  const draftsRef = useRef(CACHED?.drafts || {});
  const panesRef = useRef(null);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(v => !v);
        setCommandQuery('');
        setCommandIndex(0);
      } else if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!editingRequestName || page !== 'tester') return;
    const input=requestNameInputRef.current;
    if (input) { input.focus(); input.select(); }
  }, [editingRequestName, activeTabId, page]);
  function beginRequestRename() {
    const current=openTabs.find(tab=>tab.id===activeTabRef.current);
    originalRequestNameRef.current=current?.name||'Untitled Request';
    cancelledRequestNameRef.current=false;
    setEditingRequestName(true);
  }
  function setCurrentRequestName(nextName) {
    setOpenTabs(tabs=>tabs.map(tab=>tab.id===activeTabRef.current?{...tab,name:nextName}:tab));
  }
  function finishRequestRename() {
    if(cancelledRequestNameRef.current){cancelledRequestNameRef.current=false;return;}
    const current=openTabs.find(tab=>tab.id===activeTabRef.current);
    const trimmed=(current?.name||'').trim();
    setCurrentRequestName(trimmed||originalRequestNameRef.current||'Untitled Request');
    setEditingRequestName(false);
  }
  function cancelRequestRename() {
    cancelledRequestNameRef.current=true;
    setCurrentRequestName(originalRequestNameRef.current);
    setEditingRequestName(false);
  }

  const currentAuth=()=>({authType,bearerToken,basicUsername,basicPassword,apiKeyName,apiKeyValue,apiKeyIn});
  function snapshot() { return { method, url, rows: rows.map(r => ({ ...r })), body, documentation, responsePretty, prettyResponse, format, formFields:formFields.map(r=>({...r})),binaryFile:{...binaryFile},preScript,postScript,responseExamples:sanitizeResponseExamples(responseExamples),scriptLog,scriptTests,scriptError, reqTab, resTab, result, params: params.map(p => ({ ...p })), ...currentAuth() }; }
  function restoreDraft(next) {
    setMethod(next.method||'GET');setUrl(next.url||'');setRows(next.rows||[{...EMPTY_HEADER}]);setBody(next.body||'');setDocumentation(next.documentation||'');
    setFormat(next.format||'application/json');setFormFields(next.formFields||[{key:'',value:''}]);
    setBinaryFile(next.binaryFile||{name:'',base64:''});
    setPreScript(next.preScript||'');setPostScript(next.postScript||'');setResponseExamples(sanitizeResponseExamples(next.responseExamples));
    setScriptLog(next.scriptLog||[]);setScriptTests(next.scriptTests||[]);setScriptError(next.scriptError||'');
    setReqTab(next.reqTab||'params');setResTab(next.resTab||'body');setResult(next.result||null);setResponsePretty(next.responsePretty??true);setPrettyResponse(next.prettyResponse||'');
    setParams(next.params||[{...EMPTY_HEADER}]);setAuthType(next.authType||'none');setBearerToken(next.bearerToken||'');
    setBasicUsername(next.basicUsername||'');setBasicPassword(next.basicPassword||'');
    setApiKeyName(next.apiKeyName||'X-API-Key');setApiKeyValue(next.apiKeyValue||'');setApiKeyIn(next.apiKeyIn||'header');
  }
  function stashActive() { draftsRef.current[activeTabRef.current] = snapshot(); }
  useEffect(()=>writeLocalCollections(localCollections),[localCollections]);
  useEffect(()=>writeWorkspaceCollectionDocs(localStorage,workspaceCollectionDocs),[workspaceCollectionDocs]);
  useEffect(()=>{localStorage.setItem('pakpost_v14_global_collection_sort',collectionSort)},[collectionSort]);
  useEffect(()=>{localStorage.setItem('pakpost_v14_right_width',String(rightWidth))},[rightWidth]);
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
      drafts:draftsRef.current,active:snapshot(),recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope});
    const timer=setTimeout(persist,600);
    window.addEventListener('beforeunload',persist);
    return ()=>{clearTimeout(timer);window.removeEventListener('beforeunload',persist)};
  },[method,url,rows,body,documentation,format,formFields,binaryFile,preScript,postScript,responseExamples,scriptLog,scriptTests,scriptError,
    reqTab,resTab,result,params,authType,bearerToken,basicUsername,basicPassword,apiKeyName,apiKeyValue,apiKeyIn,openTabs,activeTabId,recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope]);
  function selectTab(id) {
    setEditingRequestName(false);
    if (id === activeTabRef.current) { setPage('tester'); return; }
    stashActive();
    const next = draftsRef.current[id];
    if (!next) return;
    activeTabRef.current = id; setActiveTabId(id);
    restoreDraft(next);

    setPage('tester');
  }
  function addTab(request, source = null, { focusName = false } = {}) {
    stashActive();
    const id = `t${++tabSequence.current}`;
    const draft = { ...freshRequest(request?.name || 'Untitled Request'), ...request, binaryFile:{name:request?.binaryFile?.name||'',base64:''},
      params:request?.params||[{...EMPTY_HEADER}],rows:request?.rows||[{...EMPTY_HEADER}],
      formFields:request?.formFields||[{...EMPTY_HEADER}],result:null,scriptLog:[],scriptTests:[],scriptError:''};
    draftsRef.current[id] = draft; activeTabRef.current = id;
    const name = request?.name || 'Untitled Request';
    setOpenTabs(t => [...t, { id, name, savedName:name, method: draft.method, source, savedFingerprint:requestFingerprint(draft,name) }]);
    originalRequestNameRef.current=name; cancelledRequestNameRef.current=false; setEditingRequestName(focusName);
    setActiveTabId(id); restoreDraft(draft); setPage('tester');
  }
  async function importPreparedEnvironments(imported,destination){
    if(!imported.length)return 0;
    const cloud=destination===STORAGE_WORKSPACE;
    const workspaceId=selectedWs,auth=token,epoch=workspaceFetchEpoch.current;
    if(cloud&&(!auth||!workspaceId))throw Error('Sign in and select a workspace before importing environments to Cloud.');
    // Remote list may not be loaded yet when the user is browsing Local environments.
    // Always read the destination workspace's real list: never dedupe against another team's cached list.
    const existing=cloud?await api(`/api/workspaces/${workspaceId}/environments`,'GET',undefined,auth):localEnvironments;
    const prepared=uniqueEnvironmentImports(imported,existing);
    if(!cloud){
      const added=prepared.map(env=>({...env,id:crypto.randomUUID(),variables:(env.variables||[]).map(v=>({key:String(v.key||''),value:String(v.value||''),isSecret:!!v.isSecret}))}));
      setLocalEnvironments(old=>[...old,...added]);
      setStorageScope(STORAGE_LOCAL);selectEnvironmentForContext(STORAGE_LOCAL,'','',added[0].id);
      return added.length;
    }
    const base=`/api/workspaces/${workspaceId}/environments`;
    const saved=[];
    for(const env of prepared){
      let created;
      try{
        created=await api(base,'POST',{name:env.name},auth);
        saved.push(await api(`${base}/${created.id}`,'PUT',{name:env.name,variables:env.variables},auth));
      }catch(error){
        // Undo only the empty record created by this failed environment; keep earlier successful imports.
        if(created){try{await api(`${base}/${created.id}`,'DELETE',undefined,auth)}catch{}}
        if(saved.length&&epoch===workspaceFetchEpoch.current)setWorkspaceEnvironments(old=>[...old.filter(e=>!saved.some(x=>x.id===e.id)),...saved]);
        throw Error(`Cloud import partially completed (${saved.length}/${prepared.length} environments): ${getMessage(error)}`);
      }
    }
    if(epoch===workspaceFetchEpoch.current){
      setWorkspaceEnvironments(old=>[...old.filter(e=>!saved.some(x=>x.id===e.id)),...saved]);
      setStorageScope(STORAGE_WORKSPACE);selectEnvironmentForContext(STORAGE_WORKSPACE,workspaceId,me?.id,saved[0].id);
    }
    return saved.length;
  }
  async function importCloudCollections(sources){
    const workspaceId=selectedWs;
    const auth=token;
    const epoch=workspaceFetchEpoch.current;
    let imported;
    try{
      imported=await saveCloudCollections(sources,{workspaceId,token:auth,request:api,onCreated:created=>{
        if(epoch===workspaceFetchEpoch.current)setCollections(old=>[...old,created]);
      }});
    }catch(error){
      // A failed remote import can still have successful records: refresh without local fallback.
      if(auth&&workspaceId){try{
        const latest=await api(`/api/workspaces/${workspaceId}/collections`,'GET',undefined,auth);
        if(epoch===workspaceFetchEpoch.current)setCollections(latest);
      }catch{}}
      throw error;
    }
    try{
      const latest=await api(`/api/workspaces/${workspaceId}/collections`,'GET',undefined,auth);
      if(epoch===workspaceFetchEpoch.current)setCollections(latest);
    }catch{}
    if(epoch===workspaceFetchEpoch.current){
      if(imported.firstId){setSelectedCol(imported.firstId);setExpandedCollections(old=>({...old,[workspaceCollectionKey(workspaceId,imported.firstId)]:true}));}
      setStorageScope(STORAGE_WORKSPACE);
      setExplorerTab('collections');setSidebarCollapsed(false);setPage('tester');
    }
    return imported.count;
  }
  async function importRequestsAndEnvironments({kind,requests=[],environments=[],collections:incoming=[]},requestedDestination){
    if(requests.length>200)throw Error('Import limit: maximum 200 requests.');
    const destination=allowedStorageScope(!!token,requestedDestination);
    const sources=collectionImportSources({kind,requests,collections:incoming});
    let count=0;
    if(sources.length){
      if(destination===STORAGE_WORKSPACE){
        count=await importCloudCollections(sources);
      }else{
        const added=sources.map(source=>toLocalCollection(source));
        setLocalCollections(validateLibrary([...localCollections,...added]));
        count=requests.length;
        setStorageScope(STORAGE_LOCAL);setExplorerTab('collections');setSidebarCollapsed(false);setPage('tester');
      }
    }else if(kind==='pakpost'&&requests.length){
      // A Pakpost session is a tab backup, not a collection import.
      stashActive();
      const tabs=requests.map(request=>{
        const id=`t${++tabSequence.current}`;
        const draft={...blankDraft(),...request,binaryFile:{name:request?.binaryFile?.name||'',base64:''},result:null,scriptLog:[],scriptTests:[],scriptError:''};
        draftsRef.current[id]=draft;
        return {id,name:request.name||'Imported Request',method:draft.method};
      });
      setOpenTabs(old=>[...old,...tabs]);
      const last=tabs.at(-1);
      activeTabRef.current=last.id;setActiveTabId(last.id);restoreDraft(draftsRef.current[last.id]);setPage('tester');
    }
    if(environments.length)await importPreparedEnvironments(environments,destination);
    const place=destination===STORAGE_WORKSPACE?'Cloud · Neon':'Local · Browser';
    if(kind==='pakpost')return `Restored ${requests.length} tab(s)${environments.length?` and imported ${environments.length} environment(s) into ${place}`:''}.`;
    return `Imported ${[count?`${count} request(s)`:null,environments.length?`${environments.length} environment(s)`:null].filter(Boolean).join(' and ')||'0 items'} into ${place}.`;
  }
  function openDocumentation(target){
    let initial='';
    if(target.scope==='local'){
      const collection=localCollections.find(c=>c.id===target.collectionId);
      if(target.type==='collection')initial=collection?.documentation||'';
      if(target.type==='folder')initial=collection?.folderDocs?.[JSON.stringify(target.folderPath||[])]||'';
      if(target.type==='request')initial=collection?.requests?.find(r=>r.id===target.requestId)?.documentation||'';
    }else if(target.type==='collection'){
      initial=workspaceCollectionDocs[workspaceDocKey(selectedWs,target.collectionId)]||'';
    }else{
      const request=(workspaceRequestLists[workspaceCollectionKey(selectedWs,target.collectionId)]||savedRequests).find(r=>r.id===target.requestId);
      initial=decodeStoredHeaders(request?.headersJson).documentation||'';
    }
    setDocumentationTarget({...target,workspaceId:selectedWs,initial});
  }
  async function saveDocumentation(text){
    if(!documentationTarget)return;
    const target=documentationTarget;const value=String(text||'').slice(0,16000);
    setDocBusy(true);
    try{
      if(target.scope==='local'){
        setLocalCollections(old=>applyLocalAction(old,{type:'saveDocumentation',collectionId:target.collectionId,requestId:target.requestId,folderPath:target.folderPath,documentation:value}));
      }else if(target.type==='collection'){
        // Current Neon collection DTO has no description property. Persist browser-locally.
        setWorkspaceCollectionDocs(old=>({...old,[workspaceDocKey(target.workspaceId,target.collectionId)]:value}));
      }else{
        const base=`/api/workspaces/${target.workspaceId}/collections/${target.collectionId}/requests`;
        const requests=await api(base,'GET',undefined,token);
        const request=requests.find(r=>r.id===target.requestId);
        if(!request)throw Error('Saved request was not found');
        const meta=decodeStoredHeaders(request.headersJson);
        const saved=await api(`${base}/${target.requestId}`,'PUT',{
          ...request,headersJson:encodeStoredHeaders(meta.headers,meta.params,value,meta.responseExamples,meta.auth)
        },token);
        setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(target.workspaceId,target.collectionId)]:requests.map(r=>r.id===saved.id?saved:r)}));
        if(selectedCol===target.collectionId)setSavedRequests(requests.map(r=>r.id===saved.id?saved:r));
      }
      if(target.type==='request'){
        // Keep open tab's draft metadata in sync so later Save doesn't erase docs.
        for(const tab of openTabs){if(tab.source?.scope===target.scope&&tab.source?.collectionId===target.collectionId&&tab.source?.requestId===target.requestId){
          if(draftsRef.current[tab.id])draftsRef.current[tab.id]={...draftsRef.current[tab.id],documentation:value};
          if(tab.id===activeTabRef.current)setDocumentation(value);
        }}
      }
      setDocumentationTarget(null);setNotice('Documentation saved');
    }catch(e){setNotice(`Cannot save documentation: ${getMessage(e)}`)}finally{setDocBusy(false)}
  }
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
    previewSavedExample({...draft,name:request.name||draft.name},{scope:'workspace',workspaceId:selectedWs,collectionId,requestId:request.id},example);
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
  const WORKSPACE_DRAG='application/x-pakpost-workspace-request';
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
        await api(`${base}/requests/${requestId}`,'PUT',{...item,name},token);
        setSavedRequests(old=>old.map(x=>x.id===requestId?{...x,name}:x));
        setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:(old[workspaceCollectionKey(selectedWs,collectionId)]||[]).map(x=>x.id===requestId?{...x,name}:x)}));
        setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.requestId===requestId?{...t,name,savedName:name}:t));
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
  function importCurlIntoCurrent(value){
    try{
      const parsed=parseCurl(value);
      setMethod(parsed.method);setUrl(parsed.url);setRows(parsed.rows);setBody(parsed.body);setFormat(parsed.format);
      setParams(parsed.params);setFormFields(parsed.formFields);setBinaryFile({name:'',base64:''});
      setAuthType(parsed.authType);setBearerToken(parsed.bearerToken);
      setBasicUsername(parsed.basicUsername||'');setBasicPassword(parsed.basicPassword||'');
      setApiKeyName(parsed.apiKeyName||'X-API-Key');setApiKeyValue(parsed.apiKeyValue||'');setApiKeyIn(parsed.apiKeyIn||'header');
      setResult(null);setPrettyResponse('');
      setReqTab(parsed.body||parsed.formFields.some(r=>r.key)?'body':'params');
      setOpenTabs(t=>t.map(x=>x.id===activeTabRef.current?{...x,method:parsed.method,name:parsed.name,status:undefined}:x));
      setNotice(`cURL imported: ${parsed.method} ${parsed.url}. Review before sending.`);
    }catch(e){setNotice(`cURL import failed: ${getMessage(e)}`);}
  }
  function closeTab(id){performTabAction('close',id);}
  function performTabAction(action,id,confirmed=false){
    setTabMenu(null);
    if(action==='duplicate'){
      stashActive();const source=draftsRef.current[id];if(!source)return;
      const newId=`t${++tabSequence.current}`;
      const cloned=JSON.parse(JSON.stringify(source));
      draftsRef.current[newId]={...cloned,binaryFile:{name:cloned.binaryFile?.name||'',base64:''},result:null,scriptLog:[],scriptTests:[],scriptError:''};
      const sourceTab=openTabs.find(t=>t.id===id);
      const index=openTabs.findIndex(t=>t.id===id);
      const copyName=`${sourceTab?.name||'Request'} (copy)`;
      setOpenTabs(t=>[...t.slice(0,index+1),{id:newId,name:copyName,savedName:copyName,method:cloned.method,source:null,pendingCopy:true,savedFingerprint:requestFingerprint(cloned,copyName)},...t.slice(index+1)]);
      selectTabFromDraft(newId);return;
    }
    stashActive();
    const plan=planTabClose(openTabs,id,activeTabRef.current,action);
    if(!confirmed){
      const unsaved=plan.removedIds.filter(tabId=>{
        const tab=openTabs.find(t=>t.id===tabId);
        return needsCloseConfirmation(tab,draftsRef.current[tabId]);
      });
      if(unsaved.length){setCloseConfirmation({action,id,unsaved});return;}
    }
    setCloseConfirmation(null);
    if(plan.reset){
      const blank=freshRequest('Untitled Request');const blankId=id;
      draftsRef.current={[blankId]:blank};
      setOpenTabs([{id:blankId,name:'Untitled Request',savedName:'Untitled Request',method:'GET',savedFingerprint:requestFingerprint(blank,'Untitled Request')}]);
      selectTabFromDraft(blankId);return;
    }
    const removed=new Set(plan.removedIds);
    for(const key of removed)delete draftsRef.current[key];
    setOpenTabs(plan.remaining);
    if(plan.nextActiveId!==activeTabRef.current)selectTabFromDraft(plan.nextActiveId);
  }
  function showTabContext(e,id){
    e.preventDefault();e.stopPropagation();
    setTabMenu({id,x:Math.max(8,Math.min(e.clientX,window.innerWidth-224)),y:Math.max(8,Math.min(e.clientY,window.innerHeight-190))});
  }
  function selectTabFromDraft(id) {
    setEditingRequestName(false);
    const next = draftsRef.current[id];
    if (!next) return;
    activeTabRef.current = id; setActiveTabId(id);
    restoreDraft(next);

    setPage('tester');
  }
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
  function loadSavedRequest(item) {
    const saved=decodeStoredHeaders(item.headersJson);
    const savedRows=saved.headers;
    let formFields = [];
    try { formFields = JSON.parse(item.formFieldsJson||'[]'); }catch{}
    openBoundRequest({ ...item,rows:[...savedRows,{...EMPTY_HEADER}],params:saved.params.length?saved.params:[{...EMPTY_HEADER}],documentation:saved.documentation,responseExamples:saved.responseExamples,...saved.auth,format:item.contentType||'application/json',formFields:formFields.length?formFields:[{key:'',value:''}],preScript:item.preRequestScript||'',postScript:item.postResponseScript||'' },
      {scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId||selectedCol,requestId:item.id});
  }


  useEffect(()=>{if(!token&&envScope===STORAGE_WORKSPACE)setStorageScope(STORAGE_LOCAL);},[token,envScope]);
  useEffect(()=>{
    const safe=localEnvironments.map(e=>({...e,variables:e.variables.map(v=>v.isSecret?{...v,value:''}:v)}));
    const secrets=Object.fromEntries(localEnvironments.map(e=>[e.id,Object.fromEntries(e.variables.filter(v=>v.isSecret).map(v=>[v.key,v.value]))]));
    localStorage.setItem('pakpost_guest_envs',JSON.stringify(safe));
    sessionStorage.setItem('pakpost_guest_secrets',JSON.stringify(secrets));
  },[localEnvironments]);
  useEffect(()=>{
    if(envScope!==STORAGE_WORKSPACE||!token||!selectedWs||!cloudEnvironmentContext){
      setWorkspaceEnvironmentResult({context:'',items:[]});return;
    }
    const context=cloudEnvironmentContext;
    let cancelled=false;
    // Reset immediately for the new context; old workspace data will never be rendered.
    setWorkspaceEnvironmentResult(previous=>previous.context===context?previous:{context,items:[]});
    api(`/api/workspaces/${selectedWs}/environments`,'GET',undefined,token)
      .then(items=>{if(!cancelled&&cloudEnvironmentContextRef.current===context)setWorkspaceEnvironmentResult({context,items});})
      .catch(e=>{if(!cancelled&&cloudEnvironmentContextRef.current===context)setNotice(`Environments API: ${getMessage(e)}`);});
    return()=>{cancelled=true;};
  },[envScope,token,selectedWs,cloudEnvironmentContext]);
  const activeEnvironment=currentEnvironments.find(e=>e.id===activeEnvId);
  // Do not resolve masked Cloud secrets in the browser, even for a request executor.
  // Read-only members can create temporary personal values without writing to Neon.
  const activeSessionEnvironmentKey=envScope===STORAGE_WORKSPACE?sessionEnvironmentKey(environmentContext,activeEnvId):'';
  const activeSessionOverrides=sessionEnvironmentOverlays.current.get(activeSessionEnvironmentKey)||{};
  const canWriteEnvironment=envScope!==STORAGE_WORKSPACE||canWorkspace(currentWorkspaceMember(members,me),'environment.write');
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
  function updateStorageScope(scope){
    setStorageScope(allowedStorageScope(!!token,scope));
    // Keep each context's selection while switching Local, Cloud and workspaces.
    setCreatingLocalCollection(false);
  }
  async function importEnvironmentFile(sourceText,requestedDestination){
    let doc;
    try{doc=JSON.parse(sourceText)}catch{throw Error('Invalid JSON environment file. Use Postman, Hoppscotch or Insomnia v4 JSON (not YAML).');}
    const imported=parseEnvironmentDocument(doc);
    if(!imported?.length)throw Error('No supported environments found. Choose a Postman, Hoppscotch or Insomnia v4 JSON environment export.');
    const destination=allowedStorageScope(!!token,requestedDestination);
    const count=await importPreparedEnvironments(imported,destination);
    setNotice(`Imported ${count} environment(s) into ${destination===STORAGE_WORKSPACE?'Cloud · Neon':'Local · Browser'}.`);
  }
  async function createEnvironment(name){
    if(envScope==='workspace'){
      if(!selectedWs||!token)throw new Error('Sign in and choose a workspace');
      const env=await api(`/api/workspaces/${selectedWs}/environments`,'POST',{name},token);
      setWorkspaceEnvironments(v=>[...v,env]);setActiveEnvId(env.id);return env;
    }else{const env={id:crypto.randomUUID(),name,variables:[]};setLocalEnvironments(v=>[...v,env]);setActiveEnvId(env.id);return env;}
  }
  async function duplicateEnvironment(source){
    let nextName=`${source.name} (copy)`;let sequence=2;
    while(currentEnvironments.some(x=>x.name.toLowerCase()===nextName.toLowerCase()))nextName=`${source.name} (copy ${sequence++})`;
    const created=await createEnvironment(nextName);
    // A failed update is not silently treated as a successful duplicate.
    await persistEnvironment({...created,name:nextName,variables:(source.variables||[]).map(v=>({...v}))});
    setNotice(`Duplicated ${source.name}`);
    return created;
  }
  function openExportChoice(choice){
    setExportFormat('postman');setExportIncludeSecrets(false);setExportChoice(choice);
  }
  async function confirmExport(){
    if(!exportChoice)return;
    try{
      const {kind,scope,collectionId,environment,name}=exportChoice;
      if(kind==='environment'){
        downloadJson(exportEnvironmentByFormat(environment,{format:exportFormat,includeSecrets:exportIncludeSecrets}),exportFileName(name,exportFormat,'environment'));
      }else{
        let drafts,localCollection=null;
        if(scope==='local'){
          localCollection=localCollections.find(c=>c.id===collectionId);
          if(!localCollection)throw new Error('Collection no longer exists');
          drafts=localCollection.requests||[];
        }else{
          const list=await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests`,'GET',undefined,token);
          drafts=list.map(workspaceDraft);
        }
        const documentation=scope==='workspace'?workspaceCollectionDocs[workspaceDocKey(selectedWs,collectionId)]||'':'';
        const output=exportCollectionByFormat(drafts,{name,format:exportFormat,includeSecrets:exportIncludeSecrets,localCollection,documentation});
        downloadJson(output,exportFileName(name,exportFormat));
      }
      setNotice(`Exported ${name} as ${exportFormat==='openapi'?'OpenAPI 3.1':exportFormat==='insomnia'?'Insomnia v4':'Postman'}`);setExportChoice(null);
    }catch(e){setNotice(`Export failed: ${getMessage(e)}`);}
  }
  async function persistEnvironment(env){
    if(envScope==='workspace'){
      const saved=await api(`/api/workspaces/${selectedWs}/environments/${env.id}`,'PUT',{name:env.name,variables:env.variables},token);
      setWorkspaceEnvironments(v=>v.map(x=>x.id===saved.id?saved:x));
    }else setLocalEnvironments(v=>v.map(x=>x.id===env.id?env:x));
    setNotice('Environment saved');
  }
  async function deleteEnvironment(id){
    if(envScope==='workspace'){
      await api(`/api/workspaces/${selectedWs}/environments/${id}`,'DELETE',undefined,token);
      setWorkspaceEnvironments(v=>v.filter(x=>x.id!==id));
    }else setLocalEnvironments(v=>v.filter(x=>x.id!==id));
    setActiveEnvId('');
  }
  async function applyScriptVariables(values,runEnvironment){
    const {environment,scope,sessionKey,canWrite,initialValues}=runEnvironment;
    if(!environment||JSON.stringify(initialValues)===JSON.stringify(values))return;
    if(scope===STORAGE_WORKSPACE&&!canWrite){
      // QA, Writer and Developer (without environment.write): pm.environment.set/unset
      // updates only a personal in-memory overlay; never calls the Cloud PUT endpoint.
      rememberSessionValues(sessionKey,environment,values);
      return;
    }
    const old=environment.variables;
    const merged=Object.entries(values).map(([key,value])=>({key,value:String(value),isSecret:old.find(x=>x.key===key)?.isSecret||isSensitiveVariable(key)}));
    // This preserves the existing persistence behavior for Local and authorized Cloud editors.
    await persistEnvironment({...environment,variables:merged});
  }
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
  function buildOutgoing(vars=varsFromEnv()) {
    const preparedBody=languageFromMime(format)==='json'?stripJsonComments(body):body;
    const command=buildCommand({method,url,headers:rows,body:preparedBody,format,fields:formFields,fileBase64:binaryFile.base64,fileName:binaryFile.name},vars);
    const parsed=new URL(command.url);
    resolveRows(params,vars).forEach(p=>parsed.searchParams.append(p.key,p.value));
    command.url=parsed.toString();
    return applyAuthorization(command,currentAuth(),vars);
  }
  function maskSensitiveHeaders(request) {
    for(const key of Object.keys(request.headers||{})) {
      if(/(authorization|cookie|token|secret|api[-_]?key)/i.test(key))
        request.headers[key]='{{REDACTED_SECRET}}';
    }
    return request;
  }
  function buildCodeRequest(allowSecrets=false){
    const request=buildOutgoing(varsFromEnv(allowSecrets));
    if(allowSecrets)return request;
    maskSensitiveHeaders(request);
    // A custom API key query name might not contain the word "key" or "token".
    if(authType==='apiKey'&&apiKeyIn==='query'&&apiKeyName.trim()){
      try{
        const target=new URL(request.url);
        target.searchParams.set(resolveVars(apiKeyName.trim(),varsFromEnv(false)).value,'{{REDACTED_SECRET}}');
        request.url=target.toString();
      }catch{/* Other URL diagnostics will surface in the normal request builder. */}
    }
    return request;
  }
  function codePreviewRequest(){
    const fmt=bodyFormat(format);
    const query=params.filter(x=>x.key.trim()&&isEnabled(x)).map(x=>`${encodeURIComponent(x.key)}=${encodeURIComponent(x.value||'')}`).join('&');
    const target=url+(query?(url.includes('?')?'&':'?')+query:'');
    const headers={...requestHeaderObject()};
    if(fmt.mode==='raw'&&body&&!rows.some(x=>x.key?.trim().toLowerCase()==='content-type'&&x.enabled===false)&&!Object.keys(headers).some(x=>x.toLowerCase()==='content-type'))headers['Content-Type']=fmt.mime;
    if(authType==='bearer'&&bearerToken.trim())headers.Authorization='Bearer {{REDACTED_SECRET}}';
    if(authType==='basic')headers.Authorization='Basic {{REDACTED_SECRET}}';
    if(authType==='apiKey'&&apiKeyIn==='header'&&apiKeyName.trim())headers[apiKeyName.trim()]='{{REDACTED_SECRET}}';
    const queryAuth=authType==='apiKey'&&apiKeyIn==='query'&&apiKeyName.trim()?`${target}${target.includes('?')?'&':'?'}${encodeURIComponent(apiKeyName.trim())}={{REDACTED_SECRET}}`:target;
    return {method,url:queryAuth,headers:maskSensitiveHeaders({headers}).headers,body:languageFromMime(format)==='json'?stripJsonComments(body):body,bodyMode:fmt.mode,contentType:format,
      formFields:formFields.map(x=>({key:x.key,value:x.value,fileName:x.fileName,base64:x.fileBase64})),fileName:binaryFile.name};
  }
  useEffect(() => {
    document.documentElement.dataset.theme = normalizeAppearance(theme);
    try { localStorage.setItem('pakpost_theme', normalizeAppearance(theme)); } catch {}
  }, [theme]);
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

  function logout() { setCanCreateWorkspace(false);sessionStorage.removeItem('pakpost_token');setStorageScope(STORAGE_LOCAL);setToken('');setMe(null);setSelectedWs('');setWorkspaceEnvironmentResult({context:'',items:[]});setPage('tester');setWorkspaces([]); }
  function requiresLogin(target = 'workspace') {
    if (token) return true;
    setAuthMode('login'); setAuthError(''); setAuthOpen(true);
    setNotice(`Sign in to access ${target}. The request tester is always available.`);
    return false;
  }
  function navigate(target) {
    if (target !== 'tester' && !requiresLogin(target)) return;
    setPage(target);
    if (target === 'workspace') loadWorkspaces();
  }
  function completeSignIn(data) {
    sessionStorage.setItem('pakpost_token', data.accessToken);
    setToken(data.accessToken);setStorageScope(STORAGE_WORKSPACE);setMe(data.user);setSelectedWs('');setWorkspaceEnvironmentResult({context:'',items:[]});setAuthOpen(false);
    setAuthForm({ displayName: '', email: '', password: '' });
    setNotice(`Welcome, ${data.user.displayName}. You can now use workspaces.`);
  }
  async function submitAuth(e) {
    e.preventDefault(); setAuthBusy(true); setAuthError('');
    try {
      const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register' ? authForm : { email: authForm.email, password: authForm.password };
      completeSignIn(await api(path, 'POST', payload));
    } catch (e) { setAuthError(getMessage(e)); }
    finally { setAuthBusy(false); }
  }
  async function submitGoogleAuth(credential) {
    if (authBusy) return;
    setAuthBusy(true);setAuthError('');
    try { completeSignIn(await api('/api/auth/google','POST',{credential})); }
    catch(e) {setAuthError(getMessage(e));}
    finally {setAuthBusy(false);}
  }
  async function submitGoogleLink(credential) {
    if (authBusy || !token || !googleLinkPassword) return;
    setAuthBusy(true);setGoogleLinkError('');
    try {
      await api('/api/auth/google/link','POST',{credential,password:googleLinkPassword},token);
      setGoogleLinkOpen(false);setGoogleLinkPassword('');setNotice('Google account connected. You can sign in with Google next time.');
    } catch(e) {setGoogleLinkError(getMessage(e));}
    finally {setAuthBusy(false);}
  }
  async function loadWorkspaces(auth = token) {
    if (!auth) return;
    try {
      const data = await api('/api/workspaces', 'GET', undefined, auth);
      // Logout or account switch may happen before this request resolves.
      if(auth!==currentTokenRef.current)return;
      setWorkspaces(data);
      api('/api/workspaces/capabilities','GET',undefined,auth).then(cap=>{if(auth===currentTokenRef.current)setCanCreateWorkspace(!!cap.canCreateWorkspace)}).catch(()=>setCanCreateWorkspace(false));
      setSelectedWs(current => data.some(x => x.id === current) ? current : (data[0]?.id || ''));
    } catch (e) { if(auth===currentTokenRef.current)setNotice(getMessage(e)); }
  }
  useEffect(() => { if (token) loadWorkspaces(token); }, [token]);
  // Role editor state is scoped to the selected Workspace, never carried to another team.
  useEffect(()=>{setEditingMemberId('');setEditingMemberRoles([]);setNewMemberRoles(['Developer']);},[selectedWs]);
  useEffect(() => {
    if (!token || !selectedWs) { setCollections([]); setMembers([]); setTeams([]); return; }
    let cancelled=false;
    const epoch=workspaceFetchEpoch.current;
    // Show no stale workspace metadata while a different team is loading.
    setCollections([]);setMembers([]);setTeams([]);
    Promise.all([
      api(`/api/workspaces/${selectedWs}/collections`, 'GET', undefined, token),
      api(`/api/workspaces/${selectedWs}/members`, 'GET', undefined, token),
      api(`/api/workspaces/${selectedWs}/teams`, 'GET', undefined, token),
    ]).then(([cols, mems, tms]) => {
      if(cancelled||epoch!==workspaceFetchEpoch.current)return;
      setCollections(cols); setMembers(mems); setTeams(tms);
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
    api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests`, 'GET', undefined, token)
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
      api(`/api/workspaces/${selectedWs}/collections/${col.id}/requests`,'GET',undefined,token)
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
  const selfMember=currentWorkspaceMember(members,me);
  const canEditCloud=canWorkspace(selfMember,'collection.write');
  const canManageMembers=canWorkspace(selfMember,'member.manage');
  const canManageTeams=canWorkspace(selfMember,'team.manage');
  const canAssignRoles=canWorkspace(selfMember,'role.assign');
  const assignableRoles=selfMember?.roles||[];
  const activeTeam = teams.find(x => x.id === selectedTeam);
  const headerCount = rows.filter(x => x.key.trim()&&isEnabled(x)).length;
  const requestHeaderObject = () => Object.fromEntries(rows.filter(x => x.key.trim()&&isEnabled(x)).map(x => [x.key.trim(), x.value]));
  async function sendRequest() {
    if(!url.trim()){setNotice('Enter a request URL first');return;}
    if(loading)return;
    const tabId=activeTabRef.current;
    stashActive();setLoading(true);setResult(null);setPrettyResponse('');setResponsePretty(true);setScriptError('');setScriptLog([]);setScriptTests([]);
    let variables=varsFromEnv();
    // Snapshot the workspace, selected environment and permissions at Send time.
    // A later workspace switch cannot redirect this request's script edits.
    const runEnvironment={environment:activeEnvironment,scope:envScope,sessionKey:activeSessionEnvironmentKey,
      canWrite:canWriteEnvironment,initialValues:{...variables}};
    const logs=[],tests=[];
    try {
      const pre=await runSandbox(preScript,'pre',variables,postmanRequestSnapshot({method,url,headers:requestHeaderObject(),body:languageFromMime(format)==='json'?stripJsonComments(body):body,format},variables),null);
      if(pre.error)throw new Error(`Pre-request script: ${pre.error}`);
      variables=pre.variables;logs.push(...pre.logs.map(x=>'PRE: '+x));tests.push(...pre.tests);
      await applyScriptVariables(pre.environmentVariables || variables,runEnvironment);
      const command=buildOutgoing(variables);
      for(const [name,value] of Object.entries(pre.requestHeaderOverrides||{})){
        const previous=Object.keys(command.headers).find(key=>key.toLowerCase()===name.toLowerCase());
        if(previous)delete command.headers[previous];
        command.headers[name]=value;
      }
      if(command.bodyMode==='multipart'&&formFields.some(x=>x.fileName&&!x.fileBase64))throw new Error('Reattach saved multipart file before sending.');
      if(command.bodyMode==='binary'&&!binaryFile.base64)throw new Error('Choose a binary file before sending.');
      if(command.bodyMode==='raw'){
        const problem=syntaxProblem(command.body,languageFromMime(format));
        if(problem)throw new Error('Request body is invalid: '+problem.message);
      }
      const r=interceptorMode==='proxy'
        ?await api('/api/proxy/send','POST',command)
        :await dispatchRequest(command,interceptorMode);
      // An HTTP request that completed must remain visible even if the post-response script fails.
      let scriptErrorNext='';
      try {
        const post=await runSandbox(postScript,'post',pre.environmentVariables||varsFromEnv(),command,r,pre.localVariables||{});
        logs.push(...post.logs.map(x=>'POST: '+x));tests.push(...post.tests);
        if(post.error){scriptErrorNext=post.error;logs.push('SCRIPT ERROR: '+post.error);}
        else await applyScriptVariables(post.environmentVariables||post.variables,runEnvironment);
      }catch(scriptFailure){
        scriptErrorNext=getMessage(scriptFailure);
        logs.push('SCRIPT ERROR: '+scriptErrorNext);
      }
      draftsRef.current[tabId]={...draftsRef.current[tabId],result:r,resTab:'body',scriptLog:logs,scriptTests:tests,scriptError:scriptErrorNext};
      if(tabId===activeTabRef.current){setResult(r);setResTab('body');setScriptLog(logs);setScriptTests(tests);setScriptError(scriptErrorNext);}
      setOpenTabs(t=>t.map(x=>x.id===tabId?{...x,status:r.statusCode}:x));
      setRecent(old=>[{method,url:command.url,status:r.statusCode,elapsed:r.elapsedMs,body,rows:rows.map(x=>({...x}))},...old].slice(0,20));
    }catch(e){
      const error={error:getMessage(e)};
      draftsRef.current[tabId]={...draftsRef.current[tabId],result:error,scriptLog:logs,scriptTests:tests,scriptError:getMessage(e)};
      if(tabId===activeTabRef.current){setResult(error);setScriptLog(logs);setScriptTests(tests);setScriptError(getMessage(e));}
    }finally{setLoading(false)}
  }

  const doAction = async fn => {
    setBusyAction(true);
    try { await fn(); return true; } catch (e) { setNotice(getMessage(e)); return false; } finally { setBusyAction(false); }
  };
  function loadRequest(item) {
    if (Array.isArray(item.rows)) addTab({ ...item, name: item.name || 'From history' });
    else loadSavedRequest(item);
  }

  const activeSource=()=>openTabs.find(t=>t.id===activeTabRef.current)?.source;
  const currentSavePayload=(name,examples=responseExamples)=>({name,method,url,headersJson:encodeStoredHeaders(rows,params,documentation,examples,currentAuth()),body,
    bodyMode:bodyFormat(format).mode,contentType:format,
    formFieldsJson:JSON.stringify(formFields.map(({key,value,fileName,contentType})=>({key,value,fileName,contentType}))),
    preRequestScript:preScript,postResponseScript:postScript});
  function openSaveAs(destination=null){
    const origin=destination||activeSource();
    setSaveScope(origin?.scope==='workspace'&&!canEditCloud?'local':origin?.scope||'local');
    setSaveLocalCollection(origin?.scope==='local'?origin.collectionId:localCollections[0]?.id||'');
    setSaveWs(origin?.workspaceId||selectedWs||workspaces[0]?.id||'');
    setSaveCollection(origin?.scope==='workspace'?origin.collectionId:selectedCol||'');
    setSaveName(activeRequestName==='Untitled Request'?`${method} ${url||'request'}`:activeRequestName);
    setSaveOpen(true);
  }
  async function saveCurrent(){
    const origin=activeSource();
    if(origin?.scope==='workspace' && (!canEditCloud || origin.workspaceId!==selectedWs)){
      openSaveAs({...origin,scope:'local',collectionId:localCollections[0]?.id||''});
      setNotice('Cloud is read-only for this role. Save a separate Local copy instead.');return;
    }
    if(!origin){openSaveAs();return;}
    const name=activeRequestName.trim();
    if(!name){setNotice('Request name cannot be empty');return;}
    const tabId=activeTabRef.current;
    const savedDraft=snapshot();
    await doAction(async()=>{
      let savedSource={...origin};
      if(origin.scope==='local'){
        if(origin.pending){
          const next=createLocalSavedRequest(localCollections,origin.collectionId,
            {...savedDraft,name,folderPath:origin.folderPath||[]});
          setLocalCollections(next.collections);
          savedSource={scope:'local',collectionId:origin.collectionId,requestId:next.request.id};
        }else setLocalCollections(updateLocalRequest(localCollections,origin.collectionId,origin.requestId,{...savedDraft,name}));
      }else{
        if(!token)throw Error('Sign in to save workspace requests');
        const base=`/api/workspaces/${origin.workspaceId}/collections/${origin.collectionId}/requests`;
        if(!url.trim())throw Error('Request URL is required. Please enter a URL before saving.');
        const savedPayload=currentSavePayload(name);
        if(origin.pending){
          const saved=await api(base,'POST',savedPayload,token);
          savedSource={scope:'workspace',workspaceId:origin.workspaceId,collectionId:origin.collectionId,requestId:saved.id};
        }else await api(`${base}/${origin.requestId}`,'PUT',savedPayload,token);
        invalidateWorkspaceRequestLists(origin.workspaceId,[origin.collectionId]);
        if(origin.workspaceId===selectedWs){
          // Saving has already completed; a list refresh failure must not turn it into an unsaved draft.
          try {
            const latest=await api(base,'GET',undefined,token);
            setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(origin.workspaceId,origin.collectionId)]:latest}));
            if(origin.collectionId===selectedCol)setSavedRequests(latest);
          }catch{ /* The next explorer fetch can retry. */ }
        }
      }
      // The request now belongs to a real saved entity; later Save calls update that same ID.
      setOpenTabs(tabs=>tabs.map(t=>t.id===tabId?tabSaved(t,savedSource,savedDraft,name):t));
      setNotice(origin.pending?`Created ${name} in collection`:`Saved changes to ${name}`);
    });
  }
  async function saveRequest(e){
    e.preventDefault();
    if(!saveName.trim())return;
    const savedDraft=snapshot();
    const tabId=activeTabRef.current;
    await doAction(async()=>{
      let source;
      if(saveScope==='local'){
        const next=createLocalSavedRequest(localCollections,saveLocalCollection,{...savedDraft,name:saveName});
        setLocalCollections(next.collections);
        source={scope:'local',collectionId:saveLocalCollection,requestId:next.request.id};
      }else{
        if(!token)throw Error('Sign in to save to workspace');
        const saved=await api(`/api/workspaces/${saveWs}/collections/${saveCollection}/requests`,'POST',currentSavePayload(saveName),token);
        source={scope:'workspace',workspaceId:saveWs,collectionId:saveCollection,requestId:saved.id};
        invalidateWorkspaceRequestLists(saveWs,[saveCollection]);
        if(saveWs===selectedWs){
          try {
            const latest=await api(`/api/workspaces/${saveWs}/collections/${saveCollection}/requests`,'GET',undefined,token);
            setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(saveWs,saveCollection)]:latest}));
            if(saveCollection===selectedCol)setSavedRequests(latest);
          }catch{ /* Save succeeded; keep the source ID and retry the list later. */ }
        }
      }
      setOpenTabs(ts=>ts.map(t=>t.id===tabId?tabSaved(t,source,savedDraft,saveName):t));
      setSaveOpen(false);setNotice(`Saved ${saveName}`);
    });
  }

  function openSaveExampleDialog(){
    if(!result||result.error)return;
    setExampleName(suggestExampleName(result));
    setExampleDescription('');
    setSaveExampleOpen(true);
  }
  async function persistResponseExamples(nextExamples){
    const source=activeSource();
    if(source?.scope==='local'&&!source.pending){
      setLocalCollections(old=>applyLocalAction(old,{type:'saveExamples',collectionId:source.collectionId,requestId:source.requestId,responseExamples:nextExamples}));
    }
    if(source?.scope==='workspace'&&!source.pending){
      if(!token)throw Error('Sign in to update workspace examples');
      const base=`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests`;
      const latest=await api(base,'GET',undefined,token);
      const original=latest.find(request=>request.id===source.requestId);
      if(!original)throw Error('Saved request not found');
      const metadata=decodeStoredHeaders(original.headersJson);
      const saved=await api(`${base}/${source.requestId}`,'PUT',{
        ...original,headersJson:encodeStoredHeaders(metadata.headers,metadata.params,metadata.documentation,nextExamples,metadata.auth)
      },token);
      const updated=latest.map(request=>request.id===saved.id?saved:request);
      setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(source.workspaceId,source.collectionId)]:updated}));
      if(source.workspaceId===selectedWs&&source.collectionId===selectedCol)setSavedRequests(updated);
    }
    const tabId=activeTabRef.current;
    draftsRef.current[tabId]={...snapshot(),responseExamples:nextExamples};
    setResponseExamples(nextExamples);
  }
  async function saveResponseExample(e){
    e?.preventDefault?.();
    if(!result||result.error)return;
    const name=(exampleName||'').trim()||suggestExampleName(result);
    const example=createResponseExample(result,{name,description:exampleDescription});
    const nextExamples=upsertResponseExample(responseExamples,example);
    const source=activeSource();
    const success=await doAction(async()=>{
      await persistResponseExamples(nextExamples);
      setNotice(!source||source.pending?`Added ${name} to draft. Save the request to keep it in a collection.`:`Saved example ${name}`);
    });
    if(success)setSaveExampleOpen(false);
  }

  const visibleCollections = sortCollectionRoots(collections.filter(c => c.name.toLowerCase().includes(explorerSearch.toLowerCase()) || (workspaceRequestLists[workspaceCollectionKey(selectedWs,c.id)]||[]).some(r => `${r.name} ${r.url}`.toLowerCase().includes(explorerSearch.toLowerCase()))),collectionSort);
  const visibleLocalCollections = sortCollectionRoots(localCollections,collectionSort);
  const activeRequestName = openTabs.find(t => t.id === activeTabId)?.name || 'Untitled Request';
  const responseType = result && !result.error ? (result.headers?.['Content-Type'] || result.headers?.['content-type'] || 'text/plain') : 'text/plain';
  const commandItems = [
    {key:'new-request', title:'New HTTP request', subtitle:'Open an empty request tab', icon:'action', run:()=>addTab()},
    {key:'open-collections',title:'Show collections',subtitle:'Browse saved API requests',icon:'action',run:()=>{setExplorerTab('collections');setSidebarCollapsed(false);setPage('tester')}},
    {key:'open-history',title:'Open request history',subtitle:'Previously sent requests',icon:'action',run:()=>{setExplorerTab('history');setSidebarCollapsed(false);setPage('tester')}},
    {key:'environments',title:'Manage environments',subtitle:'Edit local and workspace variables',icon:'action',run:()=>openContext('environments')},
    {key:'code',title:'Generate code',subtitle:'cURL, Fetch, Go, C#, Python',icon:'action',run:()=>{setExplorerTab('code');setSidebarCollapsed(false);setPage('tester')}},
    ...openTabs.map(t=>({key:`tab-${t.id}`,title:t.name,subtitle:`${t.method} · Open tab`,method:t.method,run:()=>selectTab(t.id)})),
    ...localCollections.flatMap(col => (col.requests || []).map(req => ({key:`local-${col.id}-${req.id}`,title:req.requestName||req.name||'Untitled Request',subtitle:`${col.name} · ${req.url || ''}`,method:req.method||'GET',run:()=>openLocalRequest(req,col.id)}))),
    ...(token?savedRequests.map(req=>({key:`neon-${req.id}`,title:req.name,subtitle:`Workspace · ${req.url||''}`,method:req.method||'GET',run:()=>loadSavedRequest(req)})):[])
  ];
  const visibleCommandItems = commandItems.filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(commandQuery.trim().toLowerCase())).slice(0,30);
  const responseText = result && !result.error ? (resTab === 'body' ? (responsePretty ? (prettyResponse||prettyJson(result.body||'')) : (result.body||'')) : JSON.stringify(result.headers || {}, null, 2)) : '';

  return <div className="pp-app">
    <header className="pp-top">
      <div className="pp-logo pp-branding-v17" aria-label="Pakpost"><img src={isDarkAppearance(theme)?"/branding/pakpost-logo-dark.svg":"/branding/pakpost-logo-light.svg"} alt="Pakpost" width="155" height="48" decoding="async"/></div>
      <button className="pp-top-search" type="button" aria-label="Search requests and commands" onClick={()=>{setCommandQuery('');setCommandIndex(0);setCommandOpen(true);}}><Search size={15}/><span>Search requests and commands</span><kbd>Ctrl K</kbd></button>
      <div className="pp-top-right">
        <div className="pp-env-top pp-unified-storage-top">
          <span>STORAGE</span>
          {token?<RetroSelect ariaLabel="Storage location for collections and environments" title="Controls storage for both Collections and Environments" className="pp-top-scope" value={storageScope} onChange={updateStorageScope} options={[{value:STORAGE_LOCAL,label:'Local · Browser'},{value:STORAGE_WORKSPACE,label:'Cloud · Neon',disabled:!selectedWs}]}/>:<span className="pp-top-env-local" title="Sign in to use Cloud · Neon">Local · Browser</span>}
          {token&&envScope===STORAGE_WORKSPACE&&<span className="pp-v6-workspace-indicator" title={`Active environment workspace: ${activeWorkspace?.name||'Select workspace'}`}>{activeWorkspace?.name||'Select workspace'}</span>}
          <span className="pp-top-env-label">ENV</span>
          <RetroSelect ariaLabel="Active environment" title={envScope===STORAGE_WORKSPACE?`Environment for ${workspaces.find(w=>w.id===selectedWs)?.name||'selected workspace'}`:'Local environment'} className="pp-top-environment" value={activeEnvId} onChange={setActiveEnvId} options={[{value:'',label:'No environment'},...currentEnvironments.map(e=>({value:e.id,label:e.name}))]}/>
          <button title="Manage environments" onClick={()=>openContext('environments')}><Settings2 size={16}/></button>
        </div>
        <span className="pp-connection"><span/> Local development</span>
        {me ? <><button className="pp-profile" title={me.email} onClick={logout}><span>{me.displayName.slice(0, 1).toUpperCase()}</span><span className="pp-profile-name">{me.displayName}</span><LogOut size={14}/></button>{GOOGLE_CLIENT_ID && <button type="button" className="pp-google-link-top" title="Connect Google to your existing PakPost account" onClick={()=>{setGoogleLinkError('');setGoogleLinkPassword('');setGoogleLinkOpen(true);}}><Link2 size={14}/> Connect Google</button>}</> : <button className="pp-signin" onClick={() => setAuthOpen(true)}><LogIn size={15}/> Sign in</button>}
      </div>
    </header>

    <div className={`pp-main-frame ${page==='settings'?'pp-view-settings':page==='workspace'?'pp-view-workspace':'pp-view-tester'} ${sidebarCollapsed?'pp-navigator-collapsed':''}`} style={{'--pp-v14-right-width':`${rightWidth}px`}}>
      <nav className="pp-rail pp-module-rail" aria-label="Main modules">
        <button className={page!=='settings'?'selected':''} aria-label="REST" title="REST API client" onClick={()=>setPage('tester')}><Code2 size={20}/><span>REST</span></button>
        <div className="pp-rail-spacer"/>
        <button className={page==='settings'?'selected':''} aria-label="Settings" title="Settings" onClick={()=>setPage('settings')}><Settings2 size={20}/><span>Settings</span></button>
      </nav>
      {page==='tester'&&<nav className="pp-context-rail" aria-label="Context panels">
        {[["collections","Collections",Layers3],["environments","Environments",Variable],["history","History",History],["code","Generate Code",Code2],["exchange","Import / Export",FileUp],["teams","Teams",Users]].map(([id,title,Icon])=><button key={id} className={!sidebarCollapsed&&explorerTab===id?'selected':''} aria-label={title} title={title} onClick={()=>{if(!sidebarCollapsed&&explorerTab===id)setSidebarCollapsed(true);else openContext(id)}}><Icon size={18}/></button>)}
        <div className="pp-rail-spacer"/>
        <button title={sidebarCollapsed?'Show context panel':'Hide context panel'} aria-label={sidebarCollapsed?'Show context panel':'Hide context panel'} onClick={()=>setSidebarCollapsed(v=>!v)}>{sidebarCollapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>
        {!sidebarCollapsed&&<div className="pp-context-resizer" role="separator" aria-label="Resize context panel" aria-orientation="vertical" tabIndex={0} onPointerDown={e=>{e.preventDefault();resizingRight.current=true;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={resizeRight} onPointerUp={endRightResize} onPointerCancel={endRightResize} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setRightWidth(w=>Math.max(280,Math.min(650,w+(e.key==='ArrowLeft'?16:-16))))}}}><span/></div>}
      </nav>}

      {page==='tester' && !sidebarCollapsed && <aside className="pp-explorer">
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
      </aside>}

      <main className="pp-content">
        {page==='settings'&&<WorkbenchSettings theme={theme} onThemeChange={setTheme} split={split} onSplitChange={setSplit} interceptorMode={interceptorMode} onInterceptorChange={setInterceptorMode} extensionStatus={extensionStatus} onCheckExtension={refreshExtensionStatus} onBack={()=>setPage('tester')} onOpenEnvironments={()=>{setPage('tester');openContext('environments')}} onOpenImportExport={()=>{setPage('tester');openContext('exchange')}}/>}
        <div className="pp-tabs-bar">
          <div className="pp-open-tabs" role="tablist" aria-label="Open requests">
            {openTabs.map(t => <button role="tab" aria-selected={page === 'tester' && activeTabId === t.id} key={t.id} className={`pp-open-tab ${page === 'tester' && activeTabId === t.id ? 'current' : ''}`} onClick={() => selectTab(t.id)} draggable onDragStart={e=>{tabDragRef.current=t.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',t.id);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=tabDragRef.current;if(from)setOpenTabs(ts=>reorderTabs(ts,from,t.id));tabDragRef.current=null;}} onDragEnd={()=>{tabDragRef.current=null;}} onContextMenu={e=>showTabContext(e,t.id)} onKeyDown={e=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();setTabMenu({id:t.id,x:Math.max(8,Math.min(rect.left,window.innerWidth-224)),y:Math.max(8,Math.min(rect.bottom,window.innerHeight-190))});}}}><span className={`pp-http-label ${t.method.toLowerCase()}`}>{t.method}</span><span className="pp-tab-name">{t.name}</span>{hasUnsavedMarker(t,t.id===activeTabId?snapshot():draftsRef.current[t.id]) && <span className="pp-unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes"/>}{t.status && <span className={`pp-tab-status ${t.status >= 400 ? 'error' : ''}`}>{t.status}</span>}<span className="pp-tab-x" title="Close tab" onClick={e => { e.stopPropagation(); closeTab(t.id); }}><X size={13}/></span></button>)}
            {page === 'workspace' && <button className="pp-open-tab current pp-manage-tab" onClick={() => navigate('workspace')}><Layers3 size={14}/> Workspace</button>}
            <button className="pp-new-tab" title="New request tab" onClick={() => addTab(freshRequest('Untitled Request'))}><Plus size={17}/></button>
          </div>
          <div className="pp-tabs-actions"><span><span className="pp-working-dot"/> {token ? 'Synced' : 'Guest'}</span><button title="Open history" onClick={() => { setExplorerTab('history'); setSidebarCollapsed(false); }}><History size={16}/></button></div>
        </div>
        {workspaceMenu&&<div className="pp-collection-popup" role="menu" style={{left:workspaceMenu.x,top:workspaceMenu.y}}>
          {(workspaceMenu.type==='collection'?[
            ['newRequest','New request'],['documentation','Documentation'],['renameCollection','Rename'],['duplicateCollection','Duplicate collection'],['sortCollection','Sort by name'],['exportCollection','Export collection'],['deleteCollection','Delete collection']
          ]:workspaceMenu.type==='example'?[
            ['renameExample','Rename example'],['deleteExample','Delete example']
          ]:[['documentation','Documentation'],['renameRequest','Rename'],['duplicateRequest','Duplicate'],['deleteRequest','Delete']]).map(([id,label])=>
            <MenuActionItem key={id} action={id} disabled={!canEditCloud && !['exportCollection'].includes(id)} danger={id.startsWith('delete')} onClick={()=>handleWorkspaceMenu(id,workspaceMenu)}>{label}</MenuActionItem>)}
        </div>}
        {tabMenu&&<div className="pp-tab-context" role="menu" style={{left:tabMenu.x,top:tabMenu.y}} onContextMenu={e=>e.preventDefault()}>
          <button role="menuitem" onClick={()=>performTabAction('duplicate',tabMenu.id)}><Copy size={14}/> Duplicate tab</button>
          <button role="menuitem" onClick={()=>{selectTab(tabMenu.id);setTabMenu(null);setTimeout(()=>openSaveAs(),0);}}><Save size={14}/> Save as new request</button>

          <div className="pp-context-divider"/>
          <button role="menuitem" onClick={()=>performTabAction('close',tabMenu.id)}><X size={14}/> Close tab</button>
          <button role="menuitem" disabled={openTabs.length<=1} onClick={()=>performTabAction('others',tabMenu.id)}><Layers3 size={14}/> Close other tabs</button>
          <button role="menuitem" disabled={openTabs.findIndex(t=>t.id===tabMenu.id)>=openTabs.length-1} onClick={()=>performTabAction('right',tabMenu.id)}><ArrowRight size={14}/> Close tabs to the right</button>
        </div>}

        {page === 'tester' ? <div key={activeTabId} className="pp-tester pp-fade-content">
          <div className="pp-crumb"><span>REST</span><ChevronRight size={13}/>{editingRequestName ? <input
            ref={requestNameInputRef}
            className="pp-inline-request-name"
            aria-label="Request name"
            title="Press Enter to finish, Ctrl/Cmd+S to save, Escape to cancel"
            value={activeRequestName}
            maxLength={120}
            spellCheck={false}
            onChange={event=>setCurrentRequestName(event.target.value)}
            onBlur={finishRequestRename}
            onKeyDown={event=>{
              if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
              if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelRequestRename();}
            }}
          /> : <button type="button" className="pp-editable-request-name" onClick={beginRequestRename} title="Rename request" aria-label={`Rename ${activeRequestName}`}><span>{activeRequestName}</span><Pencil size={13}/></button>}<span className="pp-crumb-sub">HTTP request</span><div className="pp-crumb-spacer"/><div className="pp-layout-actions"><span>Layout</span><button className={split === 'horizontal' ? 'active' : ''} onClick={() => setSplit('horizontal')} title="Request above response"><LayoutPanelTop size={16}/></button><button className={split === 'vertical' ? 'active' : ''} onClick={() => setSplit('vertical')} title="Request to left of response"><Columns2 size={16}/></button></div></div>
          <div className="pp-url-bar"><div className="pp-url-entry"><div className="pp-method-wrap"><RetroSelect className={`pp-method ${method.toLowerCase()}`} ariaLabel="HTTP method" value={method} options={METHODS.map(m=>({value:m,label:m,method:true}))} onChange={v=>{setMethod(v);setOpenTabs(t=>t.map(x=>x.id===activeTabId?{...x,method:v}:x));}}/></div><div className="pp-url-input"><Link2 size={16}/><VariableUrlInput value={url} onChange={setUrl} {...variableUi} onSend={sendRequest} onPaste={e=>{const raw=e.clipboardData.getData('text');if(isCurl(raw)){e.preventDefault();importCurlIntoCurrent(raw)}}}/></div></div><button className="pp-send" disabled={loading} onClick={sendRequest}>{loading ? <span className="spinner"/> : <Send size={15}/>} {loading ? 'Sending' : 'Send'} <span className="pp-send-shortcut">↵</span></button><button className="pp-save-action" onClick={saveCurrent} disabled={busyAction} title={!canEditCloud&&activeSource()?.scope==='workspace'?"Save as Local copy — Cloud is read-only":"Save changes (Ctrl/Cmd+S)"}><Save size={15}/><span>Save</span></button><button className="pp-save-as-action" onClick={()=>openSaveAs()} title="Save as a new request">Save as…</button></div>
          <div className={`pp-panes pp-${split}`} ref={panesRef} style={{ '--pp-split': `${splitPercent}%` }}>
            <section className="pp-request-pane">
              <div className="pp-pane-heading"><span className="pp-pane-title"><Code2 size={15}/> Request</span><span className="pp-pane-meta">{method} · {headerCount} headers</span></div>
              <div className="pp-panel-tabs">
                {[[ 'params','Params' ],[ 'headers','Headers' ],[ 'body','Body' ],[ 'auth','Authorization' ],[ 'scripts','Scripts' ]].map(([id, name]) => <button key={id} className={reqTab === id ? 'active' : ''} onClick={() => setReqTab(id)}>{name}{id === 'headers' && headerCount > 0 && <span className="pp-tiny-count">{headerCount}</span>}</button>)}
              </div>
              <div className="pp-panel-body pp-request-body">
                {reqTab === 'params' && <KeyValueEditor kind="params" rows={params} onChange={setParams} variableUi={variableUi}/>}
                {reqTab === 'headers' && <KeyValueEditor kind="headers" rows={rows} onChange={setRows} variableUi={variableUi}/>}
                {reqTab === 'body' && <div className="pp-body-composer">
                  <div className="pp-body-toolbar"><div className="pp-body-format-label"><span>Body type</span><RetroSelect ariaLabel="Body type" className="pp-body-format-select" value={format} onChange={selectFormat} options={BODY_FORMATS.map(f=>({value:f.mime,label:f.label,group:f.group}))}/></div>
                    {bodyFormat(format).mode==='raw'&&<button title="Beautify request body" onClick={beautifyBody}><WandSparkles size={15}/> Beautify</button>}
                    <span>UTF-8</span>
                  </div>
                  {bodyFormat(format).mode==='none'&&<div className="pp-body-empty">This request has no body. Choose a format to start editing.</div>}
                  {bodyFormat(format).mode==='raw'&&<div className="pp-body-code">
                    <TextEditor value={body} onChange={setBody} variableUi={variableUi} lang={languageFromMime(format)==='json'?'jsonc':languageFromMime(format)} theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="100%" placeholder="Write request body here…" allowComments fill/>
                    {syntaxProblem(body,languageFromMime(format))&&<div className="pp-inline-validation"><AlertTriangle size={14}/><span>{syntaxProblem(body,languageFromMime(format))?.message}</span></div>}
                  </div>}
                  {(bodyFormat(format).mode==='urlencoded'||bodyFormat(format).mode==='multipart')&&<>
                    <div className="pp-form-caption"><span>{bodyFormat(format).mode==='multipart'?'MULTIPART FORM DATA':'URL ENCODED DATA'}</span><span>Up to 5 MB</span></div>
                    <div className="pp-keyvalue-heading"><span>KEY</span><span>VALUE / FILE</span><span/></div>
                    {formFields.map((r,i)=><div className="pp-keyvalue-row pp-form-data-row" key={i}>
                      <VariableAwareInput placeholder="key" ariaLabel="Form field key" value={r.key} onChange={value=>setFormFields(v=>v.map((x,j)=>j===i?{...x,key:value}:x))} {...variableUi}/>
                      {r.fileBase64?<div className="pp-file-name"><FileUp size={14}/>{r.fileName}<button title="Detach file" onClick={()=>setFormFields(v=>v.map((x,j)=>j===i?{key:x.key,value:''}:x))}><X size={12}/></button></div>
                        :<VariableAwareInput placeholder="value or {{variable}}" ariaLabel="Form field value" value={r.value||''} onChange={value=>setFormFields(v=>v.map((x,j)=>j===i?{...x,value}:x))} {...variableUi}/>}
                      <div className="pp-field-actions">
                        {bodyFormat(format).mode==='multipart'&&<label title="Attach file"><FileUp size={15}/><input type="file" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const value=await encodeFile(file);setFormFields(v=>v.map((x,j)=>j===i?{...x,value:'',fileName:file.name,fileBase64:value,contentType:file.type}:x))}catch(err){setNotice(err.message)}}}/></label>}
                        <IconButton icon={X} label="Remove field" onClick={()=>setFormFields(v=>v.filter((_,j)=>j!==i))}/>
                      </div>
                    </div>)}
                    <button className="pp-inline-add" onClick={()=>setFormFields(v=>[...v,{key:'',value:''}])}><Plus size={14}/> Add field</button>
                  </>}
                  {bodyFormat(format).mode==='binary'&&<div className="pp-binary-picker"><FileUp size={22}/><span>{binaryFile.name||'Select a binary file (up to 5 MB)'}</span><label>Choose file<input type="file" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{setBinaryFile({name:file.name,base64:await encodeFile(file)})}catch(err){setNotice(err.message)}}}/></label></div>}
                </div>}
                {reqTab === 'auth' && <><div className="pp-form-caption"><span>REQUEST AUTHORIZATION</span><span>Applied when sending the request</span></div><div className="pp-auth-form pp-auth-v26"><div className="pp-auth-select"><span>Auth type</span><RetroSelect ariaLabel="Auth type" value={authType} onChange={setAuthType} options={AUTH_OPTIONS}/></div>
                  {authType==='bearer'&&<label>Token<VariableAwareInput placeholder="{{AuthToken}} or paste bearer token" ariaLabel="Bearer token" value={bearerToken} onChange={value=>setBearerToken(value)} {...variableUi}/></label>}
                  {authType==='basic'&&<><label>Username<VariableAwareInput placeholder="{{username}} or username" ariaLabel="Basic auth username" value={basicUsername} onChange={value=>setBasicUsername(value)} {...variableUi}/></label><label>Password<VariableAwareInput placeholder="{{password}} or password" ariaLabel="Basic auth password" value={basicPassword} onChange={value=>setBasicPassword(value)} {...variableUi}/></label></>}
                  {authType==='apiKey'&&<><label>Key<VariableAwareInput placeholder="X-API-Key" ariaLabel="API key name" value={apiKeyName} onChange={value=>setApiKeyName(value)} {...variableUi}/></label><label>Value<VariableAwareInput placeholder="{{apiKey}}" ariaLabel="API key value" value={apiKeyValue} onChange={value=>setApiKeyValue(value)} {...variableUi}/></label><div className="pp-auth-select"><span>Add to</span><RetroSelect ariaLabel="API Key location" value={apiKeyIn} onChange={setApiKeyIn} options={[{value:'header',label:'Header'},{value:'query',label:'Query Param'}]}/></div></>}
                  {authType==='none'?<p>No automatic authorization. Custom Authorization headers remain available in Headers.</p>:<p>Use {'{{variable}}'} for credentials. Workspace saves only variable references for secrets; raw credentials are never written to Neon. Values are visible here by design—avoid screen sharing sensitive tokens.</p>}
                </div></>}
                {reqTab === 'scripts'&&<div className="pp-script-panel">
                  <div className="pp-script-label"><strong>Pre-request script</strong><span>Runs before resolving and sending HTTP request</span></div>
                  <TextEditor value={preScript} onChange={setPreScript} lang="javascript" theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="180px" lint={false} allowComments/>
                  <div className="pp-script-label"><strong>Post-response script</strong><span>Runs after receiving the HTTP response</span></div>
                  <TextEditor value={postScript} onChange={setPostScript} lang="javascript" theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="180px" lint={false} allowComments/>
                  <p className="pp-script-note">Postman-compatible subset: require('crypto-js'), pm.request.url.path, pm.request.body.raw, pm.variables.get/set, pm.environment.get/set, pm.response.json(), pm.test(), console.log().
                  Scripts run in an isolated, time-limited QuickJS worker. External npm import is not enabled yet.</p>
                  {(scriptLog.length>0||scriptTests.length>0||scriptError)&&<div className="pp-script-console"><strong>Script results</strong>
                    {scriptLog.map((l,i)=><pre key={i}>{l}</pre>)}
                    {scriptTests.map((t,i)=><div key={i} className={t.passed?'pp-test-pass':'pp-test-fail'}>{t.passed?'✓':'✕'} {t.name}{t.error&&` — ${t.error}`}</div>)}
                    {scriptError&&<div className="pp-inline-validation">{scriptError}</div>}
                  </div>}
                </div>}
              </div>
              <div className="pp-pane-footer"><ShieldCheck size={14}/><span>Public API tester · No sign-in needed</span><span className="pp-footer-tail">Proxy protected</span></div>
            </section>
            <div role="separator" aria-label="Resize request and response panels" aria-orientation={split === 'vertical' ? 'vertical' : 'horizontal'} className="pp-splitter" onPointerDown={e => { draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={onSplitterMove} onPointerUp={onSplitterEnd} onPointerCancel={onSplitterEnd}><span className="pp-splitter-handle"/></div>
            <section className="pp-response-pane">
              <div className="pp-pane-heading pp-response-heading"><span className="pp-pane-title"><Bolt size={15}/> Response</span>{result && !result.error ? <div className="pp-response-metrics"><span className={`pp-status ${statusTone(result.statusCode)}`}><span className="pp-status-dot"/>{result.statusCode} {result.reasonPhrase}</span><span><Clock3 size={13}/> {result.elapsedMs} ms</span><span><ArrowDownToLine size={13}/> {new Blob([result.body || '']).size.toLocaleString()} B</span></div> : <span className="pp-pane-meta">Awaiting response</span>}</div>
              <div className="pp-panel-tabs"><button className={resTab === 'body' ? 'active' : ''} onClick={()=>setResTab('body')}>Body</button><button className={resTab === 'headers' ? 'active' : ''} onClick={()=>setResTab('headers')}>Headers{result && !result.error && <span className="pp-tiny-count">{Object.keys(result.headers || {}).length}</span>}</button><div className="pp-panel-tabs-spacer"/><button className="pp-copy-response" disabled={!result||!!result.error} onClick={beautifyResult} title="Beautify response"><WandSparkles size={14}/> Beautify</button><button className="pp-copy-response" disabled={!result||!!result.error} onClick={()=>setResponsePretty(v=>!v)} title="Toggle raw/pretty">{responsePretty?'Pretty':'Raw'}</button><button className="pp-copy-response" title="Save response example" disabled={!result || !!result.error} onClick={openSaveExampleDialog}><Save size={14}/> Save example</button><button className="pp-copy-response" title="Copy response" disabled={!result || !!result.error} onClick={() => { navigator.clipboard?.writeText(responseText); setNotice('Response copied'); }}><Copy size={14}/> Copy</button></div>
              <div className="pp-panel-body pp-response-body">
                {!result ? <div className="pp-response-empty"><div className="pp-response-empty-symbol"><Terminal size={28}/></div><strong>{loading ? 'Sending request…' : 'Ready to send a request'}</strong><p>{loading ? 'The server is processing your request.' : 'Enter a URL, configure your request, and hit Send. Your response will appear here.'}</p><span>⌘ / Ctrl + Enter</span></div> : result.error ? <div className="pp-response-error"><div><X size={18}/></div><strong>Request failed</strong><p>{result.error}</p></div> : <><div className="pp-response-code"><TextEditor readOnly value={responseText} lang={resTab==='headers'?'json':languageFromMime(responseType)} theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="250px"/></div>{result.truncated && <div className="pp-response-warning">Output truncated to 1 MB.</div>}{result.isBinary && <div className="pp-response-warning">Binary content displayed as Base64.</div>}</>}
              </div>
              <div className="pp-pane-footer"><span>{result && !result.error ? `HTTP ${result.statusCode}` : 'No response yet'}</span><span className="pp-footer-tail">{responseExamples.length ? `${responseExamples.length} example${responseExamples.length>1?'s':''} saved` : (result?.truncated ? 'Truncated' : 'Raw / JSON preview')}</span></div>
            </section>
          </div>
        </div> : <div className="pp-manager">
          <div className="pp-manager-top"><div><span className="pp-manager-eyebrow"><Layers3 size={14}/> WORKSPACE MANAGEMENT</span><h2>{activeWorkspace?.name || 'Your workspaces'}</h2><p>Collections, teams and members are available after sign-in.</p></div><button className="pp-plain-btn" onClick={() => setPage('tester')}><ArrowRight size={15}/> Back to request tester</button></div>
          <div className="pp-manager-columns"><aside className="pp-manager-ws"><div className="pp-manager-label">YOUR WORKSPACES <span>{workspaces.length}</span></div>{canCreateWorkspace&&<form className="pp-manager-add" onSubmit={e => { e.preventDefault(); if(!newWs.trim()) return; doAction(async()=>{const w=await api('/api/workspaces','POST',{name:newWs.trim()},token);setNewWs('');await loadWorkspaces();setSelectedWs(w.id);setNotice('Workspace created.');}); }}><input placeholder="New workspace" maxLength={120} value={newWs} onChange={e=>setNewWs(e.target.value)}/><button title="Create workspace" disabled={busyAction}><Plus size={16}/></button></form>}{workspaces.map(w=><button className={`pp-manager-ws-row ${w.id === selectedWs ? 'active' : ''}`} key={w.id} onClick={()=>setSelectedWs(w.id)}><Layers3 size={17}/><span>{w.name}</span><ChevronRight size={15}/></button>)}</aside>
            <section className="pp-manager-details">{!activeWorkspace ? <Empty icon={FolderClosed} title="No workspace selected" description="Create a workspace on the left to start organizing your requests."/> : <>
              <div className="pp-manager-detail-title"><span className="pp-manager-avatar"><Layers3 size={18}/></span><div><strong>{activeWorkspace.name}</strong><small>Private · Members only</small></div><LockKeyhole size={15}/></div>
              <div className="pp-manager-tabs">{[['collections','Collections',FolderClosed],['teams','Teams',Users],['members','Members',ShieldCheck]].map(([id,label,Icon])=><button className={wsTab === id ? 'active':''} key={id} onClick={()=>setWsTab(id)}><Icon size={15}/>{label}</button>)}</div>
              {wsTab === 'collections' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Collections</strong>{canEditCloud&&<form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newCollection.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections`,'POST',{name:newCollection.trim()},token);setNewCollection('');setCollections(await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token));setNotice('Collection created');});}}><input placeholder="Collection name" maxLength={120} value={newCollection} onChange={e=>setNewCollection(e.target.value)}/><button title="Create collection" disabled={busyAction}><Plus size={16}/></button></form>}</div>{collections.map(c=><button className={`pp-manager-entry ${selectedCol === c.id ? 'active' : ''}`} key={c.id} onClick={()=>setSelectedCol(c.id)}><FolderClosed size={16}/><span>{c.name}</span><ChevronRight size={15}/></button>)}{!collections.length && <Empty icon={FolderPlus} title="No collections yet" description="Create your first collection above."/>}{selectedCol && <div className="pp-manager-saved"><h3>Saved requests</h3>{savedRequests.map(r=><div className="pp-manager-saved-row" key={r.id}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><button onClick={()=>loadSavedRequest(r)}><strong>{r.name}</strong><small>{r.url}</small></button>{canEditCloud&&<IconButton icon={Trash2} label="Delete request" disabled={busyAction} onClick={()=>doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests/${r.id}`,'DELETE',undefined,token);setSavedRequests(v=>v.filter(x=>x.id!==r.id));})}/>}</div>)}{!savedRequests.length && <p className="pp-muted-small">No saved requests in this collection.</p>}</div>}</div>}
              {wsTab === 'teams' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Teams</strong>{canManageTeams&&<form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newTeam.trim())return;doAction(async()=>{const t=await api(`/api/workspaces/${selectedWs}/teams`,'POST',{name:newTeam.trim()},token);setNewTeam('');setTeams(await api(`/api/workspaces/${selectedWs}/teams`,'GET',undefined,token));setSelectedTeam(t.id);setNotice('Team created');});}}><input placeholder="Team name" maxLength={120} value={newTeam} onChange={e=>setNewTeam(e.target.value)}/><button title="Create team" disabled={busyAction}><Plus size={16}/></button></form>}</div>{teams.map(t=><button className={`pp-manager-entry ${selectedTeam===t.id?'active':''}`} key={t.id} onClick={()=>setSelectedTeam(t.id)}><Users size={16}/><span>{t.name}</span><ChevronRight size={15}/></button>)}{!teams.length && <Empty icon={Users} title="No teams yet" description="Create a team above to manage collaboration."/>}{activeTeam && <div className="pp-manager-saved"><div className="pp-manager-section-heading"><strong>{activeTeam.name} members</strong>{canManageTeams&&<form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newTeamMember.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/teams/${selectedTeam}/members`,'POST',{email:newTeamMember.trim()},token);setNewTeamMember('');setTeamMembers(await api(`/api/workspaces/${selectedWs}/teams/${selectedTeam}/members`,'GET',undefined,token));setNotice('Member added to team');});}}><input type="email" placeholder="Member email" value={newTeamMember} onChange={e=>setNewTeamMember(e.target.value)}/><button title="Add to team" disabled={busyAction}><Plus size={16}/></button></form>}</div>{teamMembers.map(m=><div className="pp-manager-member" key={m.userId}><span>{m.displayName[0]}</span><div><strong>{m.displayName}</strong><small>{m.email}</small></div></div>)}<p className="pp-muted-small">A user must belong to this workspace before joining a team.</p></div>}</div>}
              {wsTab === 'members' && <div className="pp-manager-section">
                <div className="pp-manager-section-heading"><strong>Workspace members</strong><span className="pp-rbac-muted">Roles apply only to {activeWorkspace?.name||'this workspace'}</span></div>
                {canManageMembers && <form onSubmit={e=>{e.preventDefault();if(!newMember.trim()||!newMemberRoles.length)return;
                  doAction(async()=>{await api(`/api/workspaces/${selectedWs}/members`,'POST',
                    {email:newMember.trim(),role:'Member',roles:newMemberRoles},token);
                    setNewMember('');setNewMemberRoles(['Developer']);
                    setMembers(await api(`/api/workspaces/${selectedWs}/members`,'GET',undefined,token));
                    setNotice('Member added with assigned roles');});}}>
                  <div className="pp-manager-add"><input type="email" placeholder="Existing user email" value={newMember} onChange={e=>setNewMember(e.target.value)}/>
                    <button title="Add member" disabled={busyAction||!newMemberRoles.length}><Plus size={16}/></button></div>
                  <div className="pp-rbac-heading">Assign roles</div>
                  <WorkspaceRolePicker value={newMemberRoles} onChange={setNewMemberRoles} actorRoles={assignableRoles} disabled={busyAction}/>
                </form>}
                {members.map(m=>{
                  const founder=m.userId===activeWorkspace?.ownerUserId;
                  const self=m.userId===me?.id;
                  const canModify=canAssignRoles && !founder && !self &&
                    (assignableRoles.includes('TeamLead') || !(m.roles||[]).some(r=>['TeamLead','WorkspaceAdmin'].includes(r)));
                  return <div className="pp-rbac-manage-member" key={m.userId}>
                    <div className="pp-manager-member"><span>{m.displayName?.[0]||'?'}</span><div><strong>{m.displayName}</strong><small>{m.email}</small></div></div>
                    <div className="pp-rbac-badges">{(m.roles||[]).map(r=><span key={r}>{WORKSPACE_ROLES.find(role=>role.id===r)?.label||r}</span>)}
                      {founder&&<span>Founder</span>}{self&&<span>You</span>}</div>
                    {canModify && <div className="pp-rbac-actions"><button className="pp-plain-btn" type="button" onClick={()=>{
                      if(editingMemberId===m.userId)setEditingMemberId('');else{
                        setEditingMemberId(m.userId);setEditingMemberRoles(normalizeRoles(m.roles));
                      }}}><ShieldCheck size={14}/> {editingMemberId===m.userId?'Cancel':'Manage roles'}</button></div>}
                    {canModify && editingMemberId===m.userId && <div className="pp-rbac-manage-editor">
                      <WorkspaceRolePicker value={editingMemberRoles} onChange={setEditingMemberRoles} actorRoles={assignableRoles} disabled={busyAction}/>
                      <div className="pp-rbac-actions"><button type="button" className="pp-small-primary" disabled={busyAction||!editingMemberRoles.length}
                        onClick={()=>doAction(async()=>{await api(`/api/workspaces/${selectedWs}/members/${m.userId}/roles`,'PUT',
                          {roles:editingMemberRoles},token);
                          setMembers(await api(`/api/workspaces/${selectedWs}/members`,'GET',undefined,token));
                          setEditingMemberId('');setNotice('Workspace roles updated');})}>Save roles</button>
                      </div>
                    </div>}
                  </div>;
                })}
                <p className="pp-muted-small">Members must sign in first. Workspace Admin can grant Developer/QA/Writer; Team Lead can also grant privileged roles.</p>
              </div>}
            </>}</section></div>
        </div>}
      </main>
    </div>
    <footer className="pp-global-footer"><span><span className="pp-footer-dot"/> Pakpost REST Client</span><span className="pp-footer-center">{interceptorMode==='proxy'?'Secure proxy · Private networks blocked':interceptorMode==='extension'?'Browser extension · Allowed destinations only':'Browser · CORS restrictions apply'}</span><span>UTF-8 <span className="pp-footer-divider">·</span> {split === 'horizontal' ? 'Stacked' : 'Side-by-side'}</span></footer>
    {commandOpen && <div className="pp-command-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCommandOpen(false);}}><section className="pp-command-dialog" role="dialog" aria-modal="true" aria-label="Quick search and commands"><div className="pp-command-input-wrap"><Search size={18}/><input autoFocus aria-label="Search commands" value={commandQuery} onChange={e=>{setCommandQuery(e.target.value);setCommandIndex(0);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setCommandIndex(i=>Math.min(visibleCommandItems.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setCommandIndex(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&visibleCommandItems.length){e.preventDefault();setCommandOpen(false);visibleCommandItems[Math.min(commandIndex,visibleCommandItems.length-1)].run();}}} placeholder="Find a request or run a command..."/><kbd>Esc</kbd></div><div className="pp-command-results" role="listbox">{visibleCommandItems.length?visibleCommandItems.map((item,i)=><button type="button" role="option" aria-selected={commandIndex===i} onMouseEnter={()=>setCommandIndex(i)} key={item.key} onClick={()=>{setCommandOpen(false);item.run();}}>{item.method?<span className={`pp-http-label ${item.method.toLowerCase()}`}>{item.method}</span>:<Code2 size={15}/>}<span><strong>{item.title}</strong><small>{item.subtitle}</small></span><ArrowRight size={14}/></button>):<div className="pp-command-empty">No matching requests or commands.</div>}</div></section></div>}
    {notice && createPortal(<div className="pp-toast pp-toast-v17" role="status" aria-live="polite"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={15}/></button></div>,document.body)}
    {documentationTarget&&<Dialog title={`Documentation · ${documentationTarget.type}`} subtitle="Write Markdown notes for OpenAPI/Postman exports." onClose={()=>setDocumentationTarget(null)}><DocumentationEditor key={`${documentationTarget.scope}:${documentationTarget.collectionId}:${documentationTarget.requestId||JSON.stringify(documentationTarget.folderPath||[])}`} title={documentationTarget.name||'Item'} initial={documentationTarget.initial} busy={docBusy} onCancel={()=>setDocumentationTarget(null)} onSave={saveDocumentation}/></Dialog>}
    {exportChoice&&<Dialog title={`Export ${exportChoice.kind}`} subtitle={`Export “${exportChoice.name}” as a downloadable JSON file.`} onClose={()=>setExportChoice(null)}>
      <div className="pp-v17-export-options">
        <p>Format</p><div className="pp-v17-export-choices">
          <button className={exportFormat==='postman'?'active':''} onClick={()=>setExportFormat('postman')}><FileJson size={17}/><span><strong>Postman JSON</strong><small>{exportChoice.kind==='environment'?'Postman environment':'Postman Collection v2.1'}</small></span></button>
          <button className={exportFormat==='openapi'?'active':''} onClick={()=>setExportFormat('openapi')}><Braces size={17}/><span><strong>OpenAPI 3.1</strong><small>{exportChoice.kind==='environment'?'Vendor-extension environment metadata':'API endpoint description'}</small></span></button>
          <button className={exportFormat==='insomnia'?'active':''} onClick={()=>setExportFormat('insomnia')}><FileJson size={17}/><span><strong>Insomnia v4 JSON</strong><small>Legacy portable format · imports in current Insomnia</small></span></button>
        </div>
        <label className="pp-v17-export-secret"><input type="checkbox" checked={exportIncludeSecrets} onChange={e=>setExportIncludeSecrets(e.target.checked)}/> Include secret variable values / known sensitive headers</label>
        {exportIncludeSecrets&&<p className="pp-v17-export-warning">The exported JSON may contain credentials. Store it securely.</p>}
        <p className="pp-v17-export-note">OpenAPI cannot execute Postman scripts; Insomnia v4 JSON is a legacy interchange format, not Insomnia v5 YAML. Environment OpenAPI export uses an x-pakpost-environment extension. Always check payloads/examples for credentials.</p>
        <div className="pp-action-dialog-buttons"><button onClick={()=>setExportChoice(null)}>Cancel</button><button className="pp-modal-submit" onClick={confirmExport}><ArrowDownToLine size={15}/> Export JSON</button></div>
      </div>
    </Dialog>}
    {authOpen && <Dialog title={authMode === 'login' ? 'Welcome back' : 'Create account'} subtitle="Sign in to manage your collections, teams and workspaces. API testing stays open to everyone." onClose={()=>setAuthOpen(false)}>
      <form className="modal-form" onSubmit={submitAuth}>
        {authMode==='register' && <label>Display name<input required maxLength={120} placeholder="Your name" value={authForm.displayName} onChange={e=>setAuthForm(v=>({...v,displayName:e.target.value}))}/></label>}
        <label>Email address<input type="email" required autoComplete="email" value={authForm.email} placeholder="you@example.com" onChange={e=>setAuthForm(v=>({...v,email:e.target.value}))}/></label>
        <label>Password<input type="password" required minLength={authMode === 'register' ? 12 : 1} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder={authMode === 'register' ? 'At least 12 characters' : 'Your password'} value={authForm.password} onChange={e=>setAuthForm(v=>({...v,password:e.target.value}))}/></label>
        {authError && <div className="form-error" role="alert">{authError}</div>}
        <button className="pp-modal-submit" disabled={authBusy} type="submit">{authBusy ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></button>
        <p className="form-toggle">{authMode === 'login' ? 'New to Pakpost?' : 'Already have an account?'} <button type="button" onClick={()=>{setAuthMode(v=>v==='login'?'register':'login');setAuthError('');}}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p>
      </form>
      {GOOGLE_CLIENT_ID && <div className="pp-google-auth-section">
        <div className="pp-google-divider">or continue with</div>
        <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} disabled={authBusy} onCredential={submitGoogleAuth} onError={setAuthError}/>
        <p className="pp-muted-small pp-center">Already have an email/password account? Sign in and choose Connect Google first.</p>
      </div>}
    </Dialog>}
    {googleLinkOpen && me && <Dialog title="Connect Google" subtitle={`Link Google to ${me.email}. This keeps your existing workspaces and collections.`} onClose={()=>setGoogleLinkOpen(false)}>
      <div className="modal-form">
        <label>Confirm your PakPost password<input type="password" autoComplete="current-password" value={googleLinkPassword} onChange={e=>setGoogleLinkPassword(e.target.value)} placeholder="Existing account password"/></label>
        {googleLinkError && <div className="form-error" role="alert">{googleLinkError}</div>}
        {googleLinkPassword && <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} disabled={authBusy} onCredential={submitGoogleLink} onError={setGoogleLinkError}/>}
        {!googleLinkPassword && <p className="pp-muted-small">Enter your PakPost password to enable Google linking.</p>}
      </div>
    </Dialog>}
    {closeConfirmation&&<Dialog title="Unsaved changes" subtitle="Changes in these tabs have not been saved to their collections." onClose={()=>setCloseConfirmation(null)}>
      <div className="pp-unsaved-confirm">
        <p>{closeConfirmation.unsaved.length===1?'This request has unsaved changes:':`${closeConfirmation.unsaved.length} requests have unsaved changes:`}</p>
        <ul>{closeConfirmation.unsaved.map(id=><li key={id}>{openTabs.find(t=>t.id===id)?.name||'Request'}</li>)}</ul>
        <p>Discard these changes and close {closeConfirmation.action==='close'?'the tab':'the selected tabs'}?</p>
        <div className="pp-action-dialog-buttons">
          <button type="button" onClick={()=>setCloseConfirmation(null)}>Keep editing</button>
          <button className="pp-destructive-confirm" type="button" onClick={()=>performTabAction(closeConfirmation.action,closeConfirmation.id,true)}>Discard & close</button>
        </div>
      </div>
    </Dialog>}
    {saveExampleOpen && <Dialog title="Save response example" subtitle="Capture the latest response as an example for this request." onClose={()=>setSaveExampleOpen(false)}><form className="modal-form" onSubmit={saveResponseExample}>
      <label>Example name<input autoFocus required maxLength={140} value={exampleName} onChange={e=>setExampleName(e.target.value)}/></label>
      <label>Description <textarea rows={3} maxLength={1000} placeholder="Optional note, e.g. when to expect this response" value={exampleDescription} onChange={e=>setExampleDescription(e.target.value)}/></label>
      <p className="pp-example-warning">Review the response body before saving. It can contain personal data, tokens, or account details. Known sensitive response headers are redacted; the body is saved as-is (up to 64 KB). {!activeSource()||activeSource()?.pending?'This is a draft; use Save to keep this example in a collection.':''}</p>
      {result && !result.error && <div className="pp-example-preview"><span className={`pp-example-status ${statusTone(result.statusCode)}`}>{result.statusCode}</span><strong>{result.reasonPhrase || 'HTTP response'}</strong><small>{new Blob([result.body || '']).size.toLocaleString()} B · {result.elapsedMs} ms</small></div>}
      <button className="pp-modal-submit" type="submit" disabled={!result||!!result.error||busyAction}><Save size={16}/> Save example</button>
    </form></Dialog>}
    {saveOpen && <Dialog title="Save as new request" subtitle="Keep an independent copy in a local collection or a signed-in workspace." onClose={()=>setSaveOpen(false)}><form className="modal-form" onSubmit={saveRequest}>
      <label>Request name<input autoFocus required maxLength={120} value={saveName} onChange={e=>setSaveName(e.target.value)}/></label>
      <div className="pp-modal-select-label"><span>Destination</span><RetroSelect ariaLabel="Save scope" value={saveScope} onChange={setSaveScope} options={[{value:'local',label:'Local browser'},...(token&&canEditCloud?[{value:'workspace',label:'Workspace · Neon'}]:[])]}/></div>
      {saveScope==='local'?<div className="pp-modal-select-label"><span>Local collection</span><RetroSelect ariaLabel="Local collection" value={saveLocalCollection} onChange={setSaveLocalCollection} options={localCollections.map(c=>({value:c.id,label:c.name}))}/></div>:
        <><div className="pp-modal-select-label"><span>Workspace</span><RetroSelect ariaLabel="Save workspace" value={saveWs} onChange={setSaveWs} options={workspaces.map(w=>({value:w.id,label:w.name}))}/></div><div className="pp-modal-select-label"><span>Collection</span><RetroSelect ariaLabel="Save collection" value={saveCollection} onChange={setSaveCollection} options={saveCols.map(c=>({value:c.id,label:c.name}))}/></div></>}
      {!(saveScope==='local'?localCollections.length:saveCols.length)&&<div className="form-error">Create a collection first.</div>}
      <button className="pp-modal-submit" type="submit" disabled={!(saveScope==='local'?saveLocalCollection:saveCollection)||busyAction}><Save size={16}/> Save new request</button>
    </form></Dialog>}
    {collectionImportOpen&&<Dialog title="Import collection" subtitle="Postman v2.1, OpenAPI JSON, Insomnia v4 JSON or cURL" onClose={()=>{if(!collectionImportBusy)setCollectionImportOpen(false)}}>
      <div className="pp-collection-import-dialog">
        <ImportDestinationPicker authenticated={!!token} allowCloud={canEditCloud} workspaceName={activeWorkspace?.name||''} value={collectionImportDestination} onChange={setCollectionImportDestination} onLogin={()=>{setCollectionImportOpen(false);setAuthMode('login');setAuthOpen(true);}}/>
        <label className="pp-collection-file-picker"><FileUp size={17}/><span>{collectionImportFile?.name||'Choose a collection file'}</span><input type="file" accept=".json,.txt,.curl,.sh,application/json,text/plain" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setCollectionImportError('');if(file.size>3*1024*1024){setCollectionImportError('Maximum collection import size is 3 MB.');return;}setCollectionImportFile(file);}}/></label>
        {collectionImportError&&<p role="alert" className="pp-env-error">{collectionImportError}</p>}
        <div className="pp-collection-import-actions"><button type="button" disabled={collectionImportBusy} onClick={()=>setCollectionImportOpen(false)}>Cancel</button><button type="button" className="pp-env-primary" disabled={collectionImportBusy||!collectionImportFile} onClick={submitCollectionImport}><FileUp size={15}/>{collectionImportBusy?'Importing…':'Import collection'}</button></div>
      </div>
    </Dialog>}
    {actionDialog&&<Dialog title={{renameCollection:'Rename collection',renameRequest:'Rename request',renameFolder:'Rename folder',deleteCollection:'Delete collection',deleteRequest:'Delete request',deleteFolder:'Delete folder',renameExample:'Rename example',deleteExample:'Delete example'}[actionDialog.action]||'Manage collection'} subtitle={actionDialog.action.startsWith('delete')?'This action cannot be undone. Open tabs will not be closed.':'Changes will be reflected in Collections.'} onClose={()=>setActionDialog(null)}>
      <form className="modal-form" onSubmit={executeActionDialog} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setActionDialog(null);}}}>
        {actionDialog.action.startsWith('rename')?<label>Name<input autoFocus required maxLength={actionDialog.action==='renameExample'?140:120} value={actionName} onChange={e=>setActionName(e.target.value)}/></label>:<p>Delete <strong>{actionDialog.name}</strong>?</p>}
        <div className="pp-action-dialog-buttons"><button type="button" onClick={()=>setActionDialog(null)}>Cancel</button><button type="submit" disabled={busyAction} className="pp-modal-submit">{actionDialog.action.startsWith('delete')?'Delete':'Rename'}</button></div>
      </form>
    </Dialog>}
  <FastTooltip/>
  </div>;
}
