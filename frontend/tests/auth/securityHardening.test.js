import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('redacted environment variables cannot be silently interpolated into a request',()=>{
  const source=readWorkbenchSource();
  // The central helper filters redacted values before any script or request can use them.
  const helper=readFileSync(new URL('../../src/features/environments/services/sessionEnvironment.js',import.meta.url),'utf8');
  assert.match(source,/const base=readableEnvironmentValues\(activeEnvironment\)/);
  assert.match(helper,/filter\(variable => variable\?\.key && !variable\.isRedacted\)/);
});
test('redacted environment variables are clearly restricted in the editor',()=>{
  const source=readFileSync(new URL('../../src/features/environments/components/EnvironmentExplorer.jsx',import.meta.url),'utf8');
  assert.match(source,/Restricted to Owner\/Admin/);
  assert.match(source,/disabled=\{!!v\.isRedacted\}/);
});
