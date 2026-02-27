/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> centralized seed fallback helpers

  - isolates fallback decision logic from individual services
  - loads and normalizes seed json for controls + faqs
  - respects ALLOW_SEED_FALLBACK so demo mode is explicit
  - logs fallback usage in a request-aware structured format
  - keeps fallback data outside the shared db read cache path
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import fs from 'node:fs/promises'; // read local seed json files when db is unavailable
import path from 'node:path'; // resolve seed data directory paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // build deterministic ids for seed-mode rows

// ---------- shared row shapes ----------

export type SeedControlRow = {
  id: string; // deterministic fallback id
  control_key: string; // natural key used by the GraphQL/API layer
  title: string; // user-facing label
  description: string; // long description
  category: string; // grouping used by filters/subnav
  source_url: string | null; // optional source url
  updated_at: string; // synthetic iso timestamp for stable cursor behavior
};

export type SeedFaqRow = {
  id: string; // deterministic fallback id
  faq_key: string; // natural key used by the GraphQL/API layer
  question: string; // user-facing question
  answer: string; // user-facing answer
  category: string; // grouping used by filters/subnav
  updated_at: string; // synthetic iso timestamp for stable cursor behavior
};

// ---------- raw json shapes ----------

type SeedControlJson = {
  controls: Array<{
    control_key: string;
    title: string;
    description: string;
    category: string;
    source_url?: string | null;
  }>;
};

type SeedFaqJson = {
  faqs: Array<{
    faq_key: string;
    question: string;
    answer: string;
    category: string;
  }>;
};

// ---------- env + fallback decision helpers ----------

function isSeedFallbackEnabled(): boolean {
  const raw = String(process.env.ALLOW_SEED_FALLBACK ?? '').toLowerCase(); // env flags arrive as strings
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'; // tolerate common truthy values for local demo mode
}

export function shouldUseSeedFallback(error: unknown): boolean {
  if (!isSeedFallbackEnabled()) return false; // fallback must be explicitly enabled so perf/debug work stays honest

  const msg = error instanceof Error ? error.message : String(error); // normalize unknown errors into one comparable string
  const lower = msg.toLowerCase(); // case-insensitive matching keeps checks simple

  if (msg.includes('ENV_ERROR:')) return true; // missing DATABASE_URL or similar env validation failures are safe fallback cases
  if (lower.includes('connect')) return true; // common connection/refused/timeout failures are safe fallback cases
  if (lower.includes('does not exist')) return true; // missing table/schema during local setup is safe fallback territory

  return false; // logic/query bugs should surface instead of being hidden by fallback
}

export function logSeedFallback(args: {
  requestId: string;
  resolverName: string;
  reason: string;
}): void {
  console.warn(
    `[gql] requestId=${args.requestId} resolver=${args.resolverName} event=fallback_to_seed reason=${args.reason}`
  ); // structured warning keeps fallback visible in the same trace as gql/memo/cache/db/data logs
}

// ---------- file + id helpers ----------

function getDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url)); // resolve current services directory in ESM
  return path.resolve(here, '../db/data'); // reuse the same db/data folder used by seed scripts
}

function stableId(prefix: string, key: string): string {
  const hash = createHash('sha256').update(`${prefix}:${key}`).digest('hex'); // deterministic fallback id source
  return `${prefix}_${hash.slice(0, 24)}`; // shorter stable id is enough for prototype seed mode
}

// ---------- in-process parsed seed caches ----------

let cachedSeedControls: SeedControlRow[] | null = null; // parsed once per process so repeated fallback reads avoid disk work
let cachedSeedFaqs: SeedFaqRow[] | null = null; // parsed once per process so repeated fallback reads avoid disk work

// ---------- controls seed loader ----------

export async function getSeedControlsRows(): Promise<SeedControlRow[]> {
  if (cachedSeedControls) return cachedSeedControls; // reuse parsed seed rows within the current node process

  const controlsPath = path.join(getDataDir(), 'controls.json'); // concrete controls seed file path
  const raw = await fs.readFile(controlsPath, 'utf8'); // read seed json from disk
  const parsed = JSON.parse(raw) as SeedControlJson; // parse the controls payload
  const nowIso = new Date().toISOString(); // synthetic timestamp keeps cursor ordering stable in seed mode

  const rows: SeedControlRow[] = (parsed.controls ?? []).map(control => ({
    id: stableId('control', String(control.control_key ?? 'missing_key')), // deterministic fallback id
    control_key: String(control.control_key ?? ''), // normalize to string
    title: String(control.title ?? ''), // normalize to string
    description: String(control.description ?? ''), // normalize to string
    category: String(control.category ?? 'General'), // default incomplete rows into a general bucket
    source_url: control.source_url == null ? null : String(control.source_url), // preserve explicit null when source url is absent
    updated_at: nowIso // synthetic iso timestamp used by pagination helpers
  }));

  rows.sort((a, b) => {
    const keyOrder = b.control_key.localeCompare(a.control_key); // deterministic seed-mode ordering when timestamps are identical
    if (keyOrder !== 0) return keyOrder; // primary seed ordering by natural key
    return b.id.localeCompare(a.id); // stable tie-breaker to avoid unstable page boundaries
  });

  cachedSeedControls = rows; // store parsed controls rows for future fallback reuse
  return rows; // return normalized controls rows
}

// ---------- faqs seed loader ----------

export async function getSeedFaqsRows(): Promise<SeedFaqRow[]> {
  if (cachedSeedFaqs) return cachedSeedFaqs; // reuse parsed seed rows within the current node process

  const faqsPath = path.join(getDataDir(), 'faqs.json'); // concrete faqs seed file path
  const raw = await fs.readFile(faqsPath, 'utf8'); // read seed json from disk
  const parsed = JSON.parse(raw) as SeedFaqJson; // parse the faqs payload
  const nowIso = new Date().toISOString(); // synthetic timestamp keeps cursor ordering stable in seed mode

  const rows: SeedFaqRow[] = (parsed.faqs ?? []).map(faq => ({
    id: stableId('faq', String(faq.faq_key ?? 'missing_key')), // deterministic fallback id
    faq_key: String(faq.faq_key ?? ''), // normalize to string
    question: String(faq.question ?? ''), // normalize to string
    answer: String(faq.answer ?? ''), // normalize to string
    category: String(faq.category ?? 'General'), // default incomplete rows into a general bucket
    updated_at: nowIso // synthetic iso timestamp used by pagination helpers
  }));

  rows.sort((a, b) => {
    const keyOrder = b.faq_key.localeCompare(a.faq_key); // deterministic seed-mode ordering when timestamps are identical
    if (keyOrder !== 0) return keyOrder; // primary seed ordering by natural key
    return b.id.localeCompare(a.id); // stable tie-breaker to avoid unstable page boundaries
  });

  cachedSeedFaqs = rows; // store parsed faqs rows for future fallback reuse
  return rows; // return normalized faqs rows
}
