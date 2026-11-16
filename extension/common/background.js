/* Pakpost Interceptor – background transport. No network access is granted at install time. */
const api=typeof browser!=='undefined'?browser:chrome;
const BRIDGE='pakpost.interceptor.v1';
const MAX_RESPONSE=1048576;
const MAX_BODY=131072;
const METHODS=new Set(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']);
const DENIED_HEADERS=new Set(['host','cookie','origin','referer','content-length','connection','transfer-encoding','upgrade','proxy-authorization','proxy-connection','keep-alive','te','trailer','user-agent']);
const activeByOrigin=new Map();

const storage=()=>api.storage.local.get(['allowedOrigins','allowedDestinations']);
function parseOrigin(value){
  try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return '';
    return url.origin;
  }catch{return ''}
}
const pattern=origin=>{const url=new URL(origin);return `${url.protocol}//${url.hostname.includes(':')?`[${url.hostname.replace(/[\[\]]/g,'')}]`:url.hostname}/*`};
async function authorizedCaller(sender){
  if(sender.frameId!==0||!sender.tab?.id||!sender.url)throw Error('Only an approved top-level Pakpost tab may use this interceptor.');
  const pageOrigin=parseOrigin(new URL(sender.url).origin);
  const settings=await storage();
  if(!pageOrigin||!Array.isArray(settings.allowedOrigins)||!settings.allowedOrigins.includes(pageOrigin))throw Error('This Pakpost website has not been authorized in the extension.');
  if(sender.tab.url){let tabOrigin='';try{tabOrigin=new URL(sender.tab.url).origin}catch{}
    if(tabOrigin!==pageOrigin)throw Error('Tab navigated; retry after reloading Pakpost.');}
  const permission=await api.permissions.contains({origins:[pattern(pageOrigin)]});
  if(!permission)throw Error('Permission for this Pakpost website has been revoked.');
  return {pageOrigin,settings};
}
function validateCommand(command,settings){
  if(!command||typeof command!=='object')throw Error('Missing request payload');
  const method=String(command.method||'GET').toUpperCase();
  if(!METHODS.has(method))throw Error('Unsupported HTTP method');
  const target=String(command.url||'');
  if(target.length>4096)throw Error('URL exceeds 4096 characters');
  const url=new URL(target);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Only HTTP(S) URLs without embedded credentials are supported.');
  if(!Array.isArray(settings.allowedDestinations)||!settings.allowedDestinations.includes(url.origin))throw Error(`Destination not allowed: ${url.origin}. Add it in Pakpost Extension first.`);
  const mode=String(command.bodyMode||'raw');
  if(!['none','raw','urlencoded','multipart','binary'].includes(mode))throw Error('Unsupported body mode');
  const headers=command.headers||{};
  if(typeof headers!=='object'||Array.isArray(headers)||Object.keys(headers).length>40)throw Error('Too many request headers');
  for(const [key,value] of Object.entries(headers)){
    if(!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/.test(key)||DENIED_HEADERS.has(key.toLowerCase())||key.toLowerCase().startsWith('proxy-')||String(value).length>4096||/[\r\n]/.test(String(value)))throw Error(`Invalid or forbidden request header: ${key}`);
  }
  if(new TextEncoder().encode(String(command.body||'')).length>MAX_BODY)throw Error('Raw request body exceeds 128 KB');
  if(String(command.fileBase64||'').length>7000000)throw Error('Binary request body exceeds 5 MB');
  if((command.formFields||[]).length>50)throw Error('Too many form fields');
  return {url,method,mode,headers};
}
function decodeBase64(input){
  const raw=atob(String(input||''));if(raw.length>5242880)throw Error('File exceeds 5 MB');
  const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;
}
function prepareRequest(command,validated){
  const {method,mode}=validated;
  const headers=new Headers();
  for(const [key,value] of Object.entries(validated.headers))headers.set(key,String(value));
  const init={method,headers,redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'};
  if(method==='GET'||method==='HEAD')return init;
  if(mode==='urlencoded'){
    const form=new URLSearchParams();for(const field of command.formFields||[])if(field.key)form.append(field.key,String(field.value||''));
    init.body=form;headers.delete('Content-Type');
  }else if(mode==='multipart'){
    const form=new FormData();let bytes=0;
    for(const field of command.formFields||[]){
      if(!field.key)continue;
      if(field.base64){const file=decodeBase64(field.base64);bytes+=file.length;
        form.append(field.key,new Blob([file],{type:field.contentType||'application/octet-stream'}),String(field.fileName||'file.bin').replace(/[/\\]/g,'_'));
      }else {const value=String(field.value||'');bytes+=new TextEncoder().encode(value).length;form.append(field.key,value)}
      if(bytes>5242880)throw Error('Multipart request exceeds 5 MB');
    }
    init.body=form;headers.delete('Content-Type');
  }else if(mode==='binary'){
    init.body=decodeBase64(command.fileBase64);
    if(command.contentType)headers.set('Content-Type',String(command.contentType));
  }else if(mode==='raw'&&command.body){
    init.body=String(command.body);
    if(command.contentType&&!headers.has('Content-Type'))headers.set('Content-Type',String(command.contentType));
  }
  return init;
}
async function responsePayload(response,elapsedMs){
  if(response.type==='opaqueredirect'||(response.status>=300&&response.status<400))throw Error('Redirect blocked. Authorize the final URL and request it explicitly.');
  if(response.type==='opaque'||response.status===0)throw Error('Response unavailable. Check extension host permission and TLS certificate.');
  const reader=response.body?.getReader();let chunks=[],total=0,truncated=false;
  if(reader){
    try{while(true){const {done,value}=await reader.read();if(done)break;
      const remaining=MAX_RESPONSE-total;if(value.length>remaining){chunks.push(value.slice(0,Math.max(remaining,0)));total+=Math.max(remaining,0);truncated=true;await reader.cancel();break}
      chunks.push(value);total+=value.length;
    }}finally{try{reader.releaseLock()}catch{}}
  }else{const bytes=new Uint8Array(await response.arrayBuffer());truncated=bytes.length>MAX_RESPONSE;
    chunks=[bytes.slice(0,MAX_RESPONSE)];total=chunks[0].length;}
  const bytes=new Uint8Array(total);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}
  let body='',isBinary=false;
  try{body=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{isBinary=true;
    let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));body=btoa(binary);
  }
  return {statusCode:response.status,reasonPhrase:response.statusText||'',elapsedMs,
    headers:Object.fromEntries(response.headers.entries()),body,truncated,isBinary};
}
async function handleMessage(message,sender){
  if(!message||message.channel!==BRIDGE)return {ok:false,error:'Invalid bridge message'};
  const {pageOrigin,settings}=await authorizedCaller(sender);
  if(message.action==='PING')return {ok:true,result:{name:'Pakpost Interceptor',version:api.runtime.getManifest().version}};
  if(message.action!=='SEND')throw Error('Unsupported extension action');
  const validated=validateCommand(message.payload,settings);
  const granted=await api.permissions.contains({origins:[pattern(validated.url.origin)]});
  if(!granted)throw Error(`Browser permission missing for ${validated.url.origin}. Grant it in the extension popup.`);
  const active=activeByOrigin.get(pageOrigin)||0;
  if(active>=4)throw Error('Maximum 4 simultaneous requests per Pakpost origin');
  activeByOrigin.set(pageOrigin,active+1);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const init=prepareRequest(message.payload,validated);init.signal=controller.signal;
    const start=performance.now();
    const response=await fetch(validated.url.href,init);
    return {ok:true,result:await responsePayload(response,Math.round(performance.now()-start))};
  }finally{
    clearTimeout(timer);const count=activeByOrigin.get(pageOrigin)||1;
    if(count<=1)activeByOrigin.delete(pageOrigin);else activeByOrigin.set(pageOrigin,count-1);
  }
}
async function syncBridge(){
  const state=await storage();const origins=Array.isArray(state.allowedOrigins)?state.allowedOrigins:[];
  const patterns=[...new Set(origins.filter(parseOrigin).map(pattern))];
  const registered=await api.scripting.getRegisteredContentScripts({});
  const ours=registered.filter(item=>item.id==='pakpost-bridge').map(item=>item.id);
  if(ours.length)await api.scripting.unregisterContentScripts({ids:ours});
  const granted=[];
  for(const entry of patterns)if(await api.permissions.contains({origins:[entry]}))granted.push(entry);
  if(granted.length)await api.scripting.registerContentScripts([{id:'pakpost-bridge',matches:granted,js:['content.js'],runAt:'document_start',allFrames:false,persistAcrossSessions:true}]);
  return {registered:granted.length};
}
api.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.kind==='PAKPOST_SYNC'){
    if(sender.id!==api.runtime.id||sender.tab){respond({ok:false,error:'Extension popup required'});return false;}
    syncBridge().then(result=>respond({ok:true,result})).catch(error=>respond({ok:false,error:error.message}));return true;
  }
  if(message?.kind==='PAKPOST_BRIDGE'&&message?.channel===BRIDGE){
    handleMessage(message,sender).then(respond).catch(error=>respond({ok:false,error:String(error.message||error)}));return true;
  }
  return false;
});
api.runtime.onInstalled.addListener(()=>{syncBridge().catch(()=>{})});
api.runtime.onStartup.addListener(()=>{syncBridge().catch(()=>{})});
