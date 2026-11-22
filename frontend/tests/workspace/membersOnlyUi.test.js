import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialWorkspaceUiState } from '../../src/features/workspace/store/workspaceUiDefaults.js';
import { WORKSPACE_ROLES } from '../../src/features/workspace/services/workspaceRoles.js';
import { WORKSPACE_PERMISSION_GROUPS, groupEffectivePermissions } from '../../src/features/workspace/services/workspaceRoleInsights.js';

const read = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('REST navigation and Workspace Management offer Collections and Members & Roles without Teams', () => {
  const nav = read('src/components/layout/WorkbenchNavigation.jsx');
  const manager = read('src/features/workspace/components/WorkspaceManager.jsx');
  const members = read('src/features/workspace/components/WorkspaceMembersSection.jsx');
  const explorer = read('src/features/collections/components/WorkbenchExplorer.jsx');
  assert.doesNotMatch(nav, /\["teams","Teams"/);
  assert.match(manager, /\['members','Members & Roles',ShieldCheck\]/);
  assert.doesNotMatch(manager, /wsTab === 'teams'/);
  assert.doesNotMatch(explorer, /explorerTab === 'teams'/);
  assert.match(members, /members\/\$\{m\.userId\}\/roles/);
  assert.match(members, /inviteMember/);
});

test('Workbench no longer fetches Teams or retains team-only UI state', () => {
  const controller = read('src/app/hooks/useWorkbenchController.jsx');
  const explorerLayout = read('src/app/hooks/useExplorerPanelLayout.js');
  assert.doesNotMatch(controller, /api\(`\/api\/workspaces\/\$\{selectedWs\}\/teams/);
  assert.match(controller, /useExplorerPanelLayout\(/);
  assert.match(explorerLayout, /'collections', 'environments', 'history', 'code', 'exchange'/);
  const state = initialWorkspaceUiState();
  for (const key of ['teams','selectedTeam','teamMembers','newTeam','newTeamMember']) {
    assert.equal(key in state, false, `retired team-only UI key: ${key}`);
  }
});

test('Roles and server permission identities remain intact while legacy Teams permission is hidden from UI', () => {
  assert.equal(WORKSPACE_ROLES.find(role => role.id === 'TeamLead')?.label, 'Team Lead');
  assert.equal(WORKSPACE_PERMISSION_GROUPS.some(group => group.items.some(permission => permission.id === 'team.manage')), false);
  assert.equal(groupEffectivePermissions(['team.manage','member.manage']).some(group => group.items.some(permission => permission.id === 'team.manage')), false);
  assert.equal(groupEffectivePermissions(['member.manage']).find(group => group.id === 'people')?.items[0]?.enabled, true);
});
