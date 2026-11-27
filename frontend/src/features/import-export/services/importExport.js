/** Stable public import/export API. Parsers are pure and never execute imported scripts. */
import {parseOpenApiCollection,parseInsomniaV4} from './portableFormats.js';
import {parseEnvironmentDocument} from '../../environments/services/environmentImport.js';
import {isSensitiveVariable} from '../../environments/services/variableExperience.js';
import {safeString} from './draftFormat.js';
import {isCurl,parseCurl} from './curlImport.js';
import {parsePostmanCollection,postmanFolderDocs,pmScript} from './postmanImport.js';
import {parseSession} from './sessionFormats.js';
export {blankDraft} from './draftFormat.js';
export {shellWords,isCurl,parseCurl} from './curlImport.js';
export {parsePostmanCollection,postmanFolderDocs} from './postmanImport.js';
export {safeExportDraft,createPostmanCollection,createLocalPostmanExport} from './postmanExport.js';
export {parseSession,createSessionExport} from './sessionFormats.js';

export function parseImportText(text){
  if(isCurl(text))return {requests:[parseCurl(text)],environments:[],kind:'curl'};
  let data;try{data=JSON.parse(text);}catch{
    if(/^\s*(?:openapi:|type:\s*collection\.insomnia\.rest\/5\.0)/m.test(text))throw Error('YAML detected. Import OpenAPI 3.1 JSON or Insomnia v4 JSON. YAML is not supported in this lightweight importer yet.');
    throw Error('Invalid JSON. Paste cURL or choose OpenAPI 3.1, Insomnia v4, Postman, or Pakpost JSON.');
  }
  if(data?.format==='pakpost-workbench-session')return {...parseSession(data),kind:'pakpost'};
  // Insomnia exports with HTTP requests must still import those requests, not only envs.
  if(data?.__export_format===4&&Array.isArray(data.resources)&&data.resources.some(r=>r?._type==='request'))return parseInsomniaV4(data);
  const importedEnvironments=parseEnvironmentDocument(data);
  if(importedEnvironments)return {requests:[],environments:importedEnvironments,kind:'environment'};
  if(data?.openapi)return parseOpenApiCollection(data);
  if(data?.__export_format===4&&Array.isArray(data.resources))return parseInsomniaV4(data);
  if(Array.isArray(data?.item)){const requests=parsePostmanCollection(data);return {requests,environments:[],kind:'postman',collections:[{name:safeString(data.info?.name||'Imported collection'),documentation:safeString(data.info?.description),folderDocs:postmanFolderDocs(data.item),preScript:pmScript(data.event,'prerequest'),postScript:pmScript(data.event,'test'),variables:(Array.isArray(data.variable)?data.variable:[]).filter(v=>v?.key&&v.disabled!==true&&v.enabled!==false).slice(0,100).map(v=>({key:safeString(v.key),value:safeString(v.value),isSecret:v.type==='secret'||isSensitiveVariable(v.key)})),requests}]};}
  throw Error('Unsupported file. Use Hoppscotch/Postman/Insomnia environment JSON, OpenAPI 3.1 JSON, Postman v2.1, Pakpost session, or cURL.');
}
