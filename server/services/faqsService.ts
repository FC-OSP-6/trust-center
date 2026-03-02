/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> faqs service (single place for read logic)

  - builds sql for faqsConnection (filters + cursor boundary + deterministic order)
  - keeps pagination behavior identical to previous resolver implementation
  - supports seed json fallback when db is unavailable (mvp resilience)
  - dedupes duplicate reads within one graphql request using request-scoped memoization
  - adds shared read cache (LRU TTL) for db-backed results across requests
  - returns taxonomy-aware row metadata for later graphql/frontend consumers
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
  getSeedFaqsRows,
  getSeedFaqSearchText,
  logSeedFallback,
  shouldUseSeedFallback
} from './seedFallback'; // centralized fallback decision + seed row loading
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
  section: string; // broad taxonomy bucket
  category: string; // compatibility grouping field
  subcategory: string | null; // finer taxonomy bucket
  tags: string[] | null; // normalized tag list
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

function buildFaqsReadIdentity(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): string {
  return buildFaqsReadCacheKey(args, {
    authScope: getAuthScopeForReadCache(ctx)
  }); // compute one normalized read identity so request memo + shared cache stay aligned
}

function buildFaqsWhereArgs(args: FaqsConnectionArgs): {
  category?: string;
  search?: string;
} {
  const out: { category?: string; search?: string } = {}; // omit undefined props for exactOptionalPropertyTypes

  if (args.category !== undefined) out.category = args.category; // preserve caller category only when present
  if (args.search !== undefined) out.search = args.search; // preserve caller search only when present

  return out; // exactOptionalPropertyTypes-safe filter arg bag
}

// ---------- db read path (cacheable) ----------

async function getFaqsPageFromDb(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): Promise<FaqsPage> {
  const firstClamped = clampFirst(args.first); // enforce safe page size
  const { whereSql, params } = buildCategorySearchWhere(
    buildFaqsWhereArgs(args)
  ); // build shared filter predicates
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary predicate

  const countSql = `
    select count(*)::int as count
    from public.faqs
    ${whereSql}
  `; // total count for connection metadata (post-filter, pre-page)

  const countRes = await ctx.db.query(countSql, params); // count query goes through injected db adapter
  const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize count result defensively

  const pageSql = `
    select
      id,
      faq_key,
      question,
      answer,
      section,
      category,
      subcategory,
      tags,
      updated_at
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
  const cacheKey = buildFaqsReadIdentity(args, ctx); // normalized cross-request cache key with placeholder auth scope

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
  const readIdentity = buildFaqsReadIdentity(args, ctx); // compute once so memo identity and shared cache identity cannot drift
  const memoKey = `faqsService:getFaqsPage:${readIdentity}`; // namespace request memo identity to keep traceable service ownership

  return memoizePromise(ctx.memo, memoKey, async () => {
    try {
      return await getFaqsPageDbCached(args, ctx); // shared read cache sits inside request memo for best of both
    } catch (error) {
      if (!shouldFallbackToMock(error)) throw error; // non-db-availability errors should not be masked

      const msg = error instanceof Error ? error.message : String(error); // normalize error for logging
      console.warn('[gql] faqsConnection fallback to seed json:', msg); // explicit fallback log for demos

      const seedRows = await loadSeedFaqs(); // parse/cached seed rows
      const filtered = filterRowsByCategorySearch(seedRows, args, {
        getCategory: row => row.category, // category source for shared in-memory filter helper
        getSearchText: getSeedFaqSearchText // reuse the precomputed fallback search_text so services do not drift from seed normalization
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
