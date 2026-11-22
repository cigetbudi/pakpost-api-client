/** Shared, side-effect-free draft shape and sanitizers. */
export const EMPTY = () => ({key:'',value:'',description:'',enabled:true});
export const safeString = (x) => String(x ?? '');
export const sanitizeRows = (rows) => Array.isArray(rows) ? rows.filter(x=>x&&typeof x==='object').slice(0,400).map(x=>({key:safeString(x.key),value:safeString(x.value),description:safeString(x.description),enabled:x.enabled!==false,...(x.fileName?{fileName:safeString(x.fileName)}:{})})) : [];
export const named = (key) => /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie|x-signature|x-access-token|x-auth-token|x-client-secret)$/i.test(key);
export const blankDraft = () => ({ method:'GET',url:'',rows:[EMPTY()],body:'',format:'application/json',formFields:[EMPTY()],binaryFile:{name:'',base64:''},preScript:'',postScript:'',documentation:'',responseExamples:[],reqTab:'params',resTab:'body',result:null,params:[EMPTY()],authType:'none',bearerToken:'',basicUsername:'',basicPassword:'',apiKeyName:'X-API-Key',apiKeyValue:'',apiKeyIn:'header',scriptLog:[],scriptTests:[],scriptError:'' });

export function mimeFromHeaders(rows){return rows.find(x=>x.key.toLowerCase()==='content-type')?.value?.split(';')[0]?.trim()?.toLowerCase()||'';}
