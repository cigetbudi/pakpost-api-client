/** Pakpost interceptor transport. The extension bridge is origin-isolated by its
 * content script and re-authorized in the extension background before every send.
 * Never fall back to the backend proxy for extension failures.
 */
import { isTauriDesktop } from '../../collections/services/desktopLocalRepository.js';

export const INTERCEPTOR_MODES=['proxy','browser','extension','native'];
export const EXTENSION_CHANNEL='pakpost.interceptor.v1';
const MAX_RESPONSE_BYTES=1_048_576;

export function readInterceptorMode(store){
  try { const mode=store?.getItem('pakpost_interceptor_mode');return INTERCEPTOR_MODES.includes(mode)&& (mode!=='native'||isTauriDesktop())?mode:(isTauriDesktop()?'native':'proxy'); }
  catch{return 'proxy';}
}
export function writeInterceptorMode(store,mode){
  if(!INTERCEPTOR_MODES.includes(mode)||(mode==='native'&&!isTauriDesktop()))throw Error('Unknown interceptor');
  try{store?.setItem('pakpost_interceptor_mode',mode);}catch{}
}

export function extensionBridge(action,payload=null,{timeoutMs=3000,target=globalThis.window}={}){
  if(!target?.postMessage||!target?.addEventListener)return Promise.reject(Error('Extension bridge is unavailable'));
  const id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`pp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve,reject)=>{
    let timer;
    const cleanup=()=>{target.removeEventListener('message',onMessage);clearTimeout(timer)};
    const onMessage=event=>{
      if(event.source!==target||event.origin!==target.location.origin)return;
      const message=event.data;
      if(!message||message.channel!==EXTENSION_CHANNEL||message.type!=='RESPONSE'||message.id!==id)return;
      cleanup();
      if(message.ok)resolve(message.result);
      else reject(Error(String(message.error||'Extension request rejected')));
    };
    target.addEventListener('message',onMessage);
    timer=setTimeout(()=>{cleanup();reject(Error(action==='PING'
      ?'Pakpost extension is not connected to this website. Allow its origin in the extension and reload the tab.'
      :'Extension timed out. Check its permissions, connection and VPN.'))},timeoutMs);
    target.postMessage({channel:EXTENSION_CHANNEL,type:'REQUEST',action,id,payload},target.location.origin);
  });
}
export const probeExtension=()=>extensionBridge('PING',null,{timeoutMs:1500});
export const sendExtensionRequest=command=>extensionBridge('SEND',command,{timeoutMs:26000});

const forbidden=new Set(['host','cookie','content-length','connection','transfer-encoding','origin','referer','user-agent','sec-fetch-site','sec-fetch-mode']);
export function prepareBrowserRequest(command){
  const method=String(command.method||'GET').toUpperCase();
  const url=new URL(command.url);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Only HTTP(S) URLs without embedded credentials are supported.');
  const headers=new Headers();
  for(const [key,value] of Object.entries(command.headers||{})){
    if(forbidden.has(key.toLowerCase())||key.toLowerCase().startsWith('proxy-'))throw Error(`Browser cannot set header: ${key}`);
    headers.set(key,String(value));
  }
  const init={method,headers,credentials:'omit',redirect:'manual',referrerPolicy:'no-referrer',cache:'no-store'};
  if(method==='GET'||method==='HEAD')return {url:url.href,init};
  const mode=command.bodyMode||'raw';
  if(mode==='urlencoded'){
    const values=new URLSearchParams();
    for(const item of command.formFields||[])if(item.key)values.append(item.key,String(item.value||''));
    init.body=values;
    headers.delete('Content-Type');
  }else if(mode==='multipart'){
    const form=new FormData();
    for(const item of command.formFields||[]){
      if(!item.key)continue;
      if(item.base64){
        const binary=atob(item.base64);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
        form.append(item.key,new Blob([bytes],{type:item.contentType||'application/octet-stream'}),item.fileName||'upload.bin');
      }else form.append(item.key,String(item.value||''));
    }
    init.body=form;headers.delete('Content-Type');
  }else if(mode==='binary'){
    const binary=atob(command.fileBase64||'');
    init.body=Uint8Array.from(binary,c=>c.charCodeAt(0));
    if(command.contentType)headers.set('Content-Type',command.contentType);
  }else if(mode==='raw'&&command.body){
    init.body=String(command.body);
    if(command.contentType&&!headers.has('Content-Type'))headers.set('Content-Type',command.contentType);
  }
  return {url:url.href,init};
}
export async function decodeBrowserResponse(response,elapsedMs){
  if(response.type==='opaqueredirect'||(response.status>=300&&response.status<400))throw Error('Redirect blocked. Add the final destination explicitly and request its URL directly.');
  if(response.type==='opaque'||response.status===0)throw Error('Browser could not read the response. Check CORS or use the extension.');
  const reader=response.body?.getReader();
  const chunks=[];let length=0,truncated=false;
  if(reader){
    try{while(true){const {done,value}=await reader.read();if(done)break;
      const remaining=MAX_RESPONSE_BYTES-length;
      if(value.length>remaining){chunks.push(value.subarray(0,Math.max(remaining,0)));length+=Math.max(remaining,0);truncated=true;await reader.cancel();break}
      chunks.push(value);length+=value.length;
    }}finally{try{reader.releaseLock()}catch{}}
  }else{
    const raw=new Uint8Array(await response.arrayBuffer());truncated=raw.length>MAX_RESPONSE_BYTES;
    const chunk=raw.subarray(0,MAX_RESPONSE_BYTES);chunks.push(chunk);length=chunk.length;
  }
  const content=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){content.set(chunk,offset);offset+=chunk.length}
  let body='',isBinary=false;
  try{body=new TextDecoder('utf-8',{fatal:true}).decode(content)}catch{isBinary=true;
    for(let offset=0;offset<content.length;offset+=16384)body+=String.fromCharCode(...content.subarray(offset,offset+16384));
    body=btoa(body);
  }
  return {statusCode:response.status,reasonPhrase:response.statusText||'',elapsedMs,
    headers:Object.fromEntries(response.headers.entries()),body,truncated,isBinary};
}
export async function sendBrowserRequest(command){
  const {url,init}=prepareBrowserRequest(command);
  const controller=new AbortController();init.signal=controller.signal;
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{const start=performance.now();const response=await fetch(url,init);return await decodeBrowserResponse(response,Math.round(performance.now()-start))}
  catch(error){throw Error(`Browser request failed (${error.message}). Check CORS or use the Browser Extension interceptor.`)}
  finally{clearTimeout(timeout)}
}

export async function dispatchRequest(command,mode){
  if(mode==='native'){
    if(!isTauriDesktop())throw Error('Native transport only works in PakPost Desktop');
    const {invoke}=await import('@tauri-apps/api/core');
    return invoke('send_native_http',{command});
  }
  if(mode==='extension')return sendExtensionRequest(command);
  if(mode==='browser')return sendBrowserRequest(command);
  return null; // Caller invokes its existing secure server proxy.
}
