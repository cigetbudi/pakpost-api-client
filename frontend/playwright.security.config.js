import { defineConfig, devices } from '@playwright/test';
// Isolated Vite dev server: import the actual worker entry, no backend or accounts.
export default defineConfig({
  testDir:'./e2e-security', timeout:30000, workers:1,
  use:{baseURL:'http://127.0.0.1:4181',trace:'off',screenshot:'off',video:'off'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'bun run dev --port 4181 --strictPort',url:'http://127.0.0.1:4181',reuseExistingServer:false,timeout:30000},
});
