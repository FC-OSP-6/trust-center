/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  vitest config for unit + integration tests

  what this config does:
    - runs fast node/jsdom tests (not playwright e2e tests)
    - includes root testing folders and server tests
    - excludes e2e specs, stencil dist output, and legacy todo/archive folders
    - defaults to node for backend/integration speed

  why this matters:
    - keeps vitest focused on logic + contracts
    - prevents runner collisions with playwright
    - gives us a clean base to add jsdom ui tests later
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ---------- test discovery ----------

    include: [
      'server/**/*.test.ts', // server-side unit/integration tests colocated in server if added later
      'testing/unit-test/**/*.test.ts', // root unit tests
      'testing/integration-tests/**/*.test.ts', // root integration tests
      'testing/**/*.test.tsx' // ui/component tests at root if you keep any tsx vitest files
    ],

    exclude: [
      'testing/e2e-tests/**', // playwright owns E2E
      'testing/_todo/**', // planning stubs should not execute
      'stencil/**', // stencil has its own runner/configs and generated output
      'node_modules/**',
      'test-results/**',
      '**/dist/**'
    ],

    // ---------- default environment ----------

    environment: 'node', // fastest default for backend + api + integration tests

    // ---------- quality-of-life ----------

    globals: true // allows describe/it/expect without importing in every file
  }
});
