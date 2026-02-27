/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> controls service (single place for read logic)

  - builds sql for controlsConnection (filters + cursor boundary + deterministic order)
  - keeps pagination behavior identical to previous resolver implementation
  - supports seed json fallback when db is unavailable (mvp resilience)
  - dedupes duplicate reads within one graphql request using request-scoped memoization
  - adds shared read cache (LRU TTL) for db-backed results across requests
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from '../graphql/context'; // request-scoped deps (db + memo + cache + auth)
import { buildControlsReadCacheKey } from '../cache/keys'; // normalized cache key builder (includes auth scope)
import { memoizePromise } from './memo'; // request-scoped promise dedupe helper
import {
  getSeedControlsRows,
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

export type ControlsConnectionArgs = {
  first: number; // requested page size
  after?: string; // optional cursor
  category?: string; // optional category filter
  search?: string; // optional search filter
};

export type DbControlRow = {
  id: string; // uuid primary key
  control_key: string; // natural key used by seed upserts
  title: string; // short label
  description: string; // long detail
  category: string; // grouping
  source_url: string | null; // optional url
  updated_at: string | Date; // timestamptz
};

export type ControlsPage = {
  rows: DbControlRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  source: 'db' | 'mock';
};

// ---------- cache config helpers ----------

const CONTROLS_READ_CACHE_TTL_SECONDS = 60; // short prototype ttl keeps repeated UI reads fast while staying reasonably fresh

function getAuthScopeForReadCache(ctx: GraphQLContext): string {
  if (ctx.auth.isAdmin) return 'admin'; // placeholder until real auth scopes land
  return 'public'; // current prototype reads behave as public
}

// ---------- db read path (cacheable) ----------

async function getControlsPageFromDb(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): Promise<ControlsPage> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  }; // omit undefined props for exactOptionalPropertyTypes

  const { whereSql, params } = buildCategorySearchWhere(whereArgs); // build shared filter predicates
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary predicate

  const countSql = `
    select count(*)::int as count
    from public.controls
    ${whereSql}
  `; // total count for connection metadata (post-filter, pre-page)

  const countRes = await ctx.db.query(countSql, params); // count query goes through injected db adapter
  const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize count result defensively

  const pageSql = `
    select id, control_key, title, description, category, source_url, updated_at
    from public.controls
    ${whereSql}
    ${whereSql ? '' : 'where true'}
    ${afterBoundary.sql}
    order by updated_at desc, id desc
    limit $${params.length + afterBoundary.params.length + 1}
  `; // deterministic desc ordering with cursor boundary + overfetch by 1

  const limitParam = firstClamped + 1; // overfetch one row to compute hasNextPage
  const pageParams = [...params, ...afterBoundary.params, limitParam]; // preserve parameter ordering
  const pageRes = await ctx.db.query(pageSql, pageParams); // paged query through injected db adapter
  const fetched = (pageRes.rows ?? []) as DbControlRow[]; // cast row shape from query result

  const hasNextPage = fetched.length > firstClamped; // extra row means more data exists
  const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched; // trim extra row for response
  const last = rows.length ? rows[rows.length - 1] : null; // last visible row determines endCursor
  const endCursor = last
    ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
    : null; // null when page is empty

  return { rows, hasNextPage, endCursor, totalCount, source: 'db' }; // db-backed page result
}

async function getControlsPageDbCached(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): Promise<ControlsPage> {
  const cacheKey = buildControlsReadCacheKey(args, {
    authScope: getAuthScopeForReadCache(ctx)
  }); // normalized cross-request cache key with placeholder auth scope

  const page = await ctx.cache.getOrSet(
    cacheKey,
    CONTROLS_READ_CACHE_TTL_SECONDS,
    async () => getControlsPageFromDb(args, ctx) // only db-backed reads belong in the shared cross-request cache
  );

  return page as ControlsPage; // cache interface is generic/unknown-friendly, so cast to service return type
}

// ---------- main read path ----------

export async function getControlsPage(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): Promise<ControlsPage> {
  const memoKey = `controlsService:getControlsPage:${buildControlsReadCacheKey(
    args,
    {
      authScope: getAuthScopeForReadCache(ctx)
    }
  )}`; // align memo identity with shared read-cache identity so future auth-scoped reads cannot collide

  return memoizePromise(ctx.memo, ctx.requestId, memoKey, async () => {
    try {
      return await getControlsPageDbCached(args, ctx); // request memo wraps shared read cache so one request never duplicates work
    } catch (error) {
      if (!shouldUseSeedFallback(error)) throw error; // only known demo-safe failures should route into fallback mode

      const reason = error instanceof Error ? error.message : String(error); // normalize unknown errors into one loggable string

      logSeedFallback({
        requestId: ctx.requestId, // tie fallback log to the same request trace used by gql/cache/db/data logs
        resolverName: 'controlsConnection', // identify which resolver path fell back
        reason // keep the db/env failure reason visible for debugging
      });

      const seedRows = await getSeedControlsRows(); // load normalized controls seed rows from the centralized fallback module
      const filtered = filterRowsByCategorySearch(seedRows, args, {
        getCategory: row => row.category, // category source for shared in-memory filter helper
        getSearchText: row => `${row.title} ${row.description} ${row.category}` // simple fallback search text for substring filtering
      });

      const pageArgs = {
        first: args.first,
        ...(args.after !== undefined ? { after: args.after } : {})
      }; // omit undefined props for exactOptionalPropertyTypes

      const page = pageFromRows(filtered, pageArgs); // paginate the filtered seed rows using the same in-memory helper as before
      return { ...page, source: 'mock' }; // preserve resolver contract while clearly signaling fallback mode
    }
  });
}
