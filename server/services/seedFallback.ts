/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> centralized seed fallback helpers

  - isolates fallback decision logic from individual services
  - loads and normalizes seed json for controls + faqs
  - validates fallback rows against the shared taxonomy contract
  - reuses shared taxonomy resolution + search-text composition helpers
  - keeps fallback ordering deterministic for cursor pagination
  - respects ALLOW_SEED_FALLBACK so demo mode is explicit
  - logs fallback usage in a request-aware structured format
  - keeps fallback data outside the shared db read cache path
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import fs from 'node:fs/promises'; // read local seed json + taxonomy files when db is unavailable
import path from 'node:path'; // resolve seed data directory paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // build deterministic ids + timestamps for seed-mode rows
import {
  assertValidTaxonomyManifest,
  buildSearchText,
  normalizeWhitespace,
  resolveTaxonomy,
  type TaxonomyManifest
} from '../db/seed'; // reuse the shared taxonomy/search contract so db + fallback do not drift

// ---------- shared row shapes ----------

export type SeedControlRow = {
  id: string; // deterministic fallback id
  control_key: string; // natural key used by the GraphQL/API layer
  title: string; // user-facing label
  description: string; // long description
  section: string; // broad taxonomy bucket
  category: string; // grouping used by filters/subnav
  subcategory: string | null; // finer taxonomy bucket
  tags: string[]; // normalized seed tags
  source_url: string | null; // optional source url
  search_text: string; // taxonomy-aware fallback search text for parity with db seed normalization
  updated_at: string; // deterministic iso timestamp for stable cursor behavior
};

export type SeedFaqRow = {
  id: string; // deterministic fallback id
  faq_key: string; // natural key used by the GraphQL/API layer
  question: string; // user-facing question
  answer: string; // user-facing answer
  section: string; // broad taxonomy bucket
  category: string; // grouping used by filters/subnav
  subcategory: string | null; // finer taxonomy bucket
  tags: string[]; // normalized seed tags
  search_text: string; // taxonomy-aware fallback search text for parity with db seed normalization
  updated_at: string; // deterministic iso timestamp for stable cursor behavior
};

// ---------- raw json shapes ----------

type SeedControlJson = {
  controls: Array<{
    control_key: string;
    title: string;
    description: string;
    section?: string;
    category?: string;
    subcategory?: string | null;
    tags?: string[] | null;
    source_url?: string | null;
  }>;
};

type SeedFaqJson = {
  faqs: Array<{
    faq_key: string;
    question: string;
    answer: string;
    section?: string;
    category?: string;
    subcategory?: string | null;
    tags?: string[] | null;
  }>;
};

// ---------- local normalization helpers ----------

function normalizeRequiredText(label: string, value: unknown): string {
  const text = normalizeWhitespace(String(value ?? '')); // collapse whitespace before required-field validation

  if (text.length === 0) {
    throw new Error(`SEED_FALLBACK_ERROR: missing required field "${label}"`); // fail fast so broken seed rows do not silently ship through fallback mode
  }

  return text; // required fallback text fields must always be non-empty
}

function normalizeOptionalText(value: unknown): string | null {
  const text = normalizeWhitespace(String(value ?? '')); // collapse whitespace before null check
  return text.length > 0 ? text : null; // avoid storing empty strings as semantic values
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []; // tolerate missing tags on incomplete rows

  const cleaned = tags
    .map(tag => normalizeWhitespace(String(tag ?? '')).toLowerCase()) // normalize for deterministic fallback comparisons
    .filter(tag => tag.length > 0); // drop empty tag values

  const uniq = Array.from(new Set(cleaned)); // remove duplicates before sort
  uniq.sort((a, b) => a.localeCompare(b)); // stable tag ordering helps seed-mode parity
  return uniq;
}

export function getSeedControlSearchText(
  row: Pick<SeedControlRow, 'search_text'>
): string {
  return row.search_text; // fallback rows already store taxonomy-aware search_text, so services should reuse it instead of rebuilding it
}

export function getSeedFaqSearchText(
  row: Pick<SeedFaqRow, 'search_text'>
): string {
  return row.search_text; // fallback rows already store taxonomy-aware search_text, so services should reuse it instead of rebuilding it
}

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

