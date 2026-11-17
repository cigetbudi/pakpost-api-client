/** Workspace Cloud requests opened without collection.write must be read-only.
 * Workspace mismatch is conservatively treated as read-only, even for developers.
 */
export function isReadOnlyCloudTab(tab,canEditCloud,workspaceId) {
  return !!(tab?.source?.scope==='workspace' && (!canEditCloud || tab.source.workspaceId!==workspaceId));
}
/** Prevent the browser recovery cache from persisting temporary Cloud QA drafts. */
export function sandboxCacheTabIds(tabs,workspaceId,canEditCloud) {
  return (tabs||[]).filter(tab=>isReadOnlyCloudTab(tab,canEditCloud,workspaceId)).map(tab=>tab.id);
}

/** RAM-only documentation overlay key; names are never used as identities. */
export function sandboxDocKey({workspaceId='',collectionId='',type='',requestId='',folderPath=[]}={}) {
  return `${workspaceId}:${collectionId}:${type}:${requestId||JSON.stringify(folderPath)}`;
}
