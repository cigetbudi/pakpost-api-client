import test from 'node:test';
import assert from 'node:assert/strict';
import {clampExplorerWidth, clampSplitPercent, splitPercentForPointer, splitPercentForKey, readSplitPercent} from '../../src/app/hooks/layoutSizing.js';

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


test('keyboard resize follows the effective separator orientation and remains bounded', () => {
  assert.equal(splitPercentForKey(50, 'ArrowRight', 'vertical'), 52);
  assert.equal(splitPercentForKey(50, 'ArrowLeft', 'vertical', true), 40);
  assert.equal(splitPercentForKey(50, 'ArrowDown', 'horizontal'), 52);
  assert.equal(splitPercentForKey(50, 'ArrowUp', 'horizontal', true), 40);
  assert.equal(splitPercentForKey(50, 'ArrowLeft', 'horizontal'), null);
  assert.equal(splitPercentForKey(77, 'ArrowRight', 'vertical'), 78);
  assert.equal(splitPercentForKey(23, 'ArrowUp', 'horizontal'), 22);
  assert.equal(splitPercentForKey(50, 'Home', 'horizontal'), 22);
  assert.equal(splitPercentForKey(50, 'End', 'vertical'), 78);
  assert.equal(splitPercentForKey(50, 'Tab', 'vertical'), null);
});

test('saved panel size is local, validated and safe to fall back', () => {
  const storage = value => ({getItem: key => {
    assert.equal(key, 'pakpost_split_percent');
    return value;
  }});
  for (const invalid of [null, '', '  ', 'NaN', 'Infinity', 'bad']) assert.equal(readSplitPercent(storage(invalid)), 50);
  assert.equal(readSplitPercent(storage('63.5')), 63.5);
  assert.equal(readSplitPercent(storage('100')), 78);
  assert.equal(readSplitPercent(storage('-1')), 22);
  assert.equal(readSplitPercent({getItem(){throw Error('blocked')}}), 50);
});
