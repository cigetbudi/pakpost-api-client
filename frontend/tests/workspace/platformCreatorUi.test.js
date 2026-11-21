import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('instance admin controls are gated on server-returned admin status', () => {
  const settings = read('../../src/features/settings/components/WorkbenchSettings.jsx');
  const view = read('../../src/app/components/WorkbenchView.jsx');
  assert.match(settings, /me\?\.isSuperAdmin/);
  assert.match(settings, /InstanceAdminPanel/);
  assert.match(view, /token=\{token\} me=\{me\}/);
});

test('workspace creation permission is independent of team lead membership', () => {
  const handler = read('../../../backend/src/Pakpost.Application/Internal/Workspaces/Handlers/CreateWorkspaceHandler.cs');
  const policy = read('../../../backend/src/Pakpost.Application/Common/Security/WorkspaceDeploymentPolicy.cs');
  assert.match(handler, /policy\.CanCreateAsync/);
  assert.doesNotMatch(handler, /Only Team Lead can create another workspace/);
  assert.match(policy, /CanCreateWorkspaces/);
  assert.match(policy, /\"google\"/);
});
