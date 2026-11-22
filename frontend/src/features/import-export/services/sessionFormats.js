/** PakPost session import/export with bounded input and redaction. */
import {blankDraft,sanitizeRows} from './draftFormat.js';
import {safeExportDraft} from './postmanExport.js';
export function parseSession(doc){
  if(!doc||doc.format!=='pakpost-workbench-session'||doc.version!==1||!Array.isArray(doc.requests))throw Error('Not a Pakpost session export.');
  if(doc.requests.length>200)throw Error('Import limit: maximum 200 requests.');
  return {requests:doc.requests.map(d=>({...blankDraft(),...d,rows:sanitizeRows(d.rows),params:sanitizeRows(d.params),formFields:sanitizeRows(d.formFields)})),environments:Array.isArray(doc.environments)?doc.environments.slice(0,100):[]};
}
export function createSessionExport(drafts,environments,{includeSecrets=false}={}){
  return {format:'pakpost-workbench-session',version:1,exportedAt:new Date().toISOString(),requests:drafts.map(d=>safeExportDraft(d,includeSecrets)),environments:environments.map(env=>({name:env.name,variables:(env.variables||[]).map(v=>({key:v.key,value:v.isSecret&&!includeSecrets?'':v.value,isSecret:!!v.isSecret}))}))};
}
