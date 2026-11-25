import {PRIVILEGED_ROLES} from './workspaceRoles.js';

export function canRemoveWorkspaceMember({canManageMembers,workspace,actor,actorRoles,member}) {
  return Boolean(canManageMembers && workspace?.id && actor?.id && member?.userId &&
    member.userId!==actor.id && member.userId!==workspace.ownerUserId &&
    (actorRoles.includes('TeamLead') || !(member.roles||[]).some(role=>PRIVILEGED_ROLES.includes(role))));
}