// ---------- file + deterministic identity helpers ----------

function getDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url)); // resolve current services directory in ESM
  return path.resolve(here, '../db/data'); // reuse the same db/data folder used by seed scripts
}

function getTaxonomyPath(): string {
  return path.join(getDataDir(), 'taxonomy.json'); // keep fallback taxonomy pointed at the same source of truth as the seed pipeline
}

function stableId(prefix: string, key: string): string {
  const hash = createHash('sha256').update(`${prefix}:${key}`).digest('hex'); // deterministic fallback id source
  return `${prefix}_${hash.slice(0, 24)}`; // shorter stable id is enough for prototype seed mode
}

function stableUpdatedAt(prefix: string, key: string): string {
  const baseMs = Date.parse('2020-01-01T00:00:00.000Z'); // fixed epoch keeps fallback timestamps reproducible across runs
  const windowMs = 5 * 365 * 24 * 60 * 60 * 1000; // spread synthetic timestamps across a fixed five-year window
  const hash = createHash('sha256')
    .update(`updated_at:${prefix}:${key}`)
    .digest('hex'); // derive timestamp from natural key so order is deterministic
  const offsetMs = Number(BigInt(`0x${hash.slice(0, 12)}`) % BigInt(windowMs)); // cap the hash into the fixed window without losing determinism
  return new Date(baseMs + offsetMs).toISOString(); // stable iso timestamp aligns with pagination helpers
}

function compareSeedRowsDesc(
  a: { updated_at: string; id: string },
  b: { updated_at: string; id: string }
): number {
  if (a.updated_at > b.updated_at) return -1; // newer synthetic timestamp sorts first for desc pagination
  if (a.updated_at < b.updated_at) return 1; // older synthetic timestamp sorts later
  return b.id.localeCompare(a.id); // tie-break on id keeps cursor boundaries deterministic
}

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, 'utf8'); // read json once from disk
  return JSON.parse(raw) as T; // parse into the requested shape
}

// ---------- in-process parsed seed caches ----------

let cachedTaxonomyManifest: TaxonomyManifest | null = null; // parsed once per process so repeated fallback reads avoid disk work
let cachedSeedControls: SeedControlRow[] | null = null; // parsed once per process so repeated fallback reads avoid disk work
let cachedSeedFaqs: SeedFaqRow[] | null = null; // parsed once per process so repeated fallback reads avoid disk work

async function readTaxonomyManifest(): Promise<TaxonomyManifest> {
  if (cachedTaxonomyManifest) return cachedTaxonomyManifest; // reuse parsed manifest within the current node process

  const taxonomyPath = getTaxonomyPath(); // resolve the shared taxonomy manifest path
  const manifest = await readJsonFile<TaxonomyManifest>(taxonomyPath).catch(
    err => {
      throw new Error(
        `TAXONOMY_ERROR: missing taxonomy.json at ${taxonomyPath}\n${String(err)}`
      );
    }
  );

  assertValidTaxonomyManifest(manifest, 'fallback taxonomy.json'); // fail fast if the fallback contract drifted from the shared manifest shape
  cachedTaxonomyManifest = manifest; // store parsed manifest for future fallback reuse
  return manifest; // return the validated shared taxonomy manifest
}

export function resetSeedFallbackCachesForTests(): void {
  cachedTaxonomyManifest = null; // clear manifest cache so tests can force a fresh disk read
  cachedSeedControls = null; // clear controls cache so tests do not leak prior rows
  cachedSeedFaqs = null; // clear faqs cache so tests do not leak prior rows
}

// ---------- controls seed loader ----------

