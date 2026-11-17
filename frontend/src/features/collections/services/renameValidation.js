/** Client-side rename preflight. Server-side authorization and validation remain authoritative. */
const normalized = value => String(value ?? '').trim().toLocaleLowerCase();
const sameName = (a,b) => normalized(a) === normalized(b);

export function cloudFolderNameError(folders, draft) {
  const name = String(draft?.name ?? '').trim();
  if (!name) return 'Folder name is required';
  if (name.length > 120) return 'Folder name must be 120 characters or less';
  const original = draft.mode === 'rename' ? folders.find(f => f.id === draft.id) : null;
  if (original && sameName(name,original.name)) return 'Folder name has not changed';
  const parentId = draft.mode === 'rename' ? original?.parentFolderId ?? null : draft.parentId ?? null;
  if (folders.some(f => f.id !== draft.id && (f.parentFolderId ?? null) === parentId && sameName(f.name,name)))
    return 'A folder with this name already exists at this level';
  return '';
}

export function renameActionError(actionDialog,name,{collections=[],localCollections=[],workspaceRequestLists={},selectedWs='',workspaceCollectionKey}={}) {
  if (!actionDialog?.action?.startsWith('rename')) return '';
  const trimmed=String(name??'').trim();
  if (!trimmed) return 'Name is required';
  if (sameName(trimmed,actionDialog.name)) return 'Name has not changed';
  const {scope,action,collectionId,requestId,folderPath=[]}=actionDialog;
  if (action==='renameCollection') {
    const peers=scope==='local'?localCollections:collections;
    if (peers.some(c=>c.id!==collectionId&&sameName(c.name,trimmed)))
      return 'A collection with this name already exists';
  }
  if (action==='renameRequest') {
    const list=scope==='local'
      ?(localCollections.find(c=>c.id===collectionId)?.requests||[])
      :(workspaceRequestLists[workspaceCollectionKey?.(selectedWs,collectionId)]||[]);
    const target=list.find(r=>r.id===requestId);
    if (target&&list.some(r=>r.id!==requestId&&
      (scope==='local'
        ?JSON.stringify(r.folderPath||[])===JSON.stringify(target.folderPath||[])
        :(r.folderId??null)===(target.folderId??null))&&
      sameName(r.requestName||r.name,trimmed)))
      return 'A request with this name already exists in this folder';
  }
  if (action==='renameFolder'&&scope==='local'&&folderPath.length) {
    const col=localCollections.find(c=>c.id===collectionId);
    const paths=[...(col?.requests||[]).map(r=>r.folderPath||[]),
      ...Object.keys(col?.folderDocs||{}).flatMap(k=>{try{const path=JSON.parse(k);return Array.isArray(path)?[path]:[]}catch{return []}})];
    const siblings=paths.map(p=>p.slice(0,folderPath.length))
      .filter(p=>p.length===folderPath.length&&JSON.stringify(p.slice(0,-1))===JSON.stringify(folderPath.slice(0,-1)));
    if(siblings.some(p=>!sameName(p.at(-1),folderPath.at(-1))&&sameName(p.at(-1),trimmed)))
      return 'A folder with this name already exists at this level';
  }
  return '';
}
