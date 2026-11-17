/**
 * Pure workspace event contract shared by REST reconciliation and SignalR.
 * Do not import the connection client here: this module is part of startup.
 */
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
