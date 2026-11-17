/** Small, dependency-free exporters. Never send data to a remote conversion service. */
import {createPostmanCollection,createLocalPostmanExport,safeExportDraft} from './importExport.js';
import {exportInsomniaV4Collection} from './portableFormats.js';

const safeName = name => String(name || 'Pakpost export').replace(/[^a-z0-9_-]+/gi,'_').slice(0,90);
export const exportFileName=(name,format,kind='collection')=>`${safeName(name)}.${format==='openapi'?'openapi.json':format==='insomnia'?'insomnia_v4.json':kind==='environment'?'postman_environment.json':'postman_collection.json'}`;
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
export function exportInsomniaV4Environment(env,{includeSecrets=false}={}){
  const source=Object.fromEntries((env.variables||[]).filter(v=>v.key?.trim()).map(v=>[v.key,v.isSecret&&!includeSecrets?'':String(v.value??'')]));
  return {_type:'export',__export_format:4,__export_date:new Date().toISOString(),__export_source:'pakpost',resources:[
    {_id:'__WORKSPACE_ID__',_type:'workspace',parentId:null,name:env.name||'Pakpost environment',scope:'collection'},
    {_id:'__BASE_ENVIRONMENT_ID__',_type:'environment',parentId:'__WORKSPACE_ID__',name:env.name||'Base Environment',data:source}
  ]};
}
/** A single interchange document can contain multiple local collections as top-level tags/folders. */
export function flattenLocalCollections(collections=[]){
  const folderDocs={};
  const requests=[];
  for(const collection of collections){
    const prefix=[collection.name||'Collection'];
    if(collection.documentation)folderDocs[JSON.stringify(prefix)]=collection.documentation;
    for(const [key,description] of Object.entries(collection.folderDocs||{})){
      let path;try{path=JSON.parse(key)}catch{continue}
      if(Array.isArray(path))folderDocs[JSON.stringify([...prefix,...path])]=description;
    }
    for(const req of collection.requests||[])requests.push({...req,folderPath:[...prefix,...(req.folderPath||[])]});
  }
  return {requests,folderDocs};
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

function exampleKey(name,index){
  const safe=String(name||`example-${index+1}`).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return safe||`example-${index+1}`;
}
function exampleValue(example){
  const body=String(example?.body||'');
  if(String(example?.contentType||'').includes('json')){try{return JSON.parse(body||'null')}catch{}}
  return body;
}
function openApiResponses(examples=[]){
  if(!Array.isArray(examples)||!examples.length)return {default:{description:'Response'}};
  const responses={};
  examples.forEach((example,index)=>{
    const code=String(Number(example?.statusCode||0)||'default');
    if(!responses[code])responses[code]={description:String(example?.name||example?.reasonPhrase||`HTTP ${code}`),content:{}};
    const mediaType=String(example?.contentType||'text/plain')||'text/plain';
    if(!responses[code].content[mediaType])responses[code].content[mediaType]={examples:{}};
    responses[code].content[mediaType].examples[exampleKey(example?.name,index)]={
      summary:String(example?.name||`Example ${index+1}`),
      ...(example?.description?{description:String(example.description)}:{}),
      value:exampleValue(example)
    };
  });
  return responses;
}
/** OpenAPI represents endpoint contracts, not executable Postman scripts or crypto hooks. */
export function exportOpenApiCollection(drafts,{name='Pakpost collection',includeSecrets=false,documentation='',folderDocs={}}={}){
  const doc={openapi:'3.1.0',info:{title:name,version:'1.0.0',description:documentation||'Exported from Pakpost. Pre/post scripts and file bytes are not translated to OpenAPI.'},paths:{}};
  const servers=new Map();const securitySchemes={};
  for(let i=0;i<(drafts||[]).length;i++){
    const request=safeExportDraft(drafts[i],includeSecrets);
    const method=String(request.method||'GET').toLowerCase();
    if(!['get','post','put','patch','delete','head','options','trace'].includes(method))continue;
    const target=splitUrl(request.url);const pathname=target.path||'/';
    if(target.server)servers.set(JSON.stringify(target.server),target.server);
    const operation={summary:request.requestName||request.name||`${method.toUpperCase()} ${pathname}`,
      ...(request.documentation?{description:request.documentation}:{}),
      operationId:`pakpost_${method}_${i+1}`,responses:openApiResponses(request.responseExamples)};
    if(request.folderPath?.length){const tag=request.folderPath.join(' / ');operation.tags=[tag];if(!doc.tags)doc.tags=[];if(!doc.tags.some(t=>t.name===tag))doc.tags.push({name:tag,description:folderDocs[JSON.stringify(request.folderPath)]||''});}
    const pathVars=[...pathname.matchAll(/\{([\w.-]+)\}/g)].map(m=>m[1]);
    const params=pathVars.map(key=>({name:key,in:'path',required:true,schema:{type:'string'}}));
    const queryMap=new Map((request.params||[]).filter(v=>v.key&&v.enabled!==false).map(v=>[v.key,{value:v.value,description:v.description||''}]));
    for(const [key,value] of new URLSearchParams(target.query))if(!queryMap.has(key))queryMap.set(key,{value,description:''});
    for(const [key,data] of queryMap)params.push({name:key,in:'query',required:false,schema:{type:'string'},...(data.description?{description:data.description}:{})});
    for(const header of request.rows||[]){if(!header.key||header.enabled===false||/^(content-type|authorization)$/i.test(header.key))continue;params.push({name:header.key,in:'header',required:false,schema:{type:'string'},...(header.description?{description:header.description}:{})});}
    if(params.length)operation.parameters=params;
    if(request.authType==='bearer'){
      securitySchemes.bearerAuth={type:'http',scheme:'bearer'};
      operation.security=[{bearerAuth:[]}];
    }else if(request.authType==='basic'){
      securitySchemes.basicAuth={type:'http',scheme:'basic'};
      operation.security=[{basicAuth:[]}];
    }else if(request.authType==='apiKey'){
      const name=String(request.apiKeyName||'X-API-Key').trim();
      const location=request.apiKeyIn==='query'?'query':'header';
      const schemeId=`apiKey_${location}_${name.replace(/[^A-Za-z0-9]/g,'_')}`;
      securitySchemes[schemeId]={type:'apiKey',in:location,name};
      operation.security=[{[schemeId]:[]}];
    }
    const mode=contentType(request);
    if(!['get','head'].includes(method)&&((request.body||'').length||(request.formFields||[]).some(v=>v.key)||request.binaryFile?.name)){
      let schema={type:'string'};
      if(mode.includes('json')){
        try{schema={type:typeof JSON.parse(request.body)==='object'?'object':'string'};}catch{schema={};}
      }
      if(mode==='multipart/form-data'||mode==='application/x-www-form-urlencoded'){
        schema={type:'object',properties:Object.fromEntries((request.formFields||[]).filter(v=>v.key).map(v=>[v.key,v.fileName?{type:'string',format:'binary'}:{type:'string'}]))};
      }
      let example;
      if(mode.includes('json')&&request.body){
        try{example=JSON.parse(request.body);}catch{example=request.body;}
      }else if(request.body)example=request.body;
      if(mode==='application/x-www-form-urlencoded'||mode==='multipart/form-data'){
        const values=Object.fromEntries((request.formFields||[]).filter(v=>v.key&&!v.fileName).map(v=>[v.key,v.value]));
        if(Object.keys(values).length)example=values;
      }
      operation.requestBody={content:{[mode]:{schema,...(example===undefined?{}:{example})}},required:false};
    }
    if(!doc.paths[pathname])doc.paths[pathname]={};
    doc.paths[pathname][method]=operation;
  }
  if(servers.size)doc.servers=[...servers.values()];
  if(Object.keys(securitySchemes).length)doc.components={securitySchemes};
  return doc;
}
export function exportCollectionByFormat(drafts,{name='Pakpost collection',format='postman',includeSecrets=false,localCollection=null,documentation='',folderDocs={}}={}){
  const doc=localCollection?.documentation??documentation;const folders=localCollection?.folderDocs??folderDocs;
  if(format==='openapi')return exportOpenApiCollection(drafts,{name,includeSecrets,documentation:doc,folderDocs:folders});
  if(format==='insomnia')return exportInsomniaV4Collection(drafts,{name,includeSecrets,documentation:doc,folderDocs:folders});
  if(localCollection){const doc=createLocalPostmanExport([localCollection],{includeSecrets});return {...doc,info:{...doc.info,name,description:localCollection.documentation||doc.info.description},item:doc.item[0]?.item||[],variable:doc.item[0]?.variable||[]};}
  const exported=createPostmanCollection(drafts,{name,includeSecrets});return {...exported,info:{...exported.info,description:doc||exported.info.description}};
}
export function exportEnvironmentByFormat(env,{format='postman',includeSecrets=false}={}){
  return format==='openapi'?exportOpenApiEnvironment(env,{includeSecrets}):format==='insomnia'?exportInsomniaV4Environment(env,{includeSecrets}):exportPostmanEnvironment(env,{includeSecrets});
}
