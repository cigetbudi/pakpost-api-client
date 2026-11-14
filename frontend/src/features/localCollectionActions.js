/** Pure local collection operations. Never mutates the browser's cached collection state. */
import {toLocalCollection,validateLibrary} from './localCollections.js';
import {createLocalPostmanExport} from './importExport.js';

const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`local-${Math.random().toString(36).slice(2)}`;
const nameOf=r=>String(r.requestName||r.name||'Request');
const pathEquals=(a=[],b=[])=>JSON.stringify(a)===JSON.stringify(b);
const newRequest=(name='New Request',path=[],idFactory=uid)=>({
  id:idFactory(),requestName:name,name,method:'GET',url:'',rows:[{key:'',value:''}],params:[{key:'',value:''}],
  body:'',format:'application/json',formFields:[{key:'',value:''}],binaryFile:{name:'',base64:''},
  preScript:'',postScript:'',folderPath:path,authType:'none',bearerToken:''
});
function cloneCollection(c){return {...c,requests:(c.requests||[]).map(r=>({...r,folderPath:[...(r.folderPath||[])]}))};}
const compare=(a,b,sort)=>sort==='method'?(a.method||'').localeCompare(b.method||'')||nameOf(a).localeCompare(nameOf(b)):nameOf(a).localeCompare(nameOf(b));

export function applyLocalAction(collections,action,idFactory=uid){
  let next=collections.map(cloneCollection);
  const col=next.find(c=>c.id===action.collectionId);
  if(!col)throw Error('Collection not found');
  const request=col.requests.find(r=>r.id===action.requestId);
  switch(action.type){
    case 'renameCollection': {
      const name=String(action.name||'').trim();if(!name)throw Error('Collection name required');
      col.name=name;break;
    }
    case 'duplicateCollection': {
      const copy=toLocalCollection({...col,name:`${col.name} (copy)`},idFactory);
      next.splice(next.indexOf(col)+1,0,copy);break;
    }
    case 'deleteCollection': next=next.filter(c=>c.id!==col.id);break;
    case 'sortCollection': {
      col.requests.sort((a,b)=>compare(a,b,action.sort));break;
    }
    case 'createRequest': {
      const added=newRequest(String(action.name||'New Request'),action.folderPath||[],idFactory);
      col.requests.push(added);break;
    }
    case 'renameRequest': {
      if(!request)throw Error('Request not found');
      const name=String(action.name||'').trim();if(!name)throw Error('Request name required');
      request.name=name;request.requestName=name;break;
    }
    case 'duplicateRequest': {
      if(!request)throw Error('Request not found');
      const copy={...request,id:idFactory(),name:`${nameOf(request)} (copy)`,requestName:`${nameOf(request)} (copy)`,result:null,scriptLog:[],scriptTests:[],scriptError:''};
      col.requests.splice(col.requests.indexOf(request)+1,0,copy);break;
    }
    case 'deleteRequest': col.requests=col.requests.filter(r=>r.id!==action.requestId);break;
    case 'sortFolder': {
      const selected=col.requests.filter(r=>pathEquals(r.folderPath,action.folderPath));
      const sorted=[...selected].sort((a,b)=>compare(a,b,action.sort));let index=0;
      col.requests=col.requests.map(r=>pathEquals(r.folderPath,action.folderPath)?sorted[index++]:r);break;
    }
    case 'renameFolder': {
      const from=action.folderPath||[];const to=String(action.name||'').trim();
      if(!from.length||!to)throw Error('Invalid folder rename');
      for(const r of col.requests)if(pathEquals((r.folderPath||[]).slice(0,from.length),from))r.folderPath=[...from.slice(0,-1),to,...r.folderPath.slice(from.length)];
      break;
    }
    case 'deleteFolder': {
      const path=action.folderPath||[];
      col.requests=col.requests.filter(r=>!pathEquals((r.folderPath||[]).slice(0,path.length),path));break;
    }
    case 'duplicateFolder': {
      const path=action.folderPath||[];if(!path.length)throw Error('Folder path required');
      const clones=col.requests.filter(r=>pathEquals((r.folderPath||[]).slice(0,path.length),path)).map(r=>({
        ...r,id:idFactory(),folderPath:[...path.slice(0,-1),`${path.at(-1)} (copy)`,...(r.folderPath||[]).slice(path.length)],
        result:null,scriptLog:[],scriptTests:[],scriptError:''
      }));col.requests.push(...clones);break;
    }
    case 'moveRequest': {
      if(!request)throw Error('Request not found');
      const target=next.find(c=>c.id===(action.targetCollectionId||col.id));if(!target)throw Error('Destination missing');
      col.requests=col.requests.filter(r=>r.id!==request.id);
      request.folderPath=Array.isArray(action.targetFolderPath)?[...action.targetFolderPath]:request.folderPath;
      const index=target.requests.findIndex(r=>r.id===action.beforeRequestId);
      target.requests.splice(index<0?target.requests.length:index,0,request);break;
    }
    default: throw Error('Unsupported collection action');
  }
  return validateLibrary(next);
}
export function exportLocalCollection(collection){
  const result=createLocalPostmanExport([collection]);
  const item=result.item[0];
  return {...result,info:{...result.info,name:collection.name},item:item.item};
}
export function getNewRequestDraft(name,path,idFactory=uid){return newRequest(name,path,idFactory)}

export function updateLocalRequest(collections,collectionId,requestId,draft){
  const next=collections.map(cloneCollection);
  const col=next.find(c=>c.id===collectionId);
  const index=col?.requests.findIndex(r=>r.id===requestId)??-1;
  if(index<0)throw Error('Saved request not found');
  const old=col.requests[index];
  col.requests[index]={...old,...draft,id:old.id,folderPath:old.folderPath,requestName:draft.name||old.requestName,
    binaryFile:{name:draft.binaryFile?.name||'',base64:''},
    formFields:(draft.formFields||[]).map(({fileBase64,...r})=>r),result:null,scriptLog:[],scriptTests:[],scriptError:''};
  return validateLibrary(next);
}
export function createLocalSavedRequest(collections,collectionId,draft,idFactory=uid){
  const next=collections.map(cloneCollection);
  const col=next.find(c=>c.id===collectionId);
  if(!col)throw Error('Collection not found');
  const r={...newRequest(draft.name||'New Request',[],idFactory),...draft,
    binaryFile:{name:draft.binaryFile?.name||'',base64:''},formFields:(draft.formFields||[]).map(({fileBase64,...f})=>f),
    result:null,scriptLog:[],scriptTests:[],scriptError:''};
  col.requests.push(r);return {collections:validateLibrary(next),request:r};
}
