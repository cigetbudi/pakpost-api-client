// Feature controller. Actions execute with the current Workbench context supplied
// by App; no global state, persistence middleware or extra network requests.
export function createAuthActions(dependencies) {
  const {
    STORAGE_WORKSPACE, announceSession, api, authBusy, authForm, authMode, currentTokenRef, getMessage,
    googleLinkPassword, setAuthBusy, setAuthError, setAuthForm, setAuthMode, setAuthOpen, setCanCreateWorkspace,
    setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword, setGoogleLinked, setMe, setNotice, setPage,
    setSelectedWs, setStorageScope, setToken, setWorkspaceEnvironmentResult, setWorkspaces, token,
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
    sessionStorage.setItem('pakpost_token', data.accessToken);
    if(currentTokenRef)currentTokenRef.current=data.accessToken;
    announceSession?.();
    setToken(data.accessToken);setStorageScope(STORAGE_WORKSPACE);setMe(data.user);setSelectedWs('');setWorkspaceEnvironmentResult({context:'',items:[]});setAuthOpen(false);
    setAuthForm({ displayName: '', email: '', password: '' });
    setNotice(`Welcome, ${data.user.displayName}. You can now use workspaces.`);
  }
  async function submitAuth(e) {
    e.preventDefault(); setAuthBusy(true); setAuthError('');
    try {
      const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register' ? authForm : { email: authForm.email, password: authForm.password };
      completeSignIn(await api(path, 'POST', payload));
    } catch (e) { setAuthError(getMessage(e)); }
    finally { setAuthBusy(false); }
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
  async function loadWorkspaces(auth = token) {
    if (!auth) return;
    try {
      const data = await api('/api/workspaces', 'GET', undefined, auth);
      // Logout or account switch may happen before this request resolves.
      if(auth!==currentTokenRef.current)return;
      setWorkspaces(data);
      api('/api/workspaces/capabilities','GET',undefined,auth).then(cap=>{if(auth===currentTokenRef.current)setCanCreateWorkspace(!!cap.canCreateWorkspace)}).catch(()=>setCanCreateWorkspace(false));
      setSelectedWs(current => data.some(x => x.id === current) ? current : (data[0]?.id || ''));
    } catch (e) { if(auth===currentTokenRef.current)setNotice(getMessage(e)); }
  }
  return { requiresLogin, navigate, completeSignIn, submitAuth, submitGoogleAuth, submitGoogleLink, loadWorkspaces };
}
