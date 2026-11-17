// Invitations workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createInvitationActions(dependencies) {
  const {
    acceptingInvite,
    api,
    canManageMembers,
    currentTokenRef,
    getMessage,
    invitationBusy,
    inviteEmail,
    inviteRoles,
    inviteToken,
    loadWorkspaces,
    selectedWorkspaceRef,
    selectedWs,
    setAcceptingInvite,
    setInvitationBusy,
    setInvitationError,
    setInvitationRows,
    setInviteAcceptError,
    setInviteEmail,
    setInviteOpen,
    setInviteRoles,
    setInviteToken,
    setNotice,
    setPage,
    setSelectedWs,
    setWsTab,
    token
  } = dependencies;

  async function inviteMember(e){
      e.preventDefault();
      if(invitationBusy||!inviteEmail.trim()||!inviteRoles.length||!selectedWs||!canManageMembers)return;
      const workspaceId=selectedWs;const auth=token;
      setInvitationBusy(true);setInvitationError('');
      try{
        await api(`/api/workspaces/${workspaceId}/invitations`,'POST',{email:inviteEmail.trim(),roles:inviteRoles},auth);
        const all=await api(`/api/workspaces/${workspaceId}/invitations`,'GET',undefined,auth);
        if(workspaceId!==selectedWorkspaceRef.current||auth!==currentTokenRef.current)return;
        setInvitationRows(all);setInviteOpen(false);setInviteEmail('');setInviteRoles(['Developer']);setNotice('Invitation email sent.');
      }catch(err){if(workspaceId===selectedWorkspaceRef.current)setInvitationError(getMessage(err));}
      finally{setInvitationBusy(false);}
    }

  async function actOnInvitation(invitation,operation){
      if(invitationBusy||!selectedWs||!canManageMembers)return;
      const workspaceId=selectedWs;const auth=token;
      setInvitationBusy(true);setInvitationError('');
      try{
        await api(`/api/workspaces/${workspaceId}/invitations/${invitation.id}${operation==='resend'?'/resend':''}`,operation==='resend'?'POST':'DELETE',undefined,auth);
        const all=await api(`/api/workspaces/${workspaceId}/invitations`,'GET',undefined,auth);
        if(workspaceId===selectedWorkspaceRef.current&&auth===currentTokenRef.current){setInvitationRows(all);setNotice(operation==='resend'?'Invitation resent':'Invitation revoked');}
      }catch(err){if(workspaceId===selectedWorkspaceRef.current)setInvitationError(getMessage(err));}
      finally{setInvitationBusy(false);}
    }

  async function acceptInvitation(){
      if(!token||!inviteToken||acceptingInvite)return;
      setAcceptingInvite(true);setInviteAcceptError('');
      try{
        const workspace=await api('/api/invitations/accept','POST',{token:inviteToken},token);
        setInviteToken('');await loadWorkspaces(token);setSelectedWs(workspace.id);setPage('workspace');setWsTab('members');setNotice('Workspace invitation accepted');
      }catch(err){setInviteAcceptError(getMessage(err));}
      finally{setAcceptingInvite(false);}
    }
  return { inviteMember, actOnInvitation, acceptInvitation };
}
