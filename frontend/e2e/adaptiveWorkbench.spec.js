import { test, expect } from '@playwright/test';

// Local guest mode; no API calls or Cloud credentials are needed.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
});

for (const width of [320, 390, 760]) {
  test(`mobile workbench remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const picker = page.getByRole('group', { name: 'Focus request or response' });
    await expect(picker).toBeVisible();
    await expect(page.locator('.pp-top-search')).toBeVisible();
    await expect(page.locator('.pp-top-environment')).toBeVisible();
    await expect(page.locator('.pp-save-as-action')).toBeVisible();
    const url = page.locator('.pp-url-field input');
    await url.fill('https://example.com/adaptive-test');
    await picker.getByRole('button', { name: 'Response', exact: true }).click();
    await expect(page.locator('.pp-request-pane')).toBeHidden();
    await expect(page.locator('.pp-response-body')).toBeVisible();
    await picker.getByRole('button', { name: 'Request', exact: true }).click();
    await expect(page.locator('.pp-request-pane')).toBeVisible();
    await expect(url).toHaveValue('https://example.com/adaptive-test');
    await expect(page.locator('.pp-response-body')).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Context panels' }).getByRole('button', { name: 'Collections', exact: true }).click();
    await expect(page.locator('.pp-explorer')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss context panel' }).click({ position: { x: 8, y: 10 } });
    await expect(page.locator('.pp-explorer')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('narrow viewport temporarily stacks a preferred side-by-side layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByTitle('Request to left of response', { exact: true }).click();
  await expect(page.locator('.pp-panes')).toHaveClass(/pp-vertical/);
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(page.locator('.pp-panes')).toHaveClass(/pp-horizontal/);
  await expect(page.getByRole('separator', { name: 'Resize request and response panels' })).toHaveAttribute('aria-orientation', 'horizontal');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.pp-panes')).toHaveClass(/pp-vertical/);
});
