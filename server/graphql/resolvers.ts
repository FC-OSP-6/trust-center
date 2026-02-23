/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql resolvers

  - maps schema fields to db queries
  - implements cursor pagination + category/search filters
  - keeps deterministic ordering (updated_at desc, id desc)
  - logs which data source served each request (db vs mock)
  - preserves debug resolvers for early boot verification
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './index'; // shared per-request context shape
import { query } from '../db/index'; // shared pg query wrapper (singleton pool)

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active

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
  // single-line log for terminal scanning during mvp demos
  console.log(
    `[data] requestId=${args.requestId} resolver=${args.resolverName} source=${args.source} count=${args.returnedCount}`
  );
}

function shouldFallbackToMock(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);

  // env not set (your db layer throws ENV_ERROR: ...)
  if (msg.includes('ENV_ERROR:')) return true;

  // common connection/table issues (keep broad for mvp)
  if (msg.toLowerCase().includes('connect')) return true;
  if (msg.toLowerCase().includes('does not exist')) return true;

  return false;
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

// ----------  seed fallback helpers (db unavailable)  ----------

type SeedControlJson = {
  controls: Array<{
    control_key: string;
    title: string;
    description: string;
    category: string;
    source_url?: string | null;
  }>;
};

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

let cachedSeedControls: DbControlRow[] | null = null; // seed cache --> avoids re-reading json on every call
let cachedSeedFaqs: DbFaqRow[] | null = null; // seed cache --> avoids re-reading json on every call

async function loadSeedControls(): Promise<DbControlRow[]> {
  if (cachedSeedControls) return cachedSeedControls;

  const dataDir = getDataDir();
  const controlsPath = path.join(dataDir, 'controls.json');

  const raw = await fs.readFile(controlsPath, 'utf8');
  const parsed = JSON.parse(raw) as SeedControlJson;

  const nowIso = new Date().toISOString(); // placeholder timestamp in seed mode
  const rows: DbControlRow[] = (parsed.controls ?? []).map(c => ({
    id: stableId('control', String(c.control_key ?? 'missing_key')),
    control_key: String(c.control_key ?? ''),
    title: String(c.title ?? ''),
    description: String(c.description ?? ''),
    category: String(c.category ?? 'General'),
    source_url: c.source_url == null ? null : String(c.source_url),
    updated_at: nowIso
  }));

  // deterministic ordering --> mimics updated_at desc, id desc with stable keys
  rows.sort((a, b) => {
    const k = b.control_key.localeCompare(a.control_key);
    if (k !== 0) return k;
    return b.id.localeCompare(a.id);
  });

  cachedSeedControls = rows;
  return rows;
}

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

function pageFromRows<T extends { updated_at: string | Date; id: string }>(
  allRows: T[],
  args: { first: number; after?: string }
): {
  rows: T[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
} {
  // seed-mode pagination helper --> cursor is based on (sortValue,id) like db mode
  const firstClamped = clampFirst(args.first);

  // after cursor boundary --> same tuple comparison as db mode (desc order)
  let filtered = allRows;
  if (args.after) {
    const decoded = decodeCursor(args.after);
    if (!decoded) throw new Error('CURSOR_ERROR: invalid after cursor');

    filtered = allRows.filter(r => {
      const sortValue = toIso(r.updated_at);
      if (sortValue < decoded.sortValue) return true;
      if (sortValue > decoded.sortValue) return false;
      return r.id < decoded.id;
    });
  }

  const totalCount = filtered.length;
  const slice = filtered.slice(0, firstClamped + 1);
  const hasNextPage = slice.length > firstClamped;
  const rows = hasNextPage ? slice.slice(0, firstClamped) : slice;

  const last = rows.length ? rows[rows.length - 1] : null;
  const endCursor = last
    ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
    : null;

  return { rows, hasNextPage, endCursor, totalCount };
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
  source: DataSource;
}> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  }; // omit undefined props for exactOptionalPropertyTypes

  const { whereSql, params } = buildControlsWhere(whereArgs); // build filters
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary

  const countSql = `
    select count(*)::int as count
    from public.controls
    ${whereSql}
  `;

  try {
    const countRes = await query(countSql, params); // run count query
    const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize result

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

    return { rows, hasNextPage, endCursor, totalCount, source: 'db' };
  } catch (error) {
    // only fallback when error indicates db is unavailable or not configured
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
    }; // omit undefined props for exactOptionalPropertyTypes

    const page = pageFromRows(filtered, pageArgs);
    return { ...page, source: 'mock' };
  }
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
  source: DataSource;
}> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  }; // omit undefined props for exactOptionalPropertyTypes

  const { whereSql, params } = buildFaqsWhere(whereArgs); // build filters
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
      : null; // compute endCursor

    return { rows, hasNextPage, endCursor, totalCount, source: 'db' };
  } catch (error) {
    // only fallback when error indicates db is unavailable or not configured
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
    }; // omit undefined props for exactOptionalPropertyTypes

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

// ----------  resolver map (schema execution)  ----------

export const resolvers = {
  Query: {
    // placeholder --> proves schema executes
    hello: () => 'helloWorld  from  GraphQL!',

    // placeholder --> proves server is healthy without graphql errors
    health: () => 'OK',

    // debug helper --> proves context is wired
    debugContext: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => ({
      requestId: ctx.requestId, // show request trace id
      isAdmin: ctx.auth.isAdmin // show admin flag
    }),

    // read-only controls connection --> pagination + filters
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
        throw new Error('CURSOR_ERROR: invalid after cursor');

      const page = await fetchControlsPage(args); // db-first, mock fallback when db is unavailable

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'controlsConnection',
        source: page.source,
        returnedCount: page.rows.length
      });

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }),
        node: mapControlNode(row)
      }));

      return {
        edges,
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
        totalCount: page.totalCount
      };
    },

    // read-only faqs connection --> mirrors controls behavior
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
        throw new Error('CURSOR_ERROR: invalid after cursor');

      const page = await fetchFaqsPage(args); // db-first, mock fallback when db is unavailable

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'faqsConnection',
        source: page.source,
        returnedCount: page.rows.length
      });

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }),
        node: mapFaqNode(row)
      }));

      return {
        edges,
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
        totalCount: page.totalCount
      };
    }
  }
};
