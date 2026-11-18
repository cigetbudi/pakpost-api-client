import React from 'react';
import { Layers3, ArrowRight, Plus, ChevronRight, FolderClosed, LockKeyhole, Users, ShieldCheck, FolderPlus, Trash2, Mail, Search, Pencil } from 'lucide-react';
import { api } from '../../../services/httpClient.js';
import { IconButton, Empty } from '../../../components/ui/WorkbenchPrimitives.jsx';
import { WorkspaceRolePicker } from './WorkspaceRolePicker.jsx';
import { WorkspaceAccessBreakdown } from './WorkspaceAccessBreakdown.jsx';
import { RetroSelect } from '../../../components/ui/RetroSelect.jsx';
import { pendingInvitations, canManageInvitation } from '../services/workspaceInvitations.js';
import { normalizeRoles, WORKSPACE_ROLES } from '../services/workspaceRoles.js';
import { roleSelectionChanged } from '../services/workspaceRoleInsights.js';

// Workspace is intentionally a separate view. It has no access to request
// drafts or authentication secrets; all mutations still use the same API/RBAC.
export function WorkspaceManager({ data, actions, refs }) {
  const { activeWorkspace, workspaces, canCreateWorkspace, newWs, token, busyAction } = data;
  const { selectedWs, wsTab, canEditCloud, newCollection, collections, selectedCol } = data;
  const { savedRequests, canManageTeams, newTeam, teams, selectedTeam, activeTeam } = data;
  const { newTeamMember, teamMembers, canManageMembers, showMemberAdd, inviteOpen, workspaceMemberStats } = data;
  const { newMember, newMemberRoles, assignableRoles, inviteEmail, inviteRoles, invitationBusy } = data;
  const { invitationRows, invitationError, memberSearch, memberRoleFilter, visibleWorkspaceMembers, me } = data;
  const { canAssignRoles, expandedMemberAccess, editingMemberId, editingMemberRoles } = data;
  const { setPage, doAction, setNewWs, loadWorkspaces, setSelectedWs, setNotice } = actions;
  const { setWsTab, setNewCollection, setCollections, setSelectedCol, loadSavedRequest, setSavedRequests } = actions;
  const { setNewTeam, setTeams, setSelectedTeam, setNewTeamMember, setTeamMembers, setShowMemberAdd } = actions;
  const { setInviteOpen, setNewMember, setNewMemberRoles, setMembers, inviteMember, setInviteEmail } = actions;
  const { setInviteRoles, actOnInvitation, setMemberSearch, setMemberRoleFilter, setExpandedMemberAccess, setEditingMemberId } = actions;
  const { setEditingMemberRoles } = actions;
  const { selectedWorkspaceRef, currentTokenRef } = refs;
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');
  const isFounder = activeWorkspace?.ownerUserId === me?.id;

  const closeDeleteDialog = () => {
    if (deleteBusy) return;

    setDeleteTarget(null);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const submitWorkspaceDeletion = async event => {
    event.preventDefault();

    if (
      deleteBusy ||
      !deleteTarget ||
      deleteConfirmation !== deleteTarget.name ||
      deleteTarget.ownerUserId !== me?.id
    ) {
      return;
    }

    setDeleteBusy(true);
    setDeleteError('');

    try {
      const workspaceId = deleteTarget.id;

      await api(`/api/workspaces/${workspaceId}`, 'DELETE', undefined, token);
      closeDeleteDialogAfterSuccess();
      setSelectedWs(current => current === workspaceId ? '' : current);
      await loadWorkspaces(token);

      if (currentTokenRef.current === token) {
        setNotice('Workspace permanently deleted.');
      }
    } catch (error) {
      setDeleteError(error?.message || 'Could not delete workspace.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const closeDeleteDialogAfterSuccess = () => {
    setDeleteTarget(null);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  return (
<div className="pp-manager">
          <div className="pp-manager-top"><div><span className="pp-manager-eyebrow"><Layers3 size={14}/> WORKSPACE MANAGEMENT</span><h2>{activeWorkspace?.name || 'Your workspaces'}</h2><p>Collections, teams and members are available after sign-in.</p></div><button className="pp-plain-btn" onClick={() => setPage('tester')}><ArrowRight size={15}/> Back to request tester</button></div>
          <div className="pp-manager-columns"><aside className="pp-manager-ws"><div className="pp-manager-label">YOUR WORKSPACES <span>{workspaces.length}</span></div>{canCreateWorkspace&&<form className="pp-manager-add" onSubmit={e => { e.preventDefault(); if(!newWs.trim()) return; doAction(async()=>{const w=await api('/api/workspaces','POST',{name:newWs.trim()},token);setNewWs('');await loadWorkspaces();setSelectedWs(w.id);setNotice('Workspace created.');}); }}><input placeholder="New workspace" maxLength={120} value={newWs} onChange={e=>setNewWs(e.target.value)}/><button title="Create workspace" disabled={busyAction}><Plus size={16}/></button></form>}{workspaces.map(w=><button className={`pp-manager-ws-row ${w.id === selectedWs ? 'active' : ''}`} key={w.id} onClick={()=>setSelectedWs(w.id)}><Layers3 size={17}/><span>{w.name}</span><ChevronRight size={15}/></button>)}</aside>
            <section className="pp-manager-details">{!activeWorkspace ? <Empty icon={FolderClosed} title="No workspace selected" description="Create a workspace on the left to start organizing your requests."/> : <>
              <div className="pp-manager-detail-title">
                <span className="pp-manager-avatar"><Layers3 size={18}/></span>
                <div><strong>{activeWorkspace.name}</strong><small>Private · Members only</small></div>
                <div className="pp-workspace-title-actions">
                  {isFounder && (
                    <button
                      type="button"
                      className="pp-workspace-delete-trigger"
                      disabled={busyAction}
                      onClick={() => {
                        setDeleteTarget(activeWorkspace);
                        setDeleteConfirmation('');
                        setDeleteError('');
                      }}
                    >
                      <Trash2 size={14}/>
                      Delete workspace
                    </button>
                  )}
                  <LockKeyhole size={15}/>
                </div>
              </div>
              <div className="pp-manager-tabs">{[['collections','Collections',FolderClosed],['teams','Teams',Users],['members','Members',ShieldCheck]].map(([id,label,Icon])=><button className={wsTab === id ? 'active':''} key={id} onClick={()=>setWsTab(id)}><Icon size={15}/>{label}</button>)}</div>
              {wsTab === 'collections' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Collections</strong>{canEditCloud&&<form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newCollection.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections`,'POST',{name:newCollection.trim()},token);setNewCollection('');setCollections(await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token));setNotice('Collection created');});}}><input placeholder="Collection name" maxLength={120} value={newCollection} onChange={e=>setNewCollection(e.target.value)}/><button title="Create collection" disabled={busyAction}><Plus size={16}/></button></form>}</div>{collections.map(c=><button className={`pp-manager-entry ${selectedCol === c.id ? 'active' : ''}`} key={c.id} onClick={()=>setSelectedCol(c.id)}><FolderClosed size={16}/><span>{c.name}</span><ChevronRight size={15}/></button>)}{!collections.length && <Empty icon={FolderPlus} title="No collections yet" description="Create your first collection above."/>}{selectedCol && <div className="pp-manager-saved"><h3>Saved requests</h3>{savedRequests.map(r=><div className="pp-manager-saved-row" key={r.id}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><button onClick={()=>loadSavedRequest(r)}><strong>{r.name}</strong><small>{r.url}</small></button>{canEditCloud&&<IconButton icon={Trash2} label="Delete request" disabled={busyAction} onClick={()=>doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests/${r.id}`,'DELETE',undefined,token);setSavedRequests(v=>v.filter(x=>x.id!==r.id));})}/>}</div>)}{!savedRequests.length && <p className="pp-muted-small">No saved requests in this collection.</p>}</div>}</div>}
              {wsTab === 'teams' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Teams</strong>{canManageTeams&&<form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newTeam.trim())return;doAction(async()=>{const t=await api(`/api/workspaces/${selectedWs}/teams`,'POST',{name:newTeam.trim()},token);setNewTeam('');setTeams(await api(`/api/workspaces/${selectedWs}/teams`,'GET',undefined,token));setSelectedTeam(t.id);setNotice('Team created');});}}><input placeholder="Team name" maxLength={120} value={newTeam} onChange={e=>setNewTeam(e.target.value)}/><button title="Create team" disabled={busyAction}><Plus size={16}/></button></form>}</div>{teams.map(t=><button className={`pp-manager-entry ${selectedTeam===t.id?'active':''}`} key={t.id} onClick={()=>setSelectedTeam(t.id)}><Users size={16}/><span>{t.name}</span><ChevronRight size={15}/></button>)}{!teams.length && <Empty icon={Users} title="No teams yet" description="Create a team above to manage collaboration."/>}{activeTeam && <div className="pp-manager-saved"><div className="pp-manager-section-heading"><strong>{activeTeam.name} members</strong>{canManageTeams&&<form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newTeamMember.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/teams/${selectedTeam}/members`,'POST',{email:newTeamMember.trim()},token);setNewTeamMember('');setTeamMembers(await api(`/api/workspaces/${selectedWs}/teams/${selectedTeam}/members`,'GET',undefined,token));setNotice('Member added to team');});}}><input type="email" placeholder="Member email" value={newTeamMember} onChange={e=>setNewTeamMember(e.target.value)}/><button title="Add to team" disabled={busyAction}><Plus size={16}/></button></form>}</div>{teamMembers.map(m=><div className="pp-manager-member" key={m.userId}><span>{m.displayName[0]}</span><div><strong>{m.displayName}</strong><small>{m.email}</small></div></div>)}<p className="pp-muted-small">A user must belong to this workspace before joining a team.</p></div>}</div>}
              {wsTab === 'members' && <div className="pp-manager-section">
                <div className="pp-roles-hero">
                  <div className="pp-roles-header">
                    <div><h3>Members & roles</h3><p>Roles apply only to <strong className="pp-roles-strong">{activeWorkspace?.name||'this workspace'}</strong>. Members can have multiple roles.</p></div>
                    {canManageMembers&&<div className="pp-member-actions">
                      <button type="button" className="pp-roles-button" aria-expanded={showMemberAdd} onClick={()=>{setShowMemberAdd(v=>!v);setInviteOpen(false)}}><Plus size={15}/> Add existing</button>
                      <button type="button" className="pp-roles-button primary" aria-expanded={inviteOpen} onClick={()=>{setInviteOpen(v=>!v);setShowMemberAdd(false)}}><Mail size={15}/> Invite via email</button>
                    </div>}
                  </div>
                  <div className="pp-roles-stats" aria-label="Workspace member statistics">
                    <span className="pp-roles-stat"><strong>{workspaceMemberStats.count}</strong> members</span>
                    {workspaceMemberStats.roles.filter(role=>role.count>0).map(role=><span className="pp-roles-stat" key={role.id}><strong>{role.count}</strong> {role.label}</span>)}
                  </div>
                </div>
                {canManageMembers&&showMemberAdd&&<form className="pp-roles-add" onSubmit={e=>{e.preventDefault();if(!newMember.trim()||!newMemberRoles.length)return;
                  doAction(async()=>{const workspaceId=selectedWs;await api(`/api/workspaces/${workspaceId}/members`,'POST',
                    {email:newMember.trim(),role:'Member',roles:newMemberRoles},token);
                    const refreshed=await api(`/api/workspaces/${workspaceId}/members`,'GET',undefined,token);
                    if(workspaceId!==selectedWorkspaceRef.current||token!==currentTokenRef.current)return;
                    setNewMember('');setNewMemberRoles(['Developer']);setShowMemberAdd(false);
                    setMembers(refreshed);setNotice('Member added with assigned roles');});}}>
                  <label htmlFor="pp-member-email">Email of an existing PakPost account</label>
                  <input id="pp-member-email" type="email" required maxLength={254} placeholder="teammate@company.com" value={newMember} onChange={e=>setNewMember(e.target.value)}/>
                  <div className="pp-rbac-heading">Assign initial roles</div>
                  <WorkspaceRolePicker value={newMemberRoles} onChange={setNewMemberRoles} actorRoles={assignableRoles} disabled={busyAction}/>
                  <p className="pp-roles-add-help">Only for users already registered in PakPost. Use Invite via email for new members.</p>
                  <div className="pp-roles-add-actions"><button type="button" className="pp-roles-button" onClick={()=>setShowMemberAdd(false)}>Cancel</button><button type="submit" className="pp-roles-button primary" disabled={busyAction||!newMemberRoles.length||!newMember.trim()}>Add member</button></div>
                </form>}
                {canManageMembers&&inviteOpen&&<form className="pp-roles-add pp-invite-form" onSubmit={inviteMember}>
                  <label htmlFor="pp-invite-email">Invite a new member via email</label>
                  <input id="pp-invite-email" type="email" autoFocus required maxLength={254} placeholder="teammate@company.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/>
                  <div className="pp-rbac-heading">Roles to assign when invitation is accepted</div>
                  <WorkspaceRolePicker value={inviteRoles} onChange={setInviteRoles} actorRoles={assignableRoles} disabled={invitationBusy}/>
                  <p className="pp-roles-add-help">Invitation lasts 7 days. The recipient must sign in with a Google-verified email matching this invitation.</p>
                  <div className="pp-roles-add-actions"><button type="button" className="pp-roles-button" onClick={()=>setInviteOpen(false)}>Cancel</button><button type="submit" className="pp-roles-button primary" disabled={invitationBusy||!inviteEmail.trim()||!inviteRoles.length}><Mail size={14}/> {invitationBusy?'Sending…':'Send invitation'}</button></div>
                </form>}
                {canManageMembers&&<section className="pp-invitations" aria-label="Workspace invitations">
                  <div className="pp-invitations-heading"><strong>Pending invitations</strong><span>{pendingInvitations(invitationRows).length} pending</span></div>
                  {invitationError&&<p className="pp-env-error" role="alert">{invitationError}</p>}
                  {pendingInvitations(invitationRows).map(i=><div className="pp-invite-item" key={i.id}>
                    <div className="pp-invite-info"><strong>{i.email}</strong><small>{(i.roles||[]).join(' + ')} · Expires {new Date(i.expiresAt).toLocaleDateString()}</small></div>
                    <div className="pp-invite-actions"><button type="button" disabled={invitationBusy||!canManageInvitation(assignableRoles,i.roles)} onClick={()=>actOnInvitation(i,'resend')}>Resend</button><button type="button" disabled={invitationBusy||!canManageInvitation(assignableRoles,i.roles)} onClick={()=>actOnInvitation(i,'revoke')}>Revoke</button></div>
                  </div>)}
                  {!pendingInvitations(invitationRows).length&&!invitationError&&<p className="pp-muted-small">No pending invitations for this workspace.</p>}
                </section>}
                <div className="pp-roles-toolbar">
                  <label className="pp-roles-search"><Search size={15}/><input aria-label="Search workspace members" type="search" placeholder="Search name or email" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)}/></label>
                  <RetroSelect className="pp-roles-filter" ariaLabel="Filter members by role" value={memberRoleFilter} onChange={setMemberRoleFilter}
                    options={[{value:'all',label:'All roles'},...WORKSPACE_ROLES.map(role=>({value:role.id,label:role.label}))]}/>
                  <span className="pp-roles-filter-count">{visibleWorkspaceMembers.length} shown</span>
                </div>
                <div className="pp-roles-member-list">
                  {visibleWorkspaceMembers.map(m=>{
                    const founder=m.userId===activeWorkspace?.ownerUserId;
                    const self=m.userId===me?.id;
                    const canModify=canAssignRoles&&!founder&&!self&&
                      (assignableRoles.includes('TeamLead')||!(m.roles||[]).some(r=>['TeamLead','WorkspaceAdmin'].includes(r)));
                    const accessOpen=expandedMemberAccess===m.userId;
                    const editorOpen=canModify&&editingMemberId===m.userId;
                    return <article className="pp-roles-member" key={m.userId}>
                      <div className="pp-roles-member-top">
                        <span className="pp-roles-avatar" aria-hidden="true">{m.displayName?.[0]||m.email?.[0]||'?'}</span>
                        <div className="pp-roles-member-id"><strong>{m.displayName||'Unnamed member'}</strong><small>{m.email}</small></div>
                        <div className="pp-roles-member-buttons">
                          <button type="button" aria-expanded={accessOpen} onClick={()=>setExpandedMemberAccess(current=>current===m.userId?'':m.userId)}><ShieldCheck size={14}/>{accessOpen?'Hide access':'View access'}</button>
                          {canModify&&<button type="button" aria-expanded={editorOpen} onClick={()=>{
                            if(editorOpen){setEditingMemberId('');setEditingMemberRoles([]);}else{setEditingMemberId(m.userId);setEditingMemberRoles(normalizeRoles(m.roles));}
                          }}><Pencil size={13}/>{editorOpen?'Cancel edit':'Manage roles'}</button>}
                        </div>
                      </div>
                      <div className="pp-roles-tags">{(m.roles||[]).map(roleId=><span className="pp-roles-tag" key={roleId}>{WORKSPACE_ROLES.find(role=>role.id===roleId)?.label||roleId}</span>)}
                        {founder&&<span className="pp-roles-tag muted">Founder · protected</span>}{self&&<span className="pp-roles-tag muted">You</span>}
                      </div>
                      {accessOpen&&<WorkspaceAccessBreakdown permissions={m.permissions||[]}/>}
                      {editorOpen&&<div className="pp-roles-role-edit">
                        <div className="pp-roles-role-edit-heading"><strong>Assign roles to {m.displayName||m.email}</strong><span>Changes affect only {activeWorkspace?.name}</span></div>
                        <WorkspaceRolePicker value={editingMemberRoles} onChange={setEditingMemberRoles} actorRoles={assignableRoles} disabled={busyAction}/>
                        <p className="pp-roles-add-help">Effective permissions are refreshed from the backend after Save. Privileged roles can only be granted by Team Lead.</p>
                        <div className="pp-roles-role-edit-actions">
                          <button type="button" className="pp-roles-button" onClick={()=>{setEditingMemberId('');setEditingMemberRoles([]);}}>Cancel</button>
                          <button type="button" className="pp-roles-button primary" disabled={busyAction||!editingMemberRoles.length||!roleSelectionChanged(m.roles,editingMemberRoles)}
                            onClick={()=>doAction(async()=>{const workspaceId=selectedWs;await api(`/api/workspaces/${workspaceId}/members/${m.userId}/roles`,'PUT',
                              {roles:editingMemberRoles},token);
                              const refreshed=await api(`/api/workspaces/${workspaceId}/members`,'GET',undefined,token);
                              if(workspaceId!==selectedWorkspaceRef.current||token!==currentTokenRef.current)return;
                              setMembers(refreshed);setEditingMemberId('');setEditingMemberRoles([]);setNotice('Workspace roles updated');})}>Save roles</button>
                        </div>
                      </div>}
                    </article>;
                  })}
                  {!visibleWorkspaceMembers.length&&<p className="pp-roles-empty">{workspaceMemberStats.count?'No members match your search or role filter.':'No members in this workspace yet.'}</p>}
                </div>
                <p className="pp-muted-small">Only Team Lead can assign privileged roles. Workspace Admin can assign Developer, QA and Technical Writer roles. Access is always verified by the backend.</p>
              </div>}
            </>}</section></div>
          {deleteTarget && (
            <div className="pp-workspace-delete-backdrop">
              <section
                className="pp-workspace-delete-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="pp-workspace-delete-title"
                aria-describedby="pp-workspace-delete-description"
              >
                <h3 id="pp-workspace-delete-title">Delete workspace</h3>
                <p id="pp-workspace-delete-description">
                  This permanently deletes <strong>{deleteTarget.name}</strong>, including its
                  collections, nested folders, saved requests, environments, teams,
                  memberships and invitations. This cannot be undone.
                </p>
                <form onSubmit={submitWorkspaceDeletion}>
                  <label htmlFor="pp-workspace-delete-confirmation">
                    Type <strong>{deleteTarget.name}</strong> to confirm
                  </label>
                  <input
                    id="pp-workspace-delete-confirmation"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    value={deleteConfirmation}
                    disabled={deleteBusy}
                    onChange={event => setDeleteConfirmation(event.target.value)}
                  />
                  {deleteError && <p role="alert" className="pp-workspace-delete-error">{deleteError}</p>}
                  <div className="pp-workspace-delete-actions">
                    <button type="button" onClick={closeDeleteDialog} disabled={deleteBusy}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="danger"
                      disabled={deleteBusy || deleteConfirmation !== deleteTarget.name}
                    >
                      <Trash2 size={14}/>
                      {deleteBusy ? 'Deleting…' : 'Delete permanently'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </div>
  );
}
