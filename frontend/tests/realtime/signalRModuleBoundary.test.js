import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validWorkspaceEvent, shouldRefreshRequestList } from '../../src/features/realtime/services/workspaceEventPolicy.js';

const read = path => readFileSync(new URL(path, import.meta.url),'utf8');
const ws = '11111111-1111-1111-1111-111111111111';
const collection = '22222222-2222-2222-2222-222222222222';

test('realtime event validation is pure and does not pull in SignalR at startup', () => {
  const policy = read('../../src/features/realtime/services/workspaceEventPolicy.js');
  const sync = read('../../src/features/realtime/services/workspaceSync.js');
  const lifecycle = read('../../src/features/realtime/hooks/useWorkspaceRealtimeLifecycle.js');
  assert.doesNotMatch(policy, /@microsoft\/signalr|workspaceRealtime\.js/);
  assert.match(sync, /from '\.\/workspaceEventPolicy\.js'/);
  assert.doesNotMatch(sync, /from '\.\/workspaceRealtime\.js'/);
  assert.match(lifecycle, /import\('\.\.\/services\/workspaceRealtime\.js'\)/);
  assert.match(read('../../src/features/realtime/services/workspaceRealtime.js'), /import\('@microsoft\/signalr'\)/);
});

test('event policy still rejects unknown scope and refreshes only relevant collections', () => {
  const event = {kind:'request.updated',workspaceId:ws,collectionId:collection};
  assert.equal(validWorkspaceEvent(event,ws), true);
  assert.equal(validWorkspaceEvent(event,'33333333-3333-3333-3333-333333333333'),false);
  assert.equal(validWorkspaceEvent({...event,kind:'unknown'},ws),false);
  assert.equal(shouldRefreshRequestList(event,{selectedCol:collection}),true);
  assert.equal(shouldRefreshRequestList(event,{selectedCol:'unrelated'}),false);
});
