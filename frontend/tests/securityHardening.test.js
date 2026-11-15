import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('redacted environment variables cannot be silently interpolated into a request',()=>{
  const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(source,/varsFromEnv=.*filter\(v=>!v\.isRedacted\)/);
});
test('redacted environment variables are clearly restricted in the editor',()=>{
  const source=readFileSync(new URL('../src/features/EnvironmentExplorer.jsx',import.meta.url),'utf8');
  assert.match(source,/Restricted to Owner\/Admin/);
  assert.match(source,/disabled=\{!!v\.isRedacted\}/);
});
