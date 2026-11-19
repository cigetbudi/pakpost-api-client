/** Pure native Cloud folder tree. IDs, never user-visible path strings, define identity. */
export function makeCloudFolderTree(folders = [], requests = []) {
  const root = {id: null, name: '', folders: [], requests: []};
  const map = new Map((folders || []).map(folder => [folder.id, {...folder, folders: [], requests: []}]));
  const valid = new Map();

  // Resolve each ancestry chain once, iteratively. Both missing parents and
  // cycles become root-level nodes rather than hiding requests or hanging UI.
  function validAncestry(folder) {
    if (valid.has(folder.id)) return valid.get(folder.id);
    const path = [];
    const visiting = new Set();
    let cursor = folder;
    let safe = true;
    while (cursor) {
      if (valid.has(cursor.id)) {
        safe = valid.get(cursor.id);
        break;
      }
      if (visiting.has(cursor.id)) {
        safe = false;
        break;
      }
      visiting.add(cursor.id);
      path.push(cursor.id);
      if (!cursor.parentFolderId) break;
      const parent = map.get(cursor.parentFolderId);
      if (!parent) {
        safe = false;
        break;
      }
      cursor = parent;
    }
    for (const id of path) valid.set(id, safe);
    return safe;
  }

  for (const folder of map.values()) {
    const parent = folder.parentFolderId && map.get(folder.parentFolderId);
    (parent && validAncestry(folder) ? parent : root).folders.push(folder);
  }
  for (const request of requests || []) {
    (map.get(request.folderId) || root).requests.push(request);
  }

  // The graph is now acyclic. Iterative sort avoids call-stack overflows
  // on unusually deep imported Collection folders.
  const pending = [root];
  while (pending.length) {
    const node = pending.pop();
    node.folders.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of node.folders) pending.push(child);
  }
  return root;
}
export function folderPathForId(folders,id){
  if(!id)return [];
  const map=new Map((folders||[]).map(f=>[f.id,f]));
  const names=[],visited=new Set();let current=id;
  while(current){
    if(visited.has(current)||names.length>=24)throw Error('Invalid cyclic Cloud folder path');
    visited.add(current);
    const folder=map.get(current);
    if(!folder)throw Error('Missing Cloud folder — reload before exporting');
    names.unshift(folder.name);current=folder.parentFolderId;
  }
  return names;
}
export function canMoveCloudFolder(folders,folderId,targetParentId){
  if(folderId===targetParentId)return false;
  const map=new Map((folders||[]).map(f=>[f.id,f]));
  if(!map.has(folderId)||(targetParentId&&!map.has(targetParentId)))return false;
  const visited=new Set();let p=targetParentId;
  while(p){if(p===folderId||visited.has(p))return false;visited.add(p);p=map.get(p)?.parentFolderId;}
  return true;
}
