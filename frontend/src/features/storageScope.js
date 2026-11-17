/** Storage is an explicit destination. It must never change on a failed remote write. */
import {encodeStoredHeaders} from './requestMetadata.js';
import {bodyFormat} from './requestTools.js';
import {validateCollectionVariableRows} from './collectionVariableSession.js';

export const STORAGE_LOCAL='local';
export const STORAGE_WORKSPACE='workspace';
export const defaultStorageScope=authenticated=>authenticated?STORAGE_WORKSPACE:STORAGE_LOCAL;
export const allowedStorageScope=(authenticated,requested)=>authenticated&&requested===STORAGE_WORKSPACE?STORAGE_WORKSPACE:STORAGE_LOCAL;

/** Server count works before a Cloud collection is expanded; loaded requests take precedence. */
export function cloudEndpointCount(collection,requestLists,key){
  const loaded=requestLists[key];
  return Array.isArray(loaded)?loaded.length:Math.max(0,Number(collection?.requestCount)||0);
}

/** Prepare the payload accepted by the existing SavedRequestsController, without a migration. */
export function importedRequestPayload(request){
  const folder=Array.isArray(request?.folderPath)?request.folderPath.filter(Boolean).join(' / '):'';
  const original=String(request?.name||request?.requestName||'Imported request').trim();
  // The current remote API has flat requests. Keep nested folder context in the request name.
  const name=folder&&!original.startsWith(`${folder} / `)?`${folder} / ${original}`:original;
  const url=String(request?.url||'').trim();
  if(!name||name.length>120)throw Error(`Imported request name must be 1–120 characters: ${name.slice(0,80)}`);
  if(!url||url.length>2048)throw Error(`Request "${name}" needs a URL of at most 2048 characters to import into Cloud.`);
  const auth={authType:request.authType||'none',bearerToken:request.bearerToken||'',basicUsername:request.basicUsername||'',basicPassword:request.basicPassword||'',apiKeyName:request.apiKeyName||'X-API-Key',apiKeyValue:request.apiKeyValue||'',apiKeyIn:request.apiKeyIn||'header'};
  return {
    name,method:String(request.method||'GET').toUpperCase(),url,
    headersJson:encodeStoredHeaders(request.rows||[],request.params||[],request.documentation||'',request.responseExamples||[],auth),
    body:String(request.body||''),bodyMode:bodyFormat(request.format||'application/json').mode,
    contentType:request.format||'application/json',
    formFieldsJson:JSON.stringify((request.formFields||[]).map(({key,value,fileName,contentType})=>({key,value,fileName,contentType}))),
    preRequestScript:String(request.preScript||''),postResponseScript:String(request.postScript||'')
  };
}

export function collectionImportSources({kind,requests=[],collections=[]}){
  if(!['postman','curl','openapi','insomnia'].includes(kind))return [];
  if(kind==='curl')return requests.length?[{name:'Imported cURL',requests}]:[];
  return collections.length?collections:requests.length?[{name:'Imported collection',requests}]:[];
}

/** Import into the existing Neon collections + saved-requests endpoints.
 * Never writes to browser storage. On failure, describe partial remote writes explicitly.
 */
export async function saveCloudCollections(sources,{workspaceId,token,request,onCreated=()=>{}}){
  if(!workspaceId||!token)throw Error('Sign in and select a workspace before importing collections to Cloud.');
  const base=`/api/workspaces/${workspaceId}/collections`;
  // Preflight all requests before creating any remote records.
  const prepared=sources.map(source=>({
    name:String(source.name||'Imported collection').trim(),
    variables:validateCollectionVariableRows((source.variables||[]).map(v=>({key:v.key,value:v.value??'',isSecret:!!v.isSecret}))),
    requests:(source.requests||[]).map(importedRequestPayload)
  }));
  for(const source of prepared){
    if(!source.name||source.name.length>120)throw Error('Cloud collection name must be 1–120 characters.');
  }
  let count=0,createdCount=0,firstId='';
  try{
    for(const source of prepared){
      const created=await request(base,'POST',{name:source.name},token);
      createdCount++;firstId ||= created.id;
      onCreated(created);
      if(source.variables.length){
        await request(`${base}/${created.id}/variables`,'PUT',{version:0,variables:source.variables},token);
      }
      for(const payload of source.requests){
        await request(`${base}/${created.id}/requests`,'POST',payload,token);
        count++;
      }
    }
  }catch(error){
    throw Error(`Cloud import partially completed (${createdCount} collections, ${count} requests saved): ${error?.message||String(error)}`);
  }
  return {count,createdCount,firstId};
}
