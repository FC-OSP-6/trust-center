/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL resolver orchestration layer

  - keeps resolver responsibilities small and predictable
  - delegates all read-path work to services
  - validates cursors before service execution
  - maps db/service rows into GraphQL-safe node shapes
  - logs which source produced the data for debugging
  - preserves the existing GraphQL contract for the frontend
  - exposes richer taxonomy metadata for later consumers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './context'; // Shared per-request context contract
import { isValidCursor, encodeCursor, toIso } from '../services/pagination'; // Cursor validation + encoding utilities
import {
  getControlsPage,
  type DbControlRow,
  type ControlsPage
} from '../services/controlsService'; // controls read-path service owns db/cache/memo/pagination
import {
  getFaqsPage,
  type DbFaqRow,
  type FaqsPage
} from '../services/faqsService'; // faqs read-path service owns db/cache/memo/pagination

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active
import { buildControlsKey, buildFaqsKey } from '../cache';
import { mutationResolvers } from './mutations'; // cache invalidation mutations

// ---------- Database row shapes ----------

type DbControlRow = {
  id: string; // uuid primary key
  control_key: string; // natural key used by seed upserts
  title: string; // short label
  description: string; // long detail
  category: string; // grouping
  source_url: string | null; // optional url
  updated_at: string | Date; // timestamptz
};

type DbFaqRow = {
  id: string; // uuid primary key
  faq_key: string; // natural key used by seed upserts
  question: string; // user-facing question
  answer: string; // user-facing answer
  category: string; // grouping
  updated_at: string | Date; // timestamptz
};

type CursorPayload = {
  sortValue: string; // updated_at iso string
  id: string; // uuid tie-breaker
};

// ---------- Constants ----------

const MAX_PAGE_SIZE = 50; // Safety cap to prevent excessive query sizes

// ---------- Helpers (timestamps + input normalization) ----------

// Local timestamp normalizer used to ensure consistent ISO output within resolvers
// (intentionally decoupled from service-layer implementation)
function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString(); // pg may return Date with custom parsers
  const asDate = new Date(value); // tolerate string timestamps
  if (Number.isNaN(asDate.getTime())) return String(value); // fallback for unexpected values
  return asDate.toISOString(); // canonical iso output
}

function clampFirst(first: number): number {
  if (!Number.isFinite(first)) return 10; // default page size for bad inputs
  if (first <= 0) return 10; // default for non-positive values
  return Math.min(first, MAX_PAGE_SIZE); // enforce safety max
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' '); // trim + collapse internal spaces
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, m => `\\${m}`); // escape wildcard chars for LIKE/ILIKE
}

// ---------- Data source logging ----------

type DataSource = 'db' | 'mock'; // service layer reports whether rows came from the real db or seed fallback

