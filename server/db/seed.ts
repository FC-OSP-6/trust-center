/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  schema + deterministic seed

  - ensures db schema exists (migrations)
  - reads sample json data + normalizes rows
  - validates shared taxonomy contract before any db work begins
  - upserts by stable natural keys (control_key / faq_key)
  - persists taxonomy metadata into db columns once migration 003 exists
  - batches seed writes per table to reduce round-trips while keeping deterministic metrics
  - prints deterministic metrics for repeatable runs (+ pagination practice)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

import fs from 'node:fs/promises'; // read seed json files from disk
import path from 'node:path'; // build absolute paths for data folder
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM

import { ensureDbSchema, closeDbPool, getDbPool } from './index'; // schema runner + pool lifecycle
import {
  assertValidTaxonomyManifest,
  buildSearchText,
  normalizeWhitespace,
  readTaxonomyManifestFile,
  resolveTaxonomy,
  type ResolvedTaxonomy,
  type TaxonomyManifest
} from '../taxonomy'; // shared taxonomy/search helpers stay separate from seed-runner orchestration

export {
  assertValidTaxonomyManifest,
  buildSearchText,
  normalizeWhitespace,
  resolveTaxonomy,
  type ResolvedTaxonomy,
  type TaxonomyManifest
} from '../taxonomy'; // preserve current test imports while the shared helper module becomes the real source of truth

// ---------- key + tag normalization helpers ----------

function stableKeyFromText(text: string): string {
  const cleaned = normalizeWhitespace(text).toLowerCase();

  const alnumSpacesOnly = cleaned.replace(/[^a-z0-9\s]/g, ' '); // keep letters / numbers / spaces only
  const underscored = alnumSpacesOnly
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, ''); // convert normalized spaces into db-friendly underscores

  return underscored.slice(0, 120); // safety clamp keeps deterministic keys readable and bounded
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []; // tolerate missing tags on incoming seed rows

  const cleaned = tags
    .map(tag => normalizeWhitespace(String(tag ?? '')).toLowerCase())
    .filter(tag => tag.length > 0); // normalize into deterministic lowercase tags

  const uniq = Array.from(new Set(cleaned));
  uniq.sort((a, b) => a.localeCompare(b)); // stable tag order avoids noisy reseed churn
  return uniq;
}

// ---------- seed row shapes ----------

export type SeedControlRow = {
  control_key: string;
  title: string;
  description: string;
  section: string;
  category: string;
  subcategory: string | null;
  source_url: string | null;
  tags: string[] | null;
  created_by: string;
  updated_by: string;
  search_text: string;
};

export type SeedFaqRow = {
  faq_key: string;
  question: string;
  answer: string;
  section: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
  created_by: string;
  updated_by: string;
  search_text: string;
};

// ---------- load seed json ----------

function getDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, 'data'); // resolve server/db/data relative to THIS file so cwd changes do not matter
}

function getTaxonomyPath(): string {
  return path.join(getDataDir(), 'taxonomy.json'); // shared taxonomy manifest lives alongside the seed json payloads
}

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(raw) as T;
}

let cachedTaxonomyManifest: TaxonomyManifest | null = null; // cache once per process for seed + tests

async function readTaxonomyManifest(): Promise<TaxonomyManifest> {
  if (cachedTaxonomyManifest) return cachedTaxonomyManifest;

  const manifest = await readTaxonomyManifestFile(
    getTaxonomyPath(),
    'taxonomy.json'
  ); // shared loader keeps seed + fallback manifest validation aligned

  cachedTaxonomyManifest = manifest;
  return manifest;
}

// ---------- normalize incoming json ----------

function buildControlSearchText(args: {
  title: string;
  taxonomy: ResolvedTaxonomy;
  description: string;
  tags: string[];
}): string {
  return buildSearchText([
    args.title,
    args.taxonomy.section,
    args.taxonomy.category,
    args.taxonomy.subcategory ?? '',
    args.description,
    ...args.tags
  ]); // one shared composition shape keeps db seed + fallback parity tight
}

