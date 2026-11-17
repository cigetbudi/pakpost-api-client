import {hasUnsavedChanges} from './draftLifecycle.js';
export function decideCloudTabSync(tab,draft,remote){
  if(!tab?.source || tab.source.scope!=='workspace'||tab.source.pending)return 'none';
  if(!remote)return 'deleted';
  const local=Number(tab.source.revision)||0;
  const latest=Number(remote.revision)||0;
  if(local===latest && local>0)return 'none';
  if(latest>0 && local>latest)return 'none'; // stale/out-of-order event
  return hasUnsavedChanges(tab,draft)?'conflict':'reload';
}
export function conflictFields(local={},remote={}){
  return [
    ['Name',String(local.name||''),String(remote.name||'')],
    ['Method',String(local.method||''),String(remote.method||'')],
    ['URL',String(local.url||''),String(remote.url||'')],
    ['Body',String(local.body||''),String(remote.body||'')],
    ['Pre-request script',String(local.preScript||''),String(remote.preScript||'')],
    ['Post-response script',String(local.postScript||''),String(remote.postScript||'')]
  ].map(([field,a,b])=>({field,same:a===b})); // Never expose secret-bearing values in diagnostics
}
