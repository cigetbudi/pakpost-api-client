import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = name => readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');

// Validate the full contract between App and the extracted hooks, catching
// missing useState values that otherwise throw on the initial render.
const pickKeys = (text, matcher) => {
  const result = text.match(matcher);
  assert.ok(result, 'Expected state binding is missing');
  return result[1].split(',').map(s=>s.trim()).filter(Boolean);
};

const specs = [
  ['useRequestDraftEditor','features/requests/hooks/useRequestDraftEditor.js'],
  ['useAuthOverlayState','features/auth/hooks/useAuthOverlayState.js'],
  ['useCollectionSessionState','features/collections/hooks/useCollectionSessionState.js'],
];

test('App state destructuring matches hook exports exactly and has no duplicate fields', () => {
  const app = readWorkbenchSource();
  for (const [name, path] of specs) {
    const expression = new RegExp(`const \\{([\\s\\S]*?)\\} = ${name}\\(`);
    // Find the *nearest* declaration rather than including preceding unrelated state blocks.
    const before = app.substring(0,app.indexOf(`} = ${name}(`));
    const start = before.lastIndexOf('const {');
    assert.ok(start>=0,`Missing ${name} destructuring`);
    const expected = before.substring(start+'const {'.length).split(',').map(s=>s.trim()).filter(Boolean);
    const hook = source(path);
    const returns = pickKeys(hook,/return \{([\s\S]*?)\};\s*\}\s*$/);
    assert.deepEqual(returns.sort(),expected.sort(),`${name} must return exactly the consumed state`);
    assert.equal(new Set(returns).size,returns.length,`${name} must not duplicate keys`);
  }
});

test('auth and collection session state are never put in Zustand persist', () => {
  const auth=source('features/auth/hooks/useAuthOverlayState.js');
  const session=source('features/collections/hooks/useCollectionSessionState.js');
  const editor=source('features/requests/hooks/useRequestDraftEditor.js');
  for (const module of [auth,session,editor]){
    assert.doesNotMatch(module,/localStorage\.setItem|persist\(|sessionStorage\.setItem/);
  }
  assert.match(session,/sessionCollectionVariables\.current\.clear\(\)/);
  assert.match(session,/sessionEnvironmentOverlays\.current\.clear\(\)/);
});

test('App still uses lazy editors and never eagerly imports collection runner',()=>{
  const app=readWorkbenchSource();
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/collections\/components\/CollectionRunner\.jsx'\)\)/);
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/console\/components\/PakpostConsole\.jsx'\)\)/);
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/requests\/components\/Editors\.jsx'\)/);
});

test('a render error shows an accessible fallback instead of a blank page',()=>{
  const main=source('main.jsx');
  const boundary=source('components/ui/WorkbenchErrorBoundary.jsx');
  assert.match(main,/<WorkbenchErrorBoundary><App\/><\/WorkbenchErrorBoundary>/);
  assert.match(boundary,/getDerivedStateFromError/);
  assert.match(boundary,/role="alert"/);
  assert.match(boundary,/window\.location\.reload\(\)/);
  assert.doesNotMatch(boundary,/localStorage\.clear\(|sessionStorage\.clear\(/);
});
