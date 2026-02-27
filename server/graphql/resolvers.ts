/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL resolver orchestration layer

  - Returns Relay-style connection objects: { edges, pageInfo, totalCount }
  - Implements Query resolvers for controls and FAQs connections
  - Validates cursor inputs and enforces pagination constraints
  - Delegates data retrieval to service layer (DB, caching, fallback, memoization)
  - Maps database rows into GraphQL connection structures (edges + pageInfo)
  - Logs data source (db vs. mock) for observability
  - Exports: resolvers
  - Consumed by: GraphQL handler (schema execution binding)
  - Depends on: pagination utilities, service layer, cache key builders
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './context'; // Shared per-request context contract
import { isValidCursor, encodeCursor, toIso } from '../services/pagination'; // Cursor validation + encoding utilities
import {
  getControlsPage,
  type DbControlRow
} from '../services/controlsService'; // Controls service (data retrieval + pagination logic)
import { getFaqsPage, type DbFaqRow } from '../services/faqsService'; // FAQs service (data retrieval + pagination logic)

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active
import { buildControlsKey, buildFaqsKey } from '../cache';

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

type DataSource = 'db' | 'mock';

/**
 * Emits structured log indicating which data source served the request.
 *
 * Used for observability during DB vs. seed fallback scenarios.
 */
function logDataSource(args: {
  requestId: string;
  resolverName: string;
  source: DataSource;
  returnedCount: number;
}) {
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
    id: row.id, // graphql id
    controlKey: row.control_key, // snake -> camel
    title: row.title, // passthrough
    description: row.description, // passthrough
    category: row.category, // passthrough
    sourceUrl: row.source_url, // snake -> camel
    updatedAt: toIso(row.updated_at) // timestamptz -> iso string
  };
}

function mapFaqNode(row: DbFaqRow) {
  return {
    id: row.id, // graphql id
    faqKey: row.faq_key, // snake -> camel
    question: row.question, // passthrough
    answer: row.answer, // passthrough
    category: row.category, // passthrough
    updatedAt: toIso(row.updated_at) // timestamptz -> iso string
  };
}

// ---------- Resolver map (schema execution layer) ----------

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
      requestId: ctx.requestId, // show request trace id
      isAdmin: ctx.auth.isAdmin // show admin flag
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

      const page = await getControlsPage(args, ctx); // Service layer handles DB access, fallback logic, pagination, and request memoization

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'controlsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // Terminal visibility into DB vs. seed fallback behavior

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }), // connection cursor from stable sort tuple
        node: mapControlNode(row) // db row -> graphql node
      }));

      return {
        edges, // connection edges
        pageInfo: {
          hasNextPage: page.hasNextPage, // pagination flag from service
          endCursor: page.endCursor // service-computed end cursor
        },
        totalCount: page.totalCount // post-filter total count for ui pagination metadata
      };
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
      if (args.after && !isValidCursor(args.after))
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail early with readable cursor error

      const page = await getFaqsPage(args, ctx); // Service layer handles DB access, fallback logic, pagination, and request memoization

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'faqsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // Terminal visibility into DB vs. seed fallback behavior

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }), // connection cursor from stable sort tuple
        node: mapFaqNode(row) // db row -> graphql node
      }));

      return {
        edges, // connection edges
        pageInfo: {
          hasNextPage: page.hasNextPage, // pagination flag from service
          endCursor: page.endCursor // service-computed end cursor
        },
        totalCount: page.totalCount // Post-filter total count for UI pagination metadata
      };
    }
  }
};
