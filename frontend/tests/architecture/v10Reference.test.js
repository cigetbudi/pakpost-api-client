import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APPEARANCE_THEMES } from '../../src/features/settings/services/appearance.js';

const css = readFileSync(new URL('../../src/styles/layers/theme-and-surfaces.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.jsx', import.meta.url), 'utf8');
const app = readWorkbenchSource();
const scripts = readFileSync(new URL('../../src/features/requests/components/ScriptEditor.jsx', import.meta.url), 'utf8');

test('reference theme layer loads last and offers light/dark/AMOLED only', () => {
  assert.deepEqual(APPEARANCE_THEMES.map(theme => theme.id), ['light', 'dark', 'oled']);
  assert.ok(main.indexOf("'./styles/layers/workbench-layout.css'") < main.indexOf("'./styles/layers/theme-and-surfaces.css'"));
  for (const id of ['light', 'dark', 'oled']) assert.ok(css.includes(`:root[data-theme='${id}']`));
});

test('restyled workbench retains functional request and script controls', () => {
  assert.match(app, /className="pp-url-entry"/);
  assert.match(app, /onClick=\{sendRequest\}/);
  assert.match(app, /className="pp-save-action" onClick=\{saveCurrent\}/);
  // v14 moves appearance into a dedicated Settings page instead of the explorer.
  assert.match(app, /<WorkbenchSettings category=\{settingsCategory\} onCategoryChange=\{setSettingsCategory\} theme=\{theme\} onThemeChange=\{setTheme\}/);
  assert.match(app, /onPointerMove=\{onSplitterMove\}/);
  assert.match(scripts, /<TextEditor value=\{preScript\}/);
  assert.match(scripts, /<TextEditor value=\{postScript\}/);
});

test('reference styling does not change HTTP method colors or layout via JavaScript', () => {
  assert.match(css, /--pp-pink:/);
  assert.match(css, /--pp-yellow:/);
  assert.match(css, /--pp-request-header:/);
  assert.match(css, /--pp-response-header:/);
  assert.match(css, /\.pp-panes\.pp-vertical/);
  assert.match(css, /\.pp-panes\.pp-horizontal/);
});
