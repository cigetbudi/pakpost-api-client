import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialWorkspaceUiState } from '../../src/features/workspace/store/workspaceUiDefaults.js';

const src = fileURLToPath(new URL('../../src/', import.meta.url));
const read = path => readFileSync(resolve(src, path), 'utf8');
const app = readWorkbenchSource();
const manager = read('features/workspace/components/WorkspaceManager.jsx');
const explorer = read('features/collections/components/WorkbenchExplorer.jsx');
const auth = read('features/auth/components/AuthOverlays.jsx');
const store = read('features/workspace/store/createWorkspaceUiStore.js');

test('Workspace UI starts with correctly typed collections, never lazy functions', () => {
  const state = initialWorkspaceUiState();
  for (const key of ['workspaces', 'members', 'newMemberRoles', 'editingMemberRoles', 'inviteRoles', 'invitationRows']) {
    assert.ok(Array.isArray(state[key]), `${key} must be an array at first render`);
  }
  assert.equal(state.selectedWs, '');
  assert.equal(state.wsTab, 'collections');
  assert.deepEqual(state.newMemberRoles, ['Developer']);
  assert.equal(state.invitationBusy, false);
});

test('defaults are isolated per mounted Workbench and cannot alias array values', () => {
  const a = initialWorkspaceUiState();
  const b = initialWorkspaceUiState();
  a.members.push({ userId: 'someone' });
  a.newMemberRoles.push('QA');
  assert.deepEqual(b.members, []);
  assert.deepEqual(b.newMemberRoles, ['Developer']);
  assert.notStrictEqual(a.invitationRows, b.invitationRows);
});

test('Zustand state is memory-only, scoped per App and cleared on logout', () => {
  assert.match(store, /createStore\(\(set\) =>/);
  assert.match(store, /resetWorkspaceUi:\s*\(\) => set\(initialWorkspaceUiState\(\)\)/);
  assert.match(store, /resolveUpdate\(update, s\.members\)/);
  assert.doesNotMatch(store, /\bpersist\(/);
  assert.match(app, /useState\(createWorkspaceUiStore\)/);
  assert.match(app, /workspaceUiStore\.getState\(\)\.resetWorkspaceUi\(\)/);
  for (const key of ['token', 'password', 'bearerToken', 'apiKeyValue', 'sessionEnvironmentOverlays']) {
    assert.ok(!(key in initialWorkspaceUiState()), `${key} must never live in workspace UI state`);
  }
});

test('Workspace, Explorer, and authentication are separated from App orchestration', () => {
  assert.match(app, /<WorkbenchExplorer\s/);
  assert.match(app, /<WorkspaceManager\s/);
  assert.match(app, /<AuthOverlays\s/);
  assert.match(manager, /<WorkspaceRolePicker/);
  assert.match(manager, /members\/\$\{m\.userId\}\/roles/);
  assert.match(explorer, /<LocalCollectionsTree/);
  assert.match(explorer, /<EnvironmentExplorer/);
  assert.match(auth, /<GoogleSignInButton/);
  assert.match(auth, /Workspace invitation/);
});

test('Workspace page is lazy-loaded, while optional tools remain deferred', () => {
  assert.match(app, /lazy\(\(\) => import\('\.\.\/\.\.\/features\/workspace\/components\/WorkspaceManager\.jsx'\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\.\/\.\.\/features\/collections\/components\/CollectionRunner\.jsx'\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\.\/\.\.\/features\/console\/components\/PakpostConsole\.jsx'\)/);
  assert.match(app, /<Suspense fallback=\{<div className="pp-feature-loading" role="status">Opening Workspace/);
});

test('all new components have resolvable local imports', () => {
  for (const name of ['features/workspace/components/WorkspaceManager.jsx', 'features/collections/components/WorkbenchExplorer.jsx', 'features/auth/components/AuthOverlays.jsx', 'features/workspace/store/createWorkspaceUiStore.js']) {
    const source = read(name);
    const parent = dirname(resolve(src, name));
    for (const [, importPath] of source.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)) {
      assert.ok(existsSync(resolve(parent, importPath)), `${name}: ${importPath}`);
    }
  }
});
