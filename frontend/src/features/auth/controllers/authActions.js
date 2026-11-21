import { BROWSER_SESSION, setBrowserCsrf } from '../../../services/httpClient.js';
import {chooseWorkspaceId} from '../../workspace/services/workspaceViewPreference.js';
// Feature controller. Actions execute with the current Workbench context supplied
// by App; no global state, persistence middleware or extra network requests.
export function createAuthActions(dependencies) {
  const {
    STORAGE_WORKSPACE, announceSession, api, authBusy, currentTokenRef, getMessage,
    googleLinkPassword, setAuthBusy, setAuthError, setAuthMode, setAuthOpen, setCanCreateWorkspace,
    setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword, setGoogleLinked, setMe, setNotice, setPage,
    setSelectedWs, setStorageScope, setToken, setWorkspaceEnvironmentResult, setWorkspaces, token,
    currentUserRef, preferredWorkspaceId,
  } = dependencies;
  function requiresLogin(target = 'workspace') {
    if (token) return true;
    setAuthMode('login'); setAuthError(''); setAuthOpen(true);
    setNotice(`Sign in to access ${target}. The request tester is always available.`);
    return false;
  }
  function navigate(target) {
    if (target !== 'tester' && !requiresLogin(target)) return;
    setPage(target);
    if (target === 'workspace') loadWorkspaces();
  }
  function completeSignIn(data) {
    // Cookies are established by the server. Never store/receive a JWT here.
    const alreadySignedIn = currentTokenRef?.current === BROWSER_SESSION;
    setBrowserCsrf(data.csrfToken);
    if(currentTokenRef)currentTokenRef.current=BROWSER_SESSION;
    announceSession?.();
    setToken(BROWSER_SESSION);setStorageScope(STORAGE_WORKSPACE);setMe(data.user);setSelectedWs('');setWorkspaceEnvironmentResult({context:'',items:[]});setAuthOpen(false);
    setNotice(`Welcome, ${data.user.displayName}. You can now use workspaces.`);
    if(alreadySignedIn)loadWorkspaces(BROWSER_SESSION);
  }
  async function submitGoogleAuth(credential) {
    if (authBusy) return;
    setAuthBusy(true);setAuthError('');
    try { completeSignIn(await api('/api/auth/google','POST',{credential})); }
    catch(e) {setAuthError(getMessage(e));}
    finally {setAuthBusy(false);}
  }
  async function submitGoogleLink(credential) {
    if (authBusy || !token || !googleLinkPassword) return;
    setAuthBusy(true);setGoogleLinkError('');
    try {
      await api('/api/auth/google/link','POST',{credential,password:googleLinkPassword},token);
      setGoogleLinked(true);setGoogleLinkOpen(false);setGoogleLinkPassword('');setNotice('Google account connected. You can sign in with Google next time.');
    } catch(e) {setGoogleLinkError(getMessage(e));}
    finally {setAuthBusy(false);}
  }
  async function loadWorkspaces(auth = token, userId = currentUserRef?.current?.id) {
    if (!auth) return;
    try {
      const data = await api('/api/workspaces', 'GET', undefined, auth);
      // The cookie's marker is constant across accounts. Also guard by user ID
      // so an old account's slow response cannot select its workspace later.
      const stillCurrent=()=>auth===currentTokenRef.current &&
        (!userId||currentUserRef?.current?.id===userId);
      if(!stillCurrent())return;
      setWorkspaces(data);
      api('/api/workspaces/capabilities','GET',undefined,auth)
        .then(cap=>{if(stillCurrent())setCanCreateWorkspace(!!cap.canCreateWorkspace)})
        .catch(()=>{if(stillCurrent())setCanCreateWorkspace(false)});
      setSelectedWs(current=>chooseWorkspaceId(data,current,preferredWorkspaceId?.(userId)));
    } catch (e) { if(auth===currentTokenRef.current&&(!userId||currentUserRef?.current?.id===userId))setNotice(getMessage(e)); }
  }
  return { requiresLogin, navigate, completeSignIn, submitGoogleAuth, submitGoogleLink, loadWorkspaces };
}
