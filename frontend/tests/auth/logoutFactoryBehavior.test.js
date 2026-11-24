import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkbenchLogoutActions} from '../../src/features/auth/controllers/createWorkbenchLogoutActions.js';

// These tests exercise browser-session logout. D5 also checks the Tauri
// window marker, so supply a browser-like window in the Node test environment.
let previousWindow;
test.beforeEach(() => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true });
});
test.afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
});

const makeActions = (api, events=[]) => {
  const snapshot = {name:'Cloud private',requestName:'Cloud private',body:'private payload'};
  const refs = {
    authEpochRef:{current:0},currentTokenRef:{current:'__browser_session__'},authTabSyncRef:{current:{announceLogout:()=>events.push('broadcast')}},
    openTabsRef:{current:[{id:'cloud',name:'Cloud private',source:{scope:'workspace'}},{id:'local',name:'Local request',source:{scope:'local'}}]},
    activeTabRef:{current:'cloud'},draftsRef:{current:{local:{name:'Local request',body:'safe'}}},snapshotRef:{current:()=>{events.push('snapshot');return snapshot;}},
  };
  const state={events,refs};
  const noop=()=>{};
  const deps={...refs,api,getMessage:e=>e.message,STORAGE_LOCAL:'local',
    sessionStorage:{removeItem:key=>events.push(['sessionRemoved',key])},
    localStorage:{removeItem:key=>events.push(['localRemoved',key])},
    setNotice:message=>events.push(['notice',message]),
    setToken:v=>events.push(['token',v]),setMe:noop,setStorageScope:noop,setPage:noop,
    setWorkspaceCollectionDocs:noop,setAuthOpen:noop,setGoogleLinkOpen:noop,
    setGoogleLinked:noop,setGoogleLinkPassword:noop,setRecent:noop,
    setCollections:noop,setSavedRequests:noop,setWorkspaceRequestLists:noop,
    setRemoteAlerts:noop,setConflictDialog:noop,setVersionDialog:noop,
    workspaceUiStore:{getState:()=>({resetWorkspaceUi:noop})},
    sessionEnvironmentOverlays:{current:new Map()},sessionCollectionVariables:{current:new Map()},
    savedCollectionVariablesCache:{current:new Map()},sessionDocumentationOverlays:{current:new Map()},
    setWorkspaceEnvironmentResult:noop,setOpenTabs:tabs=>events.push(['tabs',tabs]),
    setActiveTabId:id=>events.push(['active',id]),restoreDraft:draft=>events.push(['draft',draft]),
  };
  return {...state,...createWorkbenchLogoutActions(deps)};
};

test('server failure must not falsely sign out an active browser session',async()=>{
  const events=[];
  const actions=makeActions(async()=>{throw Object.assign(new Error('temporary failure'),{status:503});},events);
  assert.equal(await actions.logout(),false);
  assert.equal(actions.refs.currentTokenRef.current,'__browser_session__');
  assert.equal(events.some(e=>Array.isArray(e)&&e[0]==='token'),false);
  assert.match(events.find(e=>Array.isArray(e)&&e[0]==='notice')[1],/could not revoke/);
});

test('successful revocation invalidates auth before reading cached drafts, retaining Local only',async()=>{
  const events=[];
  const actions=makeActions(async()=>{events.push('revoked');return {};},events);
  assert.equal(await actions.logout(),true);
  assert.equal(actions.refs.currentTokenRef.current,'');
  const tokenIndex=events.findIndex(e=>Array.isArray(e)&&e[0]==='token'&&e[1]==='');
  assert.ok(tokenIndex>=0);
  assert.ok(tokenIndex<events.indexOf('snapshot'));
  assert.equal(events[0],'revoked');
  assert.ok(events.includes('broadcast'));
  assert.deepEqual(events.find(e=>Array.isArray(e)&&e[0]==='tabs')[1].map(x=>x.id),['local']);
  const draft=events.find(e=>Array.isArray(e)&&e[0]==='draft')[1];
  assert.equal(draft.name,'Local request');
  assert.ok(!JSON.stringify(draft).includes('private payload'));
});

test('401 on server revoke safely finishes local sign-out',async()=>{
  const events=[];
  const actions=makeActions(async()=>{throw Object.assign(new Error('expired'),{status:401});},events);
  assert.equal(await actions.logout(),true);
  assert.equal(actions.refs.currentTokenRef.current,'');
});
