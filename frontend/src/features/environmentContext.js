import {STORAGE_LOCAL,STORAGE_WORKSPACE} from './storageScope.js';

// Only opaque environment IDs are stored here. Variables, names and tokens are never cached.
const SELECTIONS_KEY='pakpost_environment_selections_v6';
const MAX_CONTEXTS=100;
const VALID_ID=/^[A-Za-z0-9_-]{1,128}$/;

/** A Cloud selection is scoped to both the signed-in account and the workspace. */
export function environmentContextKey(scope,workspaceId='',userId='') {
  if(scope===STORAGE_LOCAL)return 'local';
  if(scope!==STORAGE_WORKSPACE||!VALID_ID.test(String(workspaceId))||!VALID_ID.test(String(userId)))return '';
  return `workspace:${userId}:${workspaceId}`;
}

export function readEnvironmentSelections(storage,legacy) {
  let selections={};
  try {
    const raw=JSON.parse(storage?.getItem(SELECTIONS_KEY)||'{}');
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)) {
      selections=Object.fromEntries(Object.entries(raw).filter(([key,value])=>
        (key==='local'||/^workspace:[A-Za-z0-9_-]{1,128}:[A-Za-z0-9_-]{1,128}$/.test(key))&&
        typeof value==='string'&&(value===''||VALID_ID.test(value))).slice(-MAX_CONTEXTS));
    }
  }catch{/* Malformed/unavailable browser storage must not break the app. */}
  // Old v5 stored one global ID. Import ONLY its local selection; a Cloud ID has no
  // accountable workspace identity, so migrating it could cross workspace boundaries.
  if(!Object.hasOwn(selections,'local')&&legacy?.envScope===STORAGE_LOCAL&&typeof legacy.activeEnvId==='string'&&VALID_ID.test(legacy.activeEnvId)) {
    selections.local=legacy.activeEnvId;
  }
  return selections;
}

export function selectionForContext(selections,context) {
  return context&&typeof selections?.[context]==='string'?selections[context]:'';
}

export function setSelectionForContext(selections,context,id) {
  if(!context||typeof id!=='string'||(id&&!VALID_ID.test(id)))return selections;
  const next={...selections};
  // Move to the end so frequently used workspaces survive the bounded cache.
  delete next[context];next[context]=id;
  const keys=Object.keys(next);
  for(const key of keys.slice(0,Math.max(0,keys.length-MAX_CONTEXTS)))delete next[key];
  return next;
}

export function writeEnvironmentSelections(storage,selections) {
  try{storage?.setItem(SELECTIONS_KEY,JSON.stringify(selections));}catch{/* Ignore unavailable storage. */}
}

/** Distinct async fetch results are never shown for another account/workspace. */
export function environmentsForContext(result,context) {
  return context&&result?.context===context&&Array.isArray(result.items)?result.items:[];
}
