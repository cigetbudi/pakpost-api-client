import { test, expect } from '@playwright/test';

// Guest mode is deliberate: these checks must never log into a real Cloud
// account, send network requests or leak API credentials into test artifacts.
test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('production guest workbench renders without an uncaught React error', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#root .pp-app')).toBeVisible();
  await expect(page.getByRole('button', {name: /^Send\b/})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Sign in', exact: true}).first()).toBeVisible();
  await expect(page.getByRole('alert').filter({hasText: "PakPost couldn't open"})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the heavy editor chunk loads only after opening Scripts', async ({page}) => {
  const loadedScripts = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (/\/assets\/.*\.js$/.test(url.pathname)) loadedScripts.push(url.pathname);
  });
  await page.goto('/', {waitUntil: 'networkidle'});
  await expect(page.locator('#root .pp-app')).toBeVisible();
  expect(loadedScripts.some(url => /\/Editors-[^/]+\.js$/.test(url))).toBe(false);

  await page.locator('.pp-panel-tabs').getByRole('button', {name: 'Scripts'}).click();
  await expect(page.getByText('Pre-request script', {exact: true})).toBeVisible();
  await expect.poll(() => loadedScripts.some(url => /\/Editors-[^/]+\.js$/.test(url))).toBe(true);
});

test('guest sign-in dialog opens without leaving the REST workbench', async ({page}) => {
  await page.goto('/');
  await page.locator('.pp-top').getByRole('button', {name: 'Sign in'}).click();
  await expect(page.getByText('Sign in to PakPost', {exact: true})).toBeVisible();
  await expect(page.getByText('New accounts are created automatically after Google verification.', {exact: false})).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('#root .pp-app')).toBeVisible();
});
