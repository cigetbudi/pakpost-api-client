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

test('JWT extraction preserves the existing PakPost security contract', () => {
  const auth = read('backend/src/Pakpost.Api/Extensions/AuthenticationServiceExtensions.cs');
  assert.match(auth, /Jwt:SigningKey/);
  assert.match(auth, /GetByteCount\(signingKey\) < 32/);
  assert.match(auth, /MapInboundClaims = false/);
  assert.match(auth, /StartsWithSegments\("\/hubs\/workspace"\)/);
  assert.match(auth, /Jwt:Issuer/);
  assert.match(auth, /Jwt:Audience/);
  assert.match(auth, /ValidateLifetime = true/);
  assert.match(auth, /ValidateIssuerSigningKey = true/);
  assert.match(auth, /TimeSpan\.FromSeconds\(30\)/);
});
