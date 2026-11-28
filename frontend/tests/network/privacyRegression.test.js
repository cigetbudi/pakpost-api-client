import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
function files(dir, predicate) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
    if (['bin', 'obj', 'node_modules', 'target', '.git', 'dist'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path, predicate) : entry.isFile() && predicate(path) ? [path] : [];
  });
}

// Deliberately targeted: generic words such as "segment" also match unrelated libraries.
const knownSdk = /^(?:@(?:sentry|posthog|opentelemetry|amplitude|segment|datadog|bugsnag|newrelic|microsoft\/applicationinsights)(?:\/|-|$)|(?:posthog|mixpanel|sentry|opentelemetry|amplitude|segment-analytics|analytics-node|hotjar|datadog|applicationinsights|appcenter|bugsnag|newrelic|google-analytics|react-ga|gtag)(?:[._-]|$)|Microsoft\.ApplicationInsights(?:\.|$)|OpenTelemetry(?:\.|$)|Sentry(?:\.|$))/i;
const quoted = text => [...text.matchAll(/"([^"\s]+)"/g)].map(match => match[1]);
// Bun lockfile includes both package keys and versioned package identifiers.
const bare = name => name.replace(/@[^@/]+$/, '');

test('known analytics and telemetry SDKs are not in dependency manifests or lockfiles', () => {
  const suspects = [];
  for (const path of ['frontend/package.json', 'frontend/bun.lock', 'desktop/package.json', 'desktop/bun.lock']) {
    for (const name of quoted(read(path)).map(bare)) {
      if (knownSdk.test(name)) suspects.push(`${path}: ${name}`);
    }
  }
  const cargo = 'desktop/src-tauri/Cargo.lock';
  for (const match of read(cargo).matchAll(/^name\s*=\s*"([^"]+)"/gm)) {
    if (knownSdk.test(match[1])) suspects.push(`${cargo}: ${match[1]}`);
  }
  for (const path of files('backend', path => /(?:\.csproj|Directory\.Packages\.props|packages\.lock\.json)$/.test(path))) {
    const names = path.endsWith('.json') ? quoted(read(path)) : [...read(path).matchAll(/<Package(?:Reference|Version)\b[^>]*\b(?:Include|Update)\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
    for (const name of names) if (knownSdk.test(name)) suspects.push(`${path}: ${name}`);
  }
  assert.deepEqual([...new Set(suspects)], [], 'Review unexpected analytics/telemetry dependencies');
});

test('application styles and entry HTML do not reference external Google Fonts', () => {
  const paths = ['frontend/index.html', ...files('frontend/src', path => path.endsWith('.css'))];
  const suspects = paths.filter(path => /fonts\.(?:googleapis|gstatic)\.com/i.test(read(path)));
  assert.deepEqual(suspects, []);
});
