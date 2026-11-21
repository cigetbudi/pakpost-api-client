import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../src/', import.meta.url);
const entry = readFileSync(new URL('main.jsx', root), 'utf8');
const css = readFileSync(new URL('styles/layers/motion-system.css', root), 'utf8');

test('motion system loads last so old feature rules cannot silently override it', () => {
  const importPath = "import './styles/layers/motion-system.css';";
  assert.ok(entry.includes(importPath));
  assert.equal(entry.slice(entry.lastIndexOf('import ')).trim(), importPath);
});

test('motion uses bounded opacity/transform/color transitions and supports reduced motion', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /translate3d/);
  assert.doesNotMatch(css, /transition\s*:\s*all\b/i);
  assert.doesNotMatch(css, /will-change\s*:/i);
  assert.doesNotMatch(css, /backdrop-filter\s*:/i);
  assert.doesNotMatch(css, /(?<!-)filter\s*:/i);
  // Large lists and resize handles must not receive scale transforms.
  assert.doesNotMatch(css, /\.pp-tree-row\s*\):active/);
  assert.doesNotMatch(css, /\.pp-open-tab\s*\):active/);
});
