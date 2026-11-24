// Pure, small field-level merge helpers. No secret-bearing request body is logged,
// persisted by the comparison UI, or embedded in a diff report.
export const REQUEST_MERGE_GROUPS = [
  {key:'name',label:'Request name'},
  {key:'method',label:'HTTP method'},
  {key:'url',label:'URL'},
  {key:'rows',label:'Headers'},
  {key:'params',label:'Query params'},
  {key:'body',label:'Body'},
  {key:'format',label:'Body format'},
  {key:'formFields',label:'Form fields'},
  {key:'auth',label:'Authorization'},
  {key:'preScript',label:'Pre-request script'},
  {key:'postScript',label:'Post-response script'},
  {key:'documentation',label:'Documentation'},
  {key:'responseExamples',label:'Response examples'},
];
export const AUTH_FIELDS = ['authType','bearerToken','basicUsername','basicPassword','apiKeyName','apiKeyValue','apiKeyIn'];
export function mergeFieldValue(source,key){
  if(key==='auth')return AUTH_FIELDS.map(field=>source?.[field]??'');
  if(key==='rows'||key==='params'||key==='formFields'){
    // Ignore trailing empty template row(s) shown by the editor.
    const rows=Array.isArray(source?.[key])?source[key]:[];
    return rows.filter(x=>x && (x.key||x.value||x.fileName||x.fileBase64));
  }
  return source?.[key]??'';
}
export function fieldSame(a,b,key){return JSON.stringify(mergeFieldValue(a,key))===JSON.stringify(mergeFieldValue(b,key));}
export function compareRequestVersions(local={},remote={},base=null){
  return REQUEST_MERGE_GROUPS.map(group=>{
    const same=fieldSame(local,remote,group.key);
    const yourChange=base? !fieldSame(local,base,group.key):null;
    const cloudChange=base? !fieldSame(remote,base,group.key):null;
    return {...group,same,yourChange,cloudChange,
      conflict:!!(base&&yourChange&&cloudChange&&!same),
      suggestedCloud:!!(base&&!yourChange&&cloudChange)};
  });
}
export function applyFieldMerge(local={},remote={},chosen=[]){
  const next={...local};const allowed=new Set(REQUEST_MERGE_GROUPS.map(f=>f.key));
  for(const key of chosen){
    if(!allowed.has(key))continue;
    if(key==='auth'){
      for(const name of AUTH_FIELDS)next[name]=remote?.[name]??'';
    }else next[key]=remote?.[key];
  }
  return next;
}
// This comparison deliberately shows complete request values on user request.
// Authorization alone remains hidden. Rendering occurs only inside the local UI;
// previews are never written to logs or sent to an external service.
export function safeVersionSummary(field,value){
  if(field==='auth')return 'Authorization hidden';
  if(value===null||value===undefined||value==='')return '—';
  if(typeof value==='string'){
    if(['body','responseExamples','documentation'].includes(field)){
      try{return JSON.stringify(JSON.parse(value),null,2);}catch{/* Keep raw input. */}
    }
    return value;
  }
  if(typeof value==='object'){
    try{return JSON.stringify(value,null,2);}catch{return String(value);}
  }
  return String(value);
}
