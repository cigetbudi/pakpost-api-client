import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fileText = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const collectionStoreText = fileText('../src/features/collections/store/createCollectionWorkbenchStore.js');
const environmentStoreText = fileText('../src/features/environments/store/createEnvironmentWorkbenchStore.js');
const collectionHookText = fileText('../src/features/collections/store/useCollectionWorkbench.js');
const environmentHookText = fileText('../src/features/environments/store/useEnvironmentWorkbench.js');
const environmentViewText = fileText('../src/features/environments/hooks/useScopedEnvironmentView.js');
const appText = fileText('../src/App.jsx');

// Unit-test store actions without fetching React/Zustand dependencies in the
// Node-only source test runner. Bun's full tests/build use the installed package.
async function loadStoreFactory(code) {
  const injected = `
    const createStore = init => {
      let state;
      const set = updater => {
        const change = typeof updater === 'function' ? updater(state) : updater;
        state = { ...state, ...change };
      };
      state = init(set, () => state);
      return { getState: () => state };
    };
  `;
  const standalone = injected + code.replace(/^import\s*\{\s*createStore\s*\}\s*from\s*['"]zustand\/vanilla['"];?\s*/m, '');
  const url = 'data:text/javascript;base64,' + Buffer.from(standalone).toString('base64');
  return import(url);
}

test('Collections store stays scoped per workbench and updater actions preserve prior state', async () => {
  const {createCollectionWorkbenchStore} = await loadStoreFactory(collectionStoreText);
  const first = createCollectionWorkbenchStore({ localCollections: [{id:'local-one'}], collectionSort:'name-asc' });
  const second = createCollectionWorkbenchStore({ localCollections: [{id:'local-two'}] });
  first.getState().setLocalCollections(previous => [...previous, {id:'new-local'}]);
  first.getState().setSelectedCol('cloud-col-a');
  first.getState().setWorkspaceRequestLists({ 'workspace-a:cloud-col-a': [{id:'private-request'}] });
  assert.equal(first.getState().localCollections.length, 2);
  assert.equal(first.getState().collectionSort, 'name-asc');
  assert.deepEqual(second.getState().localCollections, [{id:'local-two'}]);
  assert.equal(second.getState().selectedCol, '');
  assert.deepEqual(second.getState().workspaceRequestLists, {});
  first.getState().clearWorkspaceData();
  assert.deepEqual(first.getState().workspaceRequestLists, {});
  assert.deepEqual(first.getState().savedRequests, []);
  assert.equal(first.getState().selectedCol, '');
  // Private local collections must survive a Cloud context reset.
  assert.deepEqual(first.getState().localCollections.map(item=>item.id), ['local-one','new-local']);
});

test('Environment store isolates account/workspace Cloud results and keeps Local defaults', async () => {
  const {createEnvironmentWorkbenchStore} = await loadStoreFactory(environmentStoreText);
  const local = [{id:'local-environment',name:'Local'}];
  const first = createEnvironmentWorkbenchStore({localEnvironments:local,environmentSelections:{local:'local-environment'}});
  const second = createEnvironmentWorkbenchStore();
  first.getState().setWorkspaceEnvironmentResult({context:'workspace:user-a:ws-1',items:[{id:'private-env'}]});
  assert.equal(first.getState().workspaceEnvironmentResult.items[0].id,'private-env');
  assert.deepEqual(second.getState().workspaceEnvironmentResult.items, []);
  first.getState().setEnvironmentSelections(old=>({...old,'workspace:user-a:ws-1':'private-env'}));
  assert.deepEqual(second.getState().environmentSelections,{});
  first.getState().clearWorkspaceEnvironments();
  assert.deepEqual(first.getState().workspaceEnvironmentResult,{context:'',items:[]});
  assert.deepEqual(first.getState().localEnvironments,local);
  assert.equal(first.getState().environmentSelections.local,'local-environment');
});

test('App consumes feature stores without global singletons or generic persistence', () => {
  assert.match(appText,/useState\(\(\) => createCollectionWorkbenchStore\(/);
  assert.match(appText,/useState\(\(\) => createEnvironmentWorkbenchStore\(/);
  assert.match(appText,/useCollectionWorkbench\(collectionStore\)/);
  assert.match(appText,/useEnvironmentWorkbench\(environmentStore\)/);
  assert.match(appText,/useScopedEnvironmentView\(/);
  assert.doesNotMatch(appText,/\[localEnvironments,\s*setLocalEnvironments\]\s*=\s*useState/);
  assert.doesNotMatch(appText,/\[workspaceRequestLists,\s*setWorkspaceRequestLists\]\s*=\s*useState/);
  for (const text of [collectionStoreText,environmentStoreText]) {
    assert.doesNotMatch(text,/\bpersist\s*\(/);
    assert.doesNotMatch(text,/\b(?:localStorage|sessionStorage)\s*\./);
  }
  for (const hook of [collectionHookText,environmentHookText]) {
    assert.match(hook,/useStore\(store, s => s\./);
    assert.doesNotMatch(hook,/useStore\(store,\s*s\s*=>\s*\(\{/);
  }
});

test('Cloud environments still validate account/workspace, active ID and stale async context', () => {
  assert.match(environmentViewText,/environmentContextKey\(STORAGE_WORKSPACE, selectedWs, userId\)/);
  assert.match(environmentViewText,/environmentsForContext\(workspaceEnvironmentResult, cloudEnvironmentContext\)/);
  assert.match(environmentViewText,/currentEnvironments\.some\(env => env\.id === selectedEnvironmentId\)/);
  assert.match(environmentViewText,/context !== cloudEnvironmentContextRef\.current/);
  assert.match(appText,/cloudEnvironmentContextRef\.current===context/);
  assert.match(appText,/workspaceFetchEpoch\.current/);
  assert.match(appText,/writeEnvironmentSelections\(localStorage,environmentSelections\)/);
  assert.match(appText,/writeLocalCollections\(localCollections\)/);
});
