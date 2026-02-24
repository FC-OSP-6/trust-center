/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> faqs service (single place for read logic)

  - builds sql for faqsConnection (filters + cursor boundary + deterministic order)
  - keeps pagination behavior identical to previous resolver implementation
  - supports seed json fallback when db is unavailable (mvp resilience)
  - dedupes duplicate reads within one graphql request using request-scoped memoization
  - adds shared read cache (LRU TTL) for db-backed results across requests
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active
import type { GraphQLContext } from '../graphql/context'; // request-scoped deps (db + memo + cache + auth)
import { buildFaqsKey } from '../cache'; // deterministic memo key builder (raw args for readability)
import { buildFaqsReadCacheKey } from '../cache/keys'; // normalized cache key builder (includes auth scope)
import { memoizePromise } from './memo'; // request-scoped promise dedupe helper
import {
  buildAfterBoundary,
  buildCategorySearchWhere,
  filterRowsByCategorySearch,
  pageFromRows,
  toIso,
  encodeCursor,
  clampFirst
} from './pagination';

// ---------- args + row shapes ----------

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

// ---------- cache config + debug helpers ----------

const FAQS_READ_CACHE_TTL_SECONDS = 60; // short prototype ttl for repeated UI reads while keeping data reasonably fresh

function isDebugPerfEnabled(): boolean {
  const raw = String(process.env.DEBUG_PERF ?? '').toLowerCase(); // env flags are strings
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'; // tolerate common truthy values
}

function logReadCache(
  event: 'hit' | 'miss',
  key: string,
  ttlSeconds: number
): void {
  if (!isDebugPerfEnabled()) return; // keep logs quiet unless explicitly enabled
  console.log(`[cache] ${event} key=${key} ttl=${ttlSeconds}s`); // single-line terminal log for quick perf checks
}

function getAuthScopeForReadCache(ctx: GraphQLContext): string {
  if (ctx.auth.isAdmin) return 'admin'; // placeholder until real auth scopes land
  return 'public'; // current prototype reads behave as public
}

// ---------- fallback detection ----------

function shouldFallbackToMock(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error); // normalize error message for matching

  if (msg.includes('ENV_ERROR:')) return true; // env not set (your db layer throws ENV_ERROR: ...)
  if (msg.toLowerCase().includes('connect')) return true; // common connection issues (mvp-safe broad match)
  if (msg.toLowerCase().includes('does not exist')) return true; // missing table/schema during setup/demo

  return false; // let non-connectivity/query bugs surface normally
}

// ---------- seed fallback helpers (db unavailable) ----------

type SeedFaqJson = {
  faqs: Array<{
    faq_key: string;
    question: string;
    answer: string;
    category: string;
  }>;
};

function getDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url)); // resolve current services directory in ESM
  return path.resolve(here, '../db/data'); // match seed.ts data directory convention
}

function stableId(prefix: string, key: string): string {
  const hash = createHash('sha256').update(`${prefix}:${key}`).digest('hex'); // deterministic hash for seed rows
  return `${prefix}_${hash.slice(0, 24)}`; // short stable id string (not a real uuid, okay for seed mode)
}

let cachedSeedFaqs: DbFaqRow[] | null = null; // memoized in-process seed rows to avoid file reads per call

async function loadSeedFaqs(): Promise<DbFaqRow[]> {
  if (cachedSeedFaqs) return cachedSeedFaqs; // reuse parsed seed rows within the process

  const dataDir = getDataDir(); // resolve seed data directory
  const faqsPath = path.join(dataDir, 'faqs.json'); // seed file path
  const raw = await fs.readFile(faqsPath, 'utf8'); // read seed file
  const parsed = JSON.parse(raw) as SeedFaqJson; // parse json payload
  const nowIso = new Date().toISOString(); // placeholder timestamp in seed mode

  const rows: DbFaqRow[] = (parsed.faqs ?? []).map(f => ({
    id: stableId('faq', String(f.faq_key ?? 'missing_key')), // deterministic seed id
    faq_key: String(f.faq_key ?? ''), // normalize to string
    question: String(f.question ?? ''), // normalize to string
    answer: String(f.answer ?? ''), // normalize to string
    category: String(f.category ?? 'General'), // default grouping for incomplete seed rows
    updated_at: nowIso // synthetic timestamp for stable connection behavior in seed mode
  }));

  rows.sort((a, b) => {
    const k = b.faq_key.localeCompare(a.faq_key); // deterministic tie order for seed rows
    if (k !== 0) return k; // primary seed-mode ordering
    return b.id.localeCompare(a.id); // stable tie-breaker
  });

  cachedSeedFaqs = rows; // cache parsed rows for reuse across requests
  return rows; // return parsed + normalized seed rows
}

