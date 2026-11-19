import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = file => readFileSync(path.join(root, file), 'utf8');

function mockElement() {
  const listeners = new Map();
  const classes = new Set();

  return {
    value: '',
    textContent: '',
    children: [],
    disabled: false,
    className: '',
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle(name, value) {
        if (value) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    click() {
      return listeners.get('click')?.();
    },
    setAttribute() {},
    append(...items) {
      this.children.push(...items);
    },
    appendChild(item) {
      this.children.push(item);
    },
    replaceChildren(...items) {
      this.children = [...items];
    },
    querySelectorAll() {
      return [];
    }
  };
}

function popupHarness({ approveAll = true } = {}) {
  const nodes = new Map();
  const state = {
    allowedOrigins: ['http://localhost:5173'],
    allowedDestinations: ['https://approved.example.test']
  };
  const prompts = [];
  const removed = [];
  let browserAllowsBroad = false;

  const chrome = {
    runtime: {
      id: 'pakpost-test',
      getURL: value => `chrome-extension://pakpost-test/${String(value).replace(/^\//, '')}`,
      async sendMessage() {
        return { ok: true };
      }
    },
    storage: {
      local: {
        async get() {
          return { ...state };
        },
        async set(value) {
          Object.assign(state, value);
        }
      }
    },
    tabs: {
      async query() {
        return [{ id: 1, url: 'http://localhost:5173/app' }];
      }
    },
    permissions: {
      async contains({ origins }) {
        return origins.length === 2 ? browserAllowsBroad : true;
      },
      request({ origins }) {
        prompts.push(origins);
        browserAllowsBroad = approveAll;
        return Promise.resolve(approveAll);
      },
      async remove({ origins }) {
        removed.push(origins);
        browserAllowsBroad = false;
        return true;
      }
    }
  };
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, mockElement());
      return nodes.get(id);
    },
    createElement: mockElement
  };

  vm.runInNewContext(read('extension/common/popup.js'), { document, chrome, URL, Set, String });

  return {
    state,
    prompts,
    removed,
    controls: nodes,
    click: id => nodes.get(id).click()
  };
}

async function flush() {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}

test('popup stays in Specified by default and does not request wildcards on startup', async () => {
  const popup = popupHarness();
  await flush();
  assert.equal(popup.state.destinationMode, undefined);
  assert.equal(popup.prompts.length, 0);
  assert.equal(popup.controls.get('specifiedButton').classList.contains('active'), true);
});

test('Allow All requests the two optional host patterns from a button click and persists mode', async () => {
  const popup = popupHarness();
  await flush();
  popup.click('allowAllButton');
  await flush();

  assert.equal(popup.prompts.length, 1);
  assert.deepEqual(Array.from(popup.prompts[0]), ['http://*/*', 'https://*/*']);
  assert.equal(popup.state.destinationMode, 'all');
  assert.equal(popup.controls.get('specifiedDestinations').classList.contains('hidden'), true);

  await popup.click('specifiedButton');
  await flush();
  assert.equal(popup.state.destinationMode, 'specified');
  assert.deepEqual(popup.state.allowedDestinations, ['https://approved.example.test']);
  assert.equal(popup.controls.get('revokeBroadButton').classList.contains('hidden'), false);

  await popup.click('revokeBroadButton');
  await flush();
  assert.deepEqual(Array.from(popup.removed[0]), ['http://*/*', 'https://*/*']);
});

test('popup favicon uses browser cache, and bundled toolbar icons match both manifests', () => {
  const chromeManifest = JSON.parse(read('extension/manifest.chrome.json'));
  const firefoxManifest = JSON.parse(read('extension/manifest.firefox.json'));
  const popup = read('extension/common/popup.js');

  assert.ok(chromeManifest.permissions.includes('favicon'));
  assert.ok(!firefoxManifest.permissions.includes('favicon'));
  assert.match(popup, /_favicon\//);
  assert.match(popup, /favicon\.ico/);
  assert.match(popup, /referrerPolicy='no-referrer'/);
  assert.doesNotMatch(popup, /google\.com\/s2\/favicons|favicon\.yandex|icon\.horse/);

  for (const manifest of [chromeManifest, firefoxManifest]) {
    for (const size of [16, 32, 48, 128]) {
      const icon = path.join(root, 'extension/common', manifest.icons[size]);
      assert.ok(statSync(icon).size > 100);
      assert.equal(readFileSync(icon).subarray(1, 4).toString(), 'PNG');
    }
  }
});


test('denying Allow All leaves the old Specified policy intact', async () => {
  const popup = popupHarness({ approveAll: false });
  await flush();
  popup.click('allowAllButton');
  await flush();

  assert.equal(popup.prompts.length, 1);
  assert.equal(popup.state.destinationMode, undefined);
  assert.deepEqual(popup.state.allowedDestinations, ['https://approved.example.test']);
  assert.equal(popup.controls.get('specifiedButton').classList.contains('active'), true);
});
