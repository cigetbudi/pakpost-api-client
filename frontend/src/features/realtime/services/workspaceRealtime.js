// The SignalR client lives in a separate async chunk. No connection or dependency
// is initialized for guest / Local-only sessions.
export const WORKSPACE_KINDS = new Set([
  'collection.created','collection.updated','collection.deleted','collection.variables',
  'request.created','request.updated','request.deleted','request.moved'
]);
export function validWorkspaceEvent(event, workspaceId){
  return !!event && typeof event==='object' && event.workspaceId===workspaceId &&
    WORKSPACE_KINDS.has(event.kind) && typeof event.collectionId==='string' &&
    /^[0-9a-f-]{36}$/i.test(event.collectionId) &&
    (event.requestId==null || (typeof event.requestId==='string' && /^[0-9a-f-]{36}$/i.test(event.requestId)));
}
export function shouldRefreshRequestList(event,{selectedCol='',cached=false,hasOpenTab=false,expanded=false}={}){
  return !!event?.kind?.startsWith('request.') &&
    (cached||hasOpenTab||expanded||selectedCol===event.collectionId);
}
export async function connectWorkspaceRealtime({workspaceId,getToken,onEvent,onStatus,onAccessChanged}){
  const {HubConnectionBuilder,LogLevel}=await import('@microsoft/signalr');
  const hub=new HubConnectionBuilder()
    .withUrl('/hubs/workspace',{accessTokenFactory:()=>getToken()||''})
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
