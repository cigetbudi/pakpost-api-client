import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
test('sign-in UI uses Google exclusively and has no password registration form', () => {
  const overlays = read('src/features/auth/components/AuthOverlays.jsx');
  const actions = read('src/features/auth/controllers/authActions.js');
  assert.match(overlays, /Sign in to PakPost/);
  assert.match(overlays, /GoogleSignInButton/);
  assert.doesNotMatch(overlays, /type="email"|type="password" required|submitAuth|Create account/);
  assert.doesNotMatch(actions, /api\/auth\/(?:register|login)|submitAuth/);
  assert.match(actions, /api\/auth\/google/);
});
test('password routes fail closed but leave a controlled legacy migration option', () => {
  const api = read('../backend/src/Pakpost.Api/Controllers/AuthController.cs');
  assert.match(api, /Authentication:EnableLegacyPasswordLogin/);
  assert.match(api, /StatusCodes.Status410Gone/);
  assert.match(api, /HttpPost\("register"\)/);
  assert.match(api, /HttpPost\("google"\)/);
});