export async function getSeedControlsRows(): Promise<SeedControlRow[]> {
  if (cachedSeedControls) return cachedSeedControls; // reuse parsed seed rows within the current node process

  const controlsPath = path.join(getDataDir(), 'controls.json'); // concrete controls seed file path
  const [parsed, taxonomy] = await Promise.all([
    readJsonFile<SeedControlJson>(controlsPath), // read the normalized controls seed payload
    readTaxonomyManifest() // read the shared taxonomy manifest once for contract validation
  ]);

  const rows: SeedControlRow[] = (parsed.controls ?? []).map(control => {
    const controlKey = normalizeRequiredText(
      'controls[].control_key',
      control.control_key
    ); // fallback should fail loudly if natural keys disappear
    const title = normalizeRequiredText('controls[].title', control.title); // keep user-facing labels non-empty
    const description = normalizeRequiredText(
      'controls[].description',
      control.description
    ); // keep fallback search/filter text meaningful
    const taxonomyFields = resolveTaxonomy(taxonomy, 'controls', {
      section: control.section,
      category: control.category,
      subcategory: control.subcategory
    }); // reuse the shared taxonomy resolver so db + fallback stay aligned
    const tags = normalizeTags(control.tags); // normalize tags into a deterministic non-null list
    const sourceUrl = normalizeOptionalText(control.source_url); // preserve null instead of empty strings
    const searchText = buildSearchText([
      title,
      taxonomyFields.section,
      taxonomyFields.category,
      taxonomyFields.subcategory ?? '',
      description,
      ...tags
    ]); // match the taxonomy-aware search-text composition used by the seed pipeline
    const id = stableId('control', controlKey); // deterministic fallback id
    const updatedAt = stableUpdatedAt('control', controlKey); // deterministic fallback timestamp

    return {
      id,
      control_key: controlKey,
      title,
      description,
      section: taxonomyFields.section,
      category: taxonomyFields.category,
      subcategory: taxonomyFields.subcategory,
      tags,
      source_url: sourceUrl,
      search_text: searchText,
      updated_at: updatedAt
    };
  });

  rows.sort(compareSeedRowsDesc); // sort exactly the way pageFromRows expects desc tuple ordering to behave

  cachedSeedControls = rows; // store parsed controls rows for future fallback reuse
  return rows; // return normalized controls rows
}

// ---------- faqs seed loader ----------

export async function getSeedFaqsRows(): Promise<SeedFaqRow[]> {
  if (cachedSeedFaqs) return cachedSeedFaqs; // reuse parsed seed rows within the current node process

  const faqsPath = path.join(getDataDir(), 'faqs.json'); // concrete faqs seed file path
  const [parsed, taxonomy] = await Promise.all([
    readJsonFile<SeedFaqJson>(faqsPath), // read the normalized faqs seed payload
    readTaxonomyManifest() // read the shared taxonomy manifest once for contract validation
  ]);

  const rows: SeedFaqRow[] = (parsed.faqs ?? []).map(faq => {
    const faqKey = normalizeRequiredText('faqs[].faq_key', faq.faq_key); // fallback should fail loudly if natural keys disappear
    const question = normalizeRequiredText('faqs[].question', faq.question); // keep user-facing labels non-empty
    const answer = normalizeRequiredText('faqs[].answer', faq.answer); // keep fallback search/filter text meaningful
    const taxonomyFields = resolveTaxonomy(taxonomy, 'faqs', {
      section: faq.section,
      category: faq.category,
      subcategory: faq.subcategory
    }); // reuse the shared taxonomy resolver so db + fallback stay aligned
    const tags = normalizeTags(faq.tags); // normalize tags into a deterministic non-null list
    const searchText = buildSearchText([
      question,
      taxonomyFields.section,
      taxonomyFields.category,
      taxonomyFields.subcategory ?? '',
      answer,
      ...tags
    ]); // match the taxonomy-aware search-text composition used by the seed pipeline
    const id = stableId('faq', faqKey); // deterministic fallback id
    const updatedAt = stableUpdatedAt('faq', faqKey); // deterministic fallback timestamp

    return {
      id,
      faq_key: faqKey,
      question,
      answer,
      section: taxonomyFields.section,
      category: taxonomyFields.category,
      subcategory: taxonomyFields.subcategory,
      tags,
      search_text: searchText,
      updated_at: updatedAt
    };
  });

  rows.sort(compareSeedRowsDesc); // sort exactly the way pageFromRows expects desc tuple ordering to behave

  cachedSeedFaqs = rows; // store parsed faqs rows for future fallback reuse
  return rows; // return normalized faqs rows
}
