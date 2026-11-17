/** Offline JSON import/export adapters for OpenAPI 3.x and legacy Insomnia v4.
 * Imported strings are DATA only: scripts are never evaluated on import.
 * External $ref/remote files are not fetched. The source schema is not a code generator.
 */
import {blankDraft,safeExportDraft} from './importExport.js';
import {sanitizeResponseExamples} from '../../requests/services/responseExamples.js';
import {normalizeHoppscotchVariables} from './hoppscotchCompat.js';

const METHODS=['get','post','put','patch','delete','head','options','trace'];
const s=value=>String(value??'');
const obj=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const list=value=>Array.isArray(value)?value:[];
const row=(key,value='',description='',enabled=true)=>({key:s(key),value:s(value),description:s(description),enabled:enabled!==false});
const MAX_REQUESTS=200;
function trimName(name,fallback='Imported API'){return s(name||fallback).slice(0,120);}
function toText(value){return normalizeHoppscotchVariables(typeof value==='string'?value:JSON.stringify(value,null,2));}
function uniqueId(prefix,index){return `${prefix}_pakpost_${index+1}`;}
function parseExampleContent(source,doc,limit=15){
  const result=[];
  for(const [code,value] of Object.entries(obj(source))){
    const response=obj(localRef(doc,value));
    if(!/^\d{3}$/.test(code)||!response||!Object.keys(response).length)continue;
    const content=obj(response.content);
    for(const [media,mime] of Object.entries(content)){
      const entry=obj(localRef(doc,mime));
      const rawExamples=entry.examples&&typeof entry.examples==='object'
        ?Object.entries(entry.examples).map(([name,ex])=>({name,definition:ex}))
        :[...(Object.hasOwn(entry,'example')?[{name:response.description||`HTTP ${code}`,definition:{value:entry.example}}]:[]),
          ...(Object.hasOwn(obj(entry.schema),'example')?[{name:response.description||`HTTP ${code}`,definition:{value:entry.schema.example}}]:[])];
      for(const {name,definition} of rawExamples){
        if(result.length>=limit)break;
        const example=obj(localRef(doc,definition));
        if(!Object.hasOwn(example,'value'))continue;
        result.push({id:`import-${result.length}-${code}`,name:trimName(example.summary||name||response.description||`HTTP ${code}`,'Example'),
          statusCode:Number(code),reasonPhrase:s(response.description),headers:{'Content-Type':media},body:toText(example.value),contentType:media,
          description:s(example.description),elapsedMs:0});
      }
      if(result.length>=limit)break;
    }
    if(result.length>=limit)break;
  }
  return sanitizeResponseExamples(result);
}
function localRef(document,input,seen=new Set(),depth=0){
  if(!input||typeof input!=='object'||typeof input.$ref!=='string')return input;
  const ref=input.$ref;
  if(!ref.startsWith('#/')||seen.has(ref)||depth>10)return input;
  const part=ref.slice(2).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'));
  let node=document;
  for(const token of part){node=node?.[token];if(node==null)return input;}
  return localRef(document,node,new Set([...seen,ref]),depth+1);
}
function exampleOf(media,schema){
  const value=obj(media);
  if(Object.hasOwn(value,'example'))return value.example;
  for(const example of Object.values(obj(value.examples))){const node=obj(example);if(Object.hasOwn(node,'value'))return node.value;}
  const parsed=obj(schema);
  if(Object.hasOwn(parsed,'example'))return parsed.example;
  if(Object.hasOwn(parsed,'default'))return parsed.default;
  return null;
}
function serverAddress(item,rootServers){
  const server=list(item?.servers)[0]||list(rootServers)[0];
  if(!server?.url)return '{{baseUrl}}';
  return normalizeHoppscotchVariables(server.url).replace(/(?<!\{)\{([A-Za-z0-9_.-]+)\}(?!\})/g,(full,key)=>{
    const fallback=server.variables?.[key]?.default;
    return fallback===undefined||s(fallback)==='https://example.invalid'?`{{${key}}}`:normalizeHoppscotchVariables(fallback);
  }).replace(/\/$/,'');
}
function replacePathParams(path,parameters){
  return s(path).replace(/\{([^{}]+)\}/g,(_,name)=>{
    const candidate=parameters.find(param=>param.in==='path'&&param.name===name);
    const value=candidate?.example??candidate?.schema?.example??candidate?.schema?.default;
    if(value==null)return `{{${name}}}`;
    const normalized=normalizeHoppscotchVariables(value);
    return /^\{\{[A-Za-z_][A-Za-z0-9_.-]*\}\}$/.test(normalized)?normalized:encodeURIComponent(normalized);
  });
}
function opParamValue(param){return normalizeHoppscotchVariables(param?.example??param?.schema?.example??param?.schema?.default??'');}
function checkOpenApi(doc){
  if(!/^3\.(0|1)\.\d+(?:[-+].*)?$/.test(s(doc?.openapi)))throw Error('Use OpenAPI 3.0 or 3.1 JSON. Swagger 2 and YAML are not supported yet.');
  if(!doc?.info||!doc?.paths||typeof doc.paths!=='object')throw Error('OpenAPI file must contain info and paths.');
}
export function parseOpenApiCollection(doc){
  checkOpenApi(doc);
  const requests=[];
  const folderDocs={};
  const tags=new Map(list(doc.tags).map(tag=>[s(tag.name),s(tag.description)]));
  for(const [path,rawPathItem] of Object.entries(obj(doc.paths))){
    const pathItem=localRef(doc,rawPathItem);
    if(!path.startsWith('/')||!pathItem||typeof pathItem!=='object')continue;
    for(const method of METHODS){
      const operation=localRef(doc,pathItem[method]);
      if(!operation)continue;
      if(requests.length>=MAX_REQUESTS)throw Error(`Import limit: maximum ${MAX_REQUESTS} requests`);
      const allParams=[...list(pathItem.parameters),...list(operation.parameters)].map(p=>localRef(doc,p));
      const byName=new Map();
      for(const param of allParams){if(param?.in&&param?.name)byName.set(`${param.in}:${param.name}`,param);}
      const parameters=[...byName.values()];
      const request=blankDraft();
      request.method=method.toUpperCase();
      request.name=trimName(operation.summary||operation.operationId||`${request.method} ${path}`,'Request');
      request.requestName=request.name;
      request.documentation=s(operation.description||'');
      const firstTag=s(list(operation.tags)[0]);
      request.folderPath=firstTag?firstTag.split(' / ').slice(0,8):[];
      if(firstTag&&tags.has(firstTag)&&request.folderPath.length)folderDocs[JSON.stringify(request.folderPath)]=tags.get(firstTag);
      const urlBase=serverAddress(operation?.servers?.length?operation:pathItem?.servers?.length?pathItem:doc,doc.servers);
      request.url=normalizeHoppscotchVariables(`${urlBase}${replacePathParams(path,parameters)}`);
      request.params=parameters.filter(p=>p.in==='query').map(p=>row(p.name,opParamValue(p),p.description));
      request.rows=parameters.filter(p=>p.in==='header'&&!/^(authorization|content-type)$/i.test(p.name)).map(p=>row(p.name,opParamValue(p),p.description));
      const security=list(operation.security??doc.security);
      const schemes=obj(doc?.components?.securitySchemes);
      for(const entry of security){
        const match=Object.keys(obj(entry)).map(name=>localRef(doc,schemes[name])).find(scheme=>scheme?.type==='http'||scheme?.type==='apiKey');
        if(!match)continue;
        if(match.type==='http'&&match.scheme==='bearer'){request.authType='bearer';request.bearerToken='{{token}}';break;}
        if(match.type==='http'&&match.scheme==='basic'){request.authType='basic';request.basicUsername='{{username}}';request.basicPassword='{{password}}';break;}
        if(match.type==='apiKey'){request.authType='apiKey';request.apiKeyName=String(match.name||'X-API-Key');request.apiKeyIn=match.in==='query'?'query':'header';request.apiKeyValue='{{apiKey}}';break;}
      }
      const requestBody=localRef(doc,operation.requestBody);
      const entries=Object.entries(obj(requestBody?.content));
      if(entries.length){
        const [mime,media]=entries.find(([key])=>key.includes('json'))||entries[0];
        request.format=mime;
        const schema=localRef(doc,media?.schema);
        const example=exampleOf(media,schema);
        if(mime==='application/x-www-form-urlencoded'||mime==='multipart/form-data'){
          const props=obj(schema?.properties);
          request.formFields=Object.entries(props).map(([name,def])=>row(name,def.example??def.default??'',def.description));
        }else if(example!=null){request.body=toText(example);}
      }
      request.responseExamples=parseExampleContent(operation.responses,doc);
      requests.push(request);
    }
  }
  // Hoppscotch may place requests that it cannot represent as OpenAPI operations
  // in a vendor extension. Preserve them so an import doesn't silently lose endpoints.
  for(const dropped of list(doc['x-hoppscotch-dropped-requests'])){
    if(requests.length>=MAX_REQUESTS)throw Error(`Import limit: maximum ${MAX_REQUESTS} requests`);
    const source=obj(dropped?.request);
    if(!source.endpoint||!METHODS.includes(s(source.method).toLowerCase()))continue;
    const request=blankDraft();
    request.method=s(source.method).toUpperCase();
    request.name=trimName(source.name,`${request.method} ${source.endpoint}`);
    request.requestName=request.name;
    request.url=normalizeHoppscotchVariables(source.endpoint);
    request.documentation=s(source.description);
    const tagPath=dropped.tagPath;
    request.folderPath=(Array.isArray(tagPath)?tagPath:typeof tagPath==='string'?tagPath.split(' / '):[]).filter(Boolean).slice(0,8).map(s);
    request.params=list(source.params).map(p=>row(p.key??p.name,normalizeHoppscotchVariables(p.value),p.description,p.active!==false&&!p.disabled));
    request.rows=list(source.headers).map(h=>row(h.key??h.name,normalizeHoppscotchVariables(h.value),h.description,h.active!==false&&!h.disabled));
    request.authType=source.auth?.authType==='bearer'?'bearer':'none';
    if(request.authType==='bearer')request.bearerToken=normalizeHoppscotchVariables(source.auth?.token||'');
    if(source.body&&source.body.body!=null){request.body=toText(source.body.body);request.format=s(source.body.contentType||'application/json');}
    request.preScript=s(source.preRequestScript||'');request.postScript=s(source.testScript||'');
    requests.push(request);
  }
  if(!requests.length)throw Error('OpenAPI spec has no supported HTTP operations in paths.');
  return {kind:'openapi',requests,environments:[],collections:[{
    name:trimName(doc.info.title,'OpenAPI collection'),documentation:s(doc.info.description),folderDocs,requests
  }]};
}

