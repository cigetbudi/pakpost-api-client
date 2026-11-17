/**
 * The explorer highlight follows the active workbench tab, not the last row
 * selected for Ctrl/Shift bulk actions. Never match requests across workspaces.
 */
export function activeCloudTabForCollection(tabs,activeTabId,workspaceId,collectionId){
  const tab=tabs.find(item=>item.id===activeTabId);
  const source=tab?.source;
  if(source?.scope!=='workspace'||source.workspaceId!==workspaceId||source.collectionId!==collectionId)
    return {requestId:null,pendingTabId:null};
  if(source.pending)return {requestId:null,pendingTabId:tab.id};
  return {requestId:source.requestId||null,pendingTabId:null};
}
