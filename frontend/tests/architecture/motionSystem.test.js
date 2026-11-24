import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../src/', import.meta.url);
const entry = readFileSync(new URL('main.jsx', root), 'utf8');
const css = readFileSync(new URL('styles/layers/motion-system.css', root), 'utf8');

test('motion system follows legacy layers; adaptive layers preserve reduced motion', () => {
  const imports = [...entry.matchAll(/import ['"]\.\/(styles\/[^'"]+\.css)['"]/g)].map(match => match[1]);
  const motion = imports.indexOf('styles/layers/motion-system.css');
  assert.ok(motion >= 0);
  assert.equal(imports.filter(path => path.startsWith('styles/layers/')).at(-1), imports[motion]);
  for (const file of imports.slice(motion + 1)) {
    const content = readFileSync(new URL(file, root), 'utf8');
    // No later nonzero !important animation or transition may defeat reduced-motion.
    assert.doesNotMatch(content, /(?:animation|transition)(?:-[\w-]+)?\s*:[^;{}]*!important/i,
      `Audit reduced-motion precedence for ${file}`);
  }
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
