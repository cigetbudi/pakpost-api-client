import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Search, UserRoundCheck, UserRoundX, Mail, Send, X } from 'lucide-react';
import { api } from '../../../services/httpClient.js';

const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
const invitationsUrl = '/api/admin/platform/creator-invitations';

/** Instance administration never confers workspace data access. */
export function InstanceAdminPanel({ token }) {
  const [policy, setPolicy] = useState(null);
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const policyData = await api('/api/admin/platform/policy', 'GET', undefined, token, { signal });
      const [usersData, invites] = await Promise.all([
        api(`/api/admin/platform/users?search=${encodeURIComponent(appliedQuery)}&page=${page}`, 'GET', undefined, token, { signal }),
        policyData.deploymentMode === 'Public' ? Promise.resolve([]) : api(invitationsUrl, 'GET', undefined, token, { signal }),
      ]);
      if (signal?.aborted) return;
      setPolicy(policyData);
      setUsers(usersData.items || []);
      setTotal(usersData.total || 0);
      setInvitations(invites || []);
    } catch (e) {
      if (!signal?.aborted) setError(e?.message || 'Unable to load instance users.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, page, appliedQuery]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [token, load]);

  async function submitAction() {
    if (!confirm || busyId) return;
    const action = confirm;
    setBusyId(action.id || 'invitation'); setNotice(''); setError('');
    try {
      if (action.kind === 'grant') {
        await api(`/api/admin/platform/users/${action.id}/workspace-creator`, 'PUT', { enabled: action.enabled }, token);
        setNotice(action.enabled ? 'Workspace Creator granted.' : 'Workspace Creator revoked.');
      } else if (action.kind === 'invite') {
        await api(invitationsUrl, 'POST', { email: action.email }, token);
        setNotice(`Invitation sent to ${action.email}. The recipient can activate access using Google.`);
      } else if (action.kind === 'resend') {
        await api(`${invitationsUrl}/${action.id}/resend`, 'POST', undefined, token);
        setNotice(`Invitation resent to ${action.email}. Previous link invalidated.`);
      } else if (action.kind === 'revoke') {
        await api(`${invitationsUrl}/${action.id}`, 'DELETE', undefined, token);
        setNotice(`Invitation revoked for ${action.email}.`);
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e?.message || 'Could not update instance permission.');
    } finally { setBusyId(''); }
  }

  const isPublic = policy?.deploymentMode === 'Public';
  const canInvite = !isPublic && !loading && total === 0 && isEmail(appliedQuery);
  const pendingForEmail = invitations.find(i => i.email?.toLowerCase() === appliedQuery.toLowerCase());
  return <div className="pp-instance-admin">
    <div className="pp-instance-admin-heading">
      <div><h2>Instance administration</h2><p>Manage who may create workspaces on this PakPost installation.</p></div>
      <button type="button" onClick={() => load()} disabled={loading || !!busyId}><RefreshCw size={15}/> Refresh</button>
    </div>
    {policy && <div className="pp-instance-admin-policy">
      <ShieldCheck size={18}/><div><strong>{isPublic ? 'Public' : 'Self-Hosted'} deployment</strong>
        <small>{isPublic ? 'Verified Google accounts can create workspaces. 10 seats per workspace, including pending invitations.' : 'Only approved Workspace Creators and instance admins can create workspaces. No member limit.'}</small></div>
    </div>}
    <form className="pp-instance-admin-search" onSubmit={e => {e.preventDefault();setPage(1);setAppliedQuery(query.trim());}}>
      <Search size={16}/><input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder="Search users by name or email" aria-label="Search instance users"/>
      <button type="submit">Search</button>
    </form>
    {error && <p role="alert" className="pp-security-error">{error}</p>}
    {notice && <p role="status" className="pp-security-success">{notice}</p>}
    {loading && <p className="pp-settings-muted">Loading users…</p>}
    {!loading && users.length === 0 && <div className="pp-instance-admin-empty">
      <p className="pp-settings-muted">No accounts found.</p>
      {canInvite && <div className="pp-instance-admin-invite-cta">
        <div><strong>{pendingForEmail ? 'Invitation already pending' : 'Invite a new Workspace Creator'}</strong>
          <small>{pendingForEmail ? 'Use Resend below to deliver a new link.' : 'The recipient will register with Google and activate workspace creation access.'}</small></div>
        <button type="button" disabled={!!busyId || !!pendingForEmail}
          onClick={()=>setConfirm({kind:'invite',email:appliedQuery.trim().toLowerCase()})}><Mail size={15}/> Invite via email</button>
      </div>}
    </div>}
    <div className="pp-instance-admin-users">
      {users.map(user => <div className="pp-instance-admin-user" key={user.id}>
        <span className="pp-instance-admin-icon">{user.canCreateWorkspaces || user.isSuperAdmin ? <UserRoundCheck size={19}/> : <UserRoundX size={19}/>}</span>
        <div><strong>{user.displayName || user.email}</strong><small>{user.email}</small>
          {user.isSuperAdmin && <small>Instance Admin</small>}
          {user.isDisabled && <small>Account disabled</small>}
        </div>
        <button type="button" disabled={isPublic || user.isSuperAdmin || user.isDisabled || !!busyId}
          onClick={()=>{setNotice('');setError('');setConfirm({kind:'grant',id:user.id,email:user.email,enabled:!user.canCreateWorkspaces});}}>
          {isPublic ? 'All Google users' : user.isSuperAdmin ? 'Admin' : user.canCreateWorkspaces ? 'Revoke creator' : 'Grant creator'}
        </button>
      </div>)}
    </div>
    {total > 20 && <div className="pp-instance-admin-pagination">
      <button type="button" disabled={page === 1 || loading} onClick={()=>setPage(v=>v-1)}>Previous</button>
      <span>Page {page} / {Math.ceil(total / 20)}</span>
      <button type="button" disabled={page * 20 >= total || loading} onClick={()=>setPage(v=>v+1)}>Next</button>
    </div>}
    {!isPublic && !loading && <section className="pp-instance-admin-pending" aria-label="Pending Workspace Creator invitations">
      <div className="pp-instance-admin-pending-head"><h3>Pending invitations</h3><small>{invitations.length} pending · links expire after 7 days</small></div>
      {!invitations.length && <p className="pp-settings-muted">No pending creator invitations.</p>}
      {invitations.map(invite => <div className="pp-instance-admin-invitation" key={invite.id}>
        <span className="pp-instance-admin-icon"><Mail size={17}/></span>
        <div><strong>{invite.email}</strong><small>Expires {new Date(invite.expiresAt).toLocaleString()}</small></div>
        <button type="button" disabled={!!busyId} onClick={()=>setConfirm({kind:'resend',id:invite.id,email:invite.email})}><Send size={14}/> Resend</button>
        <button type="button" disabled={!!busyId} onClick={()=>setConfirm({kind:'revoke',id:invite.id,email:invite.email})}><X size={14}/> Revoke</button>
      </div>)}
    </section>}
    <p className="pp-security-note">Platform permissions never grant access to another workspace's collections, environments, or secrets.</p>
    {confirm && <div className="pp-security-confirm" role="alertdialog" aria-modal="true" aria-labelledby="instance-creator-confirm-heading">
      <div className="pp-security-confirm-inner"><ShieldCheck size={22}/>
        <h3 id="instance-creator-confirm-heading">{confirm.kind === 'grant' ? (confirm.enabled ? 'Grant Workspace Creator?' : 'Revoke Workspace Creator?') : confirm.kind === 'invite' ? 'Send Workspace Creator invitation?' : confirm.kind === 'resend' ? 'Resend invitation?' : 'Revoke invitation?'}</h3>
        <p>{confirm.kind === 'grant' ? `${confirm.email} ${confirm.enabled ? 'will be allowed to create workspaces without joining an existing workspace.' : 'will no longer create new workspaces. Existing workspaces are unaffected.'}` : confirm.kind === 'invite' ? `Email a one-time invitation to ${confirm.email}. It expires after 7 days and requires matching Google sign-in.` : confirm.kind === 'resend' ? `Send a new link to ${confirm.email}? The previous link will stop working.` : `Revoke the pending invitation to ${confirm.email}?`}</p>
        <div><button type="button" disabled={!!busyId} onClick={()=>setConfirm(null)}>Cancel</button>
          <button type="button" disabled={!!busyId} onClick={submitAction}>{busyId ? 'Working…' : 'Confirm'}</button></div>
      </div>
    </div>}
  </div>;
}
