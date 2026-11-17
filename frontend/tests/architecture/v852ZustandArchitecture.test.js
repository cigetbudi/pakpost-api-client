import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = readWorkbenchSource();
const store = source('../../src/features/requests/store/createRequestWorkbenchStore.js');
const tabs = source('../../src/features/requests/components/RequestTabs.jsx');
const body = source('../../src/features/requests/components/RequestBody.jsx');
const scripts = source('../../src/features/requests/components/ScriptEditor.jsx');

test('Zustand store is scoped to Workbench instance and supports updater callbacks', () => {
  assert.match(store, /createStore\(\(set\) =>/);
  for (const field of ['openTabs','activeTabId','reqTab','resTab']) {
    assert.match(store, new RegExp(`set${field[0].toUpperCase()+field.slice(1)}: \\(update\\) => set`));
  }
  assert.match(store, /typeof value === 'function' \? value\(previous\) : value/);
  assert.match(app, /useState\(\(\) => createRequestWorkbenchStore\(/);
  assert.doesNotMatch(store, /\bpersist\s*\(/);
  assert.doesNotMatch(store, /localStorage|sessionStorage/);
});

test('only stable selector outputs are subscribed, preserving Zustand 5 semantics', () => {
  assert.match(app,/useStore\(requestWorkbenchStore, s => s\.openTabs\)/);
  assert.match(app,/useStore\(requestWorkbenchStore, s => s\.activeTabId\)/);
  assert.match(tabs,/useStore\(store, state => state\.openTabs\)/);
  assert.match(tabs,/useStore\(store, state => state\.activeTabId\)/);
  assert.doesNotMatch(tabs,/useStore\(store,\s*state\s*=>\s*\(\{/);
});

test('request editor modules preserve variable-aware body and script diagnostics', () => {
  assert.match(body, /ariaLabel="Form field value"/);
  assert.match(body, /syntaxProblem\(body,languageFromMime\(format\)\)/);
  assert.match(body, /encodeFile\(file\)/);
  assert.match(scripts, /scriptDiagnostic\?\.phase==='pre'/);
  assert.match(scripts, /scriptDiagnostic\?\.phase==='post'/);
  assert.match(scripts, /pp-script-diagnostic-item/);
  assert.match(app, /reqTab === 'body' && <Suspense/);
  assert.match(app, /reqTab === 'scripts' && <Suspense/);
});

test('Cloud conflict, saved draft and tab close workflow remain in App orchestration', () => {
  assert.match(tabs, /hasUnsavedMarker\(/);
  assert.match(app, /async function saveCurrent\(/);
  assert.match(app, /showConflictDialog\(activeTabId\)/);
  assert.match(app, /function restoreDraft\(next\)/);
  assert.match(app, /function stashActive\(\)/);
});
