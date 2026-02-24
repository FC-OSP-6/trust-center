/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> graphql resolvers (thin orchestration)

  - validates graphql args (cursor shape)
  - delegates read logic to services (sql + pagination + fallback + request memo)
  - maps db rows to graphql nodes + edges
  - logs which data source served each request (db vs mock)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './context'; // shared per-request context shape
import { isValidCursor, encodeCursor, toIso } from '../services/pagination'; // shared pagination primitives
import {
  getControlsPage,
  type DbControlRow
} from '../services/controlsService'; // controls read path
import { getFaqsPage, type DbFaqRow } from '../services/faqsService'; // faqs read path

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active
import { buildControlsKey, buildFaqsKey } from '../cache';

// ----------  db row shapes  ----------

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

// ----------  constants  ----------

const MAX_PAGE_SIZE = 50; // safety cap --> avoids accidental heavy queries

// ----------  helpers (timestamps + inputs)  ----------

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

// ----------  data source logs  ----------

type DataSource = 'db' | 'mock';

function logDataSource(args: {
  requestId: string;
  resolverName: string;
  source: DataSource;
  returnedCount: number;
}) {
  console.log(
    `[data] requestId=${args.requestId} resolver=${args.resolverName} source=${args.source} count=${args.returnedCount}`
  ); // single-line log for terminal scanning during mvp demos
}

// ----------  cursor boundary builder (desc order)  ----------

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

// ----------  db fetchers (controls + faqs)  ----------

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

  // cache keys should be based ONLY on query args (never requestId)
  const cacheKey = buildControlsKey({
    first: firstClamped,
    ...(args.after !== undefined ? { after: args.after } : {}),
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  });

  const ttlSeconds = 60; // prototype-friendly TTL

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

// ----------  field mappers (db --> graphql)  ----------

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

// ---------- resolver map (schema execution) ----------

export const resolvers = {
  Query: {
    hello: () => 'helloWorld from GraphQL!', // placeholder --> proves schema executes
    health: () => 'OK', // placeholder --> proves server is healthy without graphql errors

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
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail early with readable cursor error

      const page = await getControlsPage(args, ctx); // service owns db/fallback/pagination internals + request memo dedupe

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'controlsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // terminal visibility for db vs seed fallback behavior

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

      const page = await getFaqsPage(args, ctx); // service owns db/fallback/pagination internals + request memo dedupe

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'faqsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // terminal visibility for db vs seed fallback behavior

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
        totalCount: page.totalCount // post-filter total count for UI pagination metadata
      };
    }
  }
};
