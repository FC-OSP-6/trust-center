/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  schema + deterministic seed

  - ensures db schema exists (migrations)
  - reads sample json data + normalizes rows
  - upserts by stable natural keys (control_key / faq_key)
  - prints deterministic metrics for repeatable runs (+ pagination practice)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

import fs from 'node:fs/promises'; // read seed json files from disk
import path from 'node:path'; // build absolute paths for data folder
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM

import { ensureDbSchema, closeDbPool, getDbPool } from './index'; // schema runner + pool lifecycle

// ----------  normalization helpers  ----------

// trim + collapse internal spaces
export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// normalize + join + lowercase for consistent contains search
export function buildSearchText(parts: string[]): string {
  const normalized = parts
    .map(p => normalizeWhitespace(String(p ?? '')))
    .filter(p => p.length > 0);

  return normalized.join(' ').toLowerCase();
}

// deterministic natural key from human text
function stableKeyFromText(text: string): string {
  const cleaned = normalizeWhitespace(text).toLowerCase();

  // keep letters / numbers / spaces only
  const alnumSpacesOnly = cleaned.replace(/[^a-z0-9\s]/g, ' ');

  // turn spaces into underscores for db-friendly natural key
  const underscored = alnumSpacesOnly
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');

  // safety clamp  -->  keeps keys readable and avoids massive keys
  return underscored.slice(0, 120);
}

// stable tag ordering + no empties
function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map(t => normalizeWhitespace(String(t ?? '')).toLowerCase())
    .filter(t => t.length > 0);

  // deterministic  -->  sort + de-dupe
  const uniq = Array.from(new Set(cleaned));
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq;
}

// ----------  seed row shapes  ----------

export type SeedControlRow = {
  control_key: string;
  title: string;
  description: string;
  category: string;
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
  category: string;
  tags: string[] | null;
  created_by: string;
  updated_by: string;
  search_text: string;
};

// ----------  load seed json  ----------

// resolve server/db/data relative to THIS file  -->  works even when cwd changes
function getDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, 'data');
}

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(raw) as T;
}

// ----------  normalize incoming JSON  ----------

// normalizeControlsJson()  -->  accepts either:
//   A) { controls: [...] }  (our normalized local file shape)
//   B) the old GraphQL dump: { data: { allTrustControls: { edges: [{ node: {...} }] } } }
function normalizeControlsJson(input: any): SeedControlRow[] {
  const seedUser = 'seed'; // created_by / updated_by for seed pipeline

  // case A: normalized local file
  const listA = Array.isArray(input?.controls) ? input.controls : null;

  // case B: graphql dump
  const listB = Array.isArray(input?.data?.allTrustControls?.edges)
    ? input.data.allTrustControls.edges.map((e: any) => e?.node).filter(Boolean)
    : null;

  const items = (listA ?? listB ?? []) as any[];

  const rows: SeedControlRow[] = items.map(item => {
    // required-ish fields (we accept both naming styles)
    const title = normalizeWhitespace(String(item.title ?? item.short ?? ''));
    const description = normalizeWhitespace(
      String(item.description ?? item.long ?? '')
    );
    const category =
      normalizeWhitespace(String(item.category ?? 'General')) || 'General';

    // stable key preference order:
    //   1) explicit control_key from normalized file
    //   2) derived from category + title (deterministic)
    const rawKey = String(item.control_key ?? '').trim();
    const derivedKey = stableKeyFromText(`${category} ${title}`);
    const control_key = normalizeWhitespace(
      rawKey.length > 0 ? rawKey : derivedKey
    );

    const tagsArr = normalizeTags(item.tags);
    const tags = tagsArr.length > 0 ? tagsArr : null;

    const source_url = item.source_url ? String(item.source_url) : null;

    // search_text  -->  required for UI search + debug
    const search_text = buildSearchText([
      title,
      category,
      description,
      ...(tagsArr.length > 0 ? tagsArr : [])
    ]);

    return {
      control_key,
      title,
      description,
      category,
      source_url,
      tags,
      created_by: String(item.created_by ?? item.createdBy ?? seedUser),
      updated_by: String(item.updated_by ?? item.updatedBy ?? seedUser),
      search_text
    };
  });

  // deterministic ordering  -->  stable upsert + stable metrics
  rows.sort((a, b) => a.control_key.localeCompare(b.control_key));
  return rows;
}

