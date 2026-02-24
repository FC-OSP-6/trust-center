/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    TL;DR  -->  root E2E runner config (app-level browser tests)

    what this config does:
        - runs only e2e specs from testing/e2e (avoids vitest files)
        - uses the chrome already installed on the machine
        - starts the app with npm run dev if it is not already running
        - keeps debug artifacts only when tests fail or retry

    why this matters:
        - faster local setup (no playwright browser download required)
        - fewer false failures from runner/file-type collisions
        - cleaner separation between vitest (unit/integration) and playwright (e2e)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  // ---------- test discovery ----------

  testDir: './testing/e2e', // only run browser e2e specs from this folder
  testMatch: '**/*.spec.ts', // keep e2e naming explicit and avoid accidental pickup

  // ---------- runtime behavior ----------

  timeout: 30_000, // max time per test before playwright fails it
  fullyParallel: true, // allows independent e2e specs to run in parallel
  retries: process.env.CI ? 2 : 0, // retry only in ci to reduce local confusion
  reporter: [['list'], ['html', { open: 'never' }]], // list for terminal + html report for debugging

  // ---------- browser defaults ----------

  use: {
    baseURL: 'http://localhost:5173/trust-center/', // page.goto('/') resolves to the trust-center route
    trace: 'on-first-retry', // capture trace only when a test fails and retries
    screenshot: 'only-on-failure', // keep screenshots lean and useful
    video: 'retain-on-failure', // record video only for failures
    channel: 'chrome', // use installed google chrome instead of playwright-managed chromium
    headless: true // keep headless for speed; switch to false while debugging locally if needed
  },

  // ---------- local dev server orchestration ----------

  webServer: {
    command: 'npm run dev', // starts your full local stack (client/server/stencil) for e2e
    url: 'http://localhost:5173/trust-center/', // playwright waits until this url is reachable
    reuseExistingServer: !process.env.CI, // avoids restarting if the app is already running locally
    timeout: 120_000 // gives the stack time to boot on slower machines
  },

  // ---------- project matrix ----------

  projects: [
    {
      name: 'chrome-local',
      use: {
        channel: 'chrome' // kept here too so future projects can override per-browser cleanly
      }
    }
  ]
});
