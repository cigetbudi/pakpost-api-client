/** Draft identity and dirty tracking shared by local and workspace collections.
 * Only request fields are considered: HTTP responses and editor UI state never mark a tab dirty.
 */
import {blankDraft} from '../../import-export/services/importExport.js';

export const DEFAULT_REQUEST_URL = 'https://httpbin.org/get';
export function freshRequest(name='New Request') {
  return {...blankDraft(), name, method:'GET', url:DEFAULT_REQUEST_URL};
}
export function requestFingerprint(draft={},name='') {
  const rows=(value)=>Array.isArray(value)?value.map(row=>({
    key:row.key||'',value:row.value||'',description:row.description||'',enabled:row.enabled!==false,fileName:row.fileName||'',contentType:row.contentType||'',fileBase64:row.fileBase64||''
  })):[];
  const serialized=JSON.stringify({
    method:draft.method||'GET',url:draft.url||'',headers:rows(draft.rows),
    params:rows(draft.params),body:draft.body||'',format:draft.format||'application/json',
    formFields:rows(draft.formFields),binaryFileName:draft.binaryFile?.name||'',
    binaryFileBase64:draft.binaryFile?.base64||'',
    authType:draft.authType||'none',bearerToken:draft.bearerToken||'',
    basicUsername:draft.basicUsername||'',basicPassword:draft.basicPassword||'',
    apiKeyName:draft.apiKeyName||'',apiKeyValue:draft.apiKeyValue||'',apiKeyIn:draft.apiKeyIn||'header',
    preScript:draft.preScript||'',postScript:draft.postScript||'',documentation:draft.documentation||''
  });
  // The fingerprint is cached locally; never persist raw Authorization headers or secrets in it.
  let first=0x811c9dc5,second=0x9e3779b1;
  for(let i=0;i<serialized.length;i++){
    first=Math.imul(first^serialized.charCodeAt(i),0x01000193);
    second=Math.imul(second^serialized.charCodeAt(i),0x85ebca6b);
  }
  return `${(first>>>0).toString(16)}-${(second>>>0).toString(16)}-${serialized.length}`;
}
export function pendingSource(scope,collectionId,{workspaceId='',folderPath=[],pendingId}={}){
  return {scope,collectionId,...(scope==='workspace'?{workspaceId}:{folderPath}),pending:true,pendingId};
}
export function hasUnsavedChanges(tab,draft){
  if(!tab)return false;
  if(tab.source?.pending||tab.pendingCopy)return true;
  if(tab.name !== (tab.savedName ?? tab.name))return true;
  return tab.savedFingerprint != null && tab.savedFingerprint!==requestFingerprint(draft,tab.name);
}
export function needsCloseConfirmation(tab,draft){return hasUnsavedChanges(tab,draft);}
export function hasUnsavedMarker(tab,draft){return !!tab && (!!tab.source?.pending||!tab.source||hasUnsavedChanges(tab,draft));}
export function tabSaved(tab,source,draft,name=tab.name){return {...tab,name,savedName:name,source,pendingCopy:false,savedFingerprint:requestFingerprint(draft,name)};}
