// Presentation-only helpers; backend remains the source of truth for permission and status.
export function isPendingInvitation(invitation,now=Date.now()) {
  return Boolean(invitation && !invitation.acceptedAt && !invitation.revokedAt &&
    Number.isFinite(Date.parse(invitation.expiresAt)) && Date.parse(invitation.expiresAt)>now);
}
export function canManageInvitation(actorRoles=[],assignedRoles=[]) {
  return actorRoles.includes('TeamLead') ||
    !assignedRoles.some(role=>role==='TeamLead'||role==='WorkspaceAdmin');
}
export function pendingInvitations(invitations=[],now=Date.now()) {
  return invitations.filter(invitation=>isPendingInvitation(invitation,now));
}
