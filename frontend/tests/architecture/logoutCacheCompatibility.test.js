import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression for the local App.jsx sign-out fix when orchestration moves to
// useWorkbenchController: the clearWorkbenchCache binding must move too.
test('Workbench sign-out retains cache invalidation after App relocation', () => {
  const hook = readFileSync(new URL('../../src/app/hooks/useWorkbenchController.jsx', import.meta.url), 'utf8');
  const logout = readFileSync(new URL('../../src/features/auth/controllers/createWorkbenchLogoutActions.js', import.meta.url), 'utf8');
  assert.match(hook, /createWorkbenchLogoutActions/);
  assert.match(logout, /import\s*\{[^}]*\bclearWorkbenchCache\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/workspace\/services\/workspaceCache\.js['"]/);
  assert.match(logout, /invalidateBrowserSession\(sessionStorage,\s*clearWorkbenchCache\)/);
});
