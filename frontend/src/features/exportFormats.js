/** Small, dependency-free exporters. Never send data to a remote conversion service. */
import {createPostmanCollection,createLocalPostmanExport,safeExportDraft} from './importExport.js';

const safeName = name => String(name || 'Pakpost export').replace(/[^a-z0-9_-]+/gi,'_').slice(0,90);
export const exportFileName=(name,format,kind='collection')=>`${safeName(name)}.${format==='openapi'?'openapi.json':kind==='environment'?'postman_environment.json':'postman_collection.json'}`;
export const exportPostmanEnvironment=(environment,{includeSecrets=false}={})=>({
  id:String(environment.id||'pakpost-export'),name:environment.name||'Pakpost environment',
  values:(environment.variables||[]).filter(v=>v.key?.trim()).map(v=>({
    key:v.key,value:v.isSecret&&!includeSecrets?'':String(v.value??''),
    type:v.isSecret?'secret':'default',enabled:true
  })),_postman_variable_scope:'environment',_postman_exported_at:new Date().toISOString(),
  _postman_exported_using:'Pakpost'
});
export function exportOpenApiEnvironment(env,{includeSecrets=false}={}){
  return {
    openapi:'3.1.0',info:{title:`${env.name||'Pakpost'} — environment`,version:'1.0.0',
      description:'Pakpost environment metadata. x-pakpost-environment is a vendor extension, not a standard OpenAPI environment format.'},
    paths:{},
    'x-pakpost-environment':{
      name:env.name||'Environment',variables:(env.variables||[]).filter(v=>v.key?.trim()).map(v=>({
        key:v.key,value:v.isSecret&&!includeSecrets?'':String(v.value??''),secret:!!v.isSecret
      }))
    }
  };
}
const sanitizePath=path=>('/'+(path||'').replace(/^\/+/,''))
  .replace(/\{\{([\w.-]+)\}\}/g,'{$1}').replace(/<<([\w.-]+)>>/g,'{$1}').replace(/\/+/g,'/');
function splitUrl(raw){
  const value=String(raw||'');
  const variable=value.match(/^\{\{([\w.-]+)\}\}(.*)$/);
  if(variable)return {server:{url:`{${variable[1]}}`,variables:{[variable[1]]:{default:'https://example.invalid'}}},path:sanitizePath(variable[2].split('?')[0]),query:variable[2].split('?')[1]||''};
  const angle=value.match(/^<<([\w.-]+)>>(.*)$/);
  if(angle)return {server:{url:`{${angle[1]}}`,variables:{[angle[1]]:{default:'https://example.invalid'}}},path:sanitizePath(angle[2].split('?')[0]),query:angle[2].split('?')[1]||''};
  try{const parsed=new URL(value);return {server:{url:parsed.origin},path:sanitizePath(parsed.pathname),query:parsed.search.slice(1)};}catch{return {server:null,path:sanitizePath(value.split('?')[0]),query:value.split('?')[1]||''};}
}
function contentType(draft){return draft.format||draft.contentType||'application/json'}
/** OpenAPI represents endpoint contracts, not executable Postman scripts or crypto hooks. */
export function exportOpenApiCollection(drafts,{name='Pakpost collection',includeSecrets=false}={}){
  const doc={openapi:'3.1.0',info:{title:name,version:'1.0.0',description:'Exported from Pakpost. Pre/post scripts and file bytes are not translated to OpenAPI.'},paths:{}};
  const servers=new Map();let hasAuth=false;
  for(let i=0;i<(drafts||[]).length;i++){
    const request=safeExportDraft(drafts[i],includeSecrets);
    const method=String(request.method||'GET').toLowerCase();
    if(!['get','post','put','patch','delete','head','options','trace'].includes(method))continue;
    const target=splitUrl(request.url);const pathname=target.path||'/';
    if(target.server)servers.set(JSON.stringify(target.server),target.server);
    const operation={summary:request.requestName||request.name||`${method.toUpperCase()} ${pathname}`,
      operationId:`pakpost_${method}_${i+1}`,responses:{default:{description:'Response'}}};
    const pathVars=[...pathname.matchAll(/\{([\w.-]+)\}/g)].map(m=>m[1]);
    const params=pathVars.map(key=>({name:key,in:'path',required:true,schema:{type:'string'}}));
    const queryMap=new Map((request.params||[]).filter(v=>v.key).map(v=>[v.key,v.value]));
    for(const [key,value] of new URLSearchParams(target.query))if(!queryMap.has(key))queryMap.set(key,value);
    for(const [key] of queryMap)params.push({name:key,in:'query',required:false,schema:{type:'string'}});
    if(params.length)operation.parameters=params;
    if(request.authType==='bearer'){hasAuth=true;operation.security=[{bearerAuth:[]}];}
    const mode=contentType(request);
    if(!['get','head'].includes(method)&&((request.body||'').length||(request.formFields||[]).some(v=>v.key)||request.binaryFile?.name)){
      let schema={type:'string'};
      if(mode.includes('json')){
        try{schema={type:typeof JSON.parse(request.body)==='object'?'object':'string'};}catch{schema={};}
      }
      if(mode==='multipart/form-data'||mode==='application/x-www-form-urlencoded'){
        schema={type:'object',properties:Object.fromEntries((request.formFields||[]).filter(v=>v.key).map(v=>[v.key,v.fileName?{type:'string',format:'binary'}:{type:'string'}]))};
      }
      operation.requestBody={content:{[mode]:{schema}},required:false};
    }
    if(!doc.paths[pathname])doc.paths[pathname]={};
    doc.paths[pathname][method]=operation;
  }
  if(servers.size)doc.servers=[...servers.values()];
  if(hasAuth)doc.components={securitySchemes:{bearerAuth:{type:'http',scheme:'bearer'}}};
  return doc;
}
export function exportCollectionByFormat(drafts,{name='Pakpost collection',format='postman',includeSecrets=false,localCollection=null}={}){
  if(format==='openapi')return exportOpenApiCollection(drafts,{name,includeSecrets});
  if(localCollection){const doc=createLocalPostmanExport([localCollection],{includeSecrets});return {...doc,info:{...doc.info,name},item:doc.item[0]?.item||[]};}
  return createPostmanCollection(drafts,{name,includeSecrets});
}
export function exportEnvironmentByFormat(env,{format='postman',includeSecrets=false}={}){
  return format==='openapi'?exportOpenApiEnvironment(env,{includeSecrets}):exportPostmanEnvironment(env,{includeSecrets});
}
