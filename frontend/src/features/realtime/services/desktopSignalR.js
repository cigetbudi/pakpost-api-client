import {validWorkspaceEvent,validWorkspaceMemberJoined} from './workspaceEventPolicy.js';

// Use the existing SignalR protocol implementation, not a hand-written hub
// parser. HTTP transport is native and the desktop bearer never enters JS.
export function createNativeHubHttpClient(signalR, invoke, context, onUnauthorized) {
  const {HttpClient,HttpResponse,HttpError,AbortError}=signalR;
  return new class extends HttpClient {
    async send(request){
      if(request.abortSignal?.aborted)throw new AbortError();
      if(request.responseType && request.responseType!=='text')throw new Error('Only text hub frames supported');
      if(request.content!=null && typeof request.content!=='string')throw new Error('Invalid hub content');
      const url=new URL(request.url);
      if(url.username||url.password||url.hash)throw new Error('Invalid hub destination');
      if(url.origin!==context.origin || !['/hubs/workspace','/hubs/workspace/negotiate'].includes(url.pathname))throw new Error('Invalid hub destination');
      const native=invoke('remote_hub_http',{context,url:url.href,method:request.method,content:request.content??null});
      // SignalR may cancel a poll while stopping. The bounded native HTTP call
      // can finish later; its result is ignored and Rust rejects stale leases.
      let onAbort;
      const aborted=new Promise((_,reject)=>{onAbort=()=>reject(new AbortError());});
      if(request.abortSignal)request.abortSignal.onabort=onAbort;
      try{
        const result=await Promise.race([native,aborted]);
        if(request.abortSignal?.aborted)throw new AbortError();
        if(result.status===401)onUnauthorized?.();
        if(result.status<200||result.status>=300)throw new HttpError(`Hub HTTP ${result.status}`,result.status);
        return new HttpResponse(result.status,'',result.content);
      }finally{
        if(request.abortSignal?.onabort===onAbort)request.abortSignal.onabort=null;
      }
    }
    getCookieString(){return '';}
  }();
}

// SignalR owns its protocol, reconnect and negotiation. This adapter exposes only
// the WebSocket surface used by SignalR's text transport. No token enters JS.
export function createNativeHubWebSocket(invoke, createChannel, context, onUnauthorized, newId=()=>globalThis.crypto.randomUUID()) {
  return class NativeHubWebSocket {
    static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
    CONNECTING=0; OPEN=1; CLOSING=2; CLOSED=3;
    readyState=0; binaryType='arraybuffer'; bufferedAmount=0;
    onopen=null; onmessage=null; onerror=null; onclose=null;
    constructor(rawUrl){
      const url=new URL(rawUrl);
      if(url.protocol!=='wss:'||`https://${url.host}`!==context.origin||url.pathname!=='/hubs/workspace'||url.username||url.password||url.hash||[...url.searchParams].length!==1||!url.searchParams.get('id'))throw new Error('Invalid hub socket destination');
      this.id=newId(); this.channel=createChannel();
      this.channel.onmessage=event=>{
        if(this.readyState>=2)return;
        if(event.type==='open'&&this.readyState===0){this.readyState=1;this.onopen?.({type:'open'});}
        else if(event.type==='message'&&this.readyState===1&&typeof event.data==='string')this.onmessage?.({data:event.data});
        else if(event.type==='unauthorized'){onUnauthorized?.();this.finish(1008);}
        else if(event.type==='close')this.finish(1006);
      };
      // Defer registration to allow the transport to install handlers first.
      this.opening=Promise.resolve().then(()=>invoke('open_hub_socket',{context,id:this.id,url:url.href,events:this.channel}));
      this.opening.catch(()=>this.finish(1006));
    }
    finish(code){
      if(this.readyState===3)return;
      const connecting=this.readyState===0;
      this.readyState=3;this.channel.onmessage=()=>{};
      if(connecting&&code!==1000)this.onerror?.(new Error('Native hub socket failed'));
      this.onclose?.({code,reason:'',wasClean:code===1000});
    }
    send(content){
      if(this.readyState!==1||typeof content!=='string')throw new Error('Native hub socket not open or non-text frame');
      // Preserve ordering even when IPC calls complete out of order.
      this.bufferedAmount+=new TextEncoder().encode(content).length;
      if(this.bufferedAmount>256*1024){this.close();throw new Error('Native hub send queue full');}
      this.queue=(this.queue??Promise.resolve()).then(async()=>{
        if(this.readyState!==1)return;
        await invoke('send_hub_socket',{context,id:this.id,content});
        this.bufferedAmount-=new TextEncoder().encode(content).length;
      }).catch(()=>{this.close();});
    }
    close(){
      if(this.readyState>=2)return;
      this.readyState=2;this.channel.onmessage=()=>{};
      // Close after registration, even if stopped during the handshake.
      this.opening.then(()=>invoke('close_hub_socket',{context,id:this.id})).catch(()=>{});
      this.finish(1000);
    }
  };
}