function buildFaqSearchText(args: {
  question: string;
  taxonomy: ResolvedTaxonomy;
  answer: string;
  tags: string[];
}): string {
  return buildSearchText([
    args.question,
    args.taxonomy.section,
    args.taxonomy.category,
    args.taxonomy.subcategory ?? '',
    args.answer,
    ...args.tags
  ]); // one shared composition shape keeps db seed + fallback parity tight
}

function normalizeControlsJson(
  input: any,
  taxonomy: TaxonomyManifest
): SeedControlRow[] {
  const seedUser = 'seed'; // created_by / updated_by for seed pipeline

  const listA = Array.isArray(input?.controls) ? input.controls : null; // case A: normalized local file
  const listB = Array.isArray(input?.data?.allTrustControls?.edges)
    ? input.data.allTrustControls.edges
        .map((edge: any) => edge?.node)
        .filter(Boolean)
    : null; // case B: old GraphQL dump shape

  const items = (listA ?? listB ?? []) as any[];

  const rows: SeedControlRow[] = items.map(item => {
    const title = normalizeWhitespace(String(item.title ?? item.short ?? '')); // accept both normalized + legacy title fields
    const description = normalizeWhitespace(
      String(item.description ?? item.long ?? '')
    ); // accept both normalized + legacy description fields
    const taxonomyFields = resolveTaxonomy(taxonomy, 'controls', {
      section: item.section,
      category: item.category,
      subcategory: item.subcategory
    }); // shared taxonomy resolver freezes the final taxonomy shape in one place

    const rawKey = String(item.control_key ?? '').trim(); // preserve explicit natural keys whenever the seed file already provides them
    const derivedKey = stableKeyFromText(`${taxonomyFields.category} ${title}`); // deterministic fallback for legacy/derived rows
    const control_key = normalizeWhitespace(
      rawKey.length > 0 ? rawKey : derivedKey
    );

    const tagsArr = normalizeTags(item.tags);
    const tags = tagsArr.length > 0 ? tagsArr : null;
    const source_url = item.source_url ? String(item.source_url) : null;
    const search_text = buildControlSearchText({
      title,
      taxonomy: taxonomyFields,
      description,
      tags: tagsArr
    });

    return {
      control_key,
      title,
      description,
      section: taxonomyFields.section,
      category: taxonomyFields.category,
      subcategory: taxonomyFields.subcategory,
      source_url,
      tags,
      created_by: String(item.created_by ?? item.createdBy ?? seedUser),
      updated_by: String(item.updated_by ?? item.updatedBy ?? seedUser),
      search_text
    };
  });

  rows.sort((a, b) => a.control_key.localeCompare(b.control_key)); // deterministic ordering keeps payload hashing + metrics stable
  return rows;
}

function normalizeFaqsJson(
  input: any,
  taxonomy: TaxonomyManifest
): SeedFaqRow[] {
  const seedUser = 'seed';

  const listA = Array.isArray(input?.faqs) ? input.faqs : null; // case A: normalized local file
  const listB = Array.isArray(input?.data?.allTrustFaqs?.edges)
    ? input.data.allTrustFaqs.edges
        .map((edge: any) => edge?.node)
        .filter(Boolean)
    : null; // case B: old GraphQL dump shape

  const items = (listA ?? listB ?? []) as any[];

  const rows: SeedFaqRow[] = items.map(item => {
    const question = normalizeWhitespace(String(item.question ?? ''));
    const answer = normalizeWhitespace(String(item.answer ?? ''));
    const taxonomyFields = resolveTaxonomy(taxonomy, 'faqs', {
      section: item.section,
      category: item.category,
      subcategory: item.subcategory
    });

    const rawKey = String(item.faq_key ?? '').trim();
    const derivedKey = stableKeyFromText(question);
    const faq_key = normalizeWhitespace(
      rawKey.length > 0 ? rawKey : derivedKey
    );

    const tagsArr = normalizeTags(item.tags);
    const tags = tagsArr.length > 0 ? tagsArr : null;
    const search_text = buildFaqSearchText({
      question,
      taxonomy: taxonomyFields,
      answer,
      tags: tagsArr
    });

    return {
      faq_key,
      question,
      answer,
      section: taxonomyFields.section,
      category: taxonomyFields.category,
      subcategory: taxonomyFields.subcategory,
      tags,
      created_by: String(item.created_by ?? item.createdBy ?? seedUser),
      updated_by: String(item.updated_by ?? item.updatedBy ?? seedUser),
      search_text
    };
  });

  rows.sort((a, b) => a.faq_key.localeCompare(b.faq_key)); // deterministic ordering keeps payload hashing + metrics stable
  return rows;
}

