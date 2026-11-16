/** Outgoing authentication. Credentials are resolved only at send time. */
import {resolveVars} from './requestTools.js';

export const AUTH_TYPES=['none','bearer','basic','apiKey'];
export const AUTH_OPTIONS=[
  {value:'none',label:'No Auth'},
  {value:'bearer',label:'Bearer Token'},
  {value:'basic',label:'Basic Auth'},
  {value:'apiKey',label:'API Key'}
];
const TEMPLATE=/^\{\{\s*[A-Za-z_]\w*\s*\}\}$/;
const HEADER_NAME=/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
export const AUTH_DEFAULTS=Object.freeze({
  authType:'none',bearerToken:'',basicUsername:'',basicPassword:'',
  apiKeyName:'X-API-Key',apiKeyValue:'',apiKeyIn:'header'
});

const trimmed=(value)=>String(value??'').trim();
const resolved=(value,vars)=>resolveVars(String(value??''),vars).value;
function setHeader(headers,key,value){
  for(const previous of Object.keys(headers||{}))if(previous.toLowerCase()===key.toLowerCase())delete headers[previous];
  headers[key]=value;
}
function basicCredentials(username,password){
  const bytes=new TextEncoder().encode(`${username}:${password}`);
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary);
}

/** Returns the same command object with the chosen auth method applied. */
export function applyAuthorization(command,auth={},variables={}){
  const next={...command,headers:{...(command.headers||{})}};
  const kind=AUTH_TYPES.includes(auth.authType)?auth.authType:'none';
  if(kind==='bearer'&&trimmed(auth.bearerToken)){
    setHeader(next.headers,'Authorization',`Bearer ${resolved(trimmed(auth.bearerToken),variables)}`);
  }
  if(kind==='basic'&&(auth.basicUsername||auth.basicPassword)){
    const username=resolved(auth.basicUsername,variables);
    const password=resolved(auth.basicPassword,variables);
    setHeader(next.headers,'Authorization',`Basic ${basicCredentials(username,password)}`);
  }
  if(kind==='apiKey'){
    const name=trimmed(auth.apiKeyName);
    const value=trimmed(auth.apiKeyValue);
    if(!name||!value)return next;
    const resolvedName=resolved(name,variables);
    if(auth.apiKeyIn==='query'){
      const target=new URL(next.url);
      target.searchParams.set(resolvedName,resolved(value,variables));
      next.url=target.toString();
    }else{
      if(!HEADER_NAME.test(resolvedName))throw Error('Invalid API Key header name');
      setHeader(next.headers,resolvedName,resolved(value,variables));
    }
  }
  return next;
}

/** Workspace metadata may only contain variable references for secret fields.
 * This intentionally fails rather than silently persisting plaintext secrets to Neon.
 */
export function workspaceAuthMetadata(auth={}){
  const kind=AUTH_TYPES.includes(auth.authType)?auth.authType:'none';
  const kept={authType:kind};
  const secret=(value,label)=>{
    const candidate=trimmed(value);
    if(candidate&&!TEMPLATE.test(candidate))throw Error(`${label} must use a {{variable}} before saving to a workspace.`);
    return candidate;
  };
  if(kind==='bearer')kept.bearerToken=secret(auth.bearerToken,'Bearer token');
  if(kind==='basic'){
    kept.basicUsername=trimmed(auth.basicUsername).slice(0,200);
    kept.basicPassword=secret(auth.basicPassword,'Basic password');
  }
  if(kind==='apiKey'){
    kept.apiKeyName=trimmed(auth.apiKeyName).slice(0,120)||'X-API-Key';
    kept.apiKeyIn=auth.apiKeyIn==='query'?'query':'header';
    kept.apiKeyValue=secret(auth.apiKeyValue,'API Key value');
  }
  return kept;
}

export function restoredAuthMetadata(metadata={}){
  const kind=AUTH_TYPES.includes(metadata.authType)?metadata.authType:'none';
  // Ignore literal secret values from modified/untrusted metadata.
  const variableOnly=value=>TEMPLATE.test(trimmed(value))?trimmed(value):'';
  return {
    ...AUTH_DEFAULTS,authType:kind,
    bearerToken:variableOnly(metadata.bearerToken),
    basicUsername:trimmed(metadata.basicUsername).slice(0,200),
    basicPassword:variableOnly(metadata.basicPassword),
    apiKeyName:trimmed(metadata.apiKeyName).slice(0,120)||'X-API-Key',
    apiKeyIn:metadata.apiKeyIn==='query'?'query':'header',
    apiKeyValue:variableOnly(metadata.apiKeyValue)
  };
}
