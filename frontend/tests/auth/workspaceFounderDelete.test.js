import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../../..');
const read = relative => readFileSync(resolve(root, relative), 'utf8');

test('workspace deletion is authorized by immutable founder identity in the handler', () => {
  const handler = read('backend/src/Pakpost.Application/Internal/Workspaces/Handlers/DeleteWorkspaceHandler.cs');

  assert.match(handler, /workspace\.OwnerUserId != command\.ActorId/);
  assert.match(handler, /BeginSerializableAsync/);
  assert.match(handler, /DeleteOwnedAsync/);
  assert.match(handler, /transaction\.CommitAsync/);
});

test('workspace repository removes requests and folders before deleting workspace', () => {
  const repository = read('backend/src/Pakpost.Infrastructure/Persistence/Repositories/WorkspaceRepository.cs');

  const requests = repository.indexOf('db.SavedRequests');
  const folders = repository.indexOf('db.CollectionFolders');
  const workspace = repository.indexOf('db.Workspaces\n            .Where');

  assert.ok(requests >= 0 && folders > requests && workspace > folders);
  assert.match(repository, /OwnerUserId == founderId/);
});

test('only founder sees delete action and typed confirmation is required', () => {
  const component = read('frontend/src/features/workspace/components/WorkspaceManager.jsx');

  assert.match(component, /activeWorkspace\?\.ownerUserId === me\?\.id/);
  assert.match(component, /isFounder &&/);
  assert.match(component, /deleteConfirmation !== deleteTarget\.name/);
  assert.match(component, /role="alertdialog"/);
  assert.match(component, /api\(`\/api\/workspaces\/\$\{workspaceId\}`, 'DELETE'/);
});