// ---------- batched upsert seed (idempotent) ----------

type SeedWriteMetrics = {
  inserted: number;
  updated: number;
  skipped: number;
};

export async function seedControls(
  rows: SeedControlRow[]
): Promise<SeedWriteMetrics> {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 }; // avoid hitting the db when the normalized controls payload is empty
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('begin'); // keep the whole controls seed deterministic within one transaction

    const res = await client.query<{
      inserted: string | number;
      updated: string | number;
      skipped: string | number;
    }>(
      `
      with input_rows as (
        select
          control_key,
          title,
          description,
          section,
          category,
          subcategory,
          source_url,
          tags,
          created_by,
          updated_by,
          search_text
        from jsonb_to_recordset($1::jsonb) as rows(
          control_key text,
          title text,
          description text,
          section text,
          category text,
          subcategory text,
          source_url text,
          tags text[],
          created_by text,
          updated_by text,
          search_text text
        )
      ),
      upserted as (
        insert into public.controls (
          control_key,
          title,
          description,
          section,
          category,
          subcategory,
          source_url,
          tags,
          created_by,
          updated_by,
          search_text
        )
        select
          control_key,
          title,
          description,
          section,
          category,
          subcategory,
          source_url,
          tags,
          created_by,
          updated_by,
          search_text
        from input_rows
        on conflict (lower(control_key)) do update
        set
          title = excluded.title,
          description = excluded.description,
          section = excluded.section,
          category = excluded.category,
          subcategory = excluded.subcategory,
          source_url = excluded.source_url,
          tags = excluded.tags,
          updated_by = excluded.updated_by,
          updated_at = now(),
          search_text = excluded.search_text
        where
          public.controls.title is distinct from excluded.title
          or public.controls.description is distinct from excluded.description
          or public.controls.section is distinct from excluded.section
          or public.controls.category is distinct from excluded.category
          or public.controls.subcategory is distinct from excluded.subcategory
          or public.controls.source_url is distinct from excluded.source_url
          or public.controls.tags is distinct from excluded.tags
          or public.controls.search_text is distinct from excluded.search_text
        returning (xmax = 0) as inserted
      )
      select
        coalesce(count(*) filter (where inserted), 0)::int as inserted,
        coalesce(count(*) filter (where not inserted), 0)::int as updated,
        greatest((select count(*) from input_rows) - count(*), 0)::int as skipped
      from upserted;
      `,
      [JSON.stringify(rows)]
    );

    await client.query('commit');

    const metrics = res.rows[0];
    return {
      inserted: Number(metrics?.inserted ?? 0),
      updated: Number(metrics?.updated ?? 0),
      skipped: Number(metrics?.skipped ?? 0)
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function seedFaqs(rows: SeedFaqRow[]): Promise<SeedWriteMetrics> {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 }; // avoid hitting the db when the normalized faqs payload is empty
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('begin'); // keep the whole faqs seed deterministic within one transaction

    const res = await client.query<{
      inserted: string | number;
      updated: string | number;
      skipped: string | number;
    }>(
      `
      with input_rows as (
        select
          faq_key,
          question,
          answer,
          section,
          category,
          subcategory,
          tags,
          created_by,
          updated_by,
          search_text
        from jsonb_to_recordset($1::jsonb) as rows(
          faq_key text,
          question text,
          answer text,
          section text,
          category text,
          subcategory text,
          tags text[],
          created_by text,
          updated_by text,
          search_text text
        )
      ),
      upserted as (
        insert into public.faqs (
          faq_key,
          question,
          answer,
          section,
          category,
          subcategory,
          tags,
          created_by,
          updated_by,
          search_text
        )
        select
          faq_key,
          question,
          answer,
          section,
          category,
          subcategory,
          tags,
          created_by,
          updated_by,
          search_text
        from input_rows
        on conflict (lower(faq_key)) do update
        set
          question = excluded.question,
          answer = excluded.answer,
          section = excluded.section,
          category = excluded.category,
          subcategory = excluded.subcategory,
          tags = excluded.tags,
          updated_by = excluded.updated_by,
          updated_at = now(),
          search_text = excluded.search_text
        where
          public.faqs.question is distinct from excluded.question
          or public.faqs.answer is distinct from excluded.answer
          or public.faqs.section is distinct from excluded.section
          or public.faqs.category is distinct from excluded.category
          or public.faqs.subcategory is distinct from excluded.subcategory
          or public.faqs.tags is distinct from excluded.tags
          or public.faqs.search_text is distinct from excluded.search_text
        returning (xmax = 0) as inserted
      )
      select
        coalesce(count(*) filter (where inserted), 0)::int as inserted,
        coalesce(count(*) filter (where not inserted), 0)::int as updated,
        greatest((select count(*) from input_rows) - count(*), 0)::int as skipped
      from upserted;
      `,
      [JSON.stringify(rows)]
    );

    await client.query('commit');

    const metrics = res.rows[0];
    return {
      inserted: Number(metrics?.inserted ?? 0),
      updated: Number(metrics?.updated ?? 0),
      skipped: Number(metrics?.skipped ?? 0)
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

// ---------- deterministic metrics ----------

export async function runSeed(): Promise<void> {
  const dataDir = getDataDir();
  const controlsPath = path.join(dataDir, 'controls.json'); // controls json path  -->  single source of truth
  const faqsPath = path.join(dataDir, 'faqs.json');
  const taxonomyManifest = await readTaxonomyManifest(); // taxonomy must validate before any db work begins

  const controlsRaw = await readJsonFile<any>(controlsPath).catch(err => {
    throw new Error(
      `SEED_ERROR: missing controls.json at ${controlsPath}\n${String(err)}`
    );
  });

  const faqsRaw = await readJsonFile<any>(faqsPath).catch(err => {
    throw new Error(
      `SEED_ERROR: missing faqs.json at ${faqsPath}\n${String(err)}`
    );
  });

  const controlRows = normalizeControlsJson(controlsRaw, taxonomyManifest); // normalize into stable internal row shapes
  const faqRows = normalizeFaqsJson(faqsRaw, taxonomyManifest);

  await ensureDbSchema(); // schema runs after taxonomy validation so bad labels fail fast

  const controlsResult = await seedControls(controlRows); // batched deterministic write for controls
  const faqsResult = await seedFaqs(faqRows); // batched deterministic write for faqs

  const pool = getDbPool();
  const controlsCountRes = await pool.query<{ count: string }>(
    'select count(*)::text as count from public.controls;'
  );
  const faqsCountRes = await pool.query<{ count: string }>(
    'select count(*)::text as count from public.faqs;'
  );

  const totalControlsAfter = Number(controlsCountRes.rows[0]?.count ?? '0');
  const totalFaqsAfter = Number(faqsCountRes.rows[0]?.count ?? '0');

  const summary = {
    controlsInserted: controlsResult.inserted,
    controlsUpdated: controlsResult.updated,
    faqsInserted: faqsResult.inserted,
    faqsUpdated: faqsResult.updated,
    totalControlsAfter,
    totalFaqsAfter
  }; // required verification keys

  console.log('\n🌱  Seed Summary'); // final summary line (deterministic keys)
  console.log(summary);

  console.log('\n🧾  Seed Details'); // optional  -->  show skipped counts
  console.log({
    controlsSkipped: controlsResult.skipped,
    faqsSkipped: faqsResult.skipped,
    controlsInputRows: controlRows.length,
    faqsInputRows: faqRows.length
  });
}

// ---------- script entrypoint (db:seed) ----------

async function main(): Promise<void> {
  try {
    await runSeed();
    console.log('\n✅  Seed Complete');
  } catch (error) {
    console.error('\n❌  Seed Failed:', error);
    process.exitCode = 1;
  } finally {
    await closeDbPool(); // always close the pool so node exits cleanly
  }
}

const isDirectRun =
  process.argv[1]?.endsWith('server/db/seed.ts') ||
  process.argv[1]?.endsWith('server\\db\\seed.ts'); // entrypoint guard  -->  tsx server/db/seed.ts should run main()

if (isDirectRun) main();
