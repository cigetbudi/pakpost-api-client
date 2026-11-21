import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8');

test('API Program delegates Mediator and JWT setup to focused extensions', () => {
  const program = read('backend/src/Pakpost.Api/Program.cs');
  assert.match(program, /builder\.Services\.AddApplication\(\)/);
  assert.match(program, /builder\.Services\.AddMediatorServices\(\)/);
  assert.match(program, /builder\.Services\.AddInfrastructure\(builder\.Configuration\)/);
  assert.match(program, /builder\.Services\.AddJwtAuthentication\(builder\.Configuration\)/);
  assert.doesNotMatch(program, /AddJwtBearer\(|AddMediator\(\(/);
});

test('cookie session auth defaults to server-side sessions and does not accept bearer JWT', () => {
  const auth = read('backend/src/Pakpost.Api/Extensions/AuthenticationServiceExtensions.cs');
  const middleware = read('backend/src/Pakpost.Api/Security/BrowserSessionSecurityMiddleware.cs');
  const handler = read('backend/src/Pakpost.Api/Security/BrowserSessionAuthenticationHandler.cs');
  const sessions = read('backend/src/Pakpost.Api/Security/ServerSessionStore.cs');
  assert.match(auth, /Jwt:SigningKey/); // still used as the HMAC key for CSRF proofs
  assert.match(auth, /DefaultAuthenticateScheme = BrowserSessionAuthenticationHandler\.Scheme/);
  assert.doesNotMatch(auth,/AddJwtBearer\(/);
  assert.match(handler,/Request\.Cookies/);
  assert.match(sessions,/SHA256\.HashData/);
  assert.match(middleware,/X-PakPost-CSRF/);
  assert.match(middleware,/IsTrustedOrigin/);
});
