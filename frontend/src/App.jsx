import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, Braces, WandSparkles, AlertTriangle, FileUp, Variable, Bolt, ChevronDown, ChevronRight, Clock3, Code2, Columns2, Copy, FileJson, FolderClosed, FolderPlus, History, Layers3, LayoutPanelTop, LockKeyhole, LogIn, LogOut, Moon, Plus, Save, Search, Send, Settings2, ShieldCheck, Sun, Terminal, Trash2, Users, X, Zap, PanelLeftClose, PanelLeftOpen, Link2,
} from 'lucide-react';
import { TextEditor } from './features/Editors';
import { EnvironmentDialog } from './features/Environments';
import { CodeSidebar, ImportExportSidebar } from './features/WorkbenchSidebars';
import { blankDraft, parseCurl, isCurl } from './features/importExport';
import { readWorkbenchCache, writeWorkbenchCache } from './features/workspaceCache';
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
  const [theme, setTheme] = useState(localStorage.getItem('pakpost_theme') || 'dark');
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
  const [envOpen, setEnvOpen] = useState(false);
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
  const [saveName, setSaveName] = useState('New request');
  const [saveWs, setSaveWs] = useState('');
  const [saveCollection, setSaveCollection] = useState('');
  const [saveCols, setSaveCols] = useState([]);
  const [busyAction, setBusyAction] = useState(false);
  const [split, setSplit] = useState(() => CACHED?.split || localStorage.getItem('pakpost_split') || 'horizontal');
  const [splitPercent, setSplitPercent] = useState(50);
  const [explorerTab, setExplorerTab] = useState(CACHED?.explorerTab || 'collections');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(CACHED?.sidebarCollapsed || false);
  const [expandedCollections, setExpandedCollections] = useState({});
  const [params, setParams] = useState(RECOVERED.params || [{ ...EMPTY_HEADER }]);
  const [authType, setAuthType] = useState(RECOVERED.authType || 'none');
  const [bearerToken, setBearerToken] = useState(RECOVERED.bearerToken || '');
  const [openTabs, setOpenTabs] = useState(CACHED?.openTabs || [{ id: 't1', name: 'Untitled Request', method: 'GET' }]);
  const [activeTabId, setActiveTabId] = useState(CACHED?.activeTabId || 't1');
  const activeTabRef = useRef(CACHED?.activeTabId || 't1');
  const tabSequence = useRef(Math.max(1,...(CACHED?.openTabs || []).map(t=>Number(String(t.id).replace(/^t/,'')) || 0)));
  const draftsRef = useRef(CACHED?.drafts || {});
  const panesRef = useRef(null);
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
  function addTab(request) {
    stashActive();
    const id = `t${++tabSequence.current}`;
    const draft = { ...blankDraft(), ...request, binaryFile:{name:request?.binaryFile?.name||'',base64:''},
      params:request?.params||[{...EMPTY_HEADER}],rows:request?.rows||[{...EMPTY_HEADER}],
      formFields:request?.formFields||[{...EMPTY_HEADER}],result:null,scriptLog:[],scriptTests:[],scriptError:''};
    draftsRef.current[id] = draft; activeTabRef.current = id;
    const name = request?.name || 'Untitled Request';
    setOpenTabs(t => [...t, { id, name, method: draft.method }]);
    setActiveTabId(id); restoreDraft(draft); setPage('tester');
  }
  function importRequestsAndEnvironments({requests=[],environments=[]}) {
    if(requests.length > 200)throw Error('Cannot import more than 200 requests at once.');
    if(requests.length){
      stashActive();
      const tabs = requests.map(request=>{
        const id=`t${++tabSequence.current}`;
        const draft={...blankDraft(),...request,binaryFile:{name:request?.binaryFile?.name||'',base64:''},result:null,scriptLog:[],scriptTests:[],scriptError:''};
        draftsRef.current[id]=draft;
        return {id,name:request.name || 'Imported Request',method:draft.method};
      });
      setOpenTabs(old=>[...old,...tabs]);
      const last=tabs[tabs.length-1];
      activeTabRef.current=last.id;setActiveTabId(last.id);restoreDraft(draftsRef.current[last.id]);setPage('tester');
    }
    if(environments.length){
      const added=environments.map(env=>({id:crypto.randomUUID(),name:env.name||'Imported',variables:(env.variables||[]).map(v=>({key:String(v.key||''),value:String(v.value||''),isSecret:!!v.isSecret}))}));
      setLocalEnvironments(current=>[...current,...added]);
      setEnvScope('local');setActiveEnvId(added[0].id);
    }
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
  function closeTab(id) {
    if (openTabs.length === 1) {
      restoreDraft({method:'GET',url:'',rows:[{...EMPTY_HEADER}],body:'',reqTab:'params',resTab:'body',result:null});
      setOpenTabs([{ id, name: 'Untitled Request', method: 'GET' }]);
      draftsRef.current[id] = { method: 'GET', url: '', rows: [{ ...EMPTY_HEADER }], body: '',format:'application/json',formFields:[{key:'',value:''}],preScript:'',postScript:'', reqTab: 'params', resTab: 'body', result: null, params: [{...EMPTY_HEADER}], authType: 'none', bearerToken: '' };
      return;
    }
    const idx = openTabs.findIndex(t => t.id === id);
    const next = openTabs[idx + 1] || openTabs[idx - 1];
    if (id === activeTabRef.current) {
      // Set the draft on this tab to its latest contents; another draft will be activated below.
      stashActive();
    }
    const filtered = openTabs.filter(t => t.id !== id);
    setOpenTabs(filtered);
    if (id === activeTabRef.current && next) selectTabFromDraft(next.id);
    delete draftsRef.current[id];
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
    addTab({ ...item,rows:[...savedRows,{...EMPTY_HEADER}],format:item.contentType||'application/json',formFields:formFields.length?formFields:[{key:'',value:''}],preScript:item.preRequestScript||'',postScript:item.postResponseScript||'' });
    setNotice('Opened saved request in a new tab.');
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
    try{setBody(await formatSource(body,languageFromMime(format)));setNotice('Body formatted');}
    catch(e){setNotice(`Cannot format: ${getMessage(e)}`)}
  }
  async function beautifyResult(){
    if(!result||result.error)return;
    try{setPrettyResponse(await formatSource(result.body||'',languageFromMime(result.headers?.['Content-Type']||result.headers?.['content-type']||'')));setResponsePretty(true);}
    catch(e){setNotice(`Cannot format response: ${getMessage(e)}`)}
  }
  function buildOutgoing(vars=varsFromEnv()) {
    const command=buildCommand({method,url,headers:rows,body,format,fields:formFields,fileBase64:binaryFile.base64,fileName:binaryFile.name},vars);
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
    return {method,url:target,headers:maskSensitiveHeaders({headers}).headers,body,bodyMode:fmt.mode,contentType:format,
      formFields:formFields.map(x=>({key:x.key,value:x.value,fileName:x.fileName,base64:x.fileBase64})),fileName:binaryFile.name};
  }
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('pakpost_theme', theme); }, [theme]);
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && page === 'tester') {
        e.preventDefault();
        if (!loading) sendRequest();
      }
    };
    window.addEventListener('keydown', onKeyboard);
    return () => window.removeEventListener('keydown', onKeyboard);
  }, [page, loading, method, url, rows, body, params, authType, bearerToken,format,formFields,activeEnvId,localEnvironments,workspaceEnvironments,preScript,postScript]);

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
      const pre=await runSandbox(preScript,'pre',variables,postmanRequestSnapshot({method,url,headers:requestHeaderObject(),body,format},variables),null);
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
    try { await fn(); } catch (e) { setNotice(getMessage(e)); } finally { setBusyAction(false); }
  };
  function loadRequest(item) {
    if (Array.isArray(item.rows)) addTab({ ...item, name: item.name || 'From history' });
    else loadSavedRequest(item);
  }

  function openSave() {
    if (!requiresLogin('collections')) return;
    setSaveWs(workspaces[0]?.id || '');
    setSaveName(`${method} ${(() => { try { return new URL(url).pathname || '/'; } catch { return 'request'; } })()}`);
    setSaveOpen(true);
  }
  async function saveRequest(e) {
    e.preventDefault();
    await doAction(async () => {
      await api(`/api/workspaces/${saveWs}/collections/${saveCollection}/requests`, 'POST',
        { name: saveName, method, url, headersJson: JSON.stringify(requestHeaderObject()), body,bodyMode:bodyFormat(format).mode,contentType:format,
          formFieldsJson:JSON.stringify(formFields.map(({key,value,fileName,contentType})=>({key,value,fileName,contentType}))),preRequestScript:preScript,postResponseScript:postScript }, token);
      setSaveOpen(false); setNotice('Request saved to collection.');
      if (selectedWs === saveWs && selectedCol === saveCollection)
        setSavedRequests(await api(`/api/workspaces/${saveWs}/collections/${saveCollection}/requests`, 'GET', undefined, token));
    });
  }

  const visibleCollections = collections.filter(c => c.name.toLowerCase().includes(explorerSearch.toLowerCase()) || (c.id === selectedCol && savedRequests.some(r => `${r.name} ${r.url}`.toLowerCase().includes(explorerSearch.toLowerCase()))));
  const activeRequestName = openTabs.find(t => t.id === activeTabId)?.name || 'Untitled Request';
  const responseType = result && !result.error ? (result.headers?.['Content-Type'] || result.headers?.['content-type'] || 'text/plain') : 'text/plain';
  const responseText = result && !result.error ? (resTab === 'body' ? (responsePretty ? (prettyResponse||prettyJson(result.body||'')) : (result.body||'')) : JSON.stringify(result.headers || {}, null, 2)) : '';

  return <div className="pp-app">
    <header className="pp-top">
      <div className="pp-logo"><div className="pp-logo-mark">p</div><span>pakpost</span></div>
      <div className="pp-top-center"><span className="pp-env-dot"/> <span>REST CLIENT</span><span className="pp-top-divider"/><span className="pp-top-mode">{token ? 'Team workspace' : 'Guest workspace'}</span></div>
      <div className="pp-top-right">
        <div className="pp-env-top"><span>ENV</span>
          <select aria-label="Environment scope" title="Environment storage" value={envScope} onChange={e=>updateEnvScope(e.target.value)}>
            <option value="local">Local</option>{token&&selectedWs&&<option value="workspace">Workspace</option>}
          </select>
          <select aria-label="Active environment" value={activeEnvId} onChange={e=>setActiveEnvId(e.target.value)}>
            <option value="">No Environment</option>{currentEnvironments.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button title="Manage environments" onClick={()=>setEnvOpen(true)}><Settings2 size={16}/></button>
        </div>
        <span className="pp-connection"><span/> Local development</span>
        <IconButton icon={theme === 'dark' ? Sun : Moon} label="Toggle light/dark theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}/>
        {me ? <button className="pp-profile" title={me.email} onClick={logout}><span>{me.displayName.slice(0, 1).toUpperCase()}</span><span className="pp-profile-name">{me.displayName}</span><LogOut size={14}/></button> : <button className="pp-signin" onClick={() => setAuthOpen(true)}><LogIn size={15}/> Sign in</button>}
      </div>
    </header>

    <div className="pp-main-frame">
      <nav className="pp-rail" aria-label="Workbench navigation">
        <button className={page === 'tester' && explorerTab === 'collections' ? 'selected' : ''} title="Collections" onClick={() => { setExplorerTab('collections'); setSidebarCollapsed(false); setPage('tester'); }}><Layers3 size={19}/></button>
        <button className={page === 'tester' && explorerTab === 'history' ? 'selected' : ''} title="Request history" onClick={() => { setExplorerTab('history'); setSidebarCollapsed(false); setPage('tester'); }}><History size={19}/></button>
        <button title="Environments" onClick={()=>setEnvOpen(true)}><Variable size={19}/></button>
        <button className={explorerTab === 'code' ? 'selected' : ''} title="Generate Code" onClick={()=>{setExplorerTab('code');setSidebarCollapsed(false);setPage('tester')}}><Code2 size={19}/></button>
        <button className={explorerTab === 'exchange' ? 'selected' : ''} title="Import / Export" onClick={()=>{setExplorerTab('exchange');setSidebarCollapsed(false);setPage('tester')}}><FileUp size={19}/></button>
        <button className={explorerTab === 'teams' ? 'selected' : ''} title="Teams" onClick={() => { setExplorerTab('teams'); setSidebarCollapsed(false); if (token) { setWsTab('teams'); } }}><Users size={19}/></button>
        <div className="pp-rail-spacer"/>
        <button title={sidebarCollapsed ? 'Expand navigator' : 'Collapse navigator'} onClick={() => setSidebarCollapsed(v => !v)}>{sidebarCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button>
        <button title="Toggle theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Moon size={18}/> : <Sun size={18}/>}</button>
      </nav>

      {!sidebarCollapsed && <aside className="pp-explorer">
        <div className="pp-explorer-title"><strong>{explorerTab === 'collections' ? 'Explorer' : explorerTab === 'history' ? 'History' : explorerTab === 'code' ? 'Generate Code' : explorerTab === 'exchange' ? 'Import / Export' : 'Teams'}</strong><button title="Collapse sidebar" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={16}/></button></div>
        {explorerTab === 'code' ? <CodeSidebar request={codePreviewRequest()} buildResolved={buildCodeRequest}/> : explorerTab === 'exchange' ?
          <ImportExportSidebar requests={openTabs.map(t=>({...draftsRef.current[t.id],...(t.id===activeTabId?snapshot():{}),name:t.name}))}
            environments={localEnvironments} onImport={importRequestsAndEnvironments} onMessage={setNotice}/> : explorerTab === 'history' ? <>
          <div className="pp-side-subhead"><span>RECENT REQUESTS</span><span>{recent.length}</span></div>
          {recent.length ? <div className="pp-side-scroll">{recent.map((r, i) => <button key={`${i}-${r.url}`} className="pp-history-item" onClick={() => loadRequest(r)}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span className="pp-history-main"><strong>{(() => { try { return new URL(r.url).pathname || '/'; } catch { return r.url; } })()}</strong><small>{r.url}</small></span><span className={r.status < 400 ? 'pp-history-ok' : 'pp-history-bad'}>{r.status}</span></button>)}</div> : <div className="pp-explorer-empty"><History size={23}/><strong>No history yet</strong><span>Requests you send during this session will appear here.</span></div>}
        </> : explorerTab === 'teams' ? <>
          {token ? <><div className="pp-side-subhead"><span>TEAMS · {activeWorkspace?.name || 'WORKSPACE'}</span></div><div className="pp-side-scroll">{teams.map(t => <button key={t.id} className={`pp-tree-row ${selectedTeam === t.id ? 'active' : ''}`} onClick={() => { setSelectedTeam(t.id); navigate('workspace'); setWsTab('teams'); }}><Users size={15}/><span>{t.name}</span></button>)}<button className="pp-add-side" onClick={() => { navigate('workspace'); setWsTab('teams'); }}><Plus size={15}/> Manage teams</button></div></> : <div className="pp-explorer-empty"><LockKeyhole size={22}/><strong>Teams are private</strong><span>Sign in to collaborate with other members.</span><button className="pp-small-primary" onClick={() => setAuthOpen(true)}>Sign in</button></div>}
        </> : <>
          <div className="pp-scope">
            <div className="pp-scope-logo"><Layers3 size={17}/></div>
            <div><strong>{activeWorkspace?.name || 'Personal scratchpad'}</strong><small>{token ? 'Private workspace' : 'Local · guest mode'}</small></div>
            {token && <select aria-label="Switch workspace" title="Switch workspace" value={selectedWs} onChange={e => setSelectedWs(e.target.value)}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
            <ChevronDown size={15} className="pp-scope-chevron"/>
          </div>
          {token && <button className="pp-link-row" onClick={() => navigate('workspace')}><Settings2 size={14}/> Manage workspace <ChevronRight size={13}/></button>}
          <div className="pp-explorer-search"><Search size={14}/><input placeholder="Search collections" aria-label="Search collections" value={explorerSearch} onChange={e => setExplorerSearch(e.target.value)}/></div>
          <div className="pp-side-subhead"><span>COLLECTIONS</span><button title="Create collection" onClick={() => { if (!requiresLogin('collections')) return; navigate('workspace'); setWsTab('collections'); }}><Plus size={16}/></button></div>
          <div className="pp-side-scroll">
            {token && selectedWs ? <>
              {visibleCollections.map(c => <div key={c.id}>
                <button className={`pp-tree-row ${selectedCol === c.id ? 'active' : ''}`} onClick={() => { setSelectedCol(c.id); setExpandedCollections(v => ({ ...v, [c.id]: !(v[c.id] ?? true) })); }}>
                  {(expandedCollections[c.id] ?? true) && selectedCol === c.id ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                  <FolderClosed size={15}/><span>{c.name}</span>
                </button>
                {(expandedCollections[c.id] ?? true) && selectedCol === c.id && savedRequests.filter(r => `${r.name} ${r.url}`.toLowerCase().includes(explorerSearch.toLowerCase())).map(r => <button key={r.id} className="pp-tree-request" title={r.url} onClick={() => loadSavedRequest(r)}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><span>{r.name}</span></button>)}
              </div>)}
              {!collections.length && <div className="pp-tree-hint">No collections yet. Start by creating one.</div>}
              <button className="pp-add-side" onClick={() => { navigate('workspace'); setWsTab('collections'); }}><Plus size={14}/> New collection</button>
            </> : <>
              <div className="pp-guest-tree"><FolderClosed size={16}/> My requests <span className="pp-guest-badge">GUEST</span></div>
              <div className="pp-tree-hint">Use request tabs to try APIs instantly. Sign in to save collections and sync across workspaces.</div>
              <button className="pp-add-side" onClick={() => setAuthOpen(true)}><LockKeyhole size={14}/> Sign in to save</button>
            </>}
          </div>
          <div className="pp-explorer-bottom">
            {token ? <button onClick={() => navigate('workspace')}><Layers3 size={15}/> Workspace settings <ArrowRight size={14}/></button> : <div className="pp-guest-notice"><span className="pp-guest-live"/><div><strong>You're in guest mode</strong><small>Sending requests doesn't require an account.</small></div></div>}
          </div>
        </>}
      </aside>}

      <main className="pp-content">
        <div className="pp-tabs-bar">
          <div className="pp-open-tabs" role="tablist" aria-label="Open requests">
            {openTabs.map(t => <button role="tab" aria-selected={page === 'tester' && activeTabId === t.id} key={t.id} className={`pp-open-tab ${page === 'tester' && activeTabId === t.id ? 'current' : ''}`} onClick={() => selectTab(t.id)}><span className={`pp-http-label ${t.method.toLowerCase()}`}>{t.method}</span><span className="pp-tab-name">{t.name}</span>{t.status && <span className={`pp-tab-status ${t.status >= 400 ? 'error' : ''}`}>{t.status}</span>}<span className="pp-tab-x" title="Close tab" onClick={e => { e.stopPropagation(); closeTab(t.id); }}><X size={13}/></span></button>)}
            {page === 'workspace' && <button className="pp-open-tab current pp-manage-tab" onClick={() => navigate('workspace')}><Layers3 size={14}/> Workspace</button>}
            <button className="pp-new-tab" title="New request tab" onClick={() => addTab()}><Plus size={17}/></button>
          </div>
          <div className="pp-tabs-actions"><span><span className="pp-working-dot"/> {token ? 'Synced' : 'Guest'}</span><button title="Open history" onClick={() => { setExplorerTab('history'); setSidebarCollapsed(false); }}><History size={16}/></button></div>
        </div>

        {page === 'tester' ? <div className="pp-tester">
          <div className="pp-crumb"><span>REST</span><ChevronRight size={13}/><strong>{activeRequestName}</strong><span className="pp-crumb-sub">· HTTP request</span><div className="pp-crumb-spacer"/><button onClick={openSave} title="Save request to a collection"><Save size={15}/><span>Save</span>{!token && <LockKeyhole size={12}/>}</button><div className="pp-layout-actions"><span>Layout</span><button className={split === 'horizontal' ? 'active' : ''} onClick={() => setSplit('horizontal')} title="Request above response"><LayoutPanelTop size={16}/></button><button className={split === 'vertical' ? 'active' : ''} onClick={() => setSplit('vertical')} title="Request to left of response"><Columns2 size={16}/></button></div></div>
          <div className="pp-url-bar"><div className="pp-method-wrap"><select className={`pp-method ${method.toLowerCase()}`} aria-label="HTTP method" value={method} onChange={e => { setMethod(e.target.value); setOpenTabs(t => t.map(x => x.id === activeTabId ? { ...x, method: e.target.value } : x)); }}>{METHODS.map(m => <option key={m}>{m}</option>)}</select><ChevronDown size={13}/></div><div className="pp-url-input"><Link2 size={16}/><input aria-label="Request URL" spellCheck="false" type="text" placeholder="Enter URL or paste a cURL command…" value={url} onChange={e => setUrl(e.target.value)} onPaste={e=>{const raw=e.clipboardData.getData('text');if(isCurl(raw)){e.preventDefault();importCurlIntoCurrent(raw)}}} onKeyDown={e => { if (e.key === 'Enter') sendRequest(); }}/></div><button className="pp-send" disabled={loading} onClick={sendRequest}>{loading ? <span className="spinner"/> : <Send size={15}/>} {loading ? 'Sending' : 'Send'} <span className="pp-send-shortcut">↵</span></button></div>
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
                  <div className="pp-body-toolbar"><label>Body type<select value={format} onChange={e=>selectFormat(e.target.value)}>
                    {['General','Text','Structured','Binary'].map(group=><optgroup key={group} label={group}>
                      {BODY_FORMATS.filter(x=>x.group===group).map(f=><option value={f.mime} key={f.mime}>{f.label}</option>)}
                    </optgroup>)}
                  </select></label>
                    {bodyFormat(format).mode==='raw'&&<button title="Beautify request body" onClick={beautifyBody}><WandSparkles size={15}/> Beautify</button>}
                    <span>UTF-8</span>
                  </div>
                  {bodyFormat(format).mode==='none'&&<div className="pp-body-empty">This request has no body. Choose a format to start editing.</div>}
                  {bodyFormat(format).mode==='raw'&&<div className="pp-body-code">
                    <TextEditor value={body} onChange={setBody} lang={languageFromMime(format)} theme={theme} />
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
                {reqTab === 'auth' && <><div className="pp-form-caption"><span>REQUEST AUTHORIZATION</span><span>Only applied to outgoing request</span></div><div className="pp-auth-form"><label>Auth type<select value={authType} onChange={e => setAuthType(e.target.value)}><option value="none">No Auth</option><option value="bearer">Bearer Token</option></select></label>{authType === 'bearer' && <label>Token<input type="password" autoComplete="off" placeholder="Paste bearer token" value={bearerToken} onChange={e => setBearerToken(e.target.value)}/></label>}<p>Use Headers for API keys, basic authentication, or custom authorization headers. Authorization values are not saved in request history.</p></div></>}
                {reqTab === 'scripts'&&<div className="pp-script-panel">
                  <div className="pp-script-label"><strong>Pre-request script</strong><span>Runs before resolving and sending HTTP request</span></div>
                  <TextEditor value={preScript} onChange={setPreScript} lang="javascript" theme={theme} minHeight="180px" lint={false}/>
                  <div className="pp-script-label"><strong>Post-response script</strong><span>Runs after receiving the HTTP response</span></div>
                  <TextEditor value={postScript} onChange={setPostScript} lang="javascript" theme={theme} minHeight="180px" lint={false}/>
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
                {!result ? <div className="pp-response-empty"><div className="pp-response-empty-symbol"><Terminal size={28}/></div><strong>{loading ? 'Sending request…' : 'Ready to send a request'}</strong><p>{loading ? 'The server is processing your request.' : 'Enter a URL, configure your request, and hit Send. Your response will appear here.'}</p><span>⌘ / Ctrl + Enter</span></div> : result.error ? <div className="pp-response-error"><div><X size={18}/></div><strong>Request failed</strong><p>{result.error}</p></div> : <><div className="pp-response-code"><TextEditor readOnly value={responseText} lang={resTab==='headers'?'json':languageFromMime(responseType)} theme={theme} minHeight="250px"/></div>{result.truncated && <div className="pp-response-warning">Output truncated to 1 MB.</div>}{result.isBinary && <div className="pp-response-warning">Binary content displayed as Base64.</div>}</>}
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
    {notice && <div className="pp-toast"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={15}/></button></div>}
    {authOpen && <Dialog title={authMode === 'login' ? 'Welcome back' : 'Create account'} subtitle="Sign in to manage your collections, teams and workspaces. API testing stays open to everyone." onClose={()=>setAuthOpen(false)}><form className="modal-form" onSubmit={submitAuth}>{authMode==='register' && <label>Display name<input required maxLength={120} placeholder="Your name" value={authForm.displayName} onChange={e=>setAuthForm(v=>({...v,displayName:e.target.value}))}/></label>}<label>Email address<input type="email" required autoComplete="email" value={authForm.email} placeholder="you@example.com" onChange={e=>setAuthForm(v=>({...v,email:e.target.value}))}/></label><label>Password<input type="password" required minLength={authMode === 'register' ? 12 : 1} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder={authMode === 'register' ? 'At least 12 characters' : 'Your password'} value={authForm.password} onChange={e=>setAuthForm(v=>({...v,password:e.target.value}))}/></label>{authError && <div className="form-error">{authError}</div>}<button className="pp-modal-submit" disabled={authBusy} type="submit">{authBusy ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></button><p className="form-toggle">{authMode === 'login' ? 'New to Pakpost?' : 'Already have an account?'} <button type="button" onClick={()=>{setAuthMode(v=>v==='login'?'register':'login');setAuthError('');}}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p><p className="pp-muted-small pp-center">Google SSO can be added later.</p></form></Dialog>}
    {envOpen && <EnvironmentDialog items={currentEnvironments} selected={activeEnvId} onSelect={setActiveEnvId} onSave={persistEnvironment} onCreate={createEnvironment} onDelete={deleteEnvironment} onClose={()=>setEnvOpen(false)} scope={envScope==='workspace'?`Workspace: ${activeWorkspace?.name||'Private'}`:'Guest (local)'}/>}
    {saveOpen && <Dialog title="Save to collection" subtitle="Saved requests are private to members of your workspace." onClose={()=>setSaveOpen(false)}><form className="modal-form" onSubmit={saveRequest}><label>Request name<input required maxLength={120} value={saveName} onChange={e=>setSaveName(e.target.value)}/></label><label>Workspace<select value={saveWs} onChange={e=>setSaveWs(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Collection<select required value={saveCollection} onChange={e=>setSaveCollection(e.target.value)}>{saveCols.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{!saveCols.length && <div className="form-error">Create a workspace and collection first.</div>}<button className="pp-modal-submit" type="submit" disabled={!saveCollection || busyAction}><Save size={16}/> Save request</button></form></Dialog>}
  </div>;
}
