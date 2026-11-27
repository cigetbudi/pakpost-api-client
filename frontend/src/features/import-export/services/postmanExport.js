/** Postman export; secrets are redacted by default. */
import {blankDraft,sanitizeRows,named} from './draftFormat.js';
import {sanitizeResponseExamples} from '../../requests/services/responseExamples.js';
import {collectionPostmanEvents} from '../../collections/services/collectionScripts.js';
function pmEvent(listen,code){return {listen,script:{type:'text/javascript',exec:code.split('\n')}};}
function pmResponse(example){
  return {
    name:example.name||'Example',
    status:example.reasonPhrase||'',
    code:Number(example.statusCode||0)||0,
    header:Object.entries(example.headers||{}).map(([key,value])=>({key,value:String(value??'')})),
    body:String(example.body||''),
    _postman_previewlanguage:String(example.contentType||'').includes('json')?'json':'text'
  };
}
export function safeExportDraft(draft,includeSecrets=false){
  const copy={...blankDraft(),...draft,rows:sanitizeRows(draft.rows),params:sanitizeRows(draft.params),formFields:sanitizeRows(draft.formFields),binaryFile:{name:draft.binaryFile?.name||'',base64:''},responseExamples:sanitizeResponseExamples(draft.responseExamples),result:null,scriptLog:[],scriptTests:[],scriptError:''};
  if(!includeSecrets){copy.rows=copy.rows.map(r=>({...r,value:named(r.key)?'{{REDACTED}}':r.value}));copy.bearerToken=copy.bearerToken?'{{REDACTED}}':'';copy.basicPassword=copy.basicPassword?'{{REDACTED}}':'';copy.apiKeyValue=copy.apiKeyValue?'{{REDACTED}}':'';}
  return copy;
}
export function createPostmanCollection(drafts,{includeSecrets=false,name='Pakpost requests'}={}){
  const items=drafts.map(d=>{
    const r=safeExportDraft(d,includeSecrets);
    const enabledParams=r.params.filter(x=>x.key&&x.enabled!==false);
    const request={method:r.method||'GET',header:r.rows.filter(x=>x.key).map(x=>({key:x.key,value:x.value,type:'text',description:x.description||'',disabled:x.enabled===false})),url:{raw:r.url+(enabledParams.length?(r.url.includes('?')?'&':'?')+new URLSearchParams(enabledParams.map(x=>[x.key,x.value])).toString():'') ,query:r.params.filter(x=>x.key).map(x=>({key:x.key,value:x.value,description:x.description||'',disabled:x.enabled===false}))},description:r.documentation||'Exported from Pakpost'};
    if(r.authType==='bearer'&&r.bearerToken)request.auth={type:'bearer',bearer:[{key:'token',value:r.bearerToken,type:'string'}]};
    if(r.authType==='basic')request.auth={type:'basic',basic:[{key:'username',value:r.basicUsername||'',type:'string'},{key:'password',value:r.basicPassword||'',type:'string'}]};
    if(r.authType==='apiKey')request.auth={type:'apikey',apikey:[{key:'key',value:r.apiKeyName||'X-API-Key',type:'string'},{key:'value',value:r.apiKeyValue||'',type:'string'},{key:'in',value:r.apiKeyIn||'header',type:'string'}]};
    if(r.format==='multipart/form-data')request.body={mode:'formdata',formdata:r.formFields.filter(x=>x.key).map(x=>({key:x.key,...(x.fileName?{type:'file',src:x.fileName}:{type:'text',value:x.value})}))};
    else if(r.format==='application/x-www-form-urlencoded')request.body={mode:'urlencoded',urlencoded:r.formFields.filter(x=>x.key).map(x=>({key:x.key,value:x.value,type:'text'}))};
    else if(r.format==='application/octet-stream')request.body={mode:'file',file:{src:r.binaryFile?.name||''}};
    else if(r.body)request.body={mode:'raw',raw:r.body,options:{raw:{language:r.format.includes('json')?'json':r.format.includes('xml')?'xml':'text'}}};
    return {name:r.name||`${r.method} ${r.url}`,request,response:(r.responseExamples||[]).map(example=>({...pmResponse(example),originalRequest:request})),event:[r.preScript&&pmEvent('prerequest',r.preScript),r.postScript&&pmEvent('test',r.postScript)].filter(Boolean)};
  });
  return {info:{name,schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:'Exported from Pakpost'},item:items};
}
/** Preserve nested imported Postman folders when exporting local collections. */
export function createLocalPostmanExport(collections,{includeSecrets=false}={}){
  const root=createPostmanCollection([],{name:'Pakpost local collections',includeSecrets});
  for(const col of collections||[]){
    const parent={name:col.name,description:col.documentation||'',item:[],event:collectionPostmanEvents(col),variable:(col.variables||[]).map(v=>({key:v.key,value:v.isSecret&&!includeSecrets?'':v.value,type:v.isSecret?'secret':'string'}))};root.item.push(parent);
    // Create explicit empty folders as well as folders populated by requests.
    for(const path of col.folderPaths||[]){
      let target=parent;
      for(const segment of path){
        let folder=target.item.find(x=>Array.isArray(x.item)&&x.name===segment);
        if(!folder){folder={name:segment,item:[]};target.item.push(folder);}
        target=folder;
      }
    }
    for(const draft of col.requests||[]){
      const exported=createPostmanCollection([draft],{includeSecrets}).item[0];
      exported.name=draft.requestName||draft.name||'Request';
      let target=parent;
      const segments=[];for(const segment of draft.folderPath||[]){
        segments.push(segment);
        let folder=target.item.find(x=>Array.isArray(x.item)&&x.name===segment);
        if(!folder){folder={name:segment,item:[],description:col.folderDocs?.[JSON.stringify(segments)]||''};target.item.push(folder);}
        target=folder;
      }
      target.item.push(exported);
    }
  }
  return root;
}
