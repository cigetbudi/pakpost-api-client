import {canMoveCloudFolder,folderPathForId} from './cloudFolderTree.js';

const startsWithPath=(path,prefix)=>prefix.length<=path.length &&
  prefix.every((segment,index)=>path[index]===segment);

/** Enumerate path-derived folders, including empty documented folders. */
export function localFolderPaths(collection){
  const paths=new Map();
  const add=path=>{
    if(!Array.isArray(path))return;
    for(let depth=1;depth<=path.length;depth++){
      const ancestor=path.slice(0,depth);
      if(ancestor.every(segment=>typeof segment==='string'&&segment.length))
        paths.set(JSON.stringify(ancestor),ancestor);
    }
  };
  for(const request of collection?.requests||[])add(request.folderPath);
  for(const key of Object.keys(collection?.folderDocs||{})){
    try{add(JSON.parse(key));}catch{/* Ignore malformed legacy documentation keys. */}
  }
  return [...paths.values()].sort((a,b)=>a.join(' / ').localeCompare(b.join(' / ')));
}

/** Exclude the source and its descendants so invalid moves are never offered. */
export function localFolderMoveTargets(collection,sourcePath){
  return [[],...localFolderPaths(collection)].filter(path=>!startsWithPath(path,sourcePath));
}

export function cloudFolderMoveTargets(folders,sourceId){
  const options=[{id:null,label:'Collection root'}];
  for(const folder of folders||[]){
    if(!canMoveCloudFolder(folders,sourceId,folder.id))continue;
    try{options.push({id:folder.id,label:folderPathForId(folders,folder.id).join(' / ')});}
    catch{/* Exclude corrupted ancestry rather than offering an invalid move. */}
  }
  return [options[0],...options.slice(1).sort((a,b)=>a.label.localeCompare(b.label))];
}
