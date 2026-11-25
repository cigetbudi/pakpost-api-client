/** Member roles and invitations only; workspace creation never depends on team membership. */
import {useState} from 'react';
import {Plus, Mail, Search, Pencil, ShieldCheck, UserMinus} from 'lucide-react';
import {canRemoveWorkspaceMember} from '../services/workspaceMemberRemoval.js';
import {api} from '../../../services/httpClient.js';
import {WorkspaceRolePicker} from './WorkspaceRolePicker.jsx';
import {WorkspaceAccessBreakdown} from './WorkspaceAccessBreakdown.jsx';
import {RetroSelect} from '../../../components/ui/RetroSelect.jsx';
import {pendingInvitations,canManageInvitation} from '../services/workspaceInvitations.js';
import {normalizeRoles,WORKSPACE_ROLES} from '../services/workspaceRoles.js';
import {roleSelectionChanged} from '../services/workspaceRoleInsights.js';

export function WorkspaceMembersSection({data,actions,refs,maxSeats,reservedSeats,atCapacity}) {
  const {activeWorkspace,token,busyAction,selectedWs,canManageMembers,showMemberAdd,inviteOpen,workspaceMemberStats,
    newMember,newMemberRoles,assignableRoles,inviteEmail,inviteRoles,invitationBusy,invitationRows,
    invitationError,memberSearch,memberRoleFilter,visibleWorkspaceMembers,me,canAssignRoles,
    expandedMemberAccess,editingMemberId,editingMemberRoles}=data;
  const {doAction,setShowMemberAdd,setInviteOpen,setNewMember,setNewMemberRoles,setMembers,
    inviteMember,setInviteEmail,setInviteRoles,actOnInvitation,setMemberSearch,setMemberRoleFilter,
    setExpandedMemberAccess,setEditingMemberId,setEditingMemberRoles,setNotice,removeWorkspaceMember}=actions;
  const {selectedWorkspaceRef,currentTokenRef}=refs;
  const [removing,setRemoving]=useState(null);
  const [removeBusy,setRemoveBusy]=useState(false);
  const [removeError,setRemoveError]=useState('');
  const canRemove=m=>canRemoveWorkspaceMember({canManageMembers,workspace:activeWorkspace,actor:me,actorRoles:assignableRoles,member:m});
  const confirmRemove=async m=>{
    if(removeBusy||busyAction||!canRemove(m)||removing!==m.userId)return;
    setRemoveBusy(true);setRemoveError('');
    try{await removeWorkspaceMember(m);setRemoving(null);}
    catch(error){setRemoveError(error?.message||'Could not remove member');}
    finally{setRemoveBusy(false);}
  };
  return (
<div className="pp-manager-section">
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
                    {maxSeats !== null && <span className="pp-roles-stat"><strong>{Math.min(reservedSeats, maxSeats)} / {maxSeats}</strong> seats used <small>(includes pending invites)</small></span>}
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
                  <p className="pp-roles-add-help">Invitation lasts 7 days. The recipient must sign in with a Google-verified email matching this invitation.{atCapacity ? ' This workspace has reached the Public 10-seat limit.' : ''}</p>
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
                          {canRemove(m)&&<button type="button" className="pp-member-remove" disabled={busyAction||removeBusy}
                            aria-expanded={removing===m.userId} onClick={()=>{setRemoving(m.userId);setRemoveError('');}}><UserMinus size={14}/> Remove</button>}
                        </div>
                      </div>
                      <div className="pp-roles-tags">{(m.roles||[]).map(roleId=><span className="pp-roles-tag" key={roleId}>{WORKSPACE_ROLES.find(role=>role.id===roleId)?.label||roleId}</span>)}
                        {founder&&<span className="pp-roles-tag muted">Founder · protected</span>}{self&&<span className="pp-roles-tag muted">You</span>}
                      </div>
                      {canRemove(m)&&removing===m.userId&&<section className="pp-member-remove-confirm" aria-label="Confirm member removal">
                        <strong>Remove {m.displayName||m.email}?</strong>
                        <p>They will lose access to this workspace. Their PakPost account and shared requests will not be deleted.</p>
                        {removeError&&<p role="alert" className="pp-env-error">{removeError}</p>}
                        <div className="pp-workspace-delete-actions">
                          <button type="button" disabled={removeBusy} onClick={()=>setRemoving(null)}>Cancel</button>
                          <button type="button" className="danger" disabled={removeBusy||busyAction} onClick={()=>confirmRemove(m)}><UserMinus size={14}/>{removeBusy?'Removing…':'Remove member'}</button>
                        </div>
                      </section>}
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
              </div>
  );
}
