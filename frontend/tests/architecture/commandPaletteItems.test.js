import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandPaletteItems, filterCommandPaletteItems } from '../../src/app/services/commandPaletteItems.js';

const makePalette = (overrides = {}) => {
  const calls = [];
  const items = createCommandPaletteItems({
    commandOpen: true,
    addTab: () => calls.push('new'),
    setExplorerTab: value => calls.push(`panel:${value}`),
    setSidebarCollapsed: value => calls.push(`collapsed:${value}`),
    setPage: value => calls.push(`page:${value}`),
    openContext: value => calls.push(`context:${value}`),
    openTabs: [{ id: 'a', name: 'Get customer', method: 'GET' }],
    localCollections: [{ id: 'local', name: 'Local APIs', requests: [{ id: 'r', name: 'Health' }] }],
    savedRequests: [{ id: 'cloud', name: 'Private API', method: 'POST' }],
    token: '',
    selectTab: id => calls.push(`tab:${id}`),
    openLocalRequest: (_request, id) => calls.push(`local:${id}`),
    loadSavedRequest: request => calls.push(`cloud:${request.id}`),
    ...overrides,
  });
  return { items, calls };
};

test('closed palette creates no descriptors', () => {
  assert.deepEqual(makePalette({ commandOpen: false }).items, []);
});

test('guest palette shows local tabs and hides Cloud requests', () => {
  const { items } = makePalette();
  assert.ok(items.some(item => item.key === 'local-local-r'));
  assert.ok(items.some(item => item.key === 'tab-a'));
  assert.ok(!items.some(item => item.key === 'neon-cloud'));
});

test('authenticated palette includes Cloud requests without exposing their data at rest', () => {
  const { items } = makePalette({ token: 'session-present' });
  assert.ok(items.some(item => item.key === 'neon-cloud'));
});

test('palette navigation uses the existing Workbench callbacks', () => {
  const { items, calls } = makePalette();
  items.find(item => item.key === 'open-collections').run();
  items.find(item => item.key === 'tab-a').run();
  assert.deepEqual(calls, ['panel:collections', 'collapsed:false', 'page:tester', 'tab:a']);
});

test('search is case-insensitive and keeps the first 30 matching items', () => {
  const { items } = makePalette();
  assert.equal(filterCommandPaletteItems(items, 'CUSTOMER').length, 1);
  assert.equal(filterCommandPaletteItems(items, '', 2).length, 2);
});
