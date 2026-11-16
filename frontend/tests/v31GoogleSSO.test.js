import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Google Sign-In uses public client id and posts credential to backend', () => {
  const app = read('src/App.jsx');
  assert.match(app,/VITE_GOOGLE_CLIENT_ID/);
  assert.match(app,/api\/auth\/google'/);
  assert.match(app,/completeSignIn\(await api/);
  assert.match(app,/GoogleSignInButton/);
});
test('Existing account linking requires PakPost password and authenticated token', () => {
  const app=read('src/App.jsx');
  assert.match(app,/api\/auth\/google\/link/);
  assert.match(app,/password:googleLinkPassword},token/);
});
test('Google secret never goes into frontend runtime code', () => {
  const app=read('src/App.jsx')+read('src/features/GoogleSignInButton.jsx');
  assert.doesNotMatch(app,/client_secret|GOOGLE_CLIENT_SECRET/);
});
