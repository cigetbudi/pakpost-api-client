/** Storage is an explicit destination. It must never change on a failed remote write. */
import {encodeStoredHeaders} from '../../requests/services/requestMetadata.js';
import {bodyFormat} from '../../requests/services/requestTools.js';
import {validateCollectionVariableRows} from '../../collections/services/collectionVariableSession.js';
import {collectionScripts} from '../../collections/services/collectionScripts.js';

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
  const folderPath=Array.isArray(request?.folderPath)?request.folderPath.map(x=>String(x).trim()):[];
  if(folderPath.length>24||folderPath.some(x=>!x||x.length>120))throw Error('Cloud folder path is invalid (24 levels, 120 characters each).');
  const name=String(request?.requestName||request?.name||'Imported request').trim();
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
    name,method,url,folderPath,
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
  if(sources.length<1||sources.length>30)throw Error('Cloud import requires 1–30 collections.');
  // Validate the entire batch before writes, including requests nested in collections.
  const totalRequests=sources.reduce((sum,source)=>sum+(Array.isArray(source?.requests)?source.requests.length:0),0);
  if(totalRequests>CLOUD_IMPORT_MAX_REQUESTS)throw Error(`Cloud import limit: maximum ${CLOUD_IMPORT_MAX_REQUESTS} requests across all collections.`);
  const prepared=sources.map(source=>({
    name:String(source.name||'Imported collection').trim(),
    ...collectionScripts(source),
    variables:validateCollectionVariableRows((source.variables||[]).map(v=>({key:v.key,value:v.value??'',isSecret:!!v.isSecret}))),
    requests:(source.requests||[]).map(importedRequestPayload)
  }));
  for(const source of prepared){
    if(!source.name||source.name.length>120)throw Error('Cloud collection name must be 1–120 characters.');
  }
  // Atomic backend endpoint. Never use the legacy per-request loop: it leaves partial data.
  // Do not retry automatically after a timeout; the server may already have committed.
  let result;
  try{
    result=await request(`${base}/import`,'POST',{collections:prepared},token);
  }catch(error){
    throw Error(`Cloud import failed or its result is unknown. Refresh Cloud before retrying to avoid duplicates. ${error?.message||String(error)}`);
  }
  if(!result||!Number.isInteger(result.count)||!Number.isInteger(result.createdCount))
    throw Error('Cloud import response was invalid. Refresh Cloud before retrying.');
  for(const created of result.collections||[])onCreated(created);
  return {count:result.count,createdCount:result.createdCount,firstId:result.firstId||''};
}
