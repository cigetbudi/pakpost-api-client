import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_THEMES, normalizeAppearance, isDarkAppearance, nextAppearance, readAppearance } from '../src/features/appearance.js';

test('five distinct themes with stable IDs and semantic modes', () => {
  assert.deepEqual(APPEARANCE_THEMES.map(t=>t.id), ['light','dark','dark-pink','dark-green','oled']);
  assert.ok(APPEARANCE_THEMES.every(t => t.swatches.length === 4));
  assert.equal(new Set(APPEARANCE_THEMES.map(t=>t.id)).size, 5);
});
test('legacy dark/light and invalid themes', () => {
  assert.equal(normalizeAppearance('light'), 'light');
  assert.equal(normalizeAppearance('dark'), 'dark');
  assert.equal(normalizeAppearance('dark-green'), 'dark-green');
  assert.equal(normalizeAppearance('unknown'), 'dark');
});
test('all dark variants use dark code editor including OLED', () => {
  assert.equal(isDarkAppearance('dark-pink'), true);
  assert.equal(isDarkAppearance('dark-green'), true);
  assert.equal(isDarkAppearance('oled'), true);
  assert.equal(isDarkAppearance('light'), false);
  assert.equal(nextAppearance('oled'), 'light');
});
test('stored choice remains selected and localStorage failure is safe', () => {
  assert.equal(readAppearance({getItem:()=> 'dark-pink'}), 'dark-pink');
  assert.equal(readAppearance({getItem:()=> 'oled'}), 'oled');
  assert.equal(readAppearance({getItem:()=> {throw new Error('blocked')}}), 'dark');
  assert.equal(readAppearance(null), 'dark');
});
