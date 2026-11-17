import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression for the local App.jsx sign-out fix when orchestration moves to
// useWorkbenchController: the clearWorkbenchCache binding must move too.
test('Workbench sign-out retains cache invalidation after App relocation', () => {
  const hook = readFileSync(new URL('../../src/app/hooks/useWorkbenchController.jsx', import.meta.url), 'utf8');
  assert.match(hook, /import\s*\{[^}]*\bclearWorkbenchCache\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/features\/workspace\/services\/workspaceCache['"]/);
  assert.match(hook, /invalidateBrowserSession\(sessionStorage,\s*clearWorkbenchCache\)/);
});
