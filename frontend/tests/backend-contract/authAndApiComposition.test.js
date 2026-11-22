import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8');

test('API Program delegates mediator and session authentication to composition extensions', () => {
  const program = read('backend/src/Pakpost.Api/Program.cs');
  const startup = read('backend/src/Pakpost.Api/Extensions/PakpostHostExtensions.cs');
  assert.match(program, /builder\.Services\.AddPakpostServices\(builder\.Configuration\)/);
  assert.match(startup, /services\.AddApplication\(\)/);
  assert.match(startup, /services\.AddMediatorServices\(\)/);
  assert.match(startup, /services\.AddInfrastructure\(configuration\)/);
  assert.match(startup, /services\.AddJwtAuthentication\(configuration\)/);
  assert.doesNotMatch(program, /AddJwtBearer\(|AddMediator\(\(/);
});

test('cookie session auth defaults to server-side sessions and does not accept bearer JWT', () => {
  const auth = read('backend/src/Pakpost.Api/Extensions/AuthenticationServiceExtensions.cs');
  const middleware = read('backend/src/Pakpost.Api/Security/BrowserSessionSecurityMiddleware.cs');
  const handler = read('backend/src/Pakpost.Api/Security/BrowserSessionAuthenticationHandler.cs');
  const sessions = read('backend/src/Pakpost.Api/Security/ServerSessionStore.cs');
  assert.match(auth, /Jwt:SigningKey/); // still used as the HMAC key for CSRF proofs
  assert.match(auth, /DefaultAuthenticateScheme = BrowserSessionAuthenticationHandler\.SchemeName/);
  assert.doesNotMatch(auth,/AddJwtBearer\(/);
  assert.match(handler,/Request\.Cookies/);
  assert.match(sessions,/SHA256\.HashData/);
  assert.match(middleware,/X-PakPost-CSRF/);
  assert.match(middleware,/IsTrustedOrigin/);
});
