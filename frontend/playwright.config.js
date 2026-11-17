import { defineConfig, devices } from '@playwright/test';

/**
 * Production-bundle browser tests: unlike Vite dev mode, this validates the
 * generated lazy chunks. Run `bun run build` before `bun run test:e2e`.
 * Uses a guest session; does not require credentials or a running .NET API.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: {width:1440,height:900} } }],
  webServer: {
    command: 'bun run preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