type ConnectionPage<T> = {
  rows: T[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
}; // shared subset used to build relay-style connection results without duplicating the final response shape

function logDataSource(args: {
  requestId: string;
  resolverName: string;
  source: DataSource;
  returnedCount: number;
}): void {
  console.log(
    `[data] requestId=${args.requestId} resolver=${args.resolverName} source=${args.source} count=${args.returnedCount}`
  ); // Single-line log optimized for terminal scanning during MVP demos
}

// ---------- Cursor boundary builder (DESC order) ----------

/**
 * Builds SQL boundary clause for DESC cursor pagination.
 *
 * Enforces strict tuple comparison on (updated_at, id)
 * to maintain stable, deterministic ordering.
 *
 * Returns SQL fragment + parameter list.
 */
function buildAfterBoundary(
  after: string | undefined,
  startingIndex: number
): { sql: string; params: unknown[] } {
  if (!after) return { sql: '', params: [] }; // no cursor means no boundary

  const decoded = decodeCursor(after); // decode cursor payload
  if (!decoded) throw new Error('CURSOR_ERROR: invalid after cursor'); // readable failure for UI

  const p1 = startingIndex; // param index for sortValue
  const p2 = startingIndex + 1; // param index for id

  // desc boundary --> (updated_at, id) must be strictly less than cursor tuple
  const sql = `
    and (
      updated_at < $${p1}::timestamptz
      or (updated_at = $${p1}::timestamptz and id < $${p2}::uuid)
    )
  `;

  return { sql, params: [decoded.sortValue, decoded.id] }; // return clause + params
}

// NOTE: Legacy in-file fetchers retained for reference during service extraction.
// Current resolvers delegate to service-layer implementations.
// ---------- Database fetchers (controls + FAQs) ----------

/**
 * Retrieves a paginated controls page.
 *
 * Responsibilities:
 * - Builds filtered SQL query with cursor boundary
 * - Applies cache layer (query-arg derived key)
 * - Computes totalCount and hasNextPage
 * - Falls back to seed JSON when DB is unavailable
 *
 * Returns rows + pagination metadata + data source indicator.
 */
async function fetchControlsPage(
  args: {
    first: number;
    after?: string;
    category?: string;
    search?: string;
  },
  ctx: GraphQLContext
): Promise<{
  rows: DbControlRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  source: DataSource;
}> {
  const firstClamped = clampFirst(args.first);

  // Cache keys must derive solely from query arguments (never requestId)
  const cacheKey = buildControlsKey({
    first: firstClamped,
    ...(args.after !== undefined ? { after: args.after } : {}),
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  });

  const ttlSeconds = 60; // Short TTL suitable for prototype/demo environments

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  };

  const { whereSql, params } = buildControlsWhere(whereArgs);
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1);

  const countSql = `
    select count(*)::int as count
    from public.controls
    ${whereSql}
  `;

  try {
    const cached = await ctx.cache.getOrSet(cacheKey, ttlSeconds, async () => {
      const countRes = await ctx.db.query(countSql, params);
      const totalCount = Number(countRes.rows?.[0]?.count ?? 0);

      const pageSql = `
        select
          id,
          control_key,
          title,
          description,
          category,
          source_url,
          updated_at
        from public.controls
        ${whereSql}
        ${whereSql ? '' : 'where true'}
        ${afterBoundary.sql}
        order by updated_at desc, id desc
        limit $${params.length + afterBoundary.params.length + 1}
      `;

      const limitParam = firstClamped + 1;
      const pageParams = [...params, ...afterBoundary.params, limitParam];

      const pageRes = await ctx.db.query(pageSql, pageParams);
      const fetched = (pageRes.rows ?? []) as DbControlRow[];

      const hasNextPage = fetched.length > firstClamped;
      const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched;

      const last = rows.length ? rows[rows.length - 1] : null;
      const endCursor = last
        ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
        : null;

      return { rows, hasNextPage, endCursor, totalCount };
    });

    // getOrSet returns unknown, so cast back to our shape
    return { ...(cached as any), source: 'db' };
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;

    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[gql] controlsConnection fallback to seed json:', msg);

    const seedRows = await loadSeedControls();

    const categoryNorm = args.category
      ? normalizeText(args.category).toLowerCase()
      : '';
    const searchNorm = args.search
      ? normalizeText(args.search).toLowerCase()
      : '';

    const filtered = seedRows.filter(r => {
      const catOk = categoryNorm
        ? r.category.toLowerCase() === categoryNorm
        : true;
      const searchOk = searchNorm
        ? `${r.title} ${r.description} ${r.category}`
            .toLowerCase()
            .includes(searchNorm)
        : true;
      return catOk && searchOk;
    });

    const pageArgs = {
      first: args.first,
      ...(args.after !== undefined ? { after: args.after } : {})
    };

    const page = pageFromRows(filtered, pageArgs);
    return { ...page, source: 'mock' };
  }
}

/**
 * Retrieves a paginated FAQs page.
 *
 * Mirrors fetchControlsPage behavior:
 * - SQL filtering + cursor boundary
 * - Cache layer integration
 * - Pagination metadata computation
 * - Seed JSON fallback
 *
 * Returns rows + pagination metadata + data source indicator.
 */
async function fetchFaqsPage(
  args: {
    first: number;
    after?: string;
    category?: string;
    search?: string;
  },
  ctx: GraphQLContext
): Promise<{
  rows: DbFaqRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  source: DataSource;
}> {
  const firstClamped = clampFirst(args.first);

  const cacheKey = buildFaqsKey({
    first: firstClamped,
    ...(args.after !== undefined ? { after: args.after } : {}),
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  });

  const ttlSeconds = 60;

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  };

  const { whereSql, params } = buildFaqsWhere(whereArgs);
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1);

  const countSql = `
    select count(*)::int as count
    from public.faqs
    ${whereSql}
  `;

  try {
    const cached = await ctx.cache.getOrSet(cacheKey, ttlSeconds, async () => {
      const countRes = await ctx.db.query(countSql, params);
      const totalCount = Number(countRes.rows?.[0]?.count ?? 0);

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

      const limitParam = firstClamped + 1;
      const pageParams = [...params, ...afterBoundary.params, limitParam];

      const pageRes = await ctx.db.query(pageSql, pageParams);
      const fetched = (pageRes.rows ?? []) as DbFaqRow[];

      const hasNextPage = fetched.length > firstClamped;
      const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched;

      const last = rows.length ? rows[rows.length - 1] : null;
      const endCursor = last
        ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
        : null;

      return { rows, hasNextPage, endCursor, totalCount };
    });

    return { ...(cached as any), source: 'db' };
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;

    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[gql] faqsConnection fallback to seed json:', msg);

    const seedRows = await loadSeedFaqs();

    const categoryNorm = args.category
      ? normalizeText(args.category).toLowerCase()
      : '';
    const searchNorm = args.search
      ? normalizeText(args.search).toLowerCase()
      : '';

    const filtered = seedRows.filter(r => {
      const catOk = categoryNorm
        ? r.category.toLowerCase() === categoryNorm
        : true;
      const searchOk = searchNorm
        ? `${r.question} ${r.answer} ${r.category}`
            .toLowerCase()
            .includes(searchNorm)
        : true;
      return catOk && searchOk;
    });

    const pageArgs = {
      first: args.first,
      ...(args.after !== undefined ? { after: args.after } : {})
    };

    const page = pageFromRows(filtered, pageArgs);
    return { ...page, source: 'mock' };
  }
}

