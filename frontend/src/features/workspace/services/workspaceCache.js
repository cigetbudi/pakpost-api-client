import {sanitizeResponseExamples} from '../../requests/services/responseExamples.js';
/** Local-only recovery. Cloud request contents must never be persisted to browser storage. */
const SESSION_KEY='pakpost_workbench_v4_live';
const LOCAL_KEY='pakpost_workbench_v4_recovery';
const MAX_BYTES=2*1024*1024;
const SENSITIVE_KEY=/(authorization|cookie|secret|signature|password|access.?token|api.?key|bearer|client.?secret|refresh.?token|^token$)/i;
const isCloudTab=tab=>tab?.source?.scope==='workspace';
const STRIP_FORM_FILE=(rows)=>(rows||[]).map(r=>({...r,fileBase64:undefined}));
function normalizeDraft(d){
  if(!d||typeof d!=='object')return {};
  return {...d,binaryFile:{name:d.binaryFile?.name||'',base64:''},formFields:STRIP_FORM_FILE(d.formFields),
    responseExamples:sanitizeResponseExamples(d.responseExamples),
    // Don't keep large or sensitive response bodies in durable local recovery.
    result:d.result&&!d.result.error?{...d.result,body:String(d.result.body||'').slice(0,150000)}:d.result,
    scriptLog:Array.isArray(d.scriptLog)?d.scriptLog.slice(-50):[],scriptTests:Array.isArray(d.scriptTests)?d.scriptTests.slice(-50):[]};
}
function safeDraft(d){
  let sanitizedUrl=d.url||'';
  try { const url=new URL(sanitizedUrl);for(const key of url.searchParams.keys()) if(SENSITIVE_KEY.test(key))url.searchParams.set(key,'');sanitizedUrl=url.toString(); }catch{/* URL templates are permitted. */}
  return {...d,url:sanitizedUrl,rows:(d.rows||[]).map(r=>({...r,value:SENSITIVE_KEY.test(r.key||'')?'':r.value})),
    params:(d.params||[]).map(r=>({...r,value:SENSITIVE_KEY.test(r.key||'')?'':r.value})),bearerToken:'',basicPassword:'',apiKeyValue:'',
    responseExamples:sanitizeResponseExamples(d.responseExamples),
    result:null,scriptLog:[],scriptTests:[],scriptError:'',scriptDiagnostic:null};
}
export function readWorkbenchCache(){
  if(typeof sessionStorage==='undefined')return null;
  let restored=null;
  // Inspect both legacy storage locations: recovering from sessionStorage must not
  // leave an old Cloud plaintext copy behind in localStorage.
  for(const [store,key] of [[sessionStorage,SESSION_KEY],[localStorage,LOCAL_KEY]]){
    try{
      const data=JSON.parse(store.getItem(key)||'null');
      if(data?.version!==1||!Array.isArray(data.openTabs)||!data.openTabs.length||data.openTabs.length>100)continue;
      const localTabs=data.openTabs.filter(t=>t&&!isCloudTab(t)&&typeof t.id==='string');
      const validIds=new Set(localTabs.map(tab=>tab.id));
      const legacyCloudData=localTabs.length!==data.openTabs.length ||
        Object.keys(data.drafts||{}).some(id=>!validIds.has(id)) ||
        (Array.isArray(data.recent)&&data.recent.length>0);
      if(legacyCloudData)store.removeItem(key);
      if(!localTabs.length||restored)continue;
      const activeTabId=validIds.has(data.activeTabId)?data.activeTabId:localTabs[0].id;
      const drafts=Object.fromEntries(localTabs.map(tab=>[tab.id,data.drafts?.[tab.id]||{}]));
      restored={...data,openTabs:localTabs,activeTabId,drafts,recent:[]};
    }catch{/* Storage disabled or malformed; start clean. */}
  }
  return restored;
}
export function writeWorkbenchCache({openTabs,activeTabId,drafts,active,recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope,sandboxTabIds=[]}){
  try{
    const excluded=new Set(sandboxTabIds);
    // All Workspace requests stay in React memory only, even when the user can edit.
    const available=openTabs.filter(tab=>!isCloudTab(tab)&&!excluded.has(tab.id)).slice(0,100);
    // If all open tabs belong to QA's temporary Cloud sandbox, recover to an empty tester.
    const tabList=(available.length?available:[{id:'t0',name:'Untitled Request',method:'GET',source:null}])
      .map(t=>({id:t.id,name:t.name,method:t.method,status:t.status,source:t.source||null,pendingCopy:!!t.pendingCopy,savedFingerprint:t.savedFingerprint??null}));
    const safeActive=tabList.some(tab=>tab.id===activeTabId)?activeTabId:tabList[0].id;
    const all={...drafts,[activeTabId]:active};
    const clean=Object.fromEntries(tabList.map(t=>[t.id,normalizeDraft(all[t.id]) ]));
    // V6 persists Cloud environment selections in account+workspace keys, not the legacy global ID.
    const base={version:1,openTabs:tabList,activeTabId:safeActive,drafts:clean,split,explorerTab,sidebarCollapsed,activeEnvId:envScope==='local'?activeEnvId:'',envScope,recent:[]};
    const live=JSON.stringify(base);
    if(live.length<MAX_BYTES)sessionStorage.setItem(SESSION_KEY,live);
    const fallback={...base,drafts:Object.fromEntries(Object.entries(clean).map(([k,d])=>[k,safeDraft(d)])),recent:[]};
    const serialized=JSON.stringify(fallback);
    if(serialized.length<MAX_BYTES)localStorage.setItem(LOCAL_KEY,serialized);
  }catch{/* Don't break request execution if browser storage is full or unavailable. */}
}
export function clearWorkbenchCache(){
  try{sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem(LOCAL_KEY)}catch{/*noop*/}
}