export async function connectDesktopSignalR({workspaceId,context,onEvent,onStatus,onAccessChanged,onUnauthorized,onJoined,onMemberJoined}) {
  const [{invoke,Channel},signalR]=await Promise.all([import('@tauri-apps/api/core'),import('@microsoft/signalr')]);
  const {HubConnectionBuilder,LogLevel,HttpTransportType}=signalR;
  let stopped=false,joined=false;
  const notify=status=>{if(!stopped)onStatus?.(status);};
  const hub=new HubConnectionBuilder()
    .withUrl(`${context.origin}/hubs/workspace`,{
      transport:HttpTransportType.WebSockets|HttpTransportType.LongPolling,withCredentials:false,
      WebSocket:createNativeHubWebSocket(invoke,()=>new Channel(),context,()=>{if(!stopped)onUnauthorized?.();}),
      httpClient:createNativeHubHttpClient(signalR,invoke,context,()=>{if(!stopped)onUnauthorized?.();}),
    })
    .configureLogging(LogLevel.None)
    .withAutomaticReconnect([0,2000,5000,10000,30000])
    .build();
  const join=async()=>{
    await hub.invoke('JoinWorkspace',workspaceId);
    if(stopped)return;
    joined=true;notify('live');onJoined?.();
  };
  hub.on('WorkspaceMemberJoined',event=>{if(!stopped&&joined&&validWorkspaceMemberJoined(event,workspaceId))onMemberJoined?.(event);});
  hub.on('WorkspaceMemberRemoved',event=>{if(!stopped&&joined&&validWorkspaceMemberJoined(event,workspaceId))onMemberJoined?.({...event,removed:true});});
  hub.on('WorkspaceChanged',event=>{if(!stopped&&joined&&validWorkspaceEvent(event,workspaceId))onEvent?.(event);});
  hub.on('WorkspaceAccessChanged',payload=>{
    if(stopped||payload?.workspaceId!==workspaceId)return;
    joined=false;onAccessChanged?.();
    // Do not immediately rejoin a potentially revoked workspace.
    hub.stop().catch(()=>{});
  });
  hub.on('SessionRevoked',()=>{if(!stopped){joined=false;onUnauthorized?.();hub.stop().catch(()=>{});}});
  hub.onreconnecting(()=>{joined=false;notify('reconnecting');});
  hub.onreconnected(()=>{join().catch(()=>{joined=false;hub.stop().catch(()=>{});});});
  hub.onclose(()=>{joined=false;notify('offline');});
  // Return cleanup immediately; callers can dispose even while negotiate runs.
  (async()=>{try{notify('connecting');await hub.start();if(stopped){await hub.stop();return;}await join();}
    catch{notify('offline');try{await hub.stop();}catch{}}})();
  return ()=>{stopped=true;joined=false;hub.stop().catch(()=>{});};
}
