/** Insomnia v4 JSON import/export, without plugin or script execution. */
import {blankDraft} from './draftFormat.js';
import {safeExportDraft} from './postmanExport.js';
import {s,obj,list,row,MAX_REQUESTS,trimName,toText,uniqueId} from './portableFormatPrimitives.js';

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
