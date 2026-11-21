import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Exercise the real revision stylesheet without needing a Cloud account or DB state.
// The History view needs a timeline column; Conflict review does not render one.
const revisionCss = readFileSync(new URL('../src/styles/features/request-version-history.css', import.meta.url), 'utf8');
const rows = Array.from({ length: 13 }, (_, i) => `<label class="pp-revision-field">
  <input type="checkbox"><span class="pp-revision-field-name">Field ${i + 1}</span>
  <span class="pp-revision-field-preview">Draft value</span><span class="pp-revision-field-preview">Cloud value</span>
</label>`).join('');

async function renderCompare(page, mode) {
  await page.setContent(`<main class="dialog pp-revision-dialog">
    <div class="pp-conflict-conflict-dialog">
      <div class="pp-revision-panel ${mode === 'conflict' ? 'pp-revision-panel--conflict' : ''}">
        ${mode === 'history' ? '<aside class="pp-revision-timeline">Saved revisions</aside>' : ''}
        <section class="pp-revision-compare">
          <div class="pp-revision-compare-heading"><strong>My draft vs latest Cloud</strong></div>
          <div class="pp-revision-field-list">
            <div class="pp-revision-field-header"><span>Take</span><span>Field</span><span>My draft</span><span>Latest Cloud</span></div>
            ${rows}
          </div>
        </section>
      </div>
    </div>
  </main>`);
  await page.addStyleTag({ content: '*,*::before,*::after{box-sizing:border-box}body{margin:0;padding:24px;background:#0e1420;color:#f5f7fb}.dialog{width:min(96vw,980px);padding:24px;background:#141b28}.pp-conflict-conflict-dialog{padding:16px 20px}' });
  await page.addStyleTag({ content: revisionCss });
}

test('Conflict review uses the whole dialog instead of a missing history sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await renderCompare(page, 'conflict');
  const dimensions = await page.locator('.pp-revision-panel').evaluate(el => {
    const panel = el.getBoundingClientRect();
    const compare = el.querySelector('.pp-revision-compare').getBoundingClientRect();
    const list = el.querySelector('.pp-revision-field-list');
    return { panel: panel.width, compare: compare.width, listHeight: list.scrollHeight, listClientHeight: list.clientHeight };
  });
  expect(dimensions.compare).toBeGreaterThan(700);
  expect(dimensions.compare).toBeGreaterThan(dimensions.panel * 0.9);
  expect(dimensions.listHeight).toBe(dimensions.listClientHeight); // no nested vertical scroll

  await renderCompare(page, 'history');
  const columns = await page.locator('.pp-revision-panel').evaluate(el => {
    const timeline = el.querySelector('.pp-revision-timeline').getBoundingClientRect();
    const compare = el.querySelector('.pp-revision-compare').getBoundingClientRect();
    return { timeline: timeline.width, compare: compare.width };
  });
  expect(columns.timeline).toBeLessThanOrEqual(210);
  expect(columns.compare).toBeGreaterThan(450);
});

test('Conflict review keeps its columns reachable on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await renderCompare(page, 'conflict');
  const layout = await page.locator('.pp-revision-field-list').evaluate(el => ({
    clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
    gridWidth: el.querySelector('.pp-revision-field').getBoundingClientRect().width,
  }));
  expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
  expect(layout.gridWidth).toBeGreaterThanOrEqual(510);
});
