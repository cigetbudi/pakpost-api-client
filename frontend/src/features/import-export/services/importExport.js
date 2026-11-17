/** Portable import/export helpers. No shell commands or imported scripts execute here. */
import {sanitizeResponseExamples} from '../../requests/services/responseExamples.js';
import {parseOpenApiCollection,parseInsomniaV4} from './portableFormats.js';
import {parseEnvironmentDocument} from '../../environments/services/environmentImport.js';
const EMPTY = () => ({key:'',value:'',description:'',enabled:true});
const safeString = (x) => String(x ?? '');
const sanitizeRows = (rows) => Array.isArray(rows) ? rows.filter(x=>x&&typeof x==='object').slice(0,400).map(x=>({key:safeString(x.key),value:safeString(x.value),description:safeString(x.description),enabled:x.enabled!==false,...(x.fileName?{fileName:safeString(x.fileName)}:{})})) : [];
const named = (key) => /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie|x-signature|x-access-token|x-auth-token|x-client-secret)$/i.test(key);
export const blankDraft = () => ({ method:'GET',url:'',rows:[EMPTY()],body:'',format:'application/json',formFields:[EMPTY()],binaryFile:{name:'',base64:''},preScript:'',postScript:'',documentation:'',responseExamples:[],reqTab:'params',resTab:'body',result:null,params:[EMPTY()],authType:'none',bearerToken:'',basicUsername:'',basicPassword:'',apiKeyName:'X-API-Key',apiKeyValue:'',apiKeyIn:'header',scriptLog:[],scriptTests:[],scriptError:'' });

