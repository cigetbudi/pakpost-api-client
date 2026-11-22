/** OpenAPI 3.x JSON reader; local $ref only, with bounded request counts. */
import {blankDraft} from './draftFormat.js';
import {sanitizeResponseExamples} from '../../requests/services/responseExamples.js';
import {normalizeHoppscotchVariables} from './hoppscotchCompat.js';
import {METHODS,s,obj,list,row,MAX_REQUESTS,trimName,toText} from './portableFormatPrimitives.js';

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
