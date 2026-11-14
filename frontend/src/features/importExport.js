/** Portable import/export helpers. No shell commands or imported scripts execute here. */
const EMPTY = () => ({key:'',value:''});
const safeString = (x) => String(x ?? '');
const sanitizeRows = (rows) => Array.isArray(rows) ? rows.filter(x=>x&&typeof x==='object').slice(0,400).map(x=>({key:safeString(x.key),value:safeString(x.value),...(x.fileName?{fileName:safeString(x.fileName)}:{})})) : [];
const named = (key) => /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie|x-signature|x-access-token|x-auth-token|x-client-secret)$/i.test(key);
export const blankDraft = () => ({ method:'GET',url:'',rows:[EMPTY()],body:'',format:'application/json',formFields:[EMPTY()],binaryFile:{name:'',base64:''},preScript:'',postScript:'',reqTab:'params',resTab:'body',result:null,params:[EMPTY()],authType:'none',bearerToken:'',scriptLog:[],scriptTests:[],scriptError:'' });

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
  const walk=(items,folder='',parentAuth=doc.auth)=>{
    for(const item of items){
      if(item.item){walk(item.item,folder?folder+' / '+safeString(item.name):safeString(item.name),item.auth??parentAuth);continue;}
      if(!item.request)continue;
      const req=typeof item.request==='string'?{url:item.request,method:'GET'}:item.request;
      const draft=blankDraft();draft.name=(folder?folder+' / ':'')+safeString(item.name||'Imported request');
      draft.method=safeString(req.method||'GET').toUpperCase();
      const rawUrl=pmUrl(req.url);
      const clean=splitQuery(rawUrl);draft.url=clean.url;
      draft.params=Array.isArray(req.url?.query)?req.url.query.filter(q=>!q.disabled).map(q=>({key:safeString(q.key),value:safeString(q.value)})):(clean.params||[EMPTY()]);
      let headerArr=Array.isArray(req.header)?req.header:typeof req.header==='string'?req.header.split(/\r?\n/).filter(Boolean).map(x=>({key:x.split(':')[0],value:x.slice(x.indexOf(':')+1)})):[];
      draft.rows=[...sanitizeRows(headerArr.filter(x=>!x.disabled)),EMPTY()];
      pmBody(req.body,draft);
      const auth=req.auth===undefined?parentAuth:req.auth;
      if(auth?.type==='bearer'){
        draft.authType='bearer';draft.bearerToken=safeString((auth.bearer||[]).find?.(x=>x.key==='token')?.value||auth.bearer?.token||'');
      }
      draft.preScript=pmScript(item.event,'prerequest');draft.postScript=pmScript(item.event,'test');
      result.push(draft);
      if(result.length>200)throw Error('Import limit: maximum 200 requests.');
    }
  };
  walk(doc.item);
  if(!result.length)throw Error('The collection contains no HTTP requests.');
  return result;
}
function pmEvent(listen,code){return {listen,script:{type:'text/javascript',exec:code.split('\n')}};}
export function safeExportDraft(draft,includeSecrets=false){
  const copy={...blankDraft(),...draft,rows:sanitizeRows(draft.rows),params:sanitizeRows(draft.params),formFields:sanitizeRows(draft.formFields),binaryFile:{name:draft.binaryFile?.name||'',base64:''},result:null,scriptLog:[],scriptTests:[],scriptError:''};
  if(!includeSecrets){copy.rows=copy.rows.map(r=>({...r,value:named(r.key)?'{{REDACTED}}':r.value}));copy.bearerToken=copy.bearerToken?'{{REDACTED}}':'';}
  return copy;
}
export function createPostmanCollection(drafts,{includeSecrets=false,name='Pakpost requests'}={}){
  const items=drafts.map(d=>{
    const r=safeExportDraft(d,includeSecrets);
    const request={method:r.method||'GET',header:r.rows.filter(x=>x.key).map(x=>({key:x.key,value:x.value,type:'text'})),url:{raw:r.url+(r.params.filter(x=>x.key).length?(r.url.includes('?')?'&':'?')+new URLSearchParams(r.params.filter(x=>x.key).map(x=>[x.key,x.value])).toString():'') ,query:r.params.filter(x=>x.key).map(x=>({key:x.key,value:x.value}))},description:'Exported from Pakpost'};
    if(r.authType==='bearer'&&r.bearerToken)request.auth={type:'bearer',bearer:[{key:'token',value:r.bearerToken,type:'string'}]};
    if(r.format==='multipart/form-data')request.body={mode:'formdata',formdata:r.formFields.filter(x=>x.key).map(x=>({key:x.key,...(x.fileName?{type:'file',src:x.fileName}:{type:'text',value:x.value})}))};
    else if(r.format==='application/x-www-form-urlencoded')request.body={mode:'urlencoded',urlencoded:r.formFields.filter(x=>x.key).map(x=>({key:x.key,value:x.value,type:'text'}))};
    else if(r.format==='application/octet-stream')request.body={mode:'file',file:{src:r.binaryFile?.name||''}};
    else if(r.body)request.body={mode:'raw',raw:r.body,options:{raw:{language:r.format.includes('json')?'json':r.format.includes('xml')?'xml':'text'}}};
    return {name:r.name||`${r.method} ${r.url}`,request,event:[r.preScript&&pmEvent('prerequest',r.preScript),r.postScript&&pmEvent('test',r.postScript)].filter(Boolean)};
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
  let data;try{data=JSON.parse(text);}catch{throw Error('Invalid JSON. Paste cURL or choose a Pakpost/Postman JSON export.');}
  if(data?.format==='pakpost-workbench-session')return {...parseSession(data),kind:'pakpost'};
  if(Array.isArray(data?.item))return {requests:parsePostmanCollection(data),environments:[],kind:'postman'};
  if(Array.isArray(data?.values))return {requests:[],environments:[{name:data.name||'Imported environment',variables:data.values.filter(v=>v.enabled!==false).map(v=>({key:safeString(v.key),value:safeString(v.value),isSecret:v.type==='secret'}))}],kind:'environment'};
  throw Error('Unsupported file. Use a Postman v2.1 collection, Postman environment, Pakpost session, or cURL.');
}
