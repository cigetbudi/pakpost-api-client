import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('system health panel uses minimal public health checks and authenticated private details', () => {
  const panel = file('../../src/features/settings/components/SystemHealthPanel.jsx');
  assert.match(panel, /['"]\/health\/live['"]/);
  assert.match(panel, /['"]\/health\/ready['"]/);
  assert.match(panel, /['"]\/api\/system\/health['"]/);
  assert.doesNotMatch(panel, /Authorization: `Bearer/);
  assert.match(panel, /setInterval\(refresh, 30000\)/);
  assert.doesNotMatch(panel, /localStorage|sessionStorage/);
});

test('health endpoints expose no secrets and detailed endpoint requires auth', () => {
  const endpoints = file('../../../backend/src/Pakpost.Api/Health/HealthServiceExtensions.cs');
  const controller = file('../../../backend/src/Pakpost.Api/Controllers/SystemHealthController.cs');
  assert.match(endpoints, /MapHealthChecks\("\/health\/live"/);
  assert.match(endpoints, /MapHealthChecks\("\/health\/ready"/);
  assert.match(controller, /\[Authorize\]/);
  assert.doesNotMatch(endpoints, /ConnectionString|Password/);
});

test('PostgreSQL availability does not enable blanket replay of writes', () => {
  const persistence = file('../../../backend/src/Pakpost.Infrastructure/Extensions/PersistenceServiceExtensions.cs');
  assert.match(persistence, /ConnectTimeoutSeconds/);
  assert.match(persistence, /CommandTimeoutSeconds/);
  assert.doesNotMatch(persistence, /EnableRetryOnFailure/);
});