// normalizeFaqsJson()  -->  accepts either:
//   A) { faqs: [...] }  (our normalized local file shape)
//   B) the old GraphQL dump: { data: { allTrustFaqs: { edges: [{ node: {...} }] } } }
function normalizeFaqsJson(input: any): SeedFaqRow[] {
  const seedUser = 'seed';

  const listA = Array.isArray(input?.faqs) ? input.faqs : null;

  const listB = Array.isArray(input?.data?.allTrustFaqs?.edges)
    ? input.data.allTrustFaqs.edges.map((e: any) => e?.node).filter(Boolean)
    : null;

  const items = (listA ?? listB ?? []) as any[];

  const rows: SeedFaqRow[] = items.map(item => {
    const question = normalizeWhitespace(String(item.question ?? ''));
    const answer = normalizeWhitespace(String(item.answer ?? ''));
    const category =
      normalizeWhitespace(String(item.category ?? 'General')) || 'General';

    const rawKey = String(item.faq_key ?? '').trim();
    const derivedKey = stableKeyFromText(question);
    const faq_key = normalizeWhitespace(
      rawKey.length > 0 ? rawKey : derivedKey
    );

    const tagsArr = normalizeTags(item.tags);
    const tags = tagsArr.length > 0 ? tagsArr : null;

    const search_text = buildSearchText([
      question,
      category,
      answer,
      ...(tagsArr.length > 0 ? tagsArr : [])
    ]);

    return {
      faq_key,
      question,
      answer,
      category,
      tags,
      created_by: String(item.created_by ?? item.createdBy ?? seedUser),
      updated_by: String(item.updated_by ?? item.updatedBy ?? seedUser),
      search_text
    };
  });

  rows.sort((a, b) => a.faq_key.localeCompare(b.faq_key));
  return rows;
}

// ----------  upsert seed (idempotent)  ----------

