import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = readWorkbenchSource();
const main = src('../../src/main.jsx');
const css = src('../../src/styles/layers/workbench-details.css');

test('workbench theme layer extends the existing theme without replacing runtime code', () => {
  assert.match(main, /import '\.\/styles\/layers\/collection-workflows\.css';\s*import '\.\/styles\/layers\/workbench-details\.css';/);
  for (const theme of ['light', 'dark', 'oled']) assert.match(css, new RegExp(`:root\\[data-theme='${theme}'\\]`));
  assert.match(app, /executeWorkbenchRequest/);
  assert.match(app, /sendRequest/);
  assert.match(app, /saveCurrent/);
  const explorer=src('../../src/features/collections/components/WorkbenchExplorer.jsx');
  assert.match(explorer, /LocalCollectionsTree/);
});

test('collections are visually ordered to the right, while editor keeps split modes', () => {
  assert.match(css, /\.pp-content\s*\{order:1/);
  assert.match(css, /\.pp-explorer\s*\{order:2/);
  assert.match(css, /\.pp-panes\.pp-horizontal\s*\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(app, /setSplit\('horizontal'\)/);
  assert.match(app, /setSplit\('vertical'\)/);
  assert.match(app, /onPointerMove=\{onSplitterMove\}/);
});

test('quick switcher shortcut is accessible and reaches existing open tabs and saved requests', () => {
  assert.match(app, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(app, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(app, /aria-label="Quick search and commands"/);
  const palette = src('../../src/app/services/commandPaletteItems.js');
  assert.match(app, /createCommandPaletteItems\(/);
  assert.match(palette, /\.\.\.\[\.\.\.openTabs\]\.sort\([^\n]+\)\.map/);
  assert.match(palette, /\.\.\.localCollections\.flatMap/);
  assert.match(palette, /openLocalRequest\(request, collection\.id\)/);
});
