import { readWorkbenchSource } from './support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Google Sign-In uses public client id and posts credential to backend', () => {
  const app = readWorkbenchSource();
  assert.match(app,/VITE_GOOGLE_CLIENT_ID/);
  assert.match(app,/api\/auth\/google'/);
  assert.match(app,/completeSignIn\(await api/);
  const auth=read('src/features/auth/components/AuthOverlays.jsx');
  assert.match(auth,/GoogleSignInButton/);
});
test('Existing account linking requires PakPost password and authenticated token', () => {
  const app=readWorkbenchSource();
  assert.match(app,/api\/auth\/google\/link/);
  assert.match(app,/password:googleLinkPassword},token/);
});
test('Google secret never goes into frontend runtime code', () => {
  const app=readWorkbenchSource()+read('src/features/GoogleSignInButton.jsx');
  assert.doesNotMatch(app,/client_secret|GOOGLE_CLIENT_SECRET/);
});
