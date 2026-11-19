/** Collection documentation is a browser session sidecar, NOT encrypted in Neon.
 * Upgrade legacy durable entries into session scope, then remove the durable copy.
 */
const KEY='pakpost_workspace_collection_docs_v21';
export const folderKey=path=>JSON.stringify(Array.isArray(path)?path:[]);
export const workspaceDocKey=(workspaceId,collectionId)=>`${workspaceId||''}:${collectionId||''}`;

function parseDocs(json) {
  try {
    const value=JSON.parse(json||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  } catch { return {}; }
}

export function readWorkspaceCollectionDocs(legacyStorage) {
  try {
    if (typeof sessionStorage==='undefined') return {};
    const current=sessionStorage.getItem(KEY);
    const legacy=legacyStorage?.getItem(KEY);
    // Do not persist Cloud documentation permanently on the user's device.
    if (legacy!==null && legacy!==undefined) {
      if(current===null)sessionStorage.setItem(KEY,legacy);
      legacyStorage?.removeItem(KEY);
    }
    return parseDocs(sessionStorage.getItem(KEY));
  } catch { return {}; }
}

export function writeWorkspaceCollectionDocs(_unusedStorage,docs) {
  try {
    if(typeof sessionStorage==='undefined')return;
    const json=JSON.stringify(docs);
    if(json.length<250000)sessionStorage.setItem(KEY,json);
  } catch {/* browser storage may be disabled */}
}

export function clearWorkspaceCollectionDocs(legacyStorage) {
  try { sessionStorage.removeItem(KEY); } catch {/* browser storage may be disabled */}
  try { legacyStorage?.removeItem(KEY); } catch {/* browser storage may be disabled */}
}
