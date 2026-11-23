/** Server-revoked logout; keep credential invalidation before reading cached drafts. */
import {setBrowserCsrf} from '../../../services/httpClient.js';
import {invalidateBrowserSession,planSignedOutWorkbench} from '../services/logoutWorkbench.js';
import {clearWorkbenchCache} from '../../workspace/services/workspaceCache.js';
import {clearWorkspaceCollectionDocs} from '../../collections/services/documentationStore.js';

export function createWorkbenchLogoutActions({
  authEpochRef,api,currentTokenRef,authTabSyncRef,getMessage,setNotice,sessionStorage,localStorage,
  setWorkspaceCollectionDocs,setToken,setMe,setStorageScope,STORAGE_LOCAL,setPage,
  setAuthOpen,setGoogleLinkOpen,setGoogleLinked,setGoogleLinkPassword,
  setRecent,setCollections,setSavedRequests,setWorkspaceRequestLists,
  setRemoteAlerts,setConflictDialog,setVersionDialog,workspaceUiStore,
  sessionEnvironmentOverlays,sessionCollectionVariables,savedCollectionVariablesCache,
  sessionDocumentationOverlays,setWorkspaceEnvironmentResult,
  openTabsRef,activeTabRef,draftsRef,snapshotRef,setOpenTabs,setActiveTabId,restoreDraft,
}) {
  async function logout() {
    authEpochRef.current += 1;
    try {
      await api('/api/auth/logout','POST',{},currentTokenRef.current);
      if(window.__TAURI_INTERNALS__ && window.__PAKPOST_DESKTOP_REMOTE__){
        try{const {invoke}=await import('@tauri-apps/api/core');await invoke('disconnect_remote');}catch{}
        window.__PAKPOST_DESKTOP_REMOTE__=false;
      }
      performLogout(true);
      return true;
    } catch (error) {
      if (error?.status === 401) {performLogout(true);return true;}
      setNotice(`Logout could not revoke the server session: ${getMessage(error)}. Try again.`);
      return false;
    }
  }
  function performLogout(broadcast) {
    authEpochRef.current += 1;
    if(broadcast)authTabSyncRef.current?.announceLogout();
    setBrowserCsrf('');
    // Auth invalidation must happen BEFORE reading any cached draft: missing
    // Local snapshots previously threw inside restoreDraft and aborted logout.
    currentTokenRef.current='';
    invalidateBrowserSession(sessionStorage, clearWorkbenchCache);
    clearWorkspaceCollectionDocs(localStorage);
    setWorkspaceCollectionDocs({});
    setToken('');setMe(null);setStorageScope(STORAGE_LOCAL);setPage('tester');
    setAuthOpen(false);setGoogleLinkOpen(false);setGoogleLinked(false);
    setGoogleLinkPassword('');
    setRecent([]);setCollections([]);setSavedRequests([]);setWorkspaceRequestLists({});
    setRemoteAlerts({});setConflictDialog(null);setVersionDialog(null);
    workspaceUiStore.getState().resetWorkspaceUi();
    sessionEnvironmentOverlays.current.clear();sessionCollectionVariables.current.clear();
    savedCollectionVariablesCache.current.clear();sessionDocumentationOverlays.current.clear();
    setWorkspaceEnvironmentResult({context:'',items:[]});
    // Only retain Local requests, with a guaranteed draft for every tab.
    let planned;
    try {
      planned=planSignedOutWorkbench(openTabsRef.current,activeTabRef.current,
        draftsRef.current,snapshotRef.current());
    } catch {
      planned=planSignedOutWorkbench([],null,{},null);
    }
    draftsRef.current=planned.drafts;
    activeTabRef.current=planned.activeTabId;
    setOpenTabs(planned.tabs);setActiveTabId(planned.activeTabId);
    restoreDraft(planned.activeDraft);
    setNotice('Signed out. Your Local requests remain available.');
  }
  return {logout,performLogout};
}
