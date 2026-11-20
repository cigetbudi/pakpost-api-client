/** Native folder drag data shared by Local and Cloud. Uses a plain-text fallback
 * for browsers that do not preserve private DataTransfer MIME types reliably.
 * The fallback is accepted only for a drag initiated by this workbench. */
let activeFolderMime=null;
const FALLBACK_PREFIX='pakpost-folder-dnd:';

export function startFolderDrag(dataTransfer,mime,payload){
  activeFolderMime=mime;
  dataTransfer.effectAllowed='move';
  const serialized=JSON.stringify(payload);
  dataTransfer.setData(mime,serialized);
  dataTransfer.setData('text/plain',`${FALLBACK_PREFIX}${mime}:${serialized}`);
}

export function isFolderDrag(dataTransfer,mime){
  const types=Array.from(dataTransfer?.types||[]);
  return types.includes(mime)||(activeFolderMime===mime&&types.includes('text/plain'));
}

export function readFolderDrag(dataTransfer,mime){
  if(!isFolderDrag(dataTransfer,mime))return null;
  let raw=dataTransfer.getData(mime);
  if(!raw&&activeFolderMime===mime){
    const plain=dataTransfer.getData('text/plain');
    const prefix=`${FALLBACK_PREFIX}${mime}:`;
    if(plain.startsWith(prefix))raw=plain.slice(prefix.length);
  }
  try{
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;
  }catch{return null;}
}

export function endFolderDrag(){activeFolderMime=null;}
