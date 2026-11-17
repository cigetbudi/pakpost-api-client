import React from 'react';
import {Cloud,HardDrive,LockKeyhole} from 'lucide-react';
import {allowedStorageScope,STORAGE_LOCAL,STORAGE_WORKSPACE} from '../../features/import-export/services/storageScope.js';

/** Shared destination control for Collection and Environment imports. */
export function ImportDestinationPicker({authenticated=false,value,onChange,workspaceName='',onLogin,allowCloud=true}){
  const destination=authenticated&&!allowCloud?STORAGE_LOCAL:allowedStorageScope(authenticated,value);
  return <div className="pp-import-destination">
    <div className="pp-side-section-title">SAVE IMPORT TO</div>
    {authenticated?<>
      <div className="pp-import-scope-toggle" role="group" aria-label="Import destination">
        <button type="button" aria-pressed={destination===STORAGE_WORKSPACE} disabled={!allowCloud} title={!allowCloud?"No permission to write Cloud collections/environments":"Save to workspace"} className={destination===STORAGE_WORKSPACE?'active':''} onClick={()=>onChange(STORAGE_WORKSPACE)}><Cloud size={15}/> Cloud · Neon</button>
        <button type="button" aria-pressed={destination===STORAGE_LOCAL} className={destination===STORAGE_LOCAL?'active':''} onClick={()=>onChange(STORAGE_LOCAL)}><HardDrive size={15}/> Local</button>
      </div>
      <p className="pp-side-hint">{!allowCloud?"Cloud is read-only for your workspace role. Import to Local instead.":destination===STORAGE_WORKSPACE?workspaceName?`Saved to workspace: ${workspaceName}`:'Create or select a workspace before importing to Cloud.':'Saved only in this browser. Nothing is uploaded.'}</p>
    </>:<>
      <div className="pp-import-guest-destination"><HardDrive size={15}/> Local · Browser</div>
      <p className="pp-side-hint"><LockKeyhole size={12}/> Want to import into Cloud? <button type="button" onClick={onLogin}>Sign in</button></p>
    </>}
  </div>;
}
