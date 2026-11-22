import test from 'node:test';
import assert from 'node:assert/strict';
import {clampExplorerWidth, clampSplitPercent, splitPercentForPointer} from '../../src/app/hooks/layoutSizing.js';

test('Explorer resize retains the existing 280-650px bounds', () => {
  assert.equal(clampExplorerWidth(0), 280);
  assert.equal(clampExplorerWidth(340), 340);
  assert.equal(clampExplorerWidth(900), 650);
});

test('request splitter preserves horizontal and wide vertical pointer geometry', () => {
  const bounds = {left: 20, top: 30, width: 400, height: 600};
  assert.equal(splitPercentForPointer(bounds, 'vertical', {clientX: 220, clientY: 120}, true), 50);
  assert.equal(splitPercentForPointer(bounds, 'vertical', {clientX: 220, clientY: 330}, false), 50);
  assert.equal(splitPercentForPointer(bounds, 'horizontal', {clientX: 50, clientY: 330}, true), 50);
  assert.equal(clampSplitPercent(-5), 22);
  assert.equal(clampSplitPercent(105), 78);
});
