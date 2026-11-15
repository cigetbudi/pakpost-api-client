/** Workspace collection docs sidecar (browser-local until backend exposes a description field).
 * Collection metadata is separate from request metadata, which is persisted via JSONB.
 */
const KEY='pakpost_workspace_collection_docs_v21';
export const folderKey=path=>JSON.stringify(Array.isArray(path)?path:[]);
export function readWorkspaceCollectionDocs(storage) {
  try {const value=JSON.parse(storage?.getItem(KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}
export function writeWorkspaceCollectionDocs(storage,docs) {
  try {const json=JSON.stringify(docs);if(json.length<250000)storage?.setItem(KEY,json);}catch{/* storage can be unavailable */}
}
export const workspaceDocKey=(workspaceId,collectionId)=>`${workspaceId||''}:${collectionId||''}`;
