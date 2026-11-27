/** Postman Collection v2.1 import; preserves folders, auth and examples. */
import {EMPTY,safeString,sanitizeRows,blankDraft,mimeFromHeaders} from './draftFormat.js';
import {splitQuery} from './curlImport.js';
import {sanitizeResponseExamples} from '../../requests/services/responseExamples.js';
function pmUrl(url){if(typeof url==='string')return url;if(!url||typeof url!=='object')return '';return safeString(url.raw||([url.protocol||'https',':','//',(Array.isArray(url.host)?url.host.join('.'):url.host||''),'/',(Array.isArray(url.path)?url.path.join('/'):url.path||'')].join('')));}
export function pmScript(events,listen){return (Array.isArray(events)?events:[]).filter(e=>e?.listen===listen&&e.disabled!==true).map(e=>Array.isArray(e.script?.exec)?e.script.exec.join('\n'):safeString(e.script?.exec)).filter(Boolean).join('\n\n');}
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
