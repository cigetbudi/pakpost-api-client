import { test, expect } from '@playwright/test';

// Motion checks use the production bundle (vite preview), like other E2E tests.
// Build first: bun run build && bun run test:e2e -- e2e/motion.spec.js

test('buttons respond quickly and dialog enters without animating layout', async ({ page }) => {
  await page.goto('/');
  const send = page.getByRole('button', { name: /^Send\b/ });
  await expect(send).toBeVisible();
  const transitions = await send.evaluate(el => {
    const style = getComputedStyle(el);
    return { properties: style.transitionProperty, durations: style.transitionDuration };
  });
  expect(transitions.properties).not.toContain('all');
  expect(transitions.properties).toContain('background-color');

  await page.locator('.pp-top').getByRole('button', { name: 'Sign in' }).click();
  const dialog = page.locator('.dialog').first();
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el).animationName))
    .toContain('pp-motion-dialog-in');
});

test('reduced motion disables entrance and press animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const send = page.getByRole('button', { name: /^Send\b/ });
  await expect(send).toBeVisible();
  expect(await send.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');

  await page.locator('.pp-top').getByRole('button', { name: 'Sign in' }).click();
  const dialog = page.locator('.dialog').first();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
