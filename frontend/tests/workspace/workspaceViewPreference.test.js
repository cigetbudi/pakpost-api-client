import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  readWorkspaceViewPreference,saveWorkspaceViewPreference,chooseWorkspaceId,
} from '../../src/features/workspace/services/workspaceViewPreference.js';

function fakeStorage(){
  const values=new Map();
  return {
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value),
    dump:()=>Object.fromEntries(values),
  };
}

test('Cloud scope survives reload once the server session establishes the account',()=>{
  const storage=fakeStorage();
  const account='user-1';
  saveWorkspaceViewPreference(storage,account,{scope:'workspace',workspaceId:'cloud-b'});
  assert.deepEqual(readWorkspaceViewPreference(storage,account),{scope:'workspace',workspaceId:'cloud-b'});
  const available=[{id:'cloud-a'},{id:'cloud-b'}];
  assert.equal(chooseWorkspaceId(available,'',readWorkspaceViewPreference(storage,account).workspaceId),'cloud-b');
});

test('Local is an explicit saved preference, not overwritten by authenticated Cloud defaults',()=>{
  const storage=fakeStorage();
  saveWorkspaceViewPreference(storage,'user-1',{scope:'workspace'});
  saveWorkspaceViewPreference(storage,'user-1',{scope:'local'});
  assert.equal(readWorkspaceViewPreference(storage,'user-1').scope,'local');
});

test('user preferences are isolated across Google accounts',()=>{
  const storage=fakeStorage();
  saveWorkspaceViewPreference(storage,'alice',{scope:'workspace',workspaceId:'alice-ws'});
  saveWorkspaceViewPreference(storage,'bob',{scope:'local',workspaceId:'bob-ws'});
  assert.deepEqual(readWorkspaceViewPreference(storage,'alice'),{scope:'workspace',workspaceId:'alice-ws'});
  assert.deepEqual(readWorkspaceViewPreference(storage,'bob'),{scope:'local',workspaceId:'bob-ws'});
  assert.equal(readWorkspaceViewPreference(storage,'guest').workspaceId,'');
});

test('stale/revoked Workspace selection falls back to a server-authorized Workspace',()=>{
  const rows=[{id:'ws-a'},{id:'ws-b'}];
  assert.equal(chooseWorkspaceId(rows,'ws-b','ws-a'),'ws-b'); // preserve current selection
  assert.equal(chooseWorkspaceId(rows,'','removed-ws'),'ws-a');
  assert.equal(chooseWorkspaceId([], '', 'ws-a'),'');
});

test('first verified cookie session defaults to Cloud regardless of guest startup',()=>{
  const storage=fakeStorage();
  assert.equal(readWorkspaceViewPreference(storage,'verified-user').scope,'workspace');
  assert.equal(readWorkspaceViewPreference(storage,'verified-user','local').scope,'local');
  assert.equal(readWorkspaceViewPreference(storage,'','workspace').workspaceId,'');
  const source=readFileSync(new URL('../../src/app/hooks/useWorkbenchController.jsx',import.meta.url),'utf8');
  assert.match(source,/useState\(STORAGE_LOCAL\); \/\/ Until \/auth\/session verifies/);
  const bootstrap=readFileSync(new URL('../../src/features/auth/hooks/useBrowserSessionBootstrap.js',import.meta.url),'utf8');
  assert.match(source,/useBrowserSessionBootstrap/);
  assert.match(bootstrap,/if\(!sameAccount\)/);
  assert.match(bootstrap,/readWorkspaceViewPreference\(localStorage,result\.user\.id\)/);
  assert.doesNotMatch(source,/setStorageScope\(scope=>allowedStorageScope\(true,scope\)\)/);
});

test('preferences never contain cookie, CSRF, account profile, or request payload',()=>{
  const storage=fakeStorage();
  saveWorkspaceViewPreference(storage,'test-user',{scope:'workspace',workspaceId:'ws-1',token:'SENSITIVE',csrfToken:'SENSITIVE',secret:'SENSITIVE'});
  const serialized=JSON.stringify(storage.dump());
  assert.doesNotMatch(serialized,/SENSITIVE/);
  assert.deepEqual(readWorkspaceViewPreference(storage,'test-user'),{scope:'workspace',workspaceId:'ws-1'});
});
