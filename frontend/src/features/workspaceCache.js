/** Browser-local recovery. Session storage retains the live draft on refresh; the local fallback redacts known secrets. */
const SESSION_KEY='pakpost_workbench_v4_live';
const LOCAL_KEY='pakpost_workbench_v4_recovery';
const MAX_BYTES=2*1024*1024;
const SENSITIVE_KEY=/(authorization|cookie|secret|signature|password|access.?token|api.?key|bearer|client.?secret|refresh.?token|^token$)/i;
const STRIP_FORM_FILE=(rows)=>(rows||[]).map(r=>({...r,fileBase64:undefined}));
function normalizeDraft(d){
  if(!d||typeof d!=='object')return {};
  return {...d,binaryFile:{name:d.binaryFile?.name||'',base64:''},formFields:STRIP_FORM_FILE(d.formFields),
    // Don't keep large or sensitive response bodies in durable local recovery.
    result:d.result&&!d.result.error?{...d.result,body:String(d.result.body||'').slice(0,150000)}:d.result,
    scriptLog:Array.isArray(d.scriptLog)?d.scriptLog.slice(-50):[],scriptTests:Array.isArray(d.scriptTests)?d.scriptTests.slice(-50):[]};
}
function safeDraft(d){
  let sanitizedUrl=d.url||'';
  try { const url=new URL(sanitizedUrl);for(const key of url.searchParams.keys()) if(SENSITIVE_KEY.test(key))url.searchParams.set(key,'');sanitizedUrl=url.toString(); }catch{/* URL templates are permitted. */}
  return {...d,url:sanitizedUrl,rows:(d.rows||[]).map(r=>({...r,value:SENSITIVE_KEY.test(r.key||'')?'':r.value})),
    params:(d.params||[]).map(r=>({...r,value:SENSITIVE_KEY.test(r.key||'')?'':r.value})),bearerToken:'',
    result:null,scriptLog:[],scriptTests:[],scriptError:''};
}
export function readWorkbenchCache(){
  if(typeof sessionStorage==='undefined')return null;
  for(const [store,key] of [[sessionStorage,SESSION_KEY],[localStorage,LOCAL_KEY]]){
    try{
      const data=JSON.parse(store.getItem(key)||'null');
      if(data?.version!==1||!Array.isArray(data.openTabs)||!data.openTabs.length||data.openTabs.length>100)continue;
      if(typeof data.activeTabId!=='string'||!data.openTabs.some(x=>x.id===data.activeTabId))continue;
      return data;
    }catch{/* Storage disabled or malformed; start clean. */}
  }
  return null;
}
export function writeWorkbenchCache({openTabs,activeTabId,drafts,active,recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope}){
  try{
    const tabList=openTabs.slice(0,100).map(t=>({id:t.id,name:t.name,method:t.method,status:t.status,source:t.source||null,pendingCopy:!!t.pendingCopy,savedFingerprint:t.savedFingerprint??null}));
    const all={...drafts,[activeTabId]:active};
    const clean=Object.fromEntries(tabList.map(t=>[t.id,normalizeDraft(all[t.id]) ]));
    const base={version:1,openTabs:tabList,activeTabId,drafts:clean,split,explorerTab,sidebarCollapsed,activeEnvId,envScope,recent:(recent||[]).slice(0,30)};
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
