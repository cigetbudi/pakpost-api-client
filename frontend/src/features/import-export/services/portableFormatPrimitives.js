/** Shared pure helpers for offline collection formats. Imported data is never executed. */
import {normalizeHoppscotchVariables} from './hoppscotchCompat.js';

export const METHODS=['get','post','put','patch','delete','head','options','trace'];
export const s=value=>String(value??'');
export const obj=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export const list=value=>Array.isArray(value)?value:[];
export const row=(key,value='',description='',enabled=true)=>({key:s(key),value:s(value),description:s(description),enabled:enabled!==false});
export const MAX_REQUESTS=200;
export function trimName(name,fallback='Imported API'){return s(name||fallback).slice(0,120);}
export function toText(value){return normalizeHoppscotchVariables(typeof value==='string'?value:JSON.stringify(value,null,2));}
export function uniqueId(prefix,index){return `${prefix}_pakpost_${index+1}`;}