// ---------- db read path (cacheable) ----------

async function getFaqsPageFromDb(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): Promise<FaqsPage> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  }; // omit undefined props for exactOptionalPropertyTypes

  const { whereSql, params } = buildCategorySearchWhere(whereArgs); // build shared filter predicates
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary predicate

  const countSql = `
    select count(*)::int as count
    from public.faqs
    ${whereSql}
  `; // total count for connection metadata (post-filter, pre-page)

  const countRes = await ctx.db.query(countSql, params); // count query goes through injected db adapter
  const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize count result defensively

  const pageSql = `
    select id, faq_key, question, answer, category, updated_at
    from public.faqs
    ${whereSql}
    ${whereSql ? '' : 'where true'}
    ${afterBoundary.sql}
    order by updated_at desc, id desc
    limit $${params.length + afterBoundary.params.length + 1}
  `; // deterministic desc ordering with cursor boundary + overfetch by 1

  const limitParam = firstClamped + 1; // overfetch one row to compute hasNextPage
  const pageParams = [...params, ...afterBoundary.params, limitParam]; // preserve parameter ordering
  const pageRes = await ctx.db.query(pageSql, pageParams); // paged query through injected db adapter
  const fetched = (pageRes.rows ?? []) as DbFaqRow[]; // cast row shape from query result

  const hasNextPage = fetched.length > firstClamped; // extra row means more data exists
  const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched; // trim extra row for response
  const last = rows.length ? rows[rows.length - 1] : null; // last visible row determines endCursor
  const endCursor = last
    ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
    : null; // null when page is empty

  return { rows, hasNextPage, endCursor, totalCount, source: 'db' }; // db-backed page result
}

async function getFaqsPageDbCached(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): Promise<FaqsPage> {
  const cacheKey = buildFaqsReadCacheKey(args, {
    authScope: getAuthScopeForReadCache(ctx)
  }); // normalized cross-request cache key with placeholder auth scope

  const cached = ctx.cache.get(cacheKey); // probe once for debug visibility before getOrSet
  logReadCache(
    cached === null ? 'miss' : 'hit',
    cacheKey,
    FAQS_READ_CACHE_TTL_SECONDS
  ); // optional cache hit/miss logs

  const page = await ctx.cache.getOrSet(
    cacheKey,
    FAQS_READ_CACHE_TTL_SECONDS,
    async () => getFaqsPageFromDb(args, ctx) // cache DB-backed result only (fallback is handled outside)
  );

  return page as FaqsPage; // cache interface is generic/unknown-friendly, so cast to service return type
}

// ---------- main read path ----------

export async function getFaqsPage(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): Promise<FaqsPage> {
  const memoKey = `faqsService:getFaqsPage:${buildFaqsKey(args)}`; // deterministic per-request dedupe key

  return memoizePromise(ctx.memo, memoKey, async () => {
    try {
      return await getFaqsPageDbCached(args, ctx); // shared read cache sits inside request memo for best of both
    } catch (error) {
      if (!shouldFallbackToMock(error)) throw error; // non-db-availability errors should not be masked

      const msg = error instanceof Error ? error.message : String(error); // normalize error for logging
      console.warn('[gql] faqsConnection fallback to seed json:', msg); // explicit fallback log for demos

      const seedRows = await loadSeedFaqs(); // parse/cached seed rows
      const filtered = filterRowsByCategorySearch(seedRows, args, {
        getCategory: r => r.category, // category source for shared filter helper
        getSearchText: r => `${r.question} ${r.answer} ${r.category}` // simple seed-mode search text
      });

      const pageArgs = {
        first: args.first,
        ...(args.after !== undefined ? { after: args.after } : {})
      }; // omit undefined props for exactOptionalPropertyTypes

      const page = pageFromRows(filtered, pageArgs); // shared in-memory paging helper
      return { ...page, source: 'mock' }; // preserve resolver contract while signaling fallback source
    }
  });
}
