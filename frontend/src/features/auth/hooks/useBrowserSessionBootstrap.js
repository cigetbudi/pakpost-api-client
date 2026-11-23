import { isTauriDesktop } from '../../collections/services/desktopLocalRepository.js';
import { useEffect } from 'react';
import { BROWSER_SESSION, getBrowserCsrf, setBrowserCsrf } from '../../../services/httpClient.js';
import { createAuthTabSync } from '../services/authTabSync.js';
import { readWorkspaceViewPreference } from '../../workspace/services/workspaceViewPreference.js';

/**
 * Restore the server-side HttpOnly session before adopting per-account Cloud
 * preferences. An auth failure does not erase Local drafts; a network failure
 * never silently signs an existing user out.
 *
 * This effect deliberately runs once per mount, like the former Workbench
 * bootstrap, so a transient editor rerender cannot restart a session lookup.
 */
export function useBrowserSessionBootstrap({
  api, authEpochRef, authTabSyncRef, currentTokenRef, currentUserRef,
  performLogout, loadWorkspaces, setAuthOpen, setAuthSessionRevision,
  setMe, setStorageScope, setToken,
}) {
  useEffect(()=>{
    if (isTauriDesktop()) return; // Local-first desktop: no implicit public session probe.
    // Purge credentials written by pre-cookie versions of PakPost.
    try{sessionStorage.removeItem('pakpost_token');}catch{}
    let active=true;
    const refresh=async()=>{
      const epoch=authEpochRef.current;
      try {
        const result=await api('/api/auth/session','GET');
        if(!active || epoch!==authEpochRef.current)return;
        if(result?.authenticated && result.user && result.csrfToken){
          const sameAccount=currentTokenRef.current===BROWSER_SESSION &&
            currentUserRef.current?.id===result.user.id;
          const switchedAccount=currentTokenRef.current===BROWSER_SESSION &&
            currentUserRef.current?.id && currentUserRef.current.id!==result.user.id;
          if(switchedAccount)performLogout(false);
          if(result.csrfToken!==getBrowserCsrf())setAuthSessionRevision(v=>v+1);
          setBrowserCsrf(result.csrfToken);
          currentTokenRef.current=BROWSER_SESSION;
          setToken(BROWSER_SESSION);
          setMe(result.user);
          setAuthOpen(false);
          // Restore after verification, not from the unauthenticated startup state.
          // A visibility/session refresh for the same user must NOT override a
          // Local/Cloud switch they just made in this tab.
          if(!sameAccount){
            // The old workbench cache's envScope can be polluted by a brief
            // unauthenticated startup. Default verified accounts to Cloud;
            // only an explicit per-account preference can choose Local.
            const preference=readWorkspaceViewPreference(localStorage,result.user.id);
            setStorageScope(preference.scope);
          }
          if(switchedAccount)loadWorkspaces(BROWSER_SESSION,result.user.id);
        }else if(currentTokenRef.current){
          performLogout(false);
        }else setBrowserCsrf('');
      }catch{
        // Network errors must NOT silently sign an active user out.
        // Initial startup stays in guest mode until a successful check.
      }
    };
    const sync=createAuthTabSync({onSessionChanged:refresh});
    authTabSyncRef.current=sync;
    refresh(); // Cookie is shared by every tab; no token broadcast required.
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('pakpost:browser-session-revoked',refresh);
    return()=>{active=false;sync.close();document.removeEventListener('visibilitychange',visible);window.removeEventListener('pakpost:browser-session-revoked',refresh);
      if(authTabSyncRef.current===sync)authTabSyncRef.current=null;};
  },[]);
}
