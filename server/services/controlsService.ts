/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> controls service (single place for read logic)

  - builds sql for controlsConnection (filters + cursor boundary + deterministic order)
  - keeps pagination behavior identical to previous resolver implementation
  - supports seed json fallback when db is unavailable (mvp resilience)
  - dedupes duplicate reads within one graphql request using request-scoped memoization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active
import type { GraphQLContext } from '../graphql/context'; // request-scoped deps (db + memo + cache + auth)
import { buildControlsKey } from '../cache'; // deterministic key builder reused for memo/cache consistency
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

// ---------- fallback detection ----------

function shouldFallbackToMock(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error); // normalize error message for matching

  if (msg.includes('ENV_ERROR:')) return true; // env not set (your db layer throws ENV_ERROR: ...)
  if (msg.toLowerCase().includes('connect')) return true; // common connection issues (mvp-safe broad match)
  if (msg.toLowerCase().includes('does not exist')) return true; // missing table/schema during setup/demo

  return false; // let non-connectivity/query bugs surface normally
}

// ---------- seed fallback helpers (db unavailable) ----------

type SeedControlJson = {
  controls: Array<{
    control_key: string;
    title: string;
    description: string;
    category: string;
    source_url?: string | null;
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

let cachedSeedControls: DbControlRow[] | null = null; // memoized in-process seed rows to avoid file reads per call

async function loadSeedControls(): Promise<DbControlRow[]> {
  if (cachedSeedControls) return cachedSeedControls; // reuse parsed seed rows within the process

  const dataDir = getDataDir(); // resolve seed data directory
  const controlsPath = path.join(dataDir, 'controls.json'); // seed file path
  const raw = await fs.readFile(controlsPath, 'utf8'); // read seed file
  const parsed = JSON.parse(raw) as SeedControlJson; // parse json payload
  const nowIso = new Date().toISOString(); // placeholder timestamp in seed mode

  const rows: DbControlRow[] = (parsed.controls ?? []).map(c => ({
    id: stableId('control', String(c.control_key ?? 'missing_key')), // deterministic seed id
    control_key: String(c.control_key ?? ''), // normalize to string
    title: String(c.title ?? ''), // normalize to string
    description: String(c.description ?? ''), // normalize to string
    category: String(c.category ?? 'General'), // default grouping for incomplete seed rows
    source_url: c.source_url == null ? null : String(c.source_url), // preserve null when absent
    updated_at: nowIso // synthetic timestamp for stable connection behavior in seed mode
  }));

  rows.sort((a, b) => {
    const k = b.control_key.localeCompare(a.control_key); // deterministic tie order for seed rows
    if (k !== 0) return k; // primary seed-mode ordering
    return b.id.localeCompare(a.id); // stable tie-breaker
  });

  cachedSeedControls = rows; // cache parsed rows for reuse across requests
  return rows; // return parsed + normalized seed rows
}

// ---------- main read path ----------

export async function getControlsPage(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): Promise<ControlsPage> {
  const memoKey = `controlsService:getControlsPage:${buildControlsKey(args)}`; // deterministic per-request dedupe key

  return memoizePromise(ctx.memo, memoKey, async () => {
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

    try {
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
    } catch (error) {
      if (!shouldFallbackToMock(error)) throw error; // non-db-availability errors should not be masked

      const msg = error instanceof Error ? error.message : String(error); // normalize error for logging
      console.warn('[gql] controlsConnection fallback to seed json:', msg); // explicit fallback log for demos

      const seedRows = await loadSeedControls(); // parse/cached seed rows
      const filtered = filterRowsByCategorySearch(seedRows, args, {
        getCategory: r => r.category, // category source for shared filter helper
        getSearchText: r => `${r.title} ${r.description} ${r.category}` // simple seed-mode search text
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
