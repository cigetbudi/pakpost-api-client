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
    if (isTauriDesktop()) {
      let mounted=true, checking=false;
      const refreshDesktop=async()=>{
        if(!mounted||checking)return;
        checking=true;const epoch=authEpochRef.current;
        const current=()=>mounted&&epoch===authEpochRef.current;
        async function expire(invoke){
          if(!current())return;
          window.__PAKPOST_DESKTOP_REMOTE__=false;
          if(currentTokenRef.current)performLogout(false);
          // Remove expired native credentials as well. Local data stays untouched.
          try{await invoke('disconnect_remote');}catch{}
        }
        try {
          const {invoke}=await import('@tauri-apps/api/core');
          const connected=await invoke('desktop_remote_status');
          if(!current())return;
          if(!connected){if(currentTokenRef.current)await expire(invoke);return;}
          window.__PAKPOST_DESKTOP_REMOTE__=true;
          let result;
          try{result=await api('/api/auth/session','GET');}
          catch(e){if(e?.status===401)await expire(invoke);return;}
          if(!current())return;
          if(!result?.authenticated||!result.user){await expire(invoke);return;}
          if(currentTokenRef.current===BROWSER_SESSION&&currentUserRef.current?.id===result.user.id)return;
          if(currentTokenRef.current&&currentUserRef.current?.id&&currentUserRef.current.id!==result.user.id)performLogout(false);
          currentTokenRef.current=BROWSER_SESSION;
          setBrowserCsrf(result.csrfToken||'');setToken(BROWSER_SESSION);setMe(result.user);
          setAuthOpen(false);setStorageScope('workspace');loadWorkspaces(BROWSER_SESSION,result.user.id);
        }catch{/* Network errors are not a sign-out. */}
        finally{checking=false;}
      };
      refreshDesktop();
      const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshDesktop();},30000);
      const wake=()=>{if(document.visibilityState==='visible')refreshDesktop();};
      document.addEventListener('visibilitychange',wake);
      window.addEventListener('online',wake);
      window.addEventListener('pakpost:desktop-session-expired',refreshDesktop);
      return()=>{mounted=false;clearInterval(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('pakpost:desktop-session-expired',refreshDesktop);};
    }
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
