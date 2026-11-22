import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=file=>readFileSync(new URL('../../../backend/src/Pakpost.Api/Controllers/'+file,import.meta.url),'utf8');

test('browser session management keeps original routes, authenticated class and timeout policy',()=>{
  const auth=source('AuthController.cs'),sessions=source('AuthSessionsController.cs');
  assert.match(sessions,/\[ApiController, Authorize\]/);
  assert.match(sessions,/\[Route\("api\/auth"\)\]/);
  assert.match(sessions,/\[RequestTimeout\("auth"\)\]/);
  for(const route of ['logout','logout-all','sessions','sessions/\\{sessionId:guid\\}/revoke','sessions/revoke-others']) {
    const expected=route.replaceAll('\\','');
    assert.ok(sessions.includes('"'+expected+'"'),expected);
    assert.ok(!auth.includes('"'+expected+'"'),`duplicate route ${expected}`);
  }
  assert.match(sessions,/RevokeSessionAsync\(hub, sessionId\)/);
  assert.match(sessions,/RevokeOtherSessionsAsync\(hub/);
  assert.match(sessions,/RevokeUserAsync\(hub/);
  assert.match(auth,/\[HttpPost\("google"\), AllowAnonymous, EnableRateLimiting\("auth"\)\]/);
  assert.match(auth,/BrowserSessionCookies\.Options\(Request\)/);
  assert.match(auth,/GoogleLoginCommand/);
});
