/* ================================
  TL;DR  -->  graphql resolvers

  - maps schema fields to db queries
  - implements cursor pagination + category/search filters
  - keeps deterministic ordering (updated_at desc, id desc)
  - preserves debug resolvers for early boot verification
================================ */

import type { GraphQLContext } from './index'; // shared per-request context shape
import { query } from '../db/index'; // shared pg query wrapper (singleton pool)

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

const MAX_PAGE_SIZE = 50; // safety cap  -->  avoids accidental heavy queries

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

// ----------  cursor encoding (base64url json)  ----------

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); // url-safe base64
}

function fromBase64Url(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/'); // restore standard base64
  const padLen = (4 - (base64.length % 4)) % 4; // compute missing padding
  return base64 + '='.repeat(padLen); // pad to multiple of 4
}

function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload); // serialize payload deterministically
  const base64 = Buffer.from(json, 'utf8').toString('base64'); // encode to base64
  return toBase64Url(base64); // convert to url-safe cursor
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const base64 = fromBase64Url(cursor); // normalize url-safe input
    const json = Buffer.from(base64, 'base64').toString('utf8'); // decode to json
    const parsed = JSON.parse(json) as Partial<CursorPayload>; // parse to object

    if (!parsed || typeof parsed !== 'object') return null; // reject non-object
    if (typeof parsed.sortValue !== 'string') return null; // reject missing timestamp
    if (typeof parsed.id !== 'string') return null; // reject missing id

    return { sortValue: parsed.sortValue, id: parsed.id }; // return typed payload
  } catch {
    return null; // reject invalid base64/json
  }
}

function isValidCursor(cursor: string): boolean {
  return decodeCursor(cursor) !== null; // validator built on decodeCursor
}

// ----------  filter builders (controls + faqs)  ----------

function buildControlsWhere(args: { category?: string; search?: string }): {
  whereSql: string;
  params: unknown[];
} {
  const parts: string[] = []; // sql predicates
  const params: unknown[] = []; // parameter bag

  // category strict match (case-insensitive)
  if (args.category && normalizeText(args.category) !== '') {
    params.push(normalizeText(args.category)); // param: category
    parts.push(`lower(category) = lower($${params.length})`); // predicate: category match
  }

  // search contains match (mvp-simple) using precomputed search_text
  if (args.search && normalizeText(args.search) !== '') {
    const needle = escapeLike(normalizeText(args.search).toLowerCase()); // normalize + escape
    params.push(`%${needle}%`); // param: pattern
    parts.push(`search_text ILIKE $${params.length} ESCAPE '\\\\'`); // predicate: contains
  }

  const whereSql = parts.length ? `where ${parts.join(' and ')}` : ''; // join predicates
  return { whereSql, params }; // return clause + params
}

function buildFaqsWhere(args: { category?: string; search?: string }): {
  whereSql: string;
  params: unknown[];
} {
  const parts: string[] = []; // sql predicates
  const params: unknown[] = []; // parameter bag

  // category strict match (case-insensitive)
  if (args.category && normalizeText(args.category) !== '') {
    params.push(normalizeText(args.category)); // param: category
    parts.push(`lower(category) = lower($${params.length})`); // predicate: category match
  }

  // search contains match (mvp-simple) using precomputed search_text
  if (args.search && normalizeText(args.search) !== '') {
    const needle = escapeLike(normalizeText(args.search).toLowerCase()); // normalize + escape
    params.push(`%${needle}%`); // param: pattern
    parts.push(`search_text ILIKE $${params.length} ESCAPE '\\\\'`); // predicate: contains
  }

  const whereSql = parts.length ? `where ${parts.join(' and ')}` : ''; // join predicates
  return { whereSql, params }; // return clause + params
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

  // desc boundary  -->  (updated_at, id) must be strictly less than cursor tuple
  const sql = `
    and (
      updated_at < $${p1}::timestamptz
      or (updated_at = $${p1}::timestamptz and id < $${p2}::uuid)
    )
  `;

  return { sql, params: [decoded.sortValue, decoded.id] }; // return clause + params
}

// ----------  db fetchers (controls + faqs)  ----------

async function fetchControlsPage(args: {
  first: number;
  after?: string;
  category?: string;
  search?: string;
}): Promise<{
  rows: DbControlRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
}> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const { whereSql, params } = buildControlsWhere({
    category: args.category,
    search: args.search
  }); // build filters
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary

  // totalCount under filters only  -->  ignores cursor boundary by design
  const countSql = `
    select count(*)::int as count
    from public.controls
    ${whereSql}
  `;
  const countRes = await query(countSql, params); // run count query
  const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize result

  // page query  -->  first + 1 to compute hasNextPage
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

  const limitParam = firstClamped + 1; // fetch one extra row
  const pageParams = [...params, ...afterBoundary.params, limitParam]; // compose params in order
  const pageRes = await query(pageSql, pageParams); // run page query

  const fetched = (pageRes.rows ?? []) as DbControlRow[]; // cast rows to shape
  const hasNextPage = fetched.length > firstClamped; // compute pagination flag
  const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched; // drop extra row

  const last = rows.length ? rows[rows.length - 1] : null; // pick last row for endCursor
  const endCursor = last
    ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
    : null; // compute endCursor

  return { rows, hasNextPage, endCursor, totalCount }; // return page payload
}

async function fetchFaqsPage(args: {
  first: number;
  after?: string;
  category?: string;
  search?: string;
}): Promise<{
  rows: DbFaqRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
}> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const { whereSql, params } = buildFaqsWhere({
    category: args.category,
    search: args.search
  }); // build filters
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary

  // totalCount under filters only  -->  ignores cursor boundary by design
  const countSql = `
    select count(*)::int as count
    from public.faqs
    ${whereSql}
  `;
  const countRes = await query(countSql, params); // run count query
  const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize result

  // page query  -->  first + 1 to compute hasNextPage
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
    : null; // compute endCursor

  return { rows, hasNextPage, endCursor, totalCount }; // return page payload
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

// ----------  resolver map (schema execution)  ----------

export const resolvers = {
  Query: {
    // placeholder  -->  proves schema executes
    hello: () => 'helloWorld  from  GraphQL!',

    // placeholder  -->  proves server is healthy without graphql errors
    health: () => 'OK',

    // debug helper  -->  proves context is wired
    debugContext: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => ({
      requestId: ctx.requestId, // show request trace id
      isAdmin: ctx.auth.isAdmin // show admin flag
    }),

    // read-only controls connection  -->  pagination + filters
    controlsConnection: async (
      _parent: unknown,
      args: {
        first: number;
        after?: string;
        category?: string;
        search?: string;
      },
      _ctx: GraphQLContext
    ) => {
      if (args.after && !isValidCursor(args.after))
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail fast

      const page = await fetchControlsPage(args); // fetch deterministic page from db

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }), // edge cursor payload
        node: mapControlNode(row) // db -> graphql node
      }));

      return {
        edges, // list of edges
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor }, // pagination info
        totalCount: page.totalCount // filtered total
      };
    },

    // read-only faqs connection  -->  mirrors controls behavior
    faqsConnection: async (
      _parent: unknown,
      args: {
        first: number;
        after?: string;
        category?: string;
        search?: string;
      },
      _ctx: GraphQLContext
    ) => {
      if (args.after && !isValidCursor(args.after))
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail fast

      const page = await fetchFaqsPage(args); // fetch deterministic page from db

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }), // edge cursor payload
        node: mapFaqNode(row) // db -> graphql node
      }));

      return {
        edges, // list of edges
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor }, // pagination info
        totalCount: page.totalCount // filtered total
      };
    }
  }
};
