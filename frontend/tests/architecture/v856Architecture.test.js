import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createCollectionVariableActions } from '../../src/features/collections/controllers/collectionVariableActions.js';
import { createAuthActions } from '../../src/features/auth/controllers/authActions.js';
import { readWorkbenchSource, WORKBENCH_MODULES } from '../support/workbenchSource.js';

const src = name => readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');

// Protect the old cascade: moving styles to semantic paths must not reorder layers.
test('all former release-number styles have semantic filenames and a stable cascade', () => {
  const main = src('main.jsx');
  const cssImports = [...main.matchAll(/import ['"]\.\/(styles\/[^'"]+\.css)['"];?/g)].map(m => m[1]);
  assert.equal(cssImports.length, 32);
  assert.equal(cssImports.at(-2), 'styles/layers/workspace-founder-delete.css');
  assert.equal(cssImports.at(-1), 'styles/layers/motion-system.css');
  assert.ok(cssImports.indexOf('styles/layers/explorer-tree-alignment.css') < cssImports.indexOf('styles/layers/workspace-founder-delete.css'));
  assert.ok(cssImports[0] === 'styles/base.css');
  assert.ok(cssImports[1] === 'styles/clean-workbench.css');
  assert.ok(cssImports.indexOf('styles/layers/theme-and-surfaces.css') < cssImports.indexOf('styles/layers/qa-sandbox.css'));
  assert.ok(cssImports.indexOf('styles/layers/qa-sandbox.css') < cssImports.indexOf('styles/layers/realtime-conflicts.css'));
  for (const file of cssImports) {
    assert.doesNotMatch(file, /(^|\/)v\d+(?:-|\.)/);
    assert.equal(statSync(new URL(`../../src/${file}`, import.meta.url)).isFile(), true);
  }
  const files = readdirSync(new URL('../../src/', import.meta.url));
  assert.ok(!files.some(f => /^v\d+-.+\.css$/.test(f)), 'No release-number CSS filenames at root');
});

test('presentation and domain controllers are split with explicit App wiring', () => {
  const app = readWorkbenchSource();
  assert.ok(src('App.jsx').split('\n').length < 40, 'App entry must remain a thin composition root');
  for (const name of ['AppHeader','WorkbenchNavigation','CommandPalette','RequestWorkbench', 'CollectionDialogs','RequestDialogs']) {
    assert.match(app, new RegExp(`<${name}\\b`));
  }
  for (const name of ['createCollectionImportActions','createCollectionVariableActions','createDocumentationActions','createEnvironmentActions','createAuthActions','createRequestSaveActions']) {
    assert.match(app, new RegExp(`${name}\\(\\{`));
  }
  for (const file of WORKBENCH_MODULES) assert.ok(src(file).length > 100, `Empty source: ${file}`);
  assert.match(readWorkbenchSource(), /Save as Local Copy/);
  assert.match(readWorkbenchSource(), /ReferenceError|pp-script-diagnostic|scriptDiagnostic/);
});

test('factory input values are initialized before actions are constructed (blank-screen regression)', () => {
  const app = readWorkbenchSource();
  for (const [value, consumer] of [
    ['const selfMember=', 'createCollectionVariableActions({'],
    ['const canEditCloud=', 'createDocumentationActions({'],
    ['const activeRequestName =', 'createRequestSaveActions({'],
    ['localEnvironments: initialLocalEnvs()', 'createEnvironmentWorkbenchStore({'],
  ]) {
    assert.ok(app.includes(value) && app.includes(consumer), `${value} or ${consumer} missing`);
    if (value.startsWith('localEnvironments:')) continue;
    assert.ok(app.indexOf(value) < app.indexOf(consumer), `${value} initialized too late for ${consumer}`);
  }
  assert.doesNotMatch(app, /localEnvironments:\s*initialLocalEnvs\s*[,}]/);
});

test('Local Collection Variables controller keeps saved defaults distinct from session writes', async () => {
  const stored = new Map();
  const target = {scope:'local',collectionId:'col1'};
  let collections = [{id:'col1',variables:[{key:'application',value:'RAYA',isSecret:false}]}];
  let published = null;
  const controller = createCollectionVariableActions({
    api:()=>{throw Error('Local collection must never call the Cloud API');},
    canWorkspace:()=>false,
    collectionVariableKey:(t,_,user)=>`${user}:${t.collectionId}`,
    collectionVariablesData:{version:0,variables:[]},
    collectionVariablesFetchId:{current:0},
    collectionVariablesTarget:target,
    getMessage:error=>error.message,
    localCollections:collections,
    me:{id:'u1'},
    refreshSessionEnvironment:()=>{},
    resetCollectionVariables:(map,key)=>map.delete(key),
    savedCollectionVariablesCache:new Map(),
    selfMember:null,
    sessionCollectionVariables:{current:stored},
    setCollectionVariablesBusy:()=>{},
    setCollectionVariablesData:value=>{published=value;},
    setCollectionVariablesError:()=>{},
    setCollectionVariablesLoading:()=>{},
    setCollectionVariablesTarget:()=>{},
    setLocalCollections:updater=>{collections=updater(collections)},
    token:'',
    validateCollectionVariableRows:rows=>rows,
    writeCollectionVariables:(map,key,next)=>map.set(key,next),
  });
  assert.equal((await controller.readSavedCollectionVariables(target)).variables[0].value,'RAYA');
  controller.applyCollectionVariableSession({application:'TEST'});
  assert.equal(stored.get('u1:col1').application,'TEST');
  assert.equal(collections[0].variables[0].value,'RAYA','Script session must not persist to Saved Value');
  await controller.saveCollectionVariableDefaults([{key:'application',value:'RAYA2',isSecret:false}]);
  assert.equal(collections[0].variables[0].value,'RAYA2');
  assert.equal(published.variables[0].value,'RAYA2');
  controller.resetCollectionVariableSession();
  assert.equal(stored.size,0);
});

test('Auth controller signs in without requiring a global Zustand store', () => {
  const previous=globalThis.sessionStorage;
  const session = new Map();
  globalThis.sessionStorage={setItem:(key,value)=>session.set(key,value)};
  const updates={};
  try {
    const auth=createAuthActions({
      setToken:value=>{updates.token=value},setStorageScope:value=>{updates.scope=value},
      STORAGE_WORKSPACE:'workspace',setMe:value=>{updates.me=value},
      setSelectedWs:()=>{},setWorkspaceEnvironmentResult:()=>{},setAuthOpen:()=>{},
      setAuthForm:()=>{},setNotice:value=>{updates.notice=value},
    });
    auth.completeSignIn({csrfToken:'test-csrf-proof',user:{displayName:'Tester'}});
    assert.equal(session.has('pakpost_token'),false);
    assert.equal(updates.token,'pakpost:cookie-session');
    assert.equal(updates.scope,'workspace');
    assert.equal(updates.me.displayName,'Tester');
  } finally {globalThis.sessionStorage=previous;}
});
