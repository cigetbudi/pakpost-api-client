import {STORAGE_LOCAL,STORAGE_WORKSPACE} from '../../import-export/services/storageScope.js';

// UI preferences only. Never store cookies, credentials, Cloud data or user profile here.
// Account-scoped keys keep preferences from following a different Google account.
const PREFIX='pakpost_workspace_view_v1:';
const validScope=scope=>scope===STORAGE_LOCAL||scope===STORAGE_WORKSPACE;
const keyFor=userId=>typeof userId==='string'&&userId.length>0&&userId.length<=128
  ?`${PREFIX}${userId}`:'';

export function readWorkspaceViewPreference(storage,userId,fallbackScope=STORAGE_WORKSPACE){
  const fallback=validScope(fallbackScope)?fallbackScope:STORAGE_WORKSPACE;
  const key=keyFor(userId);
  if(!key)return {scope:fallback,workspaceId:''};
  try{
    const saved=JSON.parse(storage?.getItem(key)||'null');
    return {
      scope:validScope(saved?.scope)?saved.scope:fallback,
      workspaceId:typeof saved?.workspaceId==='string'&&saved.workspaceId.length<=128?saved.workspaceId:'',
    };
  }catch{return {scope:fallback,workspaceId:''};}
}

export function saveWorkspaceViewPreference(storage,userId,changes){
  const key=keyFor(userId);
  if(!key)return;
  const previous=readWorkspaceViewPreference(storage,userId);
  const next={...previous};
  if(validScope(changes?.scope))next.scope=changes.scope;
  if(typeof changes?.workspaceId==='string'&&changes.workspaceId.length<=128)next.workspaceId=changes.workspaceId;
  try{storage?.setItem(key,JSON.stringify(next));}catch{/* Private browsing / storage quota */}
}

// A stored workspace ID is only a preference, never an authorization decision.
// Validate it against the fresh server-side membership list on every boot.
export function chooseWorkspaceId(workspaces,currentId,preferredId){
  const valid=new Set((Array.isArray(workspaces)?workspaces:[]).map(ws=>ws?.id).filter(Boolean));
  if(currentId&&valid.has(currentId))return currentId;
  if(preferredId&&valid.has(preferredId))return preferredId;
  return Array.isArray(workspaces)?workspaces.find(ws=>ws?.id)?.id||'':'';
}
