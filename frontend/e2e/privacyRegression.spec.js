import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('production guest workbench never attempts cross-origin HTTP or WebSocket traffic during normal editing', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const wsOrigin = origin.replace(/^http/, 'ws');
  const unexpected = new Set();
  const remember = raw => {
    const url = new URL(raw);
    // Only log origin, never query strings, headers or request bodies.
    unexpected.add(url.origin);
  };
  const externalHttp = url => /^https?:$/.test(url.protocol) && url.origin !== origin;
  const externalWs = url => /^wss?:$/.test(url.protocol) && url.origin !== wsOrigin;
  context.on('request', request => {
    if (externalHttp(new URL(request.url()))) remember(request.url());
  });
  await context.route(externalHttp, async route => {
    remember(route.request().url());
    await route.abort('blockedbyclient');
  });
  await context.routeWebSocket(externalWs, ws => {
    remember(ws.url());
    ws.close();
  });
  await page.goto('/');
  await expect(page.locator('#root .pp-app')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Send\b/ })).toBeVisible();
  await page.locator('.pp-panel-tabs').getByRole('button', { name: 'Pre-request', exact: true }).click();
  await expect(page.getByText('Pre-request script', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Bounded observation window for delayed requests, not a proof of future behavior.
  await page.waitForTimeout(1500);
  expect([...unexpected].sort(), 'Unexpected cross-origin destinations in guest mode').toEqual([]);
});
