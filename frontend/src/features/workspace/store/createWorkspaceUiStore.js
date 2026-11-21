import { createStore } from 'zustand/vanilla';
import { initialWorkspaceUiState } from './workspaceUiDefaults.js';

// Per-mounted-workbench UI state only. No global singleton, no persist middleware.
// Cloud permissions, network requests, and sensitive script values stay elsewhere.
const resolveUpdate = (next, previous) => typeof next === 'function' ? next(previous) : next;



export function createWorkspaceUiStore() {
  return createStore((set) => ({
    ...initialWorkspaceUiState(),
    setWorkspaces: (update) => set(s => ({ workspaces: resolveUpdate(update, s.workspaces) })),
    setSelectedWs: (update) => set(s => ({ selectedWs: resolveUpdate(update, s.selectedWs) })),
    setMembers: (update) => set(s => ({ members: resolveUpdate(update, s.members) })),
    setMembersWorkspaceId: (update) => set(s => ({ membersWorkspaceId: resolveUpdate(update, s.membersWorkspaceId) })),
    setWsTab: (update) => set(s => ({ wsTab: resolveUpdate(update, s.wsTab) })),
    setNewWs: (update) => set(s => ({ newWs: resolveUpdate(update, s.newWs) })),
    setNewCollection: (update) => set(s => ({ newCollection: resolveUpdate(update, s.newCollection) })),
    setNewMember: (update) => set(s => ({ newMember: resolveUpdate(update, s.newMember) })),
    setNewMemberRoles: (update) => set(s => ({ newMemberRoles: resolveUpdate(update, s.newMemberRoles) })),
    setEditingMemberId: (update) => set(s => ({ editingMemberId: resolveUpdate(update, s.editingMemberId) })),
    setEditingMemberRoles: (update) => set(s => ({ editingMemberRoles: resolveUpdate(update, s.editingMemberRoles) })),
    setMemberSearch: (update) => set(s => ({ memberSearch: resolveUpdate(update, s.memberSearch) })),
    setMemberRoleFilter: (update) => set(s => ({ memberRoleFilter: resolveUpdate(update, s.memberRoleFilter) })),
    setShowMemberAdd: (update) => set(s => ({ showMemberAdd: resolveUpdate(update, s.showMemberAdd) })),
    setInviteOpen: (update) => set(s => ({ inviteOpen: resolveUpdate(update, s.inviteOpen) })),
    setInviteEmail: (update) => set(s => ({ inviteEmail: resolveUpdate(update, s.inviteEmail) })),
    setInviteRoles: (update) => set(s => ({ inviteRoles: resolveUpdate(update, s.inviteRoles) })),
    setInvitationRows: (update) => set(s => ({ invitationRows: resolveUpdate(update, s.invitationRows) })),
    setInvitationError: (update) => set(s => ({ invitationError: resolveUpdate(update, s.invitationError) })),
    setInvitationBusy: (update) => set(s => ({ invitationBusy: resolveUpdate(update, s.invitationBusy) })),
    setExpandedMemberAccess: (update) => set(s => ({ expandedMemberAccess: resolveUpdate(update, s.expandedMemberAccess) })),
    setCanCreateWorkspace: (update) => set(s => ({ canCreateWorkspace: resolveUpdate(update, s.canCreateWorkspace) })),
    resetWorkspaceUi: () => set(initialWorkspaceUiState()),
  }));
}
