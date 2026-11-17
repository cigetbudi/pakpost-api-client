import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_THEMES, normalizeAppearance, isDarkAppearance, nextAppearance, readAppearance } from '../../src/features/settings/services/appearance.js';

test('three reference themes have stable identifiers and semantic modes', () => {
  assert.deepEqual(APPEARANCE_THEMES.map(t => t.id), ['light', 'dark', 'oled']);
  assert.ok(APPEARANCE_THEMES.every(t => t.swatches.length === 4));
});
test('legacy user choices are normalized safely', () => {
  assert.equal(normalizeAppearance('light'), 'light');
  assert.equal(normalizeAppearance('dark'), 'dark');
  assert.equal(normalizeAppearance('dark-pink'), 'dark');
  assert.equal(normalizeAppearance('dark-green'), 'dark');
  assert.equal(normalizeAppearance('oled'), 'oled');
  assert.equal(normalizeAppearance('invalid'), 'dark');
});
test('dark and AMOLED use a dark code editor', () => {
  assert.equal(isDarkAppearance('dark'), true);
  assert.equal(isDarkAppearance('oled'), true);
  assert.equal(isDarkAppearance('light'), false);
  assert.equal(nextAppearance('oled'), 'light');
});
test('persisted appearance and inaccessible localStorage', () => {
  assert.equal(readAppearance({getItem:()=> 'oled'}), 'oled');
  assert.equal(readAppearance({getItem:()=> 'dark-pink'}), 'dark');
  assert.equal(readAppearance({getItem:()=> {throw new Error('blocked')}}), 'dark');
  assert.equal(readAppearance(null), 'dark');
});
