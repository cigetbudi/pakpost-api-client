import {withCloudPageSlot} from './cloudPageQueue.js';
import { api } from '../../../services/httpClient.js';

/**
 * Cloud REST storage boundary. No browser storage, React state, or authorization
 * shortcuts here: callers must pass the token and the backend verifies RBAC.
 */
export function workspaceCollectionsPath(workspaceId) {
  if (!workspaceId) throw new Error('Select a Workspace');
  return `/api/workspaces/${workspaceId}/collections`;
}
export function workspaceRequestsPath(workspaceId, collectionId) {
  if (!collectionId) throw new Error('Select a Collection');
  return `${workspaceCollectionsPath(workspaceId)}/${collectionId}/requests`;
}
export function getWorkspaceCollections(workspaceId, token) {
  return api(workspaceCollectionsPath(workspaceId), 'GET', undefined, token);
}
export function getWorkspaceRequests(workspaceId, collectionId, token) {
  return api(`${workspaceRequestsPath(workspaceId, collectionId)}/index`, 'GET', undefined, token);
}
export function createWorkspaceRequest(workspaceId, collectionId, payload, token) {
  return api(workspaceRequestsPath(workspaceId, collectionId), 'POST', payload, token);
}
export function updateWorkspaceRequest(workspaceId, collectionId, requestId, payload, token) {
  if (!requestId) throw new Error('Missing saved request ID');
  // Do not retry a stale save without its revision, and never auto-force a PUT.
  return api(`${workspaceRequestsPath(workspaceId, collectionId)}/${requestId}`, 'PUT', payload, token);
}

export function getWorkspaceRequestIndexPage(workspaceId, collectionId, token,
  {after='',size=120,search='',folderId=null,rootOnly=false,sortByName=false,signal}={}) {
  const query=new URLSearchParams({size:String(size)});
  if(after)query.set('after',after);
  if(search)query.set('search',search);
  if(folderId)query.set('folderId',folderId);
  if(rootOnly)query.set('rootOnly','true');
  if(sortByName)query.set('sortByName','true');
  return withCloudPageSlot(()=>api(`${workspaceRequestsPath(workspaceId,collectionId)}/index/page?${query}`,'GET',undefined,token,{signal}),signal);
}
