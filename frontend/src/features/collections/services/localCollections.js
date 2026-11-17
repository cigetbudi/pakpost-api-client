/** Browser-local imported collections. Nothing is sent to a remote workspace. */
import {blankDraft, safeExportDraft} from '../../import-export/services/importExport.js';
import {validateCollectionVariableRows} from './collectionVariableSession.js';

const LIVE='pakpost_v5_collections_live';
const FALLBACK='pakpost_v5_collections_recovery';
const MAX_COLLECTIONS=60;
const MAX_REQUESTS=500;
const MAX_BYTES=2*1024*1024;
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`local-${Math.random().toString(36).slice(2)}`;

export function toLocalCollection(source,idFactory=uid){
  const requests=(source?.requests||[]).map(r=>({
    ...blankDraft(),...r,
    id:idFactory(),
    requestName:String(r.requestName||r.name||'Imported Request'),
    folderPath:Array.isArray(r.folderPath)?r.folderPath.map(String):[],
    // Imported files store metadata only; never persist bytes.
    binaryFile:{name:r.binaryFile?.name||'',base64:''},
    formFields:(r.formFields||[]).map(f=>({...f,fileBase64:undefined})),
    responseExamples:(r.responseExamples||[]).map(example=>({...example,headers:{...(example.headers||{})}})),
    result:null,scriptLog:[],scriptTests:[],scriptError:'',
  }));
  return {id:idFactory(),name:String(source?.name||'Imported collection'),variables:(source?.variables||[]).map(v=>({key:String(v.key||''),value:String(v.value||''),isSecret:!!v.isSecret})),documentation:String(source?.documentation||''),folderDocs:{...(source?.folderDocs||{})},requests};
}

export function validateLibrary(collections){
  if(!Array.isArray(collections)||collections.length>MAX_COLLECTIONS)throw Error(`Maximum ${MAX_COLLECTIONS} local collections.`);
  if(collections.reduce((total,c)=>total+(c.requests||[]).length,0)>MAX_REQUESTS)throw Error(`Maximum ${MAX_REQUESTS} local requests.`);
  for(const collection of collections)validateCollectionVariableRows(collection.variables||[]);
  return collections;
}

export function makeCollectionTree(requests){
  const root={folders:[],requests:[]};
  for(const request of requests||[]){
    let node=root;
    for(const segment of request.folderPath||[]){
      let folder=node.folders.find(f=>f.name===segment);
      if(!folder){folder={name:segment,folders:[],requests:[]};node.folders.push(folder);}
      node=folder;
    }
    node.requests.push(request);
  }
  return root;
}

export function filterCollectionTree(tree,search){
  const term=String(search||'').trim().toLowerCase();
  if(!term)return tree;
  const visit=node=>({
    requests:node.requests.filter(r=>`${r.requestName||r.name} ${r.method} ${r.url}`.toLowerCase().includes(term)),
    folders:node.folders.map(f=>f.name.toLowerCase().includes(term)?f:{name:f.name,...visit(f)})
      .filter(f=>f.name.toLowerCase().includes(term)||f.requests.length||f.folders.length),
  });
  return visit(tree);
}

export function readLocalCollections(){
  if(typeof sessionStorage==='undefined')return [];
  for(const [store,key] of [[sessionStorage,LIVE],[localStorage,FALLBACK]]){
    try{
      const data=JSON.parse(store.getItem(key)||'null');
      if(data?.version===1&&Array.isArray(data.collections))return validateLibrary(data.collections);
    }catch{/* Storage disabled, corrupt, or over limits. */}
  }
  return [];
}

export function writeLocalCollections(collections){
  try{
    validateLibrary(collections);
    const normalized=collections.map(c=>({...c,requests:c.requests.map(r=>({...r,
      binaryFile:{name:r.binaryFile?.name||'',base64:''},
      formFields:(r.formFields||[]).map(f=>({...f,fileBase64:undefined})),
      responseExamples:(r.responseExamples||[]).map(example=>({...example,headers:{...(example.headers||{})}})),
      result:null,scriptLog:[],scriptTests:[],scriptError:''
    }))}));
    const live=JSON.stringify({version:1,collections:normalized});
    if(live.length<=MAX_BYTES)sessionStorage.setItem(LIVE,live);
    // Local secret values survive refresh in the same tab (sessionStorage only).
    // They never enter persistent localStorage recovery.
    const fallback=JSON.stringify({version:1,collections:normalized.map(c=>({...c,
      variables:(c.variables||[]).map(v=>v.isSecret?{...v,value:''}:v),
      requests:c.requests.map(r=>safeExportDraft(r,false))}))});
    if(fallback.length<=MAX_BYTES)localStorage.setItem(FALLBACK,fallback);
  }catch{/* Persistence must never interrupt request editing. */}
}
