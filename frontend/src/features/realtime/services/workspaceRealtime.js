/** SignalR transport, loaded only for an authenticated Cloud workspace. */
import { validWorkspaceEvent, validWorkspaceMemberJoined } from './workspaceEventPolicy.js';
import { getBrowserCsrf } from '../../../services/httpClient.js';

// Keep the public helpers re-exported for existing callers/tests. The module
// itself must never be statically imported by startup/reconciliation code.
export { WORKSPACE_KINDS, validWorkspaceEvent, shouldRefreshRequestList } from './workspaceEventPolicy.js';

export async function connectWorkspaceRealtime({workspaceId,getToken,onEvent,onStatus,onAccessChanged,onMemberJoined}){
  const {HubConnectionBuilder,LogLevel}=await import('@microsoft/signalr');
  const hub=new HubConnectionBuilder()
    // The browser supplies the HttpOnly cookie; only negotiate needs a CSRF header.
    .withUrl('/hubs/workspace',{headers:{'X-PakPost-CSRF':getBrowserCsrf()}})
    .withAutomaticReconnect([0,2000,5000,10000,30000])
    .configureLogging(LogLevel.Error)
    .build();
  let disposed=false;
  let timer=null;
  const join=async()=>{
    await hub.invoke('JoinWorkspace',workspaceId);
    if(!disposed)onStatus?.('live');
  };
  hub.on('WorkspaceAccessChanged',async payload=>{
    if(disposed||payload?.workspaceId!==workspaceId)return;
    try{await join()}catch{onStatus?.('offline')}
    onAccessChanged?.();
  });
  hub.on('SessionRevoked',()=>{
    if(disposed)return;
    disposed=true; // Do not attempt reconnect with a revoked cookie.
    if(timer){clearTimeout(timer);timer=null;}
    onStatus?.('offline');
    window.dispatchEvent(new Event('pakpost:browser-session-revoked'));
    hub.stop().catch(()=>{});
  });
  hub.on('WorkspaceMemberJoined',event=>{
    if(!disposed&&validWorkspaceMemberJoined(event,workspaceId))onMemberJoined?.(event);
  });
  hub.on('WorkspaceChanged',event=>{
    if(!disposed && validWorkspaceEvent(event,workspaceId)) onEvent(event);
  });
  hub.onreconnecting(()=>onStatus?.('reconnecting'));
  hub.onreconnected(()=>{join().catch(()=>{onStatus?.('offline');hub.stop().catch(()=>{});});});
  hub.onclose(()=>{if(!disposed){onStatus?.('offline');if(!timer)timer=setTimeout(()=>{timer=null;start();},10000);}});
  async function start(){
    if(disposed)return;
    try{await hub.start();if(!disposed)await join();else await hub.stop();}
    catch{
      if(!disposed){onStatus?.('offline');try{await hub.stop();}catch{};if(!timer)timer=setTimeout(()=>{timer=null;start();},10000);}
    }
  }
  onStatus?.('connecting');
  start();
  return ()=>{disposed=true;if(timer)clearTimeout(timer);hub.stop().catch(()=>{});};
}
