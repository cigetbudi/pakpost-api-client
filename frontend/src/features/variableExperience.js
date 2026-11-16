import {splitUrlVariables} from './urlSuggestions.js';

const SECRET_NAME=/(token|passwd|password|secret|authorization|credential|bearer|jwt|api[_-]?key|private[_-]?key)/i;
export const isSensitiveVariable=(key,definition={})=>Boolean(definition?.isSecret)||SECRET_NAME.test(String(key||''));

/** The source of truth remains the active environment used by requestTools.resolveVars. */
export function variableDescriptors(text,values={},definitions=[]) {
  const details=new Map((definitions||[]).filter(v=>v?.key).map(v=>[v.key,v]));
  return splitUrlVariables(text,values).map(part=>{
    if(!part.key)return part;
    const definition=details.get(part.key);
    const restricted=Boolean(definition?.isRedacted);
    const defined=Object.prototype.hasOwnProperty.call(values,part.key)&&!restricted;
    return {...part,type:restricted?'restricted':defined?'known':'missing',
      sensitive:isSensitiveVariable(part.key,definition),value:defined?String(values[part.key]??''):null};
  });
}

export function putEnvironmentVariable(variables,key,value){
  const normalized=String(key??'').trim();
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized))throw Error('Invalid variable name');
  const list=Array.isArray(variables)?variables:[];
  const original=list.find(v=>v.key===normalized);
  if(original?.isRedacted)throw Error('Restricted variable cannot be edited');
  const next={...(original||{}),key:normalized,value:String(value??''),
    isSecret:original?.isSecret??isSensitiveVariable(normalized)};
  return original?list.map(v=>v.key===normalized?next:v):[...list,next];
}
