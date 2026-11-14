import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/clean-minimal.css', import.meta.url), 'utf8');

test('clean minimal styles load after base styles without replacing v6 themes', () => {
  assert.ok(main.indexOf("import './styles.css'") < main.indexOf("import './clean-minimal.css'"));
  assert.match(css, /--pp-radius-sm:\s*4px/);
  assert.match(css, /--pp-radius-md:\s*5px/);
  assert.doesNotMatch(css, /:root\[data-theme\s*=/);
});

test('request URL editor keeps cURL paste and Send action', () => {
  assert.match(app, /className="pp-url-entry"/);
  assert.match(app, /className="pp-url-input"/);
  assert.match(app, /onPaste=\{e=>\{const raw=e\.clipboardData\.getData\('text'\);if\(isCurl\(raw\)\)/);
  assert.match(app, /className="pp-send" disabled=\{loading\} onClick=\{sendRequest\}/);
});

test('Save updates bound requests and Save As creates new record', () => {
  assert.match(app, /className="pp-save-action" onClick=\{saveCurrent\}/);
  assert.match(app, /function openSaveAs\(/);
  assert.match(app, /async function saveCurrent\(/);
});
