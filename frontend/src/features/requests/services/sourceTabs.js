/** Stable identity across repeated explorer clicks and browser refreshes. */
export function sameSource(a,b){
  if(!a||!b)return false;
  if(a.pending||b.pending)return !!a.pending&&!!b.pending&&!!a.pendingId&&a.pendingId===b.pendingId;
  if(!a.requestId||!b.requestId)return false;
  return a.scope===b.scope&&a.collectionId===b.collectionId&&a.requestId===b.requestId&&
    (a.scope==='local'||a.workspaceId===b.workspaceId);
}
export function findBoundTab(tabs,source){return tabs.find(t=>sameSource(t.source,source));}
