import { useEffect } from 'react';

/** Keep invitation lists scoped to the authorized workspace; drop stale results. */
export function useWorkspaceInvitationListing({
  api, canManageMembers, getMessage, selectedWorkspaceRef, selectedWs,
  setInvitationError, setInvitationRows, token, membershipRevision=0,
}) {
  useEffect(()=>{
    let active=true;
    if(!token||!selectedWs||!canManageMembers){setInvitationRows([]);return;}
    const workspaceId=selectedWs;
    api(`/api/workspaces/${workspaceId}/invitations`,'GET',undefined,token)
      .then(data=>{if(active&&workspaceId===selectedWorkspaceRef.current){setInvitationRows(data);setInvitationError('');}})
      .catch(e=>{if(active&&workspaceId===selectedWorkspaceRef.current)setInvitationError(getMessage(e))});
    return()=>{active=false};
  },[token,selectedWs,canManageMembers,membershipRevision]);
}
