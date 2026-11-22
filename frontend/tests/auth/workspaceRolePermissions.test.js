import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORKSPACE_ROLES,canGrantRole,normalizeRoles,canWorkspace,currentWorkspaceMember} from '../../src/features/workspace/services/workspaceRoles.js';
const read=path=>fs.readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
test('role catalog includes all five PakPost roles',()=>{
  assert.deepEqual(WORKSPACE_ROLES.map(r=>r.id),['TeamLead','WorkspaceAdmin','Developer','QA','TechnicalWriter']);
});
test('Workspace Admin cannot assign itself privileged roles',()=>{
  assert.equal(canGrantRole(['WorkspaceAdmin','Developer'],'TeamLead'),false);
  assert.equal(canGrantRole(['WorkspaceAdmin'],'WorkspaceAdmin'),false);
  assert.equal(canGrantRole(['WorkspaceAdmin'],'QA'),true);
  assert.equal(canGrantRole(['TeamLead'],'WorkspaceAdmin'),true);
});
test('workspace permission checks are based on effective permissions, not legacy role',()=>{
  const m={userId:'me',role:'Member',roles:['QA'],permissions:['collection.read','request.execute']};
  assert.equal(canWorkspace(m,'collection.write'),false);
  assert.equal(canWorkspace(m,'request.execute'),true);
  assert.equal(currentWorkspaceMember([m],{id:'me'}),m);
  assert.deepEqual(normalizeRoles(['QA','QA','Wrong']),['QA']);
});
test('Cloud mutations are secured in handlers, not just client buttons',()=>{
  const collections=read('backend/src/Pakpost.Application/Internal/Collections/Handlers/CreateCollectionHandler.cs');
  const saved = read('backend/src/Pakpost.Application/Internal/Collections/Services/SavedRequestsAccess.cs');
  const savedDelete = read('backend/src/Pakpost.Application/Internal/Collections/Handlers/DeleteSavedRequestHandler.cs');
  const env=read('backend/src/Pakpost.Application/Internal/Environments/Services/EnvironmentAccess.cs');
  assert.match(collections,/WorkspacePermissions.CollectionWrite/);
  assert.match(savedDelete,/destructive:\s*true/);
  assert.match(saved,/WorkspacePermissions.CollectionWrite/);
  assert.match(env,/WorkspacePermissions.EnvironmentWrite/);
  const ws=[
    read('backend/src/Pakpost.Application/Internal/Workspaces/Handlers/UpdateWorkspaceMemberRolesHandler.cs'),
    read('backend/src/Pakpost.Application/Internal/Workspaces/Services/RoleDelegation.cs')
  ].join('\n');
  assert.match(ws,/Cannot modify the founder/);
  assert.match(ws,/Only Team Lead may grant/);
});
test('member management supports multi-role selection and server-side update',()=>{
  const app=readWorkbenchSource();
  const workspace=read('frontend/src/features/workspace/components/WorkspaceMembersSection.jsx');
  const manager=read('frontend/src/features/workspace/components/WorkspaceManager.jsx');
  assert.match(app,/WorkspaceManager/);
  assert.match(workspace,/WorkspaceRolePicker/);
  assert.match(workspace,/\/members\/\$\{m\.userId\}\/roles/);
  assert.match(workspace,/canManageMembers/);
  assert.match(manager,/canCreateWorkspace/);
});
