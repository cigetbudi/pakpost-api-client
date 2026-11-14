import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, Braces, WandSparkles, AlertTriangle, FileUp, Variable, Bolt, ChevronDown, ChevronRight, Clock3, Code2, Columns2, Copy, FileJson, FolderClosed, FolderPlus, History, Layers3, LayoutPanelTop, LockKeyhole, LogIn, LogOut, Moon, Plus, Save, Search, Send, Settings2, ShieldCheck, Sun, Terminal, Trash2, Users, X, Zap, PanelLeftClose, PanelLeftOpen, Link2,
} from 'lucide-react';
import { TextEditor } from './features/Editors';
import { RetroSelect } from './features/RetroSelect';
import { VariableUrlInput } from './features/VariableUrlInput';
import { FastTooltip } from './features/FastTooltip';
import { EnvironmentExplorer } from './features/EnvironmentExplorer';
import { WorkbenchSettings } from './features/WorkbenchSettings';
import {sortCollectionRoots} from './features/collectionSort';
import { CodeSidebar, ImportExportSidebar } from './features/WorkbenchSidebars';
import { blankDraft, parseCurl, isCurl } from './features/importExport';
import { readWorkbenchCache, writeWorkbenchCache } from './features/workspaceCache';
import {toLocalCollection,validateLibrary,readLocalCollections,writeLocalCollections} from './features/localCollections';
import {planTabClose,reorderTabs} from './features/tabActions';
import {applyLocalAction,exportLocalCollection,updateLocalRequest,createLocalSavedRequest} from './features/localCollectionActions';
import {createPostmanCollection} from './features/importExport';
import {stripJsonComments,hasJsonComments} from './features/jsonComments';
import {findBoundTab} from './features/sourceTabs';
import {LocalCollectionsTree} from './features/LocalCollectionsTree';
import { isDarkAppearance, normalizeAppearance, readAppearance } from './features/appearance';
import { BODY_FORMATS, bodyFormat, languageFromMime, syntaxProblem, formatSource, resolveVars, resolveRows, buildCommand } from './features/requestTools';
import { runSandbox } from './features/runScript';
import { postmanRequestSnapshot } from './features/postmanCompat';

const CACHED = readWorkbenchCache();
const RECOVERED = CACHED?.drafts?.[CACHED.activeTabId] || {};
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const EMPTY_HEADER = { key: '', value: '' };
const storedToken = () => sessionStorage.getItem('pakpost_token') || '';
const getMessage = (e) => e?.message || 'Something went wrong';

