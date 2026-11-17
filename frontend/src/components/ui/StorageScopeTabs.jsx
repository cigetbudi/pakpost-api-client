import React from 'react';
import {FolderClosed,Layers3} from 'lucide-react';
import {STORAGE_LOCAL,STORAGE_WORKSPACE} from '../../features/import-export/services/storageScope.js';

/** Storage is explicit, but the switch must not move/sync data. */
export function StorageScopeTabs({value,onChange,label='Storage'}){
  return <div className="pp-storage-tabs" role="group" aria-label={label}>
    <button type="button" aria-pressed={value===STORAGE_WORKSPACE} className={value===STORAGE_WORKSPACE?'active':''} onClick={()=>onChange(STORAGE_WORKSPACE)}><Layers3 size={15}/> Cloud · Neon</button>
    <button type="button" aria-pressed={value===STORAGE_LOCAL} className={value===STORAGE_LOCAL?'active':''} onClick={()=>onChange(STORAGE_LOCAL)}><FolderClosed size={15}/> Local</button>
  </div>;
}
