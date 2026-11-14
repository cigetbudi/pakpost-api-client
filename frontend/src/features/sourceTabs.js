/** Stable identity across repeated explorer clicks and browser refreshes. */
export function sameSource(a,b){
  return !!a&&!!b&&a.scope===b.scope&&a.collectionId===b.collectionId&&a.requestId===b.requestId&&
    (a.scope==='local'||a.workspaceId===b.workspaceId);
}
export function findBoundTab(tabs,source){return tabs.find(t=>sameSource(t.source,source));}