export async function seedControls(
  rows: SeedControlRow[]
): Promise<{ inserted: number; updated: number; skipped: number }> {
  const pool = getDbPool();
  const client = await pool.connect();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // keep the whole seed deterministic  -->  one transaction for controls
    await client.query('begin');

    for (const row of rows) {
      const res = await client.query<{ inserted: boolean }>(
        `
        insert into public.controls (
          control_key,
          title,
          description,
          category,
          source_url,
          tags,
          created_by,
          updated_by,
          search_text
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (lower(control_key)) do update
        set
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          source_url = excluded.source_url,
          tags = excluded.tags,
          updated_by = excluded.updated_by,
          updated_at = now(),
          search_text = excluded.search_text
        where
          public.controls.title is distinct from excluded.title
          or public.controls.description is distinct from excluded.description
          or public.controls.category is distinct from excluded.category
          or public.controls.source_url is distinct from excluded.source_url
          or public.controls.tags is distinct from excluded.tags
          or public.controls.search_text is distinct from excluded.search_text
        returning (xmax = 0) as inserted;
        `,
        [
          row.control_key,
          row.title,
          row.description,
          row.category,
          row.source_url,
          row.tags,
          row.created_by,
          row.updated_by,
          row.search_text
        ]
      );

      // rowCount 0  -->  conflict happened but WHERE was false (unchanged row)
      if (res.rowCount === 0) {
        skipped += 1;
        continue;
      }

      // inserted flag tells us insert vs update for deterministic metrics
      if (res.rows[0]?.inserted) inserted += 1;
      else updated += 1;
    }

    await client.query('commit');
    return { inserted, updated, skipped };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function seedFaqs(
  rows: SeedFaqRow[]
): Promise<{ inserted: number; updated: number; skipped: number }> {
  const pool = getDbPool();
  const client = await pool.connect();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    await client.query('begin');

    for (const row of rows) {
      const res = await client.query<{ inserted: boolean }>(
        `
        insert into public.faqs (
          faq_key,
          question,
          answer,
          category,
          tags,
          created_by,
          updated_by,
          search_text
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (lower(faq_key)) do update
        set
          question = excluded.question,
          answer = excluded.answer,
          category = excluded.category,
          tags = excluded.tags,
          updated_by = excluded.updated_by,
          updated_at = now(),
          search_text = excluded.search_text
        where
          public.faqs.question is distinct from excluded.question
          or public.faqs.answer is distinct from excluded.answer
          or public.faqs.category is distinct from excluded.category
          or public.faqs.tags is distinct from excluded.tags
          or public.faqs.search_text is distinct from excluded.search_text
        returning (xmax = 0) as inserted;
        `,
        [
          row.faq_key,
          row.question,
          row.answer,
          row.category,
          row.tags,
          row.created_by,
          row.updated_by,
          row.search_text
        ]
      );

      if (res.rowCount === 0) {
        skipped += 1;
        continue;
      }

      if (res.rows[0]?.inserted) inserted += 1;
      else updated += 1;
    }

    await client.query('commit');
    return { inserted, updated, skipped };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

// ----------  deterministic metrics  ----------

export async function runSeed(): Promise<void> {
  await ensureDbSchema(); // schema first  -->  don't assume tables exist
  const dataDir = getDataDir();

  // controls json path  -->  single source of truth
  const controlsPath = path.join(dataDir, 'controls.json');
  const faqsPath = path.join(dataDir, 'faqs.json');

  // load json (error if missing)
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

  // normalize into stable internal row shapes
  const controlRows = normalizeControlsJson(controlsRaw);
  const faqRows = normalizeFaqsJson(faqsRaw);

  // upsert in deterministic order  -->  controls then faqs
  const controlsResult = await seedControls(controlRows);
  const faqsResult = await seedFaqs(faqRows);

  // totals after  -->  verification uses these
  const pool = getDbPool();
  const controlsCountRes = await pool.query<{ count: string }>(
    'select count(*)::text as count from public.controls;'
  );
  const faqsCountRes = await pool.query<{ count: string }>(
    'select count(*)::text as count from public.faqs;'
  );

  const totalControlsAfter = Number(controlsCountRes.rows[0]?.count ?? '0');
  const totalFaqsAfter = Number(faqsCountRes.rows[0]?.count ?? '0');

  // required verification keys
  const summary = {
    controlsInserted: controlsResult.inserted,
    controlsUpdated: controlsResult.updated,
    faqsInserted: faqsResult.inserted,
    faqsUpdated: faqsResult.updated,
    totalControlsAfter,
    totalFaqsAfter
  };

  // final summary line (deterministic keys)
  console.log('\n🌱  Seed summary');
  console.log(summary);

  // optional  -->  show skipped counts
  console.log('\n🧾  Seed details');
  console.log({
    controlsSkipped: controlsResult.skipped,
    faqsSkipped: faqsResult.skipped,
    controlsInputRows: controlRows.length,
    faqsInputRows: faqRows.length
  });
}

// ----------  script entrypoint (db:seed)  ----------

// always close the pool so node exits cleanly
async function main(): Promise<void> {
  try {
    await runSeed();
    console.log('\n✅  seed complete');
  } catch (error) {
    console.error('\n❌  seed failed:', error);
    process.exitCode = 1;
  } finally {
    await closeDbPool();
  }
}

// entrypoint guard  -->  tsx server/db/seed.ts should run main()
const isDirectRun =
  process.argv[1]?.endsWith('server/db/seed.ts') ||
  process.argv[1]?.endsWith('server\\db\\seed.ts');
if (isDirectRun) main();
