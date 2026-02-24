import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './stencil/tests/unit',
  use: {
    browserName: 'chromium',
    channel: 'chrome', // 👈 uses system Chrome
    headless: true,
    baseURL: 'http://localhost:5173'
  },
  webServer: {
    command: 'npm run start',
    port: 5173,
    reuseExistingServer: !process.env.CI
  }
});
