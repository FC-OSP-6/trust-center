/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    TL;DR  -->  optional stencil-only browser test config

    phase 2 testing optimization stretch
    
    use this only if:
      - we want browser tests for stencil components in isolation
      - we want a separate playwright job from the root app e2e suite

    do not use this as our primary E2E config right now:
      - the root playwright config already covers app-level e2e flows
      - this adds extra runner complexity for a first-pass test rollout
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  // ---------- test discovery ----------

  testDir: './tests/e2e', // keep browser tests in a clearly named e2e folder inside stencil
  testMatch: '**/*.spec.ts',

  // ---------- browser defaults ----------

  use: {
    browserName: 'chromium', // playwright engine family for chrome-channel launches
    channel: 'chrome', // use system google chrome
    headless: true, // headless for speed
    baseURL: 'http://localhost:3333' // update if your stencil dev server uses a different port
  },

  // ---------- local server ----------

  webServer: {
    command: 'npm run start', // verify this script actually starts the stencil demo/dev server
    url: 'http://localhost:3333', // match the actual server url instead of just port
    reuseExistingServer: !process.env.CI
  }
});
