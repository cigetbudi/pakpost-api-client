import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORKSPACE_ROLES,canGrantRole,normalizeRoles,canWorkspace,currentWorkspaceMember} from '../src/features/workspaceRoles.js';
const read=path=>fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8');
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
  const collections=read('backend/src/Pakpost.Application/Internal/Collections/Collections.cs');
  const saved=read('backend/src/Pakpost.Application/Internal/Collections/SavedRequests.cs');
  const env=read('backend/src/Pakpost.Application/Internal/Environments/Environments.cs');
  assert.match(collections,/WorkspacePermissions.CollectionWrite/);
  assert.match(saved,/destructive:true/);
  assert.match(saved,/WorkspacePermissions.CollectionWrite/);
  assert.match(env,/WorkspacePermissions.EnvironmentWrite/);
  const ws=read('backend/src/Pakpost.Application/Internal/Workspaces/Workspaces.cs');
  assert.match(ws,/Cannot modify the founder/);
  assert.match(ws,/Only Team Lead may grant/);
});
test('member management supports multi-role selection and server-side update',()=>{
  const app=read('frontend/src/App.jsx');
  assert.match(app,/WorkspaceRolePicker/);
  assert.match(app,/\/members\/\$\{m\.userId\}\/roles/);
  assert.match(app,/canManageMembers/);
  assert.match(app,/canCreateWorkspace/);
});
