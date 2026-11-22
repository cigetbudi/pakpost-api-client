import { useEffect } from 'react';
import { BROWSER_SESSION } from '../../../services/httpClient.js';
import { saveWorkspaceViewPreference } from '../services/workspaceViewPreference.js';

/** Never persist Cloud choice until the session has a verified account. */
export function useWorkspaceViewPreferencePersistence({ token, me, storageScope, selectedWs, workspaces, storage }) {
  // Persist only non-sensitive UI choices once a verified account is known.
  // Never overwrite a Cloud preference during the initial guest/bootstrap frame.
  useEffect(()=>{
    if(token===BROWSER_SESSION&&me?.id)
      saveWorkspaceViewPreference(storage,me.id,{scope:storageScope});
  },[token,me?.id,storageScope]);
  useEffect(()=>{
    if(token===BROWSER_SESSION&&me?.id&&selectedWs&&workspaces.some(ws=>ws.id===selectedWs))
      saveWorkspaceViewPreference(storage,me.id,{workspaceId:selectedWs});
  },[token,me?.id,selectedWs,workspaces]);
}