/** Tokenizer for pasted cURL commands, never invokes a shell. */
export function shellWords(text) {
  const s=safeString(text).replace(/\\\r?\n/g,'');
  const words=[];let word='',quote='',started=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(quote){
      if(c===quote){quote='';continue;}
      if(quote==='"'&&c==='\\'&&i+1<s.length&&/[$`"\\]/.test(s[i+1])){word+=s[++i];continue;}
      word+=c;continue;
    }
    if(c==='"'||c==="'"){quote=c;started=true;continue;}
    if(c==='\\'&&i+1<s.length){word+=s[++i];started=true;continue;}
    if(/\s/.test(c)){if(started){words.push(word);word='';started=false;}continue;}
    started=true;word+=c;
  }
  if(quote)throw Error('Unclosed quote in cURL command.');
  if(started)words.push(word);
  return words;
}
export function isCurl(text){return /^\s*curl(?:\s|$)/i.test(safeString(text));}
function splitQuery(input){
  const idx=input.indexOf('?');
  if(idx<0)return {url:input,params:[EMPTY()]};
  const hashIdx=input.indexOf('#',idx);
  const query=input.slice(idx+1,hashIdx<0?undefined:hashIdx);
  if(!query.trim())return {url:input,params:[EMPTY()]};
  const rows=[];
  for(const [key,value] of new URLSearchParams(query))rows.push({key,value});
  return {url:input.slice(0,idx)+(hashIdx<0?'':input.slice(hashIdx)),params:rows.length?rows:[EMPTY()]};
}
function mimeFromHeaders(rows){return rows.find(x=>x.key.toLowerCase()==='content-type')?.value?.split(';')[0]?.trim()?.toLowerCase()||'';}
export function parseCurl(input){
  const args=shellWords(input);
  if(!args.length||args[0].toLowerCase()!=='curl')throw Error('Paste a cURL command beginning with curl.');
  let method='',url='',hasBody=false,get=false,bodyParts=[],formFields=[],user='';
  const headers=[];
  const arg=(i,opt)=>{if(i>=args.length)throw Error(`Missing value for ${opt}`);return args[i];};
  for(let i=1;i<args.length;i++){
    const tok=args[i];
    const consume=(prefix)=>tok===prefix?arg(++i,prefix):tok.slice(prefix.length);
    if(tok==='--url'||tok.startsWith('--url=')){url=consume(tok.startsWith('--url=')?'--url=':'--url');continue;}
    if(tok==='-X'||tok==='--request'||tok.startsWith('--request=')||/^-[X][A-Za-z]+$/.test(tok)){method=consume(tok.startsWith('--request=')?'--request=':tok.startsWith('-X')?'-X':'--request').toUpperCase();continue;}
    if(tok==='-H'||tok==='--header'||tok.startsWith('--header=')||(tok.startsWith('-H')&&tok.length>2)){
      const v=consume(tok.startsWith('--header=')?'--header=':tok.startsWith('-H')?'-H':'--header');const k=v.indexOf(':');
      if(k<=0)throw Error('Invalid header in cURL: '+v);
      headers.push({key:v.slice(0,k).trim(),value:v.slice(k+1).trim()});continue;
    }
    if(tok==='-b'||tok==='--cookie'||tok.startsWith('--cookie=')){headers.push({key:'Cookie',value:consume(tok.startsWith('--cookie=')?'--cookie=':tok==='-b'?'-b':'--cookie')});continue;}
    if(tok==='-u'||tok==='--user'||tok.startsWith('--user=')){user=consume(tok.startsWith('--user=')?'--user=':tok==='-u'?'-u':'--user');continue;}
    if(tok==='-G'||tok==='--get'){get=true;continue;}
    if(tok==='--json'){bodyParts.push(arg(++i,tok));hasBody=true;headers.push({key:'Content-Type',value:'application/json'});continue;}
    if(tok==='-d'||tok==='--data'||tok==='--data-raw'||tok==='--data-binary'||tok==='--data-urlencode'||tok.startsWith('--data=')){bodyParts.push(consume(tok.startsWith('--data=')?'--data=':tok));hasBody=true;continue;}
    if(tok==='-F'||tok==='--form'||tok==='--form-string'||tok.startsWith('--form=')){
      const raw=consume(tok.startsWith('--form=')?'--form=':tok), eq=raw.indexOf('=');
      if(eq<0)throw Error('Invalid multipart form field: '+raw);
      const key=raw.slice(0,eq),value=raw.slice(eq+1);
      formFields.push(value.startsWith('@')?{key,value:'',fileName:value.slice(1).split(/[\\/]/).pop()||'file'}:{key,value});hasBody=true;continue;
    }
    if(tok==='--location'||tok==='-L'||tok==='--silent'||tok==='-s'||tok==='--insecure'||tok==='-k'||tok==='--compressed'||tok==='-i'||tok==='--include'||tok==='--globoff'||tok==='--http1.1'||tok==='--http2'||tok==='--no-progress-meter')continue;
    if(tok==='--max-time'||tok==='--connect-timeout'||tok==='--retry'||tok==='-A'||tok==='--user-agent'||tok==='-e'||tok==='--referer'){i++;continue;}
    if(tok.startsWith('-'))throw Error(`Unsupported cURL flag: ${tok}. Remove it before importing.`);
    if(!url)url=tok;else throw Error('Multiple URLs in one cURL command are not supported.');
  }
  if(!url)throw Error('cURL command has no URL.');
  if(!/^https?:\/\//i.test(url)&&!/^\{\{[^{}]+\}\}/.test(url))throw Error('Only HTTP(S) URLs and {{baseUrl}} placeholders are supported.');
  if(user&&typeof btoa==='function')headers.push({key:'Authorization',value:'Basic '+btoa(user)});
  const mime=mimeFromHeaders(headers);
  const draft=blankDraft();draft.method=method||(get?'GET':hasBody?'POST':'GET');
  if(formFields.length){draft.format='multipart/form-data';draft.formFields=formFields;}
  else if(hasBody){
    const body=bodyParts.join('&');
    if(get){url+=(url.includes('?')?'&':'?')+body;}
    else {draft.body=body;draft.format=mime||(body.trim().startsWith('{')||body.trim().startsWith('[')?'application/json':body.includes('=')?'application/x-www-form-urlencoded':'text/plain');
      if(draft.format==='application/x-www-form-urlencoded')draft.formFields=Array.from(new URLSearchParams(body),([key,value])=>({key,value}));}
  }
  const split=splitQuery(url);draft.url=split.url;draft.params=split.params;
  // Content-Type is inferred by the body editor. Keep only one explicit header.
  draft.rows=headers.length?[...headers,EMPTY()]:[EMPTY()];
  draft.name=`${draft.method} ${draft.url.split('/').slice(3).join('/')||'/'}`;
  return draft;
}
function pmUrl(url){if(typeof url==='string')return url;if(!url||typeof url!=='object')return '';return safeString(url.raw||([url.protocol||'https',':','//',(Array.isArray(url.host)?url.host.join('.'):url.host||''),'/',(Array.isArray(url.path)?url.path.join('/'):url.path||'')].join('')));}
function pmScript(events,listen){return (events||[]).filter(e=>e.listen===listen).map(e=>Array.isArray(e.script?.exec)?e.script.exec.join('\n'):safeString(e.script?.exec)).filter(Boolean).join('\n\n');}
function pmBody(body,draft){if(!body)return;
  if(body.mode==='raw'){draft.body=safeString(body.raw);const lang=body.options?.raw?.language;draft.format=mimeFromHeaders(draft.rows)||({json:'application/json',xml:'application/xml',html:'text/html',text:'text/plain',javascript:'text/plain'}[lang]||'text/plain');}
  else if(body.mode==='urlencoded'||body.mode==='formdata'){
    draft.format=body.mode==='urlencoded'?'application/x-www-form-urlencoded':'multipart/form-data';
    draft.formFields=(body[body.mode]||[]).filter(v=>!v.disabled).map(v=>({key:safeString(v.key),value:safeString(v.value),...(v.type==='file'?{fileName:Array.isArray(v.src)?v.src[0]:safeString(v.src)}:{})}));
  }else if(body.mode==='file'){draft.format='application/octet-stream';draft.binaryFile={name:safeString(body.file?.src),base64:''};}
}
export function parsePostmanCollection(doc){
  if(!doc||!Array.isArray(doc.item)||!doc.info)throw Error('Not a Postman Collection (requires info and item).');
  const result=[];
  const walk=(items,folder='',parentAuth=doc.auth,folderPath=[])=>{
    for(const item of items){
      if(item.item){const name=safeString(item.name);walk(item.item,folder?folder+' / '+name:name,item.auth??parentAuth,[...folderPath,name]);continue;}
      if(!item.request)continue;
      const req=typeof item.request==='string'?{url:item.request,method:'GET'}:item.request;
      const draft=blankDraft();draft.name=(folder?folder+' / ':'')+safeString(item.name||'Imported request');
      draft.requestName=safeString(item.name||'Imported request');
      draft.folderPath=folderPath;
      draft.method=safeString(req.method||'GET').toUpperCase();
      const rawUrl=pmUrl(req.url);
      const clean=splitQuery(rawUrl);draft.url=clean.url;
      draft.params=Array.isArray(req.url?.query)?req.url.query.map(q=>({key:safeString(q.key),value:safeString(q.value),description:safeString(q.description),enabled:q.disabled!==true})):(clean.params||[EMPTY()]);
      let headerArr=Array.isArray(req.header)?req.header:typeof req.header==='string'?req.header.split(/\r?\n/).filter(Boolean).map(x=>({key:x.split(':')[0],value:x.slice(x.indexOf(':')+1)})):[];
      draft.rows=[...sanitizeRows(headerArr.map(x=>({...x,enabled:x.disabled!==true}))),EMPTY()];
      pmBody(req.body,draft);
      const auth=req.auth===undefined?parentAuth:req.auth;
      if(auth?.type==='bearer'){
        draft.authType='bearer';draft.bearerToken=safeString((auth.bearer||[]).find?.(x=>x.key==='token')?.value||auth.bearer?.token||'');
      }else if(auth?.type==='basic'){
        draft.authType='basic';draft.basicUsername=safeString((auth.basic||[]).find?.(x=>x.key==='username')?.value||'');draft.basicPassword=safeString((auth.basic||[]).find?.(x=>x.key==='password')?.value||'');
      }else if(auth?.type==='apikey'){
        draft.authType='apiKey';
        const items=auth.apikey||[];
        draft.apiKeyName=safeString(items.find?.(x=>x.key==='key')?.value||'X-API-Key');
        draft.apiKeyValue=safeString(items.find?.(x=>x.key==='value')?.value||'');
        draft.apiKeyIn=String(items.find?.(x=>x.key==='in')?.value||'header').toLowerCase()==='query'?'query':'header';
      }
      draft.preScript=pmScript(item.event,'prerequest');draft.postScript=pmScript(item.event,'test');draft.documentation=safeString(req.description||item.description);draft.responseExamples=parsePmResponses(item.response);
      result.push(draft);
      if(result.length>200)throw Error('Import limit: maximum 200 requests.');
    }
  };
  walk(doc.item);
  if(!result.length)throw Error('The collection contains no HTTP requests.');
  return result;
}
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
function parsePmResponses(list){
  if(!Array.isArray(list))return [];
  return sanitizeResponseExamples(list.map((item,index)=>({
    id:`pm-${index}-${String(item?.name||'example').replace(/\s+/g,'-').toLowerCase()}`,
    name:safeString(item?.name||item?.status||`Example ${index+1}`),
    statusCode:Number(item?.code||0)||0,
    reasonPhrase:safeString(item?.status||''),
    headers:Array.isArray(item?.header)?Object.fromEntries(item.header.map(x=>[safeString(x.key),safeString(x.value)])): {},
    body:safeString(item?.body||''),
    contentType:Array.isArray(item?.header)?safeString(item.header.find(x=>String(x.key).toLowerCase()==='content-type')?.value||''):'',
    description:'',
    elapsedMs:0,
    isBinary:false,
    truncated:false
  })));
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
export function parseSession(doc){
  if(!doc||doc.format!=='pakpost-workbench-session'||doc.version!==1||!Array.isArray(doc.requests))throw Error('Not a Pakpost session export.');
  if(doc.requests.length>200)throw Error('Import limit: maximum 200 requests.');
  return {requests:doc.requests.map(d=>({...blankDraft(),...d,rows:sanitizeRows(d.rows),params:sanitizeRows(d.params),formFields:sanitizeRows(d.formFields)})),environments:Array.isArray(doc.environments)?doc.environments.slice(0,100):[]};
}
export function createSessionExport(drafts,environments,{includeSecrets=false}={}){
  return {format:'pakpost-workbench-session',version:1,exportedAt:new Date().toISOString(),requests:drafts.map(d=>safeExportDraft(d,includeSecrets)),environments:environments.map(env=>({name:env.name,variables:(env.variables||[]).map(v=>({key:v.key,value:v.isSecret&&!includeSecrets?'':v.value,isSecret:!!v.isSecret}))}))};
}
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
  if(Array.isArray(data?.item)){const requests=parsePostmanCollection(data);return {requests,environments:[],kind:'postman',collections:[{name:safeString(data.info?.name||'Imported collection'),documentation:safeString(data.info?.description),folderDocs:postmanFolderDocs(data.item),variables:(Array.isArray(data.variable)?data.variable:[]).filter(v=>v?.key).slice(0,100).map(v=>({key:safeString(v.key),value:safeString(v.value),isSecret:v.type==='secret'})),requests}]};}
  throw Error('Unsupported file. Use Hoppscotch/Postman/Insomnia environment JSON, OpenAPI 3.1 JSON, Postman v2.1, Pakpost session, or cURL.');
}

/** Extract folder-level description into stable relative-path keys. */
export function postmanFolderDocs(items,base=[],out={}){
  for(const node of items||[]){
    if(!Array.isArray(node?.item))continue;
    const path=[...base,safeString(node.name)];
    if(node.description)out[JSON.stringify(path)]=safeString(node.description);
    postmanFolderDocs(node.item,path,out);
  }
  return out;
}

/** Preserve nested imported Postman folders when exporting local collections. */
export function createLocalPostmanExport(collections,{includeSecrets=false}={}){
  const root=createPostmanCollection([],{name:'Pakpost local collections',includeSecrets});
  for(const col of collections||[]){
    const parent={name:col.name,description:col.documentation||'',item:[],variable:(col.variables||[]).map(v=>({key:v.key,value:v.isSecret&&!includeSecrets?'':v.value,type:v.isSecret?'secret':'string'}))};root.item.push(parent);
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
