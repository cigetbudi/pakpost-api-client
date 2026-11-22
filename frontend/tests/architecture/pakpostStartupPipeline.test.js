import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(`../../../backend/src/Pakpost.Api/${file}`, import.meta.url), 'utf8');

test('Program remains a thin composition root, keeping startup and endpoint mapping explicit', () => {
  const program = read('Program.cs');
  assert.ok(program.split('\n').length <= 20);
  for (const registration of [
    'builder.ConfigurePakpostHost()',
    'builder.Services.AddPakpostServices(builder.Configuration)',
    'app.UsePakpostRequestPipeline()',
    'app.MapPakpostEndpoints()',
  ]) assert.ok(program.includes(registration), registration);
  assert.match(program, /app.Run\(\)/);
});

test('pipeline retains middleware ordering required by cookie, CSRF, CORS and proxy security', () => {
  const pipeline = read('Extensions/PakpostApplicationExtensions.cs');
  const steps = [
    'app.UseForwardedHeaders()',
    'app.Services.GetRequiredService<WorkspaceCryptography>()',
    'app.UseMiddleware<RequestCorrelationMiddleware>()',
    'app.UseMiddleware<RequestLoggingMiddleware>()',
    'app.UseMiddleware<GlobalExceptionMiddleware>()',
    'app.UseRouting()',
    'app.UseRequestTimeouts()',
    'app.UseCors("Frontend")',
    'app.UseRateLimiter()',
    'app.UseMiddleware<PrivateApiCacheMiddleware>()',
    'app.UseMiddleware<ProxyConcurrencyMiddleware>()',
    'app.UseAuthentication()',
    'app.UseMiddleware<BrowserSessionSecurityMiddleware>()',
    'app.UseAuthorization()',
  ];
  let previous = -1;
  for (const step of steps) {
    const index = pipeline.indexOf(step);
    assert.ok(index > previous, `${step} must appear after the previous middleware`);
    previous = index;
  }
  assert.match(pipeline, /CloseOnAuthenticationExpiration = true/);
  assert.match(pipeline, /\.DisableRequestTimeout\(\)/);
});

test('reverse proxy trust stays restricted to configured known IPs', () => {
  const startup = read('Extensions/PakpostHostExtensions.cs');
  assert.match(startup, /ForwardedHeaders\.XForwardedProto/);
  assert.match(startup, /ForwardedHeaders:KnownProxies/);
  assert.match(startup, /IPAddress\.TryParse/);
  assert.doesNotMatch(startup, /KnownNetworks\.Clear\(\)|KnownProxies\.Clear\(\)/);
});
