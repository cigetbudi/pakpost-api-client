/**
 * Open Cloud index entries without publishing responses from an outdated
 * account, workspace or selection. No state is stored across renders.
 */
export function createCloudRequestOpenActions({
  api, cloudOpenEpoch, currentTokenRef, selectedWorkspaceRef,
  selectedWs, selectedCol, token, openTabs, tabActions, collectionActions,
  setNotice, getMessage,
}) {
  async function openWorkspaceExample(request,collectionId,example) {
    const selection=++cloudOpenEpoch.current;
    if(!request?.isIndex)return collectionActions.openWorkspaceExample(request,collectionId,example);
    const workspaceId=selectedWs,auth=token;
    try {
      const full=await api(`/api/workspaces/${workspaceId}/collections/${collectionId}/requests/${request.id}`,'GET',undefined,auth);
      if(currentTokenRef.current!==auth||selectedWorkspaceRef.current!==workspaceId||selection!==cloudOpenEpoch.current)return;
      return collectionActions.openWorkspaceExample(full,collectionId,example);
    } catch(error) {
      if(currentTokenRef.current===auth&&selection===cloudOpenEpoch.current)setNotice(`Cannot open response example: ${getMessage(error)}`);
    }
  }
  async function loadSavedRequest(item) {
    const selection=++cloudOpenEpoch.current;
    if (!item?.isIndex) { tabActions.loadSavedRequest(item); return true; }
    const workspaceId=selectedWs;
    const collectionId=item.collectionId||selectedCol;
    const auth=token;
    const existing=openTabs.find(tab=>tab.source?.scope==='workspace'
      &&tab.source.workspaceId===workspaceId&&tab.source.collectionId===collectionId
      &&tab.source.requestId===item.id);
    if (existing) { tabActions.selectTab(existing.id); return true; }
    try {
      const full=await api(`/api/workspaces/${workspaceId}/collections/${collectionId}/requests/${item.id}`,'GET',undefined,auth);
      if (currentTokenRef.current!==auth||selectedWorkspaceRef.current!==workspaceId||selection!==cloudOpenEpoch.current)return false;
      tabActions.loadSavedRequest(full);
      return true;
    } catch(error) {
      if(currentTokenRef.current===auth&&selection===cloudOpenEpoch.current)setNotice(`Cannot open Cloud request: ${getMessage(error)}`);
      return false;
    }
  }
  return { openWorkspaceExample, loadSavedRequest };
}
