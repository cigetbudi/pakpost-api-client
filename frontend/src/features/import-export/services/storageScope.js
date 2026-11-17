/** Storage is an explicit destination. It must never change on a failed remote write. */
import {encodeStoredHeaders} from '../../requests/services/requestMetadata.js';
import {bodyFormat} from '../../requests/services/requestTools.js';
import {validateCollectionVariableRows} from '../../collections/services/collectionVariableSession.js';

const CLOUD_IMPORT_MAX_REQUESTS = 200;
const CLOUD_REQUEST_METHODS = new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']);

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
  const method=String(request.method||'GET').toUpperCase();
  if(!CLOUD_REQUEST_METHODS.has(method))throw Error(`Unsupported HTTP method in Cloud import: ${method.slice(0,40)}`);
  const body=String(request.body||'');
  if(body.length>131072)throw Error(`Request "${name}" body exceeds the Cloud limit (131072 characters).`);
  const preRequestScript=String(request.preScript||'');
  const postResponseScript=String(request.postScript||'');
  if(preRequestScript.length>64000||postResponseScript.length>64000)
    throw Error(`Request "${name}" script exceeds the Cloud limit (64000 characters).`);
  return {
    name,method,url,
    headersJson:encodeStoredHeaders(request.rows||[],request.params||[],request.documentation||'',request.responseExamples||[],auth),
    body,bodyMode:bodyFormat(request.format||'application/json').mode,
    contentType:request.format||'application/json',
    formFieldsJson:JSON.stringify((request.formFields||[]).map(({key,value,fileName,contentType})=>({key,value,fileName,contentType}))),
    preRequestScript,postResponseScript
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
  if(!Array.isArray(sources))throw Error('Cloud import sources must be an array.');
  // Validate the entire batch before writes, including requests nested in collections.
  const totalRequests=sources.reduce((sum,source)=>sum+(Array.isArray(source?.requests)?source.requests.length:0),0);
  if(totalRequests>CLOUD_IMPORT_MAX_REQUESTS)throw Error(`Cloud import limit: maximum ${CLOUD_IMPORT_MAX_REQUESTS} requests across all collections.`);
  const prepared=sources.map(source=>({
    name:String(source.name||'Imported collection').trim(),
    variables:validateCollectionVariableRows((source.variables||[]).map(v=>({key:v.key,value:v.value??'',isSecret:!!v.isSecret}))),
    requests:(source.requests||[]).map(importedRequestPayload)
  }));
  for(const source of prepared){
    if(!source.name||source.name.length>120)throw Error('Cloud collection name must be 1–120 characters.');
  }
  let count=0,createdCount=0,firstId='';
  let activeCollectionId='',activeCollectionName='';
  try{
    for(const source of prepared){
      activeCollectionName=source.name;
      activeCollectionId='';
      const created=await request(base,'POST',{name:source.name},token);
      if(!created?.id)throw Error('Cloud API did not return a collection ID.');
      activeCollectionId=created.id;
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
    const location=activeCollectionId?`collection "${activeCollectionName}" (${activeCollectionId})`:`collection "${activeCollectionName}"`;
    throw Error(`Cloud import partially completed (${createdCount} collections created, ${count}/${totalRequests} requests saved; stopped at ${location}). Existing Cloud writes were kept. ${error?.message||String(error)}`);
  }
  return {count,createdCount,firstId};
}
