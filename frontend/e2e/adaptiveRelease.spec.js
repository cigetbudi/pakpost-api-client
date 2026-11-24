import { test, expect } from '@playwright/test';

// Fresh isolated browser context per test. Never execute a real API request.
test('panel resize is keyboard accessible, survives reload and resets on double click', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByTitle('Request to left of response', { exact: true }).click();
  const splitter = page.getByRole('separator', { name: 'Resize request and response panels' });
  await expect(splitter).toHaveAttribute('aria-orientation', 'vertical');
  await splitter.focus();
  await splitter.press('Home');
  await expect(splitter).toHaveAttribute('aria-valuenow', '22');
  await splitter.press('Shift+ArrowRight');
  await expect(splitter).toHaveAttribute('aria-valuenow', '32');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pakpost_split_percent'))).toBe('32');
  await page.reload();
  await expect(splitter).toHaveAttribute('aria-valuenow', '32');
  await splitter.dblclick();
  await expect(splitter).toHaveAttribute('aria-valuenow', '50');
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(splitter).toHaveAttribute('aria-orientation', 'horizontal');
  await splitter.focus();
  await splitter.press('ArrowDown');
  await expect(splitter).toHaveAttribute('aria-valuenow', '52');
});

for (const theme of ['light', 'dark', 'oled']) {
  test(`approved form stays usable across sizes in ${theme}`, async ({page}) => {
    await page.addInitScript(value => localStorage.setItem('pakpost_theme', value), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const panel = page.locator('.pp-request-pane');
    await panel.getByRole('button', {name: 'Headers', exact: true}).click();
    const header = panel.getByRole('textbox', {name: 'Header key', exact: true}).first();
    await header.fill('X-Example');
    for (const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[390,844],[320,700]]) {
      await page.setViewportSize({width,height});
      await expect(header).toHaveValue('X-Example');
      const bounds = await header.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds.width).toBeGreaterThan(40);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });
}