const INSOMNIA_VAR=/\{\{\s*_\.([A-Za-z0-9_.-]+)\s*\}\}/g;
function toPakpostVariable(value){return s(value).replace(INSOMNIA_VAR,'{{$1}}');}
function toInsomniaVariable(value){return s(value).replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g,'{{ _.$1 }}');}
function insomniaBody(input,request){
  const body=obj(input);
  request.format=s(body.mime||'application/json');
  if(Array.isArray(body.params)){
    request.formFields=body.params.map(param=>({...row(param.name,param.value,param.description,!param.disabled),
      ...(param.type==='file'&&param.fileName?{fileName:s(param.fileName)}:{})}));
    if(!body.mime)request.format='multipart/form-data';
  }else request.body=toPakpostVariable(body.text||'');
}
export function parseInsomniaV4(doc){
  if(doc?.__export_format!==4||!Array.isArray(doc.resources))throw Error('Expected Insomnia v4 JSON export. Insomnia v5 YAML is not supported yet.');
  const resources=doc.resources.slice(0,2000);
  const index=new Map(resources.map(item=>[item._id,item]));
  const workspaces=resources.filter(x=>x._type==='workspace');
  const groups=resources.filter(x=>x._type==='request_group');
  const requests=resources.filter(x=>x._type==='request');
  if(requests.length>MAX_REQUESTS)throw Error(`Import limit: maximum ${MAX_REQUESTS} requests`);
  const pathFor=parentId=>{
    const names=[];const seen=new Set();let node=index.get(parentId);
    while(node?._type==='request_group'&&names.length<16&&!seen.has(node._id)){
      names.unshift(trimName(node.name,'Folder'));seen.add(node._id);node=index.get(node.parentId);
    }
    return names;
  };
  const collectionsByWorkspace=new Map();
  function workspaceId(parent){
    const seen=new Set();let node=index.get(parent);
    while(node&&!seen.has(node._id)){
      if(node._type==='workspace')return node._id;
      seen.add(node._id);node=index.get(node.parentId);
    }
    return workspaces[0]?._id||'default';
  }
  for(const source of requests){
    const ws=workspaceId(source.parentId);
    if(!collectionsByWorkspace.has(ws)){
      const workspace=index.get(ws);
      collectionsByWorkspace.set(ws,{name:trimName(workspace?.name,'Insomnia collection'),documentation:s(workspace?.description),folderDocs:{},requests:[]});
    }
    const collection=collectionsByWorkspace.get(ws);
    const draft=blankDraft();
    draft.name=trimName(source.name,source.method||'Request');draft.requestName=draft.name;
    draft.folderPath=pathFor(source.parentId);
    draft.method=s(source.method||'GET').toUpperCase();draft.documentation=s(source.description);
    draft.url=toPakpostVariable(source.url);
    draft.params=list(source.parameters).map(p=>row(p.name,toPakpostVariable(p.value),p.description,p.disabled!==true));
    draft.rows=list(source.headers).map(h=>row(h.name,toPakpostVariable(h.value),h.description,h.disabled!==true));
    if(source.body)insomniaBody(source.body,draft);
    const auth=obj(source.authentication);
    if(auth.type==='bearer'){draft.authType='bearer';draft.bearerToken=toPakpostVariable(auth.token||'');}
    if(auth.type==='basic'){draft.authType='basic';draft.basicUsername=toPakpostVariable(auth.username||'');draft.basicPassword=toPakpostVariable(auth.password||'');}
    if(auth.type==='apikey'||auth.type==='apiKey'){draft.authType='apiKey';draft.apiKeyName=s(auth.key||'X-API-Key');draft.apiKeyValue=toPakpostVariable(auth.value||'');draft.apiKeyIn=auth.addTo==='query'?'query':'header';}
    // No conversion/execution of Insomnia-specific plugins/hooks.
    collection.requests.push(draft);
  }
  for(const group of groups){
    const collection=collectionsByWorkspace.get(workspaceId(group.parentId));
    const path=pathFor(group._id);
    if(collection&&path.length&&group.description)collection.folderDocs[JSON.stringify(path)]=s(group.description);
  }
  const envs=resources.filter(x=>x._type==='environment'&&obj(x.data)&&Object.keys(x.data).length)
    .slice(0,50).map(env=>({name:trimName(env.name,'Insomnia environment'),variables:Object.entries(obj(env.data)).map(([key,value])=>({key,value:toPakpostVariable(typeof value==='object'?JSON.stringify(value):value),isSecret:false}))}));
  const collections=[...collectionsByWorkspace.values()];
  if(!collections.length&&!envs.length)throw Error('Insomnia export has no HTTP requests or environments to import.');
  return {kind:'insomnia',collections,requests:collections.flatMap(c=>c.requests),environments:envs};
}
export function exportInsomniaV4Collection(drafts,{name='Pakpost collection',includeSecrets=false,documentation='',folderDocs={}}={}){
  const resources=[{_id:'__WORKSPACE_ID__',_type:'workspace',parentId:null,name,description:documentation,scope:'collection'}];
  let index=0;const folders=new Map();
  for(const raw of drafts){
    const draft=safeExportDraft(raw,includeSecrets);
    let parentId='__WORKSPACE_ID__';const path=[];
    for(const part of list(draft.folderPath)){
      path.push(s(part));const key=JSON.stringify(path);
      if(!folders.has(key)){
        const id=uniqueId('fld',index++);
        folders.set(key,id);
        resources.push({_id:id,_type:'request_group',parentId,name:s(part),description:s(folderDocs[key]||'')});
      }
      parentId=folders.get(key);
    }
    let mode=draft.format||'application/json';
    let body={};
    if(mode==='multipart/form-data'||mode==='application/x-www-form-urlencoded')body={mime:mode,params:list(draft.formFields).filter(x=>x.key).map(f=>({name:s(f.key),value:toInsomniaVariable(f.value),description:s(f.description),disabled:f.enabled===false}))};
    else if(draft.body)body={mime:mode,text:toInsomniaVariable(draft.body)};
    const request={_id:uniqueId('req',index++),_type:'request',parentId,
      name:draft.requestName||draft.name||'Request',description:s(draft.documentation),url:toInsomniaVariable(draft.url),method:draft.method||'GET',
      headers:list(draft.rows).filter(h=>h.key).map(h=>({name:h.key,value:toInsomniaVariable(h.value),description:s(h.description),disabled:h.enabled===false})),
      parameters:list(draft.params).filter(p=>p.key).map(p=>({name:p.key,value:toInsomniaVariable(p.value),description:s(p.description),disabled:p.enabled===false})),
      body,authentication:draft.authType==='bearer'?{type:'bearer',token:toInsomniaVariable(draft.bearerToken)}:
        draft.authType==='basic'?{type:'basic',username:toInsomniaVariable(draft.basicUsername),password:toInsomniaVariable(draft.basicPassword)}:
        draft.authType==='apiKey'?{type:'apikey',key:draft.apiKeyName,value:toInsomniaVariable(draft.apiKeyValue),addTo:draft.apiKeyIn}:{},
      metaSortKey:-(index+1)};
    resources.push(request);
  }
  return {_type:'export',__export_format:4,__export_date:new Date().toISOString(),__export_source:'pakpost',resources};
}