async function api(path, method = 'GET', body, token = '') {
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error(data?.message || (data?.errors?.map(e => e.message).join(', ')) || `HTTP ${res.status}`);
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

export default function App() {
  const [page, setPage] = useState('tester');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [theme, setTheme] = useState(() => readAppearance(localStorage));
  const [token, setToken] = useState(storedToken);
  const [me, setMe] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ displayName: '', email: '', password: '' });
  const [notice, setNotice] = useState('');
  const [method, setMethod] = useState(RECOVERED.method || 'GET');
  const [url, setUrl] = useState(RECOVERED.url ?? 'https://httpbin.org/get');
  const [rows, setRows] = useState(RECOVERED.rows || [{ ...EMPTY_HEADER }]);
  const [body, setBody] = useState(RECOVERED.body || '');
  const [format, setFormat] = useState(RECOVERED.format || 'application/json');
  const [formFields, setFormFields] = useState(RECOVERED.formFields || [{key:'',value:''}]);
  const [binaryFile, setBinaryFile] = useState({name:RECOVERED.binaryFile?.name || '',base64:''});
  const [preScript, setPreScript] = useState(RECOVERED.preScript || '');
  const [postScript, setPostScript] = useState(RECOVERED.postScript || '');
  const [scriptLog, setScriptLog] = useState(RECOVERED.scriptLog || []);
  const [scriptTests, setScriptTests] = useState(RECOVERED.scriptTests || []);
  const [scriptError, setScriptError] = useState(RECOVERED.scriptError || '');
  const [responsePretty, setResponsePretty] = useState(true);
  const [prettyResponse, setPrettyResponse] = useState('');
  const [envScope, setEnvScope] = useState(CACHED?.envScope || 'local');
  const [localEnvironments, setLocalEnvironments] = useState(initialLocalEnvs);
  const [workspaceEnvironments, setWorkspaceEnvironments] = useState([]);
  const [activeEnvId, setActiveEnvId] = useState(CACHED?.activeEnvId || '');
  const [reqTab, setReqTab] = useState(RECOVERED.reqTab || 'params');
  const [resTab, setResTab] = useState(RECOVERED.resTab || 'body');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(RECOVERED.result || null);
  const [recent, setRecent] = useState(CACHED?.recent || []);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState('');
  const [collections, setCollections] = useState([]);
  const [localCollections, setLocalCollections] = useState(readLocalCollections);
  const [creatingLocalCollection, setCreatingLocalCollection] = useState(false);
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
  const [newTeamMember, setNewTeamMember] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveScope,setSaveScope] = useState('local');
  const [saveLocalCollection,setSaveLocalCollection] = useState('');
  const [actionDialog,setActionDialog] = useState(null);
  const [actionName,setActionName] = useState('');
  const [workspaceMenu,setWorkspaceMenu] = useState(null);
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
  const [params, setParams] = useState(RECOVERED.params || [{ ...EMPTY_HEADER }]);
  const [authType, setAuthType] = useState(RECOVERED.authType || 'none');
  const [bearerToken, setBearerToken] = useState(RECOVERED.bearerToken || '');
  const [openTabs, setOpenTabs] = useState(CACHED?.openTabs || [{ id: 't1', name: 'Untitled Request', method: 'GET' }]);
  const [tabMenu, setTabMenu] = useState(null);
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

  function snapshot() { return { method, url, rows: rows.map(r => ({ ...r })), body, responsePretty, prettyResponse, format, formFields:formFields.map(r=>({...r})),binaryFile:{...binaryFile},preScript,postScript,scriptLog,scriptTests,scriptError, reqTab, resTab, result, params: params.map(p => ({ ...p })), authType, bearerToken }; }
  function restoreDraft(next) {
    setMethod(next.method||'GET');setUrl(next.url||'');setRows(next.rows||[{...EMPTY_HEADER}]);setBody(next.body||'');
    setFormat(next.format||'application/json');setFormFields(next.formFields||[{key:'',value:''}]);
    setBinaryFile(next.binaryFile||{name:'',base64:''});
    setPreScript(next.preScript||'');setPostScript(next.postScript||'');
    setScriptLog(next.scriptLog||[]);setScriptTests(next.scriptTests||[]);setScriptError(next.scriptError||'');
    setReqTab(next.reqTab||'params');setResTab(next.resTab||'body');setResult(next.result||null);setResponsePretty(next.responsePretty??true);setPrettyResponse(next.prettyResponse||'');
    setParams(next.params||[{...EMPTY_HEADER}]);setAuthType(next.authType||'none');setBearerToken(next.bearerToken||'');
  }
  function stashActive() { draftsRef.current[activeTabRef.current] = snapshot(); }
  useEffect(()=>writeLocalCollections(localCollections),[localCollections]);
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
  },[method,url,rows,body,format,formFields,binaryFile,preScript,postScript,scriptLog,scriptTests,scriptError,
    reqTab,resTab,result,params,authType,bearerToken,openTabs,activeTabId,recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope]);
  function selectTab(id) {
    if (id === activeTabRef.current) { setPage('tester'); return; }
    stashActive();
    const next = draftsRef.current[id];
    if (!next) return;
    activeTabRef.current = id; setActiveTabId(id);
    restoreDraft(next);

    setPage('tester');
  }
  function addTab(request, source = null) {
    stashActive();
    const id = `t${++tabSequence.current}`;
    const draft = { ...blankDraft(), ...request, binaryFile:{name:request?.binaryFile?.name||'',base64:''},
      params:request?.params||[{...EMPTY_HEADER}],rows:request?.rows||[{...EMPTY_HEADER}],
      formFields:request?.formFields||[{...EMPTY_HEADER}],result:null,scriptLog:[],scriptTests:[],scriptError:''};
    draftsRef.current[id] = draft; activeTabRef.current = id;
    const name = request?.name || 'Untitled Request';
    setOpenTabs(t => [...t, { id, name, method: draft.method, source }]);
    setActiveTabId(id); restoreDraft(draft); setPage('tester');
  }
  function importRequestsAndEnvironments({kind,requests=[],environments=[],collections:incoming=[]}) {
    if(requests.length>200)throw Error('Import limit: maximum 200 requests.');
    if(kind==='postman'||kind==='curl'){
      const sources=kind==='curl'?[{name:'Imported cURL',requests}]:incoming.length?incoming:[{name:'Imported collection',requests}];
      const next=validateLibrary([...localCollections,...sources.map(c=>toLocalCollection(c))]);
      setLocalCollections(next);
      setExplorerTab('collections');setSidebarCollapsed(false);setPage('tester');
    }else if(requests.length){
      // A Pakpost session is a tab backup, not a Postman collection import.
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
    if(environments.length){
      const added=environments.map(env=>({id:crypto.randomUUID(),name:env.name||'Imported',variables:(env.variables||[]).map(v=>({key:String(v.key||''),value:String(v.value||''),isSecret:!!v.isSecret}))}));
      setLocalEnvironments(current=>[...current,...added]);
      setEnvScope('local');setActiveEnvId(added[0].id);
    }
  }
  function createLocalCollection(e){
    e.preventDefault();
    const name=localCollectionName.trim();if(!name)return;
    try{setLocalCollections(validateLibrary([...localCollections,toLocalCollection({name,requests:[]})]));setLocalCollectionName('');setCreatingLocalCollection(false);}
    catch(err){setNotice(getMessage(err));}
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
  function downloadJson(data,filename){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function updateLocal(action){
    try{setLocalCollections(old=>applyLocalAction(old,action));
      if(action.type==='deleteRequest'||action.type==='deleteCollection')setOpenTabs(ts=>ts.map(t=>t.source?.scope==='local'&&(action.type==='deleteCollection'?t.source.collectionId===action.collectionId:(t.source.collectionId===action.collectionId&&t.source.requestId===action.requestId))?{...t,source:null}:t));
      if(action.type==='renameRequest')setOpenTabs(ts=>ts.map(t=>t.source?.scope==='local'&&t.source.collectionId===action.collectionId&&t.source.requestId===action.requestId?{...t,name:action.name}:t));
      if(action.type==='deleteRequest'||action.type==='deleteCollection')setNotice('Deleted from local collection. Open drafts are preserved.');
    }catch(e){setNotice(getMessage(e));}
  }
  function handleLocalMenu(item){
    const {action,collectionId,requestId,folderPath}=item;
    const collection=localCollections.find(c=>c.id===collectionId);
    if(!collection)return;
    if(action==='exportCollection'){
      downloadJson(exportLocalCollection(collection),`${collection.name.replace(/[^a-z0-9_-]/gi,'_')}.postman_collection.json`);return;
    }
    if(action==='newRequest'){
      const draft={...blankDraft(),name:'New Request',requestName:'New Request',folderPath:folderPath||[]};
      try{
        const next=createLocalSavedRequest(localCollections,collectionId,draft);
        setLocalCollections(next.collections);openLocalRequest(next.request,collectionId);
      }catch(e){setNotice(getMessage(e));}
      return;
    }
    const immediate={duplicateCollection:'duplicateCollection',duplicateFolder:'duplicateFolder',duplicateRequest:'duplicateRequest',sortCollection:'sortCollection',sortMethod:'sortCollection',sortFolder:'sortFolder'};
    if(immediate[action]){updateLocal({...item,type:immediate[action],sort:action==='sortMethod'?'method':'name'});return;}
    setActionName(item.name||'');setActionDialog({scope:'local',...item});
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
      if(selectedCol===collectionId)
        setSavedRequests(await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests`,'GET',undefined,token));
      setNotice('Request moved to workspace collection');
    }catch(err){setNotice(getMessage(err));}
  }
  function showWorkspaceMenu(e,item){
    e.preventDefault();e.stopPropagation();
    const rect=e.currentTarget.getBoundingClientRect();
    setWorkspaceMenu({...item,x:Math.max(8,Math.min(e.clientX||rect.right,window.innerWidth-226)),y:Math.max(8,Math.min(e.clientY||rect.bottom,window.innerHeight-282))});
  }
  function workspaceDraft(item){
    let headers={};try{headers=JSON.parse(item.headersJson||'{}')}catch{}
    let fields=[];try{fields=JSON.parse(item.formFieldsJson||'[]')}catch{}
    return {...blankDraft(),...item,rows:[...toRows(headers),{...EMPTY_HEADER}],format:item.contentType||'application/json',
      formFields:fields,preScript:item.preRequestScript||'',postScript:item.postResponseScript||''};
  }
  async function handleWorkspaceMenu(action,item){
    setWorkspaceMenu(null);
    if(action==='renameCollection'||action==='deleteCollection'||action==='renameRequest'||action==='deleteRequest'){
      setActionName(item.name||'');setActionDialog({scope:'workspace',action,...item});return;
    }
    const base=`/api/workspaces/${selectedWs}/collections`;
    await doAction(async()=>{
      if(action==='newRequest'){
        addTab({...blankDraft(),name:'New Request'});
        openSaveAs({scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId});setSaveName('New Request');return;
      }
      if(action==='sortCollection'){
        setWorkspaceSorted(old=>({...old,[item.collectionId]:'name'}));
        return;
      }
      const list=await api(`${base}/${item.collectionId}/requests`,'GET',undefined,token);
      if(action==='exportCollection'){
        const name=collections.find(c=>c.id===item.collectionId)?.name||'Workspace collection';
        downloadJson(createPostmanCollection(list.map(workspaceDraft),{name}),`${name.replace(/[^a-z0-9_-]/gi,'_')}.postman_collection.json`);return;
      }
      if(action==='duplicateCollection'){
        if(list.length>100)throw Error('Duplicate limit: 100 saved requests');
        const source=collections.find(c=>c.id===item.collectionId);
        const destination=await api(base,'POST',{name:`${source?.name||'Collection'} (copy)`},token);
        for(const req of list)await api(`${base}/${destination.id}/requests`,'POST',
          {name:req.name,method:req.method,url:req.url,headersJson:req.headersJson,body:req.body,bodyMode:req.bodyMode,contentType:req.contentType,formFieldsJson:req.formFieldsJson,preRequestScript:req.preRequestScript,postResponseScript:req.postResponseScript},token);
        setCollections(await api(base,'GET',undefined,token));return;
      }
      if(action==='duplicateRequest'){
        const req=list.find(x=>x.id===item.requestId);if(!req)return;
        await api(`${base}/${item.collectionId}/requests`,'POST',
          {name:`${req.name} (copy)`,method:req.method,url:req.url,headersJson:req.headersJson,body:req.body,bodyMode:req.bodyMode,contentType:req.contentType,formFieldsJson:req.formFieldsJson,preRequestScript:req.preRequestScript,postResponseScript:req.postResponseScript},token);
        if(selectedCol===item.collectionId)setSavedRequests(await api(`${base}/${item.collectionId}/requests`,'GET',undefined,token));
      }
    });
  }
  async function executeActionDialog(e){
    e.preventDefault();if(!actionDialog)return;
    const {scope,action,collectionId,requestId,folderPath}=actionDialog;
    const name=actionName.trim();
    if(action.startsWith('rename')&&!name)return;
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
        const item=savedRequests.find(x=>x.id===requestId);if(!item)return;
        await api(`${base}/requests/${requestId}`,'PUT',{...item,name},token);
        setSavedRequests(old=>old.map(x=>x.id===requestId?{...x,name}:x));
        setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.requestId===requestId?{...t,name}:t));
      }else if(action==='deleteRequest'){
        await api(`${base}/requests/${requestId}`,'DELETE',undefined,token);
        setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.requestId===requestId?{...t,source:null}:t));
        setSavedRequests(old=>old.filter(x=>x.id!==requestId));
      }
    }); if(!success)return; }
    setActionDialog(null);
  }
  function importCurlIntoCurrent(value){
    try{
      const parsed=parseCurl(value);
      setMethod(parsed.method);setUrl(parsed.url);setRows(parsed.rows);setBody(parsed.body);setFormat(parsed.format);
      setParams(parsed.params);setFormFields(parsed.formFields);setBinaryFile({name:'',base64:''});
      setAuthType(parsed.authType);setBearerToken(parsed.bearerToken);setResult(null);setPrettyResponse('');
      setReqTab(parsed.body||parsed.formFields.some(r=>r.key)?'body':'params');
      setOpenTabs(t=>t.map(x=>x.id===activeTabRef.current?{...x,method:parsed.method,name:parsed.name,status:undefined}:x));
      setNotice(`cURL imported: ${parsed.method} ${parsed.url}. Review before sending.`);
    }catch(e){setNotice(`cURL import failed: ${getMessage(e)}`);}
  }
  function closeTab(id){performTabAction('close',id);}
  function performTabAction(action,id){
    setTabMenu(null);
    if(action==='duplicate'){
      stashActive();const source=draftsRef.current[id];if(!source)return;
      const newId=`t${++tabSequence.current}`;
      const cloned=JSON.parse(JSON.stringify(source));
      draftsRef.current[newId]={...cloned,binaryFile:{name:cloned.binaryFile?.name||'',base64:''},result:null,scriptLog:[],scriptTests:[],scriptError:''};
      const sourceTab=openTabs.find(t=>t.id===id);
      const index=openTabs.findIndex(t=>t.id===id);
      setOpenTabs(t=>[...t.slice(0,index+1),{id:newId,name:`${sourceTab?.name||'Request'} (copy)`,method:cloned.method,source:null},...t.slice(index+1)]);
      selectTabFromDraft(newId);return;
    }
    stashActive();
    const plan=planTabClose(openTabs,id,activeTabRef.current,action);
    if(plan.reset){
      const blank={...blankDraft()};const blankId=id;
      draftsRef.current={[blankId]:blank};
      setOpenTabs([{id:blankId,name:'Untitled Request',method:'GET'}]);
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
    let savedRows;
    try { savedRows = toRows(JSON.parse(item.headersJson || '{}')); } catch { savedRows = []; }
    let formFields = [];
    try { formFields = JSON.parse(item.formFieldsJson||'[]'); }catch{}
    openBoundRequest({ ...item,rows:[...savedRows,{...EMPTY_HEADER}],format:item.contentType||'application/json',formFields:formFields.length?formFields:[{key:'',value:''}],preScript:item.preRequestScript||'',postScript:item.postResponseScript||'' },
      {scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId||selectedCol,requestId:item.id});
  }


  useEffect(()=>{if(!token&&envScope==='workspace'){setEnvScope('local');setActiveEnvId('');}},[token,envScope]);
  useEffect(()=>{
    const safe=localEnvironments.map(e=>({...e,variables:e.variables.map(v=>v.isSecret?{...v,value:''}:v)}));
    const secrets=Object.fromEntries(localEnvironments.map(e=>[e.id,Object.fromEntries(e.variables.filter(v=>v.isSecret).map(v=>[v.key,v.value]))]));
    localStorage.setItem('pakpost_guest_envs',JSON.stringify(safe));
    sessionStorage.setItem('pakpost_guest_secrets',JSON.stringify(secrets));
  },[localEnvironments]);
  useEffect(()=>{
    if(envScope!=='workspace'||!token||!selectedWs){setWorkspaceEnvironments([]);return;}
    api(`/api/workspaces/${selectedWs}/environments`,'GET',undefined,token)
      .then(setWorkspaceEnvironments).catch(e=>setNotice(`Environments API: ${getMessage(e)}. Apply the v3 EF migration.`));
  },[envScope,token,selectedWs]);
  const currentEnvironments=envScope==='workspace'?workspaceEnvironments:localEnvironments;
  const activeEnvironment=currentEnvironments.find(e=>e.id===activeEnvId);
  const varsFromEnv=(allowSecrets=true)=>Object.fromEntries((activeEnvironment?.variables||[]).map(v=>[v.key,v.isSecret&&!allowSecrets?'[REDACTED]':v.value]));
  function updateEnvScope(scope){setEnvScope(scope);setActiveEnvId('');}
  async function createEnvironment(name){
    if(envScope==='workspace'){
      if(!selectedWs||!token)throw new Error('Sign in and choose a workspace');
      const env=await api(`/api/workspaces/${selectedWs}/environments`,'POST',{name},token);
      setWorkspaceEnvironments(v=>[...v,env]);setActiveEnvId(env.id);
    }else{const env={id:crypto.randomUUID(),name,variables:[]};setLocalEnvironments(v=>[...v,env]);setActiveEnvId(env.id)}
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
  async function applyScriptVariables(values) {
    if(!activeEnvironment)return;
    const old=activeEnvironment.variables;
    const merged=Object.entries(values).map(([key,value])=>({key,value:String(value),isSecret:old.find(x=>x.key===key)?.isSecret||false}));
    if(JSON.stringify(Object.fromEntries(old.map(x=>[x.key,x.value])))!==JSON.stringify(values))
      await persistEnvironment({...activeEnvironment,variables:merged});
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
    if(authType==='bearer'&&bearerToken.trim())command.headers.Authorization=`Bearer ${resolveVars(bearerToken.trim(),vars).value}`;
    return command;
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
    return allowSecrets?request:maskSensitiveHeaders(request);
  }
  function codePreviewRequest(){
    const fmt=bodyFormat(format);
    const query=params.filter(x=>x.key.trim()).map(x=>`${encodeURIComponent(x.key)}=${encodeURIComponent(x.value||'')}`).join('&');
    const target=url+(query?(url.includes('?')?'&':'?')+query:'');
    const headers={...requestHeaderObject()};
    if(fmt.mode==='raw'&&body&&!Object.keys(headers).some(x=>x.toLowerCase()==='content-type'))headers['Content-Type']=fmt.mime;
    return {method,url:target,headers:maskSensitiveHeaders({headers}).headers,body:languageFromMime(format)==='json'?stripJsonComments(body):body,bodyMode:fmt.mode,contentType:format,
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

  function logout() { sessionStorage.removeItem('pakpost_token'); setToken(''); setMe(null); setPage('tester'); setWorkspaces([]); }
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
  async function submitAuth(e) {
    e.preventDefault(); setAuthBusy(true); setAuthError('');
    try {
      const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register' ? authForm : { email: authForm.email, password: authForm.password };
      const data = await api(path, 'POST', payload);
      sessionStorage.setItem('pakpost_token', data.accessToken);
      setToken(data.accessToken); setMe(data.user); setAuthOpen(false);
      setAuthForm({ displayName: '', email: '', password: '' });
      setNotice(`Welcome, ${data.user.displayName}. You can now use workspaces.`);
    } catch (e) { setAuthError(getMessage(e)); }
    finally { setAuthBusy(false); }
  }
  async function loadWorkspaces(auth = token) {
    if (!auth) return;
    try {
      const data = await api('/api/workspaces', 'GET', undefined, auth);
      setWorkspaces(data);
      setSelectedWs(current => data.some(x => x.id === current) ? current : (data[0]?.id || ''));
    } catch (e) { setNotice(getMessage(e)); }
  }
  useEffect(() => { if (token) loadWorkspaces(token); }, [token]);
  useEffect(() => {
    if (!token || !selectedWs) { setCollections([]); setMembers([]); setTeams([]); return; }
    Promise.all([
      api(`/api/workspaces/${selectedWs}/collections`, 'GET', undefined, token),
      api(`/api/workspaces/${selectedWs}/members`, 'GET', undefined, token),
      api(`/api/workspaces/${selectedWs}/teams`, 'GET', undefined, token),
    ]).then(([cols, mems, tms]) => {
      setCollections(cols); setMembers(mems); setTeams(tms);
      setSelectedCol(current => cols.some(x => x.id === current) ? current : cols[0]?.id || '');
      setSelectedTeam(current => tms.some(x => x.id === current) ? current : tms[0]?.id || '');
    }).catch(e => setNotice(getMessage(e)));
  }, [selectedWs, token]);
  useEffect(() => {
    if (!token || !selectedWs || !selectedCol) { setSavedRequests([]); return; }
    api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests`, 'GET', undefined, token)
      .then(setSavedRequests).catch(e => setNotice(getMessage(e)));
  }, [selectedWs, selectedCol, token]);
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
        if(page === 'tester' && !busyAction && !saveOpen && !actionDialog)saveCurrent();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && page === 'tester') {
        e.preventDefault();
        if (!loading) sendRequest();
      }
    };
    window.addEventListener('keydown', onKeyboard);
    return () => window.removeEventListener('keydown', onKeyboard);
  }, [page, loading, method, url, rows, body, params, authType, bearerToken,format,formFields,activeEnvId,localEnvironments,workspaceEnvironments,preScript,postScript,openTabs,localCollections,token,selectedWs,selectedCol,busyAction,saveOpen,actionDialog]);

  const activeWorkspace = workspaces.find(x => x.id === selectedWs);
  const activeTeam = teams.find(x => x.id === selectedTeam);
  const headerCount = rows.filter(x => x.key.trim()).length;
  const requestHeaderObject = () => Object.fromEntries(rows.filter(x => x.key.trim()).map(x => [x.key.trim(), x.value]));
  async function sendRequest() {
    if(!url.trim()){setNotice('Enter a request URL first');return;}
    if(loading)return;
    const tabId=activeTabRef.current;
    stashActive();setLoading(true);setResult(null);setPrettyResponse('');setResponsePretty(true);setScriptError('');setScriptLog([]);setScriptTests([]);
    let variables=varsFromEnv();
    const logs=[],tests=[];
    try {
      const pre=await runSandbox(preScript,'pre',variables,postmanRequestSnapshot({method,url,headers:requestHeaderObject(),body:languageFromMime(format)==='json'?stripJsonComments(body):body,format},variables),null);
      if(pre.error)throw new Error(`Pre-request script: ${pre.error}`);
      variables=pre.variables;logs.push(...pre.logs.map(x=>'PRE: '+x));tests.push(...pre.tests);
      await applyScriptVariables(pre.environmentVariables || variables);
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
      const r=await api('/api/proxy/send','POST',command);
      // An HTTP request that completed must remain visible even if the post-response script fails.
      let scriptErrorNext='';
      try {
        const post=await runSandbox(postScript,'post',pre.environmentVariables||varsFromEnv(),command,r,pre.localVariables||{});
        logs.push(...post.logs.map(x=>'POST: '+x));tests.push(...post.tests);
        if(post.error){scriptErrorNext=post.error;logs.push('SCRIPT ERROR: '+post.error);}
        else await applyScriptVariables(post.environmentVariables||post.variables);
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
  const currentSavePayload=(name)=>({name,method,url,headersJson:JSON.stringify(requestHeaderObject()),body,
    bodyMode:bodyFormat(format).mode,contentType:format,
    formFieldsJson:JSON.stringify(formFields.map(({key,value,fileName,contentType})=>({key,value,fileName,contentType}))),
    preRequestScript:preScript,postResponseScript:postScript});
  function openSaveAs(destination=null){
    const origin=destination||activeSource();
    setSaveScope(origin?.scope||'local');
    setSaveLocalCollection(origin?.scope==='local'?origin.collectionId:localCollections[0]?.id||'');
    setSaveWs(origin?.workspaceId||selectedWs||workspaces[0]?.id||'');
    setSaveCollection(origin?.scope==='workspace'?origin.collectionId:selectedCol||'');
    setSaveName(activeRequestName==='Untitled Request'?`${method} ${url||'request'}`:activeRequestName);
    setSaveOpen(true);
  }
  async function saveCurrent(){
    const origin=activeSource();
    if(!origin){openSaveAs();return;}
    const name=activeRequestName;
    const tabId=activeTabRef.current;
    await doAction(async()=>{
      if(origin.scope==='local'){
        setLocalCollections(updateLocalRequest(localCollections,origin.collectionId,origin.requestId,{...snapshot(),name}));
      }else{
        if(!token)throw Error('Sign in to update workspace requests');
        await api(`/api/workspaces/${origin.workspaceId}/collections/${origin.collectionId}/requests/${origin.requestId}`,'PUT',currentSavePayload(name),token);
        if(origin.workspaceId===selectedWs&&origin.collectionId===selectedCol)
          setSavedRequests(await api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests`,'GET',undefined,token));
      }
      // Keep saved draft (response state remains in-memory, never copied to collection).
      draftsRef.current[tabId]={...snapshot()};
      setNotice(`Saved changes to ${name}`);
    });
  }
  async function saveRequest(e){
    e.preventDefault();
    if(!saveName.trim())return;
    await doAction(async()=>{
      let source;
      if(saveScope==='local'){
        const next=createLocalSavedRequest(localCollections,saveLocalCollection,{...snapshot(),name:saveName});
        setLocalCollections(next.collections);
        source={scope:'local',collectionId:saveLocalCollection,requestId:next.request.id};
      }else{
        if(!token)throw Error('Sign in to save to workspace');
        const saved=await api(`/api/workspaces/${saveWs}/collections/${saveCollection}/requests`,'POST',currentSavePayload(saveName),token);
        source={scope:'workspace',workspaceId:saveWs,collectionId:saveCollection,requestId:saved.id};
        if(saveWs===selectedWs&&saveCollection===selectedCol)
          setSavedRequests(await api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests`,'GET',undefined,token));
      }
      const id=activeTabRef.current;
      setOpenTabs(ts=>ts.map(t=>t.id===id?{...t,name:saveName,source}:t));
      setSaveOpen(false);setNotice(`Saved ${saveName}`);
    });
  }

  const visibleCollections = sortCollectionRoots(collections.filter(c => c.name.toLowerCase().includes(explorerSearch.toLowerCase()) || (c.id === selectedCol && savedRequests.some(r => `${r.name} ${r.url}`.toLowerCase().includes(explorerSearch.toLowerCase())))),collectionSort);
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
      <div className="pp-logo"><div className="pp-logo-mark">p</div><span>pakpost</span><span className="pp-logo-sparkle" aria-hidden="true">✦</span></div>
      <button className="pp-top-search" type="button" aria-label="Search requests and commands" onClick={()=>{setCommandQuery('');setCommandIndex(0);setCommandOpen(true);}}><Search size={15}/><span>Search requests and commands</span><kbd>Ctrl K</kbd></button>
      <div className="pp-top-right">
        <div className="pp-env-top"><span>ENV</span>
          <RetroSelect ariaLabel="Environment scope" title="Environment storage" className="pp-top-scope" value={envScope} onChange={updateEnvScope} options={[{value:'local',label:'Local'},{value:'workspace',label:'Workspace',disabled:!token||!selectedWs}]}/>
          <RetroSelect ariaLabel="Active environment" className="pp-top-environment" value={activeEnvId} onChange={setActiveEnvId} options={[{value:'',label:'No environment'},...currentEnvironments.map(e=>({value:e.id,label:e.name}))]}/>
          <button title="Manage environments" onClick={()=>openContext('environments')}><Settings2 size={16}/></button>
        </div>
        <span className="pp-connection"><span/> Local development</span>
        {me ? <button className="pp-profile" title={me.email} onClick={logout}><span>{me.displayName.slice(0, 1).toUpperCase()}</span><span className="pp-profile-name">{me.displayName}</span><LogOut size={14}/></button> : <button className="pp-signin" onClick={() => setAuthOpen(true)}><LogIn size={15}/> Sign in</button>}
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
        {explorerTab === 'environments' ? <EnvironmentExplorer items={currentEnvironments} selected={activeEnvId} onSelect={setActiveEnvId} onSave={persistEnvironment} onCreate={createEnvironment} onDelete={deleteEnvironment} scope={envScope==='workspace'?`Workspace: ${activeWorkspace?.name||'Private'}`:'Guest (local)'}/> : explorerTab === 'code' ? <CodeSidebar request={codePreviewRequest()} buildResolved={buildCodeRequest} theme={isDarkAppearance(theme)?'dark':'light'}/> : explorerTab === 'exchange' ?
          <ImportExportSidebar requests={openTabs.map(t=>({...draftsRef.current[t.id],...(t.id===activeTabId?snapshot():{}),name:t.name}))}
            environments={localEnvironments} localCollections={localCollections} onImport={importRequestsAndEnvironments} onMessage={setNotice} theme={isDarkAppearance(theme)?'dark':'light'}/> : explorerTab === 'history' ? <>
          <div className="pp-side-subhead"><span>RECENT REQUESTS</span><span>{recent.length}</span></div>
          {recent.length ? <div className="pp-side-scroll">{recent.map((r, i) => <button key={`${i}-${r.url}`} className="pp-history-item" onClick={() => loadRequest(r)}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span className="pp-history-main"><strong>{(() => { try { return new URL(r.url).pathname || '/'; } catch { return r.url; } })()}</strong><small>{r.url}</small></span><span className={r.status < 400 ? 'pp-history-ok' : 'pp-history-bad'}>{r.status}</span></button>)}</div> : <div className="pp-explorer-empty"><History size={23}/><strong>No history yet</strong><span>Requests you send during this session will appear here.</span></div>}
        </> : explorerTab === 'teams' ? <>
          {token ? <><div className="pp-side-subhead"><span>TEAMS · {activeWorkspace?.name || 'WORKSPACE'}</span></div><div className="pp-side-scroll">{teams.map(t => <button key={t.id} className={`pp-tree-row ${selectedTeam === t.id ? 'active' : ''}`} onClick={() => { setSelectedTeam(t.id); navigate('workspace'); setWsTab('teams'); }}><Users size={15}/><span>{t.name}</span></button>)}<button className="pp-add-side" onClick={() => { navigate('workspace'); setWsTab('teams'); }}><Plus size={15}/> Manage teams</button></div></> : <div className="pp-explorer-empty"><LockKeyhole size={22}/><strong>Teams are private</strong><span>Sign in to collaborate with other members.</span><button className="pp-small-primary" onClick={() => setAuthOpen(true)}>Sign in</button></div>}
        </> : <>
          <div className="pp-scope">
            <div className="pp-scope-logo"><Layers3 size={17}/></div>
            <div><strong>{activeWorkspace?.name || 'Personal scratchpad'}</strong><small>{token ? 'Private workspace' : 'Local · guest mode'}</small></div>
            {token && <RetroSelect ariaLabel="Switch workspace" title="Switch workspace" value={selectedWs} onChange={setSelectedWs} options={workspaces.map(w=>({value:w.id,label:w.name}))}/>}
            <ChevronDown size={15} className="pp-scope-chevron"/>
          </div>
          {token && <button className="pp-link-row" onClick={() => navigate('workspace')}><Settings2 size={14}/> Manage workspace <ChevronRight size={13}/></button>}
          <div className="pp-explorer-search"><Search size={14}/><input placeholder="Search collections" aria-label="Search collections" value={explorerSearch} onChange={e => setExplorerSearch(e.target.value)}/></div>
          <div className="pp-global-collection-sort"><span>Sort all collections</span><RetroSelect ariaLabel="Sort all collections" value={collectionSort} onChange={setCollectionSort} options={[{value:'manual',label:'Manual order'},{value:'name-asc',label:'Name A–Z'},{value:'name-desc',label:'Name Z–A'},{value:'newest',label:'Recently updated'}]}/></div>
          <div className="pp-side-subhead"><span>COLLECTIONS</span><button title="Create local collection" onClick={()=>setCreatingLocalCollection(true)}><Plus size={16}/></button></div>
          {creatingLocalCollection&&<form className="pp-local-create" onSubmit={createLocalCollection}><input autoFocus maxLength={120} value={localCollectionName} onChange={e=>setLocalCollectionName(e.target.value)} placeholder="Collection name"/><button type="submit" title="Create collection">Add</button><button type="button" onClick={()=>setCreatingLocalCollection(false)} title="Cancel"><X size={13}/></button></form>}
          <div className="pp-side-scroll">
            {localCollections.length>0&&<><div className="pp-local-subhead">LOCAL · BROWSER <span>{localCollections.length}</span></div>
              <LocalCollectionsTree collections={visibleLocalCollections} search={explorerSearch} onOpen={openLocalRequest} onAction={handleLocalMenu} onMove={moveLocalRequest}/>
            </>}
            {token && selectedWs ? <>
              <div className="pp-local-subhead">WORKSPACE · NEON</div>
              {visibleCollections.map(c => <div key={c.id}>
                <div className="pp-tree-item-container" onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(WORKSPACE_DRAG))e.preventDefault()}} onDrop={e=>moveWorkspaceRequest(e,c.id)}>
                  <button className={`pp-tree-row ${selectedCol === c.id ? 'active' : ''}`} onContextMenu={e=>showWorkspaceMenu(e,{type:'collection',collectionId:c.id,name:c.name})} onClick={() => { setSelectedCol(c.id); setExpandedCollections(v => ({ ...v, [c.id]: !(v[c.id] ?? true) })); }}>
                    {(expandedCollections[c.id] ?? true) && selectedCol === c.id ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    <FolderClosed size={15}/><span>{c.name}</span>
                  </button>
                  <button className="pp-tree-action" title="Collection actions" aria-label={`Actions for ${c.name}`} onClick={e=>showWorkspaceMenu(e,{type:'collection',collectionId:c.id,name:c.name})}><Settings2 size={14}/></button>
                </div>
                {(expandedCollections[c.id] ?? true) && selectedCol === c.id && [...savedRequests].filter(r => `${r.name} ${r.url}`.toLowerCase().includes(explorerSearch.toLowerCase())).sort((a,b)=>workspaceSorted[c.id]==='name'?a.name.localeCompare(b.name):0).map(r => <div className="pp-tree-item-container" key={r.id} draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(WORKSPACE_DRAG,JSON.stringify({collectionId:c.id,requestId:r.id}));}}>
                  <button className="pp-tree-request" title={r.url} onContextMenu={e=>showWorkspaceMenu(e,{type:'request',collectionId:c.id,requestId:r.id,name:r.name})} onClick={() => loadSavedRequest(r)}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span>{r.name}</span></button>
                  <button className="pp-tree-action" title="Request actions" aria-label={`Actions for ${r.name}`} onClick={e=>showWorkspaceMenu(e,{type:'request',collectionId:c.id,requestId:r.id,name:r.name})}><Settings2 size={14}/></button>
                </div>)}
              </div>)}
              {!collections.length && <div className="pp-tree-hint">No collections yet. Start by creating one.</div>}
              <button className="pp-add-side" onClick={() => { navigate('workspace'); setWsTab('collections'); }}><Plus size={14}/> New collection</button>
            </> : <>
              {!localCollections.length&&<div className="pp-tree-hint">Import a Postman Collection to see its folders and requests here. Nothing is sent until you open a request and click Send.</div>}
              <button className="pp-add-side" onClick={()=>{setExplorerTab('exchange');setSidebarCollapsed(false)}}><FileUp size={14}/> Import a collection</button>
              <button className="pp-add-side pp-login-hint" onClick={() => setAuthOpen(true)}><LockKeyhole size={14}/> Sign in to sync to workspace</button>
            </>}
          </div>
          <div className="pp-explorer-bottom">
            {token ? <button onClick={() => navigate('workspace')}><Layers3 size={15}/> Workspace settings <ArrowRight size={14}/></button> : <div className="pp-guest-notice"><span className="pp-guest-live"/><div><strong>You're in guest mode</strong><small>Sending requests doesn't require an account.</small></div></div>}
          </div>
        </>}
      </aside>}

      <main className="pp-content">
        {page==='settings'&&<WorkbenchSettings theme={theme} onThemeChange={setTheme} split={split} onSplitChange={setSplit} onBack={()=>setPage('tester')}/>}
        <div className="pp-tabs-bar">
          <div className="pp-open-tabs" role="tablist" aria-label="Open requests">
            {openTabs.map(t => <button role="tab" aria-selected={page === 'tester' && activeTabId === t.id} key={t.id} className={`pp-open-tab ${page === 'tester' && activeTabId === t.id ? 'current' : ''}`} onClick={() => selectTab(t.id)} draggable onDragStart={e=>{tabDragRef.current=t.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',t.id);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=tabDragRef.current;if(from)setOpenTabs(ts=>reorderTabs(ts,from,t.id));tabDragRef.current=null;}} onDragEnd={()=>{tabDragRef.current=null;}} onContextMenu={e=>showTabContext(e,t.id)} onKeyDown={e=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();setTabMenu({id:t.id,x:Math.max(8,Math.min(rect.left,window.innerWidth-224)),y:Math.max(8,Math.min(rect.bottom,window.innerHeight-190))});}}}><span className={`pp-http-label ${t.method.toLowerCase()}`}>{t.method}</span><span className="pp-tab-name">{t.name}</span>{t.status && <span className={`pp-tab-status ${t.status >= 400 ? 'error' : ''}`}>{t.status}</span>}<span className="pp-tab-x" title="Close tab" onClick={e => { e.stopPropagation(); closeTab(t.id); }}><X size={13}/></span></button>)}
            {page === 'workspace' && <button className="pp-open-tab current pp-manage-tab" onClick={() => navigate('workspace')}><Layers3 size={14}/> Workspace</button>}
            <button className="pp-new-tab" title="New request tab" onClick={() => addTab()}><Plus size={17}/></button>
          </div>
          <div className="pp-tabs-actions"><span><span className="pp-working-dot"/> {token ? 'Synced' : 'Guest'}</span><button title="Open history" onClick={() => { setExplorerTab('history'); setSidebarCollapsed(false); }}><History size={16}/></button></div>
        </div>
        {workspaceMenu&&<div className="pp-collection-popup" role="menu" style={{left:workspaceMenu.x,top:workspaceMenu.y}}>
          {(workspaceMenu.type==='collection'?[
            ['newRequest','New request'],['renameCollection','Rename'],['duplicateCollection','Duplicate collection'],['sortCollection','Sort by name'],['exportCollection','Export collection'],['deleteCollection','Delete collection']
          ]:[['renameRequest','Rename'],['duplicateRequest','Duplicate'],['deleteRequest','Delete']]).map(([id,label])=>
            <button key={id} role="menuitem" className={id.startsWith('delete')?'danger':''} onClick={()=>handleWorkspaceMenu(id,workspaceMenu)}>{label}</button>)}
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
          <div className="pp-crumb"><span>REST</span><ChevronRight size={13}/><strong>{activeRequestName}</strong><span className="pp-crumb-sub">HTTP request</span><div className="pp-crumb-spacer"/><div className="pp-layout-actions"><span>Layout</span><button className={split === 'horizontal' ? 'active' : ''} onClick={() => setSplit('horizontal')} title="Request above response"><LayoutPanelTop size={16}/></button><button className={split === 'vertical' ? 'active' : ''} onClick={() => setSplit('vertical')} title="Request to left of response"><Columns2 size={16}/></button></div></div>
          <div className="pp-url-bar"><div className="pp-url-entry"><div className="pp-method-wrap"><RetroSelect className={`pp-method ${method.toLowerCase()}`} ariaLabel="HTTP method" value={method} options={METHODS.map(m=>({value:m,label:m,method:true}))} onChange={v=>{setMethod(v);setOpenTabs(t=>t.map(x=>x.id===activeTabId?{...x,method:v}:x));}}/></div><div className="pp-url-input"><Link2 size={16}/><VariableUrlInput value={url} onChange={setUrl} variables={varsFromEnv()} onSend={sendRequest} onPaste={e=>{const raw=e.clipboardData.getData('text');if(isCurl(raw)){e.preventDefault();importCurlIntoCurrent(raw)}}}/></div></div><button className="pp-send" disabled={loading} onClick={sendRequest}>{loading ? <span className="spinner"/> : <Send size={15}/>} {loading ? 'Sending' : 'Send'} <span className="pp-send-shortcut">↵</span></button><button className="pp-save-action" onClick={saveCurrent} title="Save changes (Ctrl/Cmd+S)"><Save size={15}/><span>Save</span></button><button className="pp-save-as-action" onClick={()=>openSaveAs()} title="Save as a new request">Save as…</button></div>
          <div className={`pp-panes pp-${split}`} ref={panesRef} style={{ '--pp-split': `${splitPercent}%` }}>
            <section className="pp-request-pane">
              <div className="pp-pane-heading"><span className="pp-pane-title"><Code2 size={15}/> Request</span><span className="pp-pane-meta">{method} · {headerCount} headers</span></div>
              <div className="pp-panel-tabs">
                {[[ 'params','Params' ],[ 'headers','Headers' ],[ 'body','Body' ],[ 'auth','Authorization' ],[ 'scripts','Scripts' ]].map(([id, name]) => <button key={id} className={reqTab === id ? 'active' : ''} onClick={() => setReqTab(id)}>{name}{id === 'headers' && headerCount > 0 && <span className="pp-tiny-count">{headerCount}</span>}</button>)}
              </div>
              <div className="pp-panel-body pp-request-body">
                {reqTab === 'params' && <><div className="pp-form-caption"><span>QUERY PARAMETERS</span><span>Added to URL when you send</span></div><div className="pp-keyvalue-heading"><span>KEY</span><span>VALUE</span><span/></div>{params.map((r,i) => <div className="pp-keyvalue-row" key={i}><input placeholder="parameter" aria-label="Query key" value={r.key} onChange={e => setParams(v => v.map((x,j)=> j === i ? {...x, key:e.target.value}:x))}/><input placeholder="value" aria-label="Query value" value={r.value} onChange={e => setParams(v => v.map((x,j)=> j === i ? {...x, value:e.target.value}:x))}/><IconButton icon={X} label="Remove query parameter" onClick={() => setParams(v => v.filter((_,j)=>j!==i))}/></div>)}<button className="pp-inline-add" onClick={() => setParams(v => [...v, { ...EMPTY_HEADER }])}><Plus size={14}/> Add parameter</button></>}
                {reqTab === 'headers' && <><div className="pp-form-caption"><span>REQUEST HEADERS</span><span>Custom key-value pairs</span></div><div className="pp-keyvalue-heading"><span>KEY</span><span>VALUE</span><span/></div>{rows.map((r,i) => <div className="pp-keyvalue-row" key={i}><input value={r.key} spellCheck="false" placeholder="Content-Type" aria-label="Header key" onChange={e => setRows(v => v.map((x,j)=>j===i?{...x,key:e.target.value}:x))}/><input value={r.value} spellCheck="false" placeholder="application/json" aria-label="Header value" onChange={e => setRows(v => v.map((x,j)=>j===i?{...x,value:e.target.value}:x))}/><IconButton icon={X} label="Remove header" onClick={() => setRows(v => v.filter((_,j)=>j!==i))}/></div>)}<button className="pp-inline-add" onClick={() => setRows(v => [...v, { ...EMPTY_HEADER }])}><Plus size={14}/> Add header</button></>}
                {reqTab === 'body' && <div className="pp-body-composer">
                  <div className="pp-body-toolbar"><div className="pp-body-format-label"><span>Body type</span><RetroSelect ariaLabel="Body type" className="pp-body-format-select" value={format} onChange={selectFormat} options={BODY_FORMATS.map(f=>({value:f.mime,label:f.label,group:f.group}))}/></div>
                    {bodyFormat(format).mode==='raw'&&<button title="Beautify request body" onClick={beautifyBody}><WandSparkles size={15}/> Beautify</button>}
                    <span>UTF-8</span>
                  </div>
                  {bodyFormat(format).mode==='none'&&<div className="pp-body-empty">This request has no body. Choose a format to start editing.</div>}
                  {bodyFormat(format).mode==='raw'&&<div className="pp-body-code">
                    <TextEditor value={body} onChange={setBody} lang={languageFromMime(format)==='json'?'jsonc':languageFromMime(format)} theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="100%" placeholder="Write request body here…" allowComments fill/>
                    {syntaxProblem(body,languageFromMime(format))&&<div className="pp-inline-validation"><AlertTriangle size={14}/><span>{syntaxProblem(body,languageFromMime(format))?.message}</span></div>}
                  </div>}
                  {(bodyFormat(format).mode==='urlencoded'||bodyFormat(format).mode==='multipart')&&<>
                    <div className="pp-form-caption"><span>{bodyFormat(format).mode==='multipart'?'MULTIPART FORM DATA':'URL ENCODED DATA'}</span><span>Up to 5 MB</span></div>
                    <div className="pp-keyvalue-heading"><span>KEY</span><span>VALUE / FILE</span><span/></div>
                    {formFields.map((r,i)=><div className="pp-keyvalue-row pp-form-data-row" key={i}>
                      <input placeholder="key" value={r.key} onChange={e=>setFormFields(v=>v.map((x,j)=>j===i?{...x,key:e.target.value}:x))}/>
                      {r.fileBase64?<div className="pp-file-name"><FileUp size={14}/>{r.fileName}<button title="Detach file" onClick={()=>setFormFields(v=>v.map((x,j)=>j===i?{key:x.key,value:''}:x))}><X size={12}/></button></div>
                        :<input placeholder="value or {{variable}}" value={r.value||''} onChange={e=>setFormFields(v=>v.map((x,j)=>j===i?{...x,value:e.target.value}:x))}/>}
                      <div className="pp-field-actions">
                        {bodyFormat(format).mode==='multipart'&&<label title="Attach file"><FileUp size={15}/><input type="file" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const value=await encodeFile(file);setFormFields(v=>v.map((x,j)=>j===i?{...x,value:'',fileName:file.name,fileBase64:value,contentType:file.type}:x))}catch(err){setNotice(err.message)}}}/></label>}
                        <IconButton icon={X} label="Remove field" onClick={()=>setFormFields(v=>v.filter((_,j)=>j!==i))}/>
                      </div>
                    </div>)}
                    <button className="pp-inline-add" onClick={()=>setFormFields(v=>[...v,{key:'',value:''}])}><Plus size={14}/> Add field</button>
                  </>}
                  {bodyFormat(format).mode==='binary'&&<div className="pp-binary-picker"><FileUp size={22}/><span>{binaryFile.name||'Select a binary file (up to 5 MB)'}</span><label>Choose file<input type="file" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{setBinaryFile({name:file.name,base64:await encodeFile(file)})}catch(err){setNotice(err.message)}}}/></label></div>}
                </div>}
                {reqTab === 'auth' && <><div className="pp-form-caption"><span>REQUEST AUTHORIZATION</span><span>Only applied to outgoing request</span></div><div className="pp-auth-form"><div className="pp-auth-select"><span>Auth type</span><RetroSelect ariaLabel="Auth type" value={authType} onChange={setAuthType} options={[{value:'none',label:'No Auth'},{value:'bearer',label:'Bearer Token'}]}/></div>{authType === 'bearer' && <label>Token<input type="password" autoComplete="off" placeholder="Paste bearer token" value={bearerToken} onChange={e => setBearerToken(e.target.value)}/></label>}<p>Use Headers for API keys, basic authentication, or custom authorization headers. Authorization values are not saved in request history.</p></div></>}
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
              <div className="pp-pane-heading pp-response-heading"><span className="pp-pane-title"><Bolt size={15}/> Response</span>{result && !result.error ? <div className="pp-response-metrics"><span className={`pp-status ${result.statusCode < 400 ? 'good' : 'bad'}`}><span className="pp-status-dot"/>{result.statusCode} {result.reasonPhrase}</span><span><Clock3 size={13}/> {result.elapsedMs} ms</span><span><ArrowDownToLine size={13}/> {new Blob([result.body || '']).size.toLocaleString()} B</span></div> : <span className="pp-pane-meta">Awaiting response</span>}</div>
              <div className="pp-panel-tabs"><button className={resTab === 'body' ? 'active' : ''} onClick={()=>setResTab('body')}>Body</button><button className={resTab === 'headers' ? 'active' : ''} onClick={()=>setResTab('headers')}>Headers{result && !result.error && <span className="pp-tiny-count">{Object.keys(result.headers || {}).length}</span>}</button><div className="pp-panel-tabs-spacer"/><button className="pp-copy-response" disabled={!result||!!result.error} onClick={beautifyResult} title="Beautify response"><WandSparkles size={14}/> Beautify</button><button className="pp-copy-response" disabled={!result||!!result.error} onClick={()=>setResponsePretty(v=>!v)} title="Toggle raw/pretty">{responsePretty?'Pretty':'Raw'}</button><button className="pp-copy-response" title="Copy response" disabled={!result || !!result.error} onClick={() => { navigator.clipboard?.writeText(responseText); setNotice('Response copied'); }}><Copy size={14}/> Copy</button></div>
              <div className="pp-panel-body pp-response-body">
                {!result ? <div className="pp-response-empty"><div className="pp-response-empty-symbol"><Terminal size={28}/></div><strong>{loading ? 'Sending request…' : 'Ready to send a request'}</strong><p>{loading ? 'The server is processing your request.' : 'Enter a URL, configure your request, and hit Send. Your response will appear here.'}</p><span>⌘ / Ctrl + Enter</span></div> : result.error ? <div className="pp-response-error"><div><X size={18}/></div><strong>Request failed</strong><p>{result.error}</p></div> : <><div className="pp-response-code"><TextEditor readOnly value={responseText} lang={resTab==='headers'?'json':languageFromMime(responseType)} theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="250px"/></div>{result.truncated && <div className="pp-response-warning">Output truncated to 1 MB.</div>}{result.isBinary && <div className="pp-response-warning">Binary content displayed as Base64.</div>}</>}
              </div>
              <div className="pp-pane-footer"><span>{result && !result.error ? `HTTP ${result.statusCode}` : 'No response yet'}</span><span className="pp-footer-tail">{result?.truncated ? 'Truncated' : 'Raw / JSON preview'}</span></div>
            </section>
          </div>
        </div> : <div className="pp-manager">
          <div className="pp-manager-top"><div><span className="pp-manager-eyebrow"><Layers3 size={14}/> WORKSPACE MANAGEMENT</span><h2>{activeWorkspace?.name || 'Your workspaces'}</h2><p>Collections, teams and members are available after sign-in.</p></div><button className="pp-plain-btn" onClick={() => setPage('tester')}><ArrowRight size={15}/> Back to request tester</button></div>
          <div className="pp-manager-columns"><aside className="pp-manager-ws"><div className="pp-manager-label">YOUR WORKSPACES <span>{workspaces.length}</span></div><form className="pp-manager-add" onSubmit={e => { e.preventDefault(); if(!newWs.trim()) return; doAction(async()=>{const w=await api('/api/workspaces','POST',{name:newWs.trim()},token);setNewWs('');await loadWorkspaces();setSelectedWs(w.id);setNotice('Workspace created.');}); }}><input placeholder="New workspace" maxLength={120} value={newWs} onChange={e=>setNewWs(e.target.value)}/><button title="Create workspace" disabled={busyAction}><Plus size={16}/></button></form>{workspaces.map(w=><button className={`pp-manager-ws-row ${w.id === selectedWs ? 'active' : ''}`} key={w.id} onClick={()=>setSelectedWs(w.id)}><Layers3 size={17}/><span>{w.name}</span><ChevronRight size={15}/></button>)}</aside>
            <section className="pp-manager-details">{!activeWorkspace ? <Empty icon={FolderClosed} title="No workspace selected" description="Create a workspace on the left to start organizing your requests."/> : <>
              <div className="pp-manager-detail-title"><span className="pp-manager-avatar"><Layers3 size={18}/></span><div><strong>{activeWorkspace.name}</strong><small>Private · Members only</small></div><LockKeyhole size={15}/></div>
              <div className="pp-manager-tabs">{[['collections','Collections',FolderClosed],['teams','Teams',Users],['members','Members',ShieldCheck]].map(([id,label,Icon])=><button className={wsTab === id ? 'active':''} key={id} onClick={()=>setWsTab(id)}><Icon size={15}/>{label}</button>)}</div>
              {wsTab === 'collections' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Collections</strong><form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newCollection.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections`,'POST',{name:newCollection.trim()},token);setNewCollection('');setCollections(await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token));setNotice('Collection created');});}}><input placeholder="Collection name" maxLength={120} value={newCollection} onChange={e=>setNewCollection(e.target.value)}/><button title="Create collection" disabled={busyAction}><Plus size={16}/></button></form></div>{collections.map(c=><button className={`pp-manager-entry ${selectedCol === c.id ? 'active' : ''}`} key={c.id} onClick={()=>setSelectedCol(c.id)}><FolderClosed size={16}/><span>{c.name}</span><ChevronRight size={15}/></button>)}{!collections.length && <Empty icon={FolderPlus} title="No collections yet" description="Create your first collection above."/>}{selectedCol && <div className="pp-manager-saved"><h3>Saved requests</h3>{savedRequests.map(r=><div className="pp-manager-saved-row" key={r.id}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><button onClick={()=>loadSavedRequest(r)}><strong>{r.name}</strong><small>{r.url}</small></button><IconButton icon={Trash2} label="Delete request" disabled={busyAction} onClick={()=>doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests/${r.id}`,'DELETE',undefined,token);setSavedRequests(v=>v.filter(x=>x.id!==r.id));})}/></div>)}{!savedRequests.length && <p className="pp-muted-small">No saved requests in this collection.</p>}</div>}</div>}
              {wsTab === 'teams' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Teams</strong><form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newTeam.trim())return;doAction(async()=>{const t=await api(`/api/workspaces/${selectedWs}/teams`,'POST',{name:newTeam.trim()},token);setNewTeam('');setTeams(await api(`/api/workspaces/${selectedWs}/teams`,'GET',undefined,token));setSelectedTeam(t.id);setNotice('Team created');});}}><input placeholder="Team name" maxLength={120} value={newTeam} onChange={e=>setNewTeam(e.target.value)}/><button title="Create team" disabled={busyAction}><Plus size={16}/></button></form></div>{teams.map(t=><button className={`pp-manager-entry ${selectedTeam===t.id?'active':''}`} key={t.id} onClick={()=>setSelectedTeam(t.id)}><Users size={16}/><span>{t.name}</span><ChevronRight size={15}/></button>)}{!teams.length && <Empty icon={Users} title="No teams yet" description="Create a team above to manage collaboration."/>}{activeTeam && <div className="pp-manager-saved"><div className="pp-manager-section-heading"><strong>{activeTeam.name} members</strong><form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newTeamMember.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/teams/${selectedTeam}/members`,'POST',{email:newTeamMember.trim()},token);setNewTeamMember('');setTeamMembers(await api(`/api/workspaces/${selectedWs}/teams/${selectedTeam}/members`,'GET',undefined,token));setNotice('Member added to team');});}}><input type="email" placeholder="Member email" value={newTeamMember} onChange={e=>setNewTeamMember(e.target.value)}/><button title="Add to team" disabled={busyAction}><Plus size={16}/></button></form></div>{teamMembers.map(m=><div className="pp-manager-member" key={m.userId}><span>{m.displayName[0]}</span><div><strong>{m.displayName}</strong><small>{m.email}</small></div></div>)}<p className="pp-muted-small">A user must belong to this workspace before joining a team.</p></div>}</div>}
              {wsTab === 'members' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Workspace members</strong><form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newMember.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/members`,'POST',{email:newMember.trim(),role:'Member'},token);setNewMember('');setMembers(await api(`/api/workspaces/${selectedWs}/members`,'GET',undefined,token));setNotice('Member added');});}}><input type="email" placeholder="Existing user email" value={newMember} onChange={e=>setNewMember(e.target.value)}/><button title="Add member" disabled={busyAction}><Plus size={16}/></button></form></div>{members.map(m=><div className="pp-manager-member" key={m.userId}><span>{m.displayName[0]}</span><div><strong>{m.displayName}</strong><small>{m.email}</small></div><em>{m.role}</em></div>)}<p className="pp-muted-small">Members must register before they can be added.</p></div>}
            </>}</section></div>
        </div>}
      </main>
    </div>
    <footer className="pp-global-footer"><span><span className="pp-footer-dot"/> Pakpost REST Client</span><span className="pp-footer-center">Guest testing enabled · Private addresses blocked by proxy</span><span>UTF-8 <span className="pp-footer-divider">·</span> {split === 'horizontal' ? 'Stacked' : 'Side-by-side'}</span></footer>
    {commandOpen && <div className="pp-command-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCommandOpen(false);}}><section className="pp-command-dialog" role="dialog" aria-modal="true" aria-label="Quick search and commands"><div className="pp-command-input-wrap"><Search size={18}/><input autoFocus aria-label="Search commands" value={commandQuery} onChange={e=>{setCommandQuery(e.target.value);setCommandIndex(0);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setCommandIndex(i=>Math.min(visibleCommandItems.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setCommandIndex(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&visibleCommandItems.length){e.preventDefault();setCommandOpen(false);visibleCommandItems[Math.min(commandIndex,visibleCommandItems.length-1)].run();}}} placeholder="Find a request or run a command..."/><kbd>Esc</kbd></div><div className="pp-command-results" role="listbox">{visibleCommandItems.length?visibleCommandItems.map((item,i)=><button type="button" role="option" aria-selected={commandIndex===i} onMouseEnter={()=>setCommandIndex(i)} key={item.key} onClick={()=>{setCommandOpen(false);item.run();}}>{item.method?<span className={`pp-http-label ${item.method.toLowerCase()}`}>{item.method}</span>:<Code2 size={15}/>}<span><strong>{item.title}</strong><small>{item.subtitle}</small></span><ArrowRight size={14}/></button>):<div className="pp-command-empty">No matching requests or commands.</div>}</div></section></div>}
    {notice && <div className="pp-toast"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={15}/></button></div>}
    {authOpen && <Dialog title={authMode === 'login' ? 'Welcome back' : 'Create account'} subtitle="Sign in to manage your collections, teams and workspaces. API testing stays open to everyone." onClose={()=>setAuthOpen(false)}><form className="modal-form" onSubmit={submitAuth}>{authMode==='register' && <label>Display name<input required maxLength={120} placeholder="Your name" value={authForm.displayName} onChange={e=>setAuthForm(v=>({...v,displayName:e.target.value}))}/></label>}<label>Email address<input type="email" required autoComplete="email" value={authForm.email} placeholder="you@example.com" onChange={e=>setAuthForm(v=>({...v,email:e.target.value}))}/></label><label>Password<input type="password" required minLength={authMode === 'register' ? 12 : 1} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder={authMode === 'register' ? 'At least 12 characters' : 'Your password'} value={authForm.password} onChange={e=>setAuthForm(v=>({...v,password:e.target.value}))}/></label>{authError && <div className="form-error">{authError}</div>}<button className="pp-modal-submit" disabled={authBusy} type="submit">{authBusy ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></button><p className="form-toggle">{authMode === 'login' ? 'New to Pakpost?' : 'Already have an account?'} <button type="button" onClick={()=>{setAuthMode(v=>v==='login'?'register':'login');setAuthError('');}}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p><p className="pp-muted-small pp-center">Google SSO can be added later.</p></form></Dialog>}
    {saveOpen && <Dialog title="Save as new request" subtitle="Keep an independent copy in a local collection or a signed-in workspace." onClose={()=>setSaveOpen(false)}><form className="modal-form" onSubmit={saveRequest}>
      <label>Request name<input autoFocus required maxLength={120} value={saveName} onChange={e=>setSaveName(e.target.value)}/></label>
      <div className="pp-modal-select-label"><span>Destination</span><RetroSelect ariaLabel="Save scope" value={saveScope} onChange={setSaveScope} options={[{value:'local',label:'Local browser'},...(token?[{value:'workspace',label:'Workspace · Neon'}]:[])]}/></div>
      {saveScope==='local'?<div className="pp-modal-select-label"><span>Local collection</span><RetroSelect ariaLabel="Local collection" value={saveLocalCollection} onChange={setSaveLocalCollection} options={localCollections.map(c=>({value:c.id,label:c.name}))}/></div>:
        <><div className="pp-modal-select-label"><span>Workspace</span><RetroSelect ariaLabel="Save workspace" value={saveWs} onChange={setSaveWs} options={workspaces.map(w=>({value:w.id,label:w.name}))}/></div><div className="pp-modal-select-label"><span>Collection</span><RetroSelect ariaLabel="Save collection" value={saveCollection} onChange={setSaveCollection} options={saveCols.map(c=>({value:c.id,label:c.name}))}/></div></>}
      {!(saveScope==='local'?localCollections.length:saveCols.length)&&<div className="form-error">Create a collection first.</div>}
      <button className="pp-modal-submit" type="submit" disabled={!(saveScope==='local'?saveLocalCollection:saveCollection)||busyAction}><Save size={16}/> Save new request</button>
    </form></Dialog>}
    {actionDialog&&<Dialog title={{renameCollection:'Rename collection',renameRequest:'Rename request',renameFolder:'Rename folder',deleteCollection:'Delete collection',deleteRequest:'Delete request',deleteFolder:'Delete folder'}[actionDialog.action]||'Manage collection'} subtitle={actionDialog.action.startsWith('delete')?'This action cannot be undone. Open tabs will not be closed.':'Changes will be reflected in Collections.'} onClose={()=>setActionDialog(null)}>
      <form className="modal-form" onSubmit={executeActionDialog}>
        {actionDialog.action.startsWith('rename')?<label>Name<input autoFocus required maxLength={120} value={actionName} onChange={e=>setActionName(e.target.value)}/></label>:<p>Delete <strong>{actionDialog.name}</strong>?</p>}
        <div className="pp-action-dialog-buttons"><button type="button" onClick={()=>setActionDialog(null)}>Cancel</button><button type="submit" disabled={busyAction} className="pp-modal-submit">{actionDialog.action.startsWith('delete')?'Delete':'Rename'}</button></div>
      </form>
    </Dialog>}
  <FastTooltip/>
  </div>;
}
