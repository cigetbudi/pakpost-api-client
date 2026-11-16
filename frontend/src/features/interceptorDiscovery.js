/** Find API origins without ever passing request paths, environment values, or credentials to the addon.
 * The addon still requires explicit user review and browser host permission before it can use them.
 */
const VAR=/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}|<<\s*([A-Za-z0-9_.-]+)\s*>>/g;
const MAX_CANDIDATES=96;
const MAX_INPUTS=1500;

export function destinationOrigin(input,variables={}){
  let url=String(input||'').trim();
  if(!url||url.length>4096)return '';
  for(let pass=0;pass<5;pass++){
    const expanded=url.replace(VAR,(match,a,b)=>{
      const key=a||b;
      if(!Object.prototype.hasOwnProperty.call(variables,key))return match;
      const value=variables[key];
      return typeof value==='string'?value:match;
    });
    if(expanded===url)break;
    url=expanded;
  }
  try{
    const parsed=new URL(url);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||!parsed.hostname)return '';
    // An unresolved placeholder in the authority is not a valid destination.
    if(/[{}<>]/.test(parsed.host))return '';
    return parsed.origin;
  }catch{return ''}
}

function variableMap(environment){
  const values={};
  for(const item of environment?.variables||[]){
    if(!item||item.isSecret||item.isRedacted||item.enabled===false||typeof item.key!=='string'||typeof item.value!=='string')continue;
    if(item.key.length<=100&&item.value.length<=4096)values[item.key]=item.value;
  }
  return values;
}

export function discoverApiDestinations({url='',openTabs=[],drafts={},localCollections=[],workspaceRequestLists={},localEnvironments=[],workspaceEnvironments=[]}={}){
  const environments=[...localEnvironments,...workspaceEnvironments];
  const maps=[{},...environments.map(variableMap)];
  const candidates=[];
  const add=value=>{if(typeof value==='string'&&value.trim())candidates.push(value)};
  add(url);
  for(const tab of openTabs||[]){add(tab?.url);add(drafts?.[tab?.id]?.url)}
  for(const collection of localCollections||[])for(const request of collection?.requests||[])add(request?.url);
  for(const requests of Object.values(workspaceRequestLists||{}))for(const request of requests||[])add(request?.url);
  // Environment values are considered only as URL candidates. Non-URL secrets are never returned.
  for(const environment of environments)for(const variable of environment?.variables||[]){
    if(variable?.isSecret||variable?.isRedacted||variable?.enabled===false)continue;
    if(typeof variable?.value==='string'&&/^https?:\/\//i.test(variable.value.trim()))add(variable.value);
  }
  const found=new Set();
  for(const value of candidates.slice(0,MAX_INPUTS)){
    for(const vars of maps){
      const host=destinationOrigin(value,vars);
      if(host)found.add(host);
      if(found.size>=MAX_CANDIDATES)return [...found].sort();
    }
  }
  return [...found].sort();
}
