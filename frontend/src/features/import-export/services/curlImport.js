/** Parse cURL input without spawning a shell. */
import {EMPTY,safeString,blankDraft,mimeFromHeaders} from './draftFormat.js';
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
export function splitQuery(input){
  const idx=input.indexOf('?');
  if(idx<0)return {url:input,params:[EMPTY()]};
  const hashIdx=input.indexOf('#',idx);
  const query=input.slice(idx+1,hashIdx<0?undefined:hashIdx);
  if(!query.trim())return {url:input,params:[EMPTY()]};
  const rows=[];
  for(const [key,value] of new URLSearchParams(query))rows.push({key,value});
  return {url:input.slice(0,idx)+(hashIdx<0?'':input.slice(hashIdx)),params:rows.length?rows:[EMPTY()]};
}
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
