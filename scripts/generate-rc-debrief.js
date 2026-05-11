// generate-rc-debrief.js
// Produces rc-debrief.json in the project root.
// Source of truth for required fields: .claude/changes/rc-contract.md §8
//
// Rules (enforced by Testing Agent):
// - DO NOT parse test output files
// - DO NOT infer runtime results
// - Static facts are hardcoded from rc-contract.md
// - Dynamic facts (commit SHA, date) are captured at generation time
// - All fields requiring manual verification use explicit placeholder strings

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------- dynamic fields ----------

function getCommitSha() {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: ROOT,
      encoding: 'utf8'
    }).trim();
  } catch {
    return 'unknown — git not available';
  }
}

function getIsoDate() {
  return new Date().toISOString();
}

// ---------- static facts (from rc-contract.md — do not change without updating the contract) ----------

const KNOWN_LIMITATIONS = [
  'W-01: test:stencil has 0 spec files — script exits 0 but tests nothing',
  'W-02: /trust-center/resources has no Playwright e2e test',
  'W-03: AI success and fallback states unreachable at runtime — backend mutation not implemented',
  'W-04: Redis cache adapter is a stub — CACHE_ADAPTER=lru forced in all modes',
  'W-05: Lighthouse CI not configured — no .lighthouserc, no CI workflow',
  'W-06: Admin CRUD mutations have no UI and no e2e test'
];

// ---------- debrief structure (rc-contract.md §8) ----------

const debrief = {
  rc_version: 'RC-1',
  demo_date: getIsoDate(),
  commit_sha: getCommitSha(),

  // Set by operator before demo — bun-local or compose
  runtime_used: 'PENDING — set to: bun-local | compose',

  // Static: Redis adapter is a stub; LRU is the only active cache mode
  cache_mode: 'lru',

  // Static: aiAnswer mutation is not in the GraphQL schema (schema.ts line 198, comment only)
  ai_mode: 'none',

  test_results: {
    // Operator fills in after running: bun run typecheck
    typecheck: 'PENDING — run: bun run typecheck',
    // Operator fills in after running: bun run format:check
    format_check: 'PENDING — run: bun run format:check',
    // Operator fills in after running: bun run test:unit
    unit: 'PENDING — run: bun run test:unit',
    // Operator fills in after running: bun run test:integration
    // Note: requires DATABASE_URL pointing to a migrated, seeded Postgres instance
    integration: 'PENDING — run: bun run test:integration (requires live DB)',
    // Static: no spec files exist; script exits 0 but covers nothing (W-01)
    stencil: 'skip (no specs)',
    // Operator fills in after running: bun run test:e2e
    e2e_smoke: 'PENDING — run: bun run test:e2e',
    e2e_controls: 'PENDING — run: bun run test:e2e'
  },

  build: {
    // Operator fills in after running: bun run build
    stencil: 'PENDING — run: bun run build:stencil',
    client: 'PENDING — run: bun run build:client',
    dist_exists: 'PENDING — verify: ls dist/'
  },

  runtime_health: {
    // Operator fills in after booting the stack
    api_health_200: 'PENDING — verify: GET /api/health returns 200',
    graphql_reachable: 'PENDING — verify: POST /graphql with { hello } query'
  },

  // Static: determined by architecture (backend not implemented, see schema.ts)
  ai_verification: {
    idle_state_visible: true,
    error_state_reachable: true,
    retry_button_visible: true,
    success_state_reachable: false,
    fallback_state_reachable: false,
    note: 'Backend mutation not implemented. Error state is the only terminal state at runtime.'
  },

  // Static: Lighthouse CI not configured (W-05)
  lighthouse: {
    status: 'not-configured',
    routes_checked: [],
    scores: {}
  },

  known_limitations: KNOWN_LIMITATIONS,

  // Operator fills in before demo
  demo_fallback_plan:
    'PENDING — describe contingency: e.g. switch runtime, use seed fallback, present Playwright HTML report as evidence'
};

// ---------- write ----------

const outputPath = join(ROOT, 'rc-debrief.json');
writeFileSync(outputPath, JSON.stringify(debrief, null, 2) + '\n', 'utf8');
console.log(`rc-debrief.json written to ${outputPath}`);
