/** Pure native Cloud folder tree. IDs, never user-visible path strings, define identity. */
export function makeCloudFolderTree(folders=[],requests=[]){
  const root={id:null,name:'',folders:[],requests:[]};
  const map=new Map((folders||[]).map(f=>[f.id,{...f,folders:[],requests:[]}]));
  // Invalid/missing parent rows render at root, never disappear from the UI.
  for(const folder of map.values()){
    const parent=folder.parentFolderId&&map.get(folder.parentFolderId);
    // Corrupt/missing/cyclic parent links must never hide requests from the explorer.
    let safe=!!parent, cursor=parent, visited=new Set([folder.id]);
    while(cursor){
      if(visited.has(cursor.id)){safe=false;break;}
      visited.add(cursor.id);
      if(cursor.parentFolderId&&!map.has(cursor.parentFolderId)){safe=false;break;}
      cursor=map.get(cursor.parentFolderId);
    }
    (safe?parent:root).folders.push(folder);
  }
  for(const item of requests||[]){
    (map.get(item.folderId)||root).requests.push(item);
  }
  const sort=(node,seen=new Set())=>{
    if(node.id){if(seen.has(node.id))return {...node,folders:[]}; seen.add(node.id);}
    node.folders.sort((a,b)=>a.name.localeCompare(b.name));
    node.folders=node.folders.map(f=>sort(f,new Set(seen)));
    return node;
  };
  return sort(root);
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
