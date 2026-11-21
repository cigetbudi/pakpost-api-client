import React, { useEffect, useState } from 'react';
import { Dialog } from '../../../components/ui/WorkbenchPrimitives.jsx';

/**
 * Link-only platform invitation. The opaque token is never persisted in
 * localStorage/sessionStorage, sent to analytics, or displayed on screen.
 */
export function PlatformCreatorInvitationOverlay({ token, me, authOpen, workspaceInviteToken,
  setAuthOpen, api, onAccepted, setNotice }) {
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('creatorInvite') || '');
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('creatorInvite')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('creatorInvite');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }, []);

  async function accept() {
    if (!token || !inviteToken || accepting) return;
    setAccepting(true); setError('');
    try {
      await api('/api/admin/platform/creator-invitations/accept', 'POST', { token: inviteToken }, token);
      setInviteToken('');
      await onAccepted?.();
      setNotice?.('Workspace Creator access activated. You can now create a workspace.');
    } catch (err) {
      setError(err?.message || 'Unable to activate invitation.');
    } finally { setAccepting(false); }
  }

  if (!inviteToken || authOpen || workspaceInviteToken) return null;
  return <Dialog title="Workspace Creator invitation" subtitle="Activate permission to create your own PakPost workspaces." onClose={()=>setInviteToken('')}>
    <div className="modal-form">
      <p className="pp-muted-small">This invite is for an instance-level permission, not membership in another workspace. The invitation expires after 7 days and can only be used once.</p>
      {me && <p>Signed in as <strong>{me.email}</strong></p>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {token ? <button type="button" className="pp-modal-submit" disabled={accepting} onClick={accept}>
        {accepting ? 'Activating…' : 'Activate Workspace Creator access'}
      </button> : <button type="button" className="pp-modal-submit" onClick={()=>setAuthOpen(true)}>Continue with Google</button>}
      <p className="pp-muted-small">Sign in using the Google-verified email that received this invitation.</p>
      <button type="button" className="pp-roles-button" onClick={()=>setInviteToken('')}>Not now</button>
    </div>
  </Dialog>;
}
