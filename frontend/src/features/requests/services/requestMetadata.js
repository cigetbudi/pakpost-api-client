/** Metadata stored alongside saved headers in the existing JSONB object.
 * The reserved key is NEVER a transport header and is removed before editing/sending.
 * This preserves workspace request descriptions/disabled rows without a DB migration.
 */
import {sanitizeResponseExamples} from './responseExamples.js';
import {restoredAuthMetadata,workspaceAuthMetadata} from './authorization.js';

export const META_KEY = '__pakpost_request_meta_v1__';
export const emptyRow = () => ({key:'',value:'',description:'',enabled:true});
export const isEnabled = row => row?.enabled !== false;
export const cleanRows = rows => Array.isArray(rows) ? rows.filter(r=>r&&typeof r==='object').slice(0,400).map(r=>({
  key:String(r.key??''),value:String(r.value??''),description:String(r.description??''),enabled:isEnabled(r)
})) : [];
export const activeRows = rows => cleanRows(rows).filter(r=>r.enabled&&r.key.trim());
export function encodeStoredHeaders(headers,params=[],documentation='',responseExamples=[],auth=null) {
  const rows=cleanRows(headers);
  const obj=Object.fromEntries(rows.filter(r=>r.enabled&&r.key.trim()&&r.key!==META_KEY).map(r=>[r.key.trim(),r.value]));
  // JSON object format required by current Pakpost DDD validator.
  obj[META_KEY]={
    version:auth ? 3 : 2,
    headers:rows.filter(r=>r.key!==META_KEY),
    params:cleanRows(params),
    documentation:String(documentation||'').slice(0,16000),
    responseExamples:sanitizeResponseExamples(responseExamples),
    ...(auth?{auth:workspaceAuthMetadata(auth)}:{})
  };
  return JSON.stringify(obj);
}
export function decodeStoredHeaders(raw) {
  let parsed;
  try {parsed=typeof raw==='string'?JSON.parse(raw||'{}'):(raw||{});} catch {parsed={};}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))parsed={};
  const { [META_KEY]:meta,...headerMap }=parsed;
  const legacy=Object.entries(headerMap).filter(([key])=>key!==META_KEY).map(([key,value])=>({key,value:String(value??''),description:'',enabled:true}));
  const version=Number(meta?.version||0);
  const withMeta=(version===1||version===2||version===3)&&Array.isArray(meta?.headers);
  return {
    headers:(withMeta?cleanRows(meta.headers):legacy),
    params:withMeta&&Array.isArray(meta?.params)?cleanRows(meta.params):[],
    documentation:withMeta?String(meta.documentation??''):'',
    responseExamples:version>=2?sanitizeResponseExamples(meta?.responseExamples):[],
    auth:version>=3?restoredAuthMetadata(meta?.auth):restoredAuthMetadata()
  };
}
