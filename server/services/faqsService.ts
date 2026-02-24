/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  faqs service (single place for read logic)

  - builds sql for faqsConnection (filters + cursor boundary + deterministic order)
  - keeps pagination behavior identical to previous resolver implementation
  - supports seed json fallback when db is unavailable (mvp resilience)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { query } from '../db/index'; // shared pg query wrapper (singleton pool)

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active

import {
  buildAfterBoundary,
  buildCategorySearchWhere,
  filterRowsByCategorySearch,
  pageFromRows,
  toIso,
  encodeCursor,
  clampFirst
} from './pagination';

// ----------  args + row shapes  ----------

export type FaqsConnectionArgs = {
  first: number; // requested page size
  after?: string; // optional cursor
  category?: string; // optional category filter
  search?: string; // optional search filter
};

export type DbFaqRow = {
  id: string; // uuid primary key
  faq_key: string; // natural key used by seed upserts
  question: string; // user-facing question
  answer: string; // user-facing answer
  category: string; // grouping
  updated_at: string | Date; // timestamptz
};

export type FaqsPage = {
  rows: DbFaqRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  source: 'db' | 'mock';
};

// ----------  fallback detection  ----------

function shouldFallbackToMock(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);

  // env not set (your db layer throws ENV_ERROR: ...)
  if (msg.includes('ENV_ERROR:')) return true;

  // common connection/table issues (keep broad for mvp)
  if (msg.toLowerCase().includes('connect')) return true;
  if (msg.toLowerCase().includes('does not exist')) return true;

  return false;
}

// ----------  seed fallback helpers (db unavailable)  ----------

type SeedFaqJson = {
  faqs: Array<{
    faq_key: string;
    question: string;
    answer: string;
    category: string;
  }>;
};

function getDataDir(): string {
  // resolve server/db/data relative to THIS file --> matches seed.ts behavior
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../db/data');
}

function stableId(prefix: string, key: string): string {
  // stable id in seed mode --> deterministic, not a real uuid, but good enough for MVP lists
  const hash = createHash('sha256').update(`${prefix}:${key}`).digest('hex');
  return `${prefix}_${hash.slice(0, 24)}`; // short, stable id string
}

let cachedSeedFaqs: DbFaqRow[] | null = null; // seed cache --> avoids re-reading json on every call

async function loadSeedFaqs(): Promise<DbFaqRow[]> {
  if (cachedSeedFaqs) return cachedSeedFaqs;

  const dataDir = getDataDir();
  const faqsPath = path.join(dataDir, 'faqs.json');

  const raw = await fs.readFile(faqsPath, 'utf8');
  const parsed = JSON.parse(raw) as SeedFaqJson;

  const nowIso = new Date().toISOString(); // placeholder timestamp in seed mode
  const rows: DbFaqRow[] = (parsed.faqs ?? []).map(f => ({
    id: stableId('faq', String(f.faq_key ?? 'missing_key')),
    faq_key: String(f.faq_key ?? ''),
    question: String(f.question ?? ''),
    answer: String(f.answer ?? ''),
    category: String(f.category ?? 'General'),
    updated_at: nowIso
  }));

  // deterministic ordering --> mimics updated_at desc, id desc with stable keys
  rows.sort((a, b) => {
    const k = b.faq_key.localeCompare(a.faq_key);
    if (k !== 0) return k;
    return b.id.localeCompare(a.id);
  });

  cachedSeedFaqs = rows;
  return rows;
}

// ----------  main read path  ----------

export async function getFaqsPage(args: FaqsConnectionArgs): Promise<FaqsPage> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  }; // omit undefined props for exactOptionalPropertyTypes

  const { whereSql, params } = buildCategorySearchWhere(whereArgs); // build filters
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary

  const countSql = `
    select count(*)::int as count
    from public.faqs
    ${whereSql}
  `;

  try {
    const countRes = await query(countSql, params); // run count query
    const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize result

    const pageSql = `
      select
        id,
        faq_key,
        question,
        answer,
        category,
        updated_at
      from public.faqs
      ${whereSql}
      ${whereSql ? '' : 'where true'}
      ${afterBoundary.sql}
      order by updated_at desc, id desc
      limit $${params.length + afterBoundary.params.length + 1}
    `;

    const limitParam = firstClamped + 1; // fetch one extra row
    const pageParams = [...params, ...afterBoundary.params, limitParam]; // compose params in order
    const pageRes = await query(pageSql, pageParams); // run page query

    const fetched = (pageRes.rows ?? []) as DbFaqRow[]; // cast rows to shape
    const hasNextPage = fetched.length > firstClamped; // compute pagination flag
    const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched; // drop extra row

    const last = rows.length ? rows[rows.length - 1] : null; // pick last row for endCursor
    const endCursor = last
      ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
      : null;

    return { rows, hasNextPage, endCursor, totalCount, source: 'db' };
  } catch (error) {
    // only fallback when error indicates db is unavailable or not configured
    if (!shouldFallbackToMock(error)) throw error;

    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[gql] faqsConnection fallback to seed json:', msg);

    const seedRows = await loadSeedFaqs();

    const filtered = filterRowsByCategorySearch(seedRows, args, {
      getCategory: r => r.category,
      getSearchText: r => `${r.question} ${r.answer} ${r.category}`
    });

    const pageArgs = {
      first: args.first,
      ...(args.after !== undefined ? { after: args.after } : {})
    }; // omit undefined props for exactOptionalPropertyTypes

    const page = pageFromRows(filtered, pageArgs);
    return { ...page, source: 'mock' };
  }
}
