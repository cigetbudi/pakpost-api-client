/** Offline environment import. Never evaluates scripts, uploads input, or resolves remote URLs. */
import {normalizeHoppscotchVariables} from './hoppscotchCompat.js';

const text=value=>String(value??'');
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const MAX_ENVIRONMENTS=50;
const MAX_VARIABLES=100;
const MAX_VALUE_LENGTH=8192;

function normalizeEnvironment(env){
  const variables=(Array.isArray(env.variables)?env.variables:[]).filter(v=>v&&text(v.key).trim()).map(variable=>({
    key:text(variable.key).trim(),
    value:normalizeHoppscotchVariables(variable.value).replace(/\{\{\s*_\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,'{{$1}}'),
    isSecret:!!variable.isSecret
  }));
  if(variables.length>MAX_VARIABLES)throw Error(`Environment has more than ${MAX_VARIABLES} variables.`);
  const seen=new Set();
  for(const variable of variables){
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.key))throw Error(`Unsupported variable key: ${variable.key}. Use letters, numbers and underscore.`);
    if(seen.has(variable.key.toLowerCase()))throw Error(`Duplicate variable key: ${variable.key}.`);
    if(variable.value.length>MAX_VALUE_LENGTH)throw Error(`Value is too long for variable: ${variable.key}.`);
    seen.add(variable.key.toLowerCase());
  }
  return {name:text(env.name||'Imported environment').slice(0,120),variables};
}
const prepared=items=>{
  if(items.length>MAX_ENVIRONMENTS)throw Error(`Too many environments (maximum ${MAX_ENVIRONMENTS}).`);
  return items.map(normalizeEnvironment);
};

/** Returns null for non-environment documents, rather than accepting arbitrary JSON. */
export function parseEnvironmentDocument(data){
  const doc=object(data);
  // Native Hoppscotch JSON: {id,v,name,variables:[{key,initialValue,currentValue,secret}]}.
  if(Array.isArray(doc.variables)&&doc.variables.every(variable=>variable&&typeof variable==='object')&&
    (doc.variables.some(variable=>Object.hasOwn(variable,'initialValue')||Object.hasOwn(variable,'currentValue')||Object.hasOwn(variable,'secret')) || (doc.v!=null&&doc.name))){
    const variables=doc.variables.map(variable=>({
      key:variable.key,
      // An unset current value falls back to Hoppscotch's initial value.
      value:variable.currentValue!=null&&text(variable.currentValue)!==''?variable.currentValue:variable.initialValue??'',
      isSecret:variable.secret===true
    }));
    return prepared([{name:doc.name||'Hoppscotch environment',variables}]);
  }
  // Postman Environment v2.1 (disabled values are intentionally not imported).
  if(Array.isArray(doc.values)&&doc.values.every(variable=>variable&&typeof variable==='object')){
    return prepared([{name:doc.name||'Postman environment',variables:doc.values.filter(v=>v.enabled!==false).map(v=>({
      key:v.key,value:v.value??'',isSecret:v.type==='secret'||v.isSecret===true
    }))}]);
  }
  // Pakpost's OpenAPI environment export uses a vendor extension, not standard OpenAPI.
  if(doc.openapi&&doc['x-pakpost-environment']){
    const ext=object(doc['x-pakpost-environment']);
    return prepared([{name:ext.name||'OpenAPI environment',variables:(Array.isArray(ext.variables)?ext.variables:[]).map(v=>({
      key:v.key,value:v.value??'',isSecret:v.secret===true
    }))}]);
  }
  // Native Pakpost session may contain several environments.
  if(doc.format==='pakpost-workbench-session'&&Array.isArray(doc.environments)){
    return prepared(doc.environments.map(e=>({name:e.name,variables:e.variables||[]})));
  }
  // Insomnia v4 JSON: environment resources, optionally embedded in a collection export.
  if(doc.__export_format===4&&Array.isArray(doc.resources)){
    const envs=doc.resources.filter(r=>r?._type==='environment'&&r.data&&typeof r.data==='object'&&!Array.isArray(r.data));
    if(envs.length)return prepared(envs.map(e=>({name:e.name||'Insomnia environment',variables:Object.entries(e.data).map(([key,value])=>({
      key,value:typeof value==='string'?value:JSON.stringify(value),isSecret:false
    }))})));
  }
  return null;
}

/** Preserve the imported names, avoiding overwrite of similarly named environments. */
export function uniqueEnvironmentImports(imported,existing=[]){
  const used=new Set(existing.map(x=>text(x.name).toLowerCase()));
  return imported.map(env=>{
    const base=text(env.name||'Imported environment').trim().slice(0,120)||'Imported environment';
    let name=base,index=2;
    while(used.has(name.toLowerCase()))name=`${base.slice(0,104)} (${index++})`;
    used.add(name.toLowerCase());
    return {...env,name};
  });
}
