import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './testing',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173/trust-center',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    channel: 'chrome' // use installed Google Chrome instead of Playwright Chromium
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/trust-center',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chrome-local',
      use: { channel: 'chrome' }
    }
  ]
});
