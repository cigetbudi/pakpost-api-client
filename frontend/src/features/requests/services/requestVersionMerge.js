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
// No raw values in the diff UI: URLs can contain query tokens and scripts/body
// can contain credentials. Users review each version in their regular editor.
export function safeVersionSummary(field,value){
  if(field==='method' || field==='name')return String(value??'').slice(0,110);
  if(field==='format')return String(value??'').slice(0,100);
  return 'Content hidden — may contain credentials';
}