// ---------- Field mappers (DB → GraphQL) ----------

function mapControlNode(row: DbControlRow) {
  return {
    id: row.id, // GraphQL node id
    controlKey: row.control_key, // db snake_case -> api camelCase
    title: row.title, // pass through title as-is
    description: row.description, // pass through description as-is
    section: row.section, // expose broad taxonomy bucket
    category: row.category, // pass through category as-is
    subcategory: row.subcategory, // expose finer taxonomy bucket when present
    tags: row.tags ?? [], // GraphQL list stays non-null even when db/fallback tags are absent
    sourceUrl: row.source_url, // db snake_case -> api camelCase
    updatedAt: toIso(row.updated_at) // normalize db timestamp into GraphQL-friendly iso string
  };
}

function mapFaqNode(row: DbFaqRow) {
  return {
    id: row.id, // GraphQL node id
    faqKey: row.faq_key, // db snake_case -> api camelCase
    question: row.question, // pass through question as-is
    answer: row.answer, // pass through answer as-is
    section: row.section, // expose broad taxonomy bucket
    category: row.category, // pass through category as-is
    subcategory: row.subcategory, // expose finer taxonomy bucket when present
    tags: row.tags ?? [], // GraphQL list stays non-null even when db/fallback tags are absent
    updatedAt: toIso(row.updated_at) // normalize db timestamp into GraphQL-friendly iso string
  };
}

// ---------- connection helpers ----------

function buildConnectionResult<
  T extends { id: string; updated_at: string | Date },
  TNode
>(page: ConnectionPage<T>, mapNode: (row: T) => TNode) {
  const edges = page.rows.map(row => ({
    cursor: encodeCursor({
      sortValue: toIso(row.updated_at), // keep cursor aligned with service/db sort order
      id: row.id // id is the tie-breaker to keep ordering stable
    }),
    node: mapNode(row) // convert db/service row into frontend GraphQL shape
  }));

  return {
    edges, // Relay-style edge array
    pageInfo: {
      hasNextPage: page.hasNextPage, // service already determined if a next page exists
      endCursor: page.endCursor // service already computed the last cursor for this page
    },
    totalCount: page.totalCount // total count stays on the connection for client pagination metadata
  };
}

// ---------- query resolvers ----------

/**
 * GraphQL resolver map bound to schema fields.
 *
 * Thin orchestration layer:
 * - Validates arguments
 * - Delegates data retrieval to service layer
 * - Shapes results into GraphQL connection format
 */
export const resolvers = {
  Query: {
    hello: () => 'helloWorld from GraphQL!', // Placeholder to verify schema wiring
    health: () => 'OK', // Placeholder to verify server health without GraphQL errors

    debugContext: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => ({
      requestId: ctx.requestId, // exposes request id so the team can match GraphiQL output to terminal logs
      isAdmin: ctx.auth.isAdmin // exposes placeholder auth state while auth is still a stub
    }),

    controlsConnection: async (
      _parent: unknown,
      args: {
        first: number;
        after?: string;
        category?: string;
        search?: string;
      },
      ctx: GraphQLContext
    ) => {
      if (args.after && !isValidCursor(args.after))
        // Fail fast on invalid cursor to avoid ambiguous pagination behavior
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail early with readable cursor error

      const page: ControlsPage = await getControlsPage(args, ctx); // service owns db reads, filtering, pagination, cache, memo, and fallback

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'controlsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // Terminal visibility into DB vs. seed fallback behavior

      return buildConnectionResult(page, mapControlNode); // centralize relay connection shaping so controls/faqs stay symmetric
    },

    faqsConnection: async (
      _parent: unknown,
      args: {
        first: number;
        after?: string;
        category?: string;
        search?: string;
      },
      ctx: GraphQLContext
    ) => {
      if (args.after && !isValidCursor(args.after)) {
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail fast so bad cursors never reach the service layer
      }

      const page: FaqsPage = await getFaqsPage(args, ctx); // service owns db reads, filtering, pagination, cache, memo, and fallback

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'faqsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // Terminal visibility into DB vs. seed fallback behavior

      return buildConnectionResult(page, mapFaqNode); // centralize relay connection shaping so controls/faqs stay symmetric
    }
  },
  Mutation: mutationResolvers.Mutation // wire cache invalidation mutations into the executable resolver map
};
