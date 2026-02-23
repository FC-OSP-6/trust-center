/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  controls service (single place for read logic)

  - builds sql for controlsConnection (filters + cursor boundary + deterministic order)
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

// ----------  main read path  ----------

export async function getControlsPage(
  args: ControlsConnectionArgs
): Promise<ControlsPage> {
  const firstClamped = clampFirst(args.first); // enforce safe page size

  const whereArgs = {
    ...(args.category !== undefined ? { category: args.category } : {}),
    ...(args.search !== undefined ? { search: args.search } : {})
  }; // omit undefined props for exactOptionalPropertyTypes

  const { whereSql, params } = buildCategorySearchWhere(whereArgs); // build filters
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
      : null;

    return { rows, hasNextPage, endCursor, totalCount, source: 'db' };
  } catch (error) {
    // only fallback when error indicates db is unavailable or not configured
    if (!shouldFallbackToMock(error)) throw error;

    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[gql] controlsConnection fallback to seed json:', msg);

    const seedRows = await loadSeedControls();

    const filtered = filterRowsByCategorySearch(seedRows, args, {
      getCategory: r => r.category,
      getSearchText: r => `${r.title} ${r.description} ${r.category}`
    });

    const pageArgs = {
      first: args.first,
      ...(args.after !== undefined ? { after: args.after } : {})
    }; // omit undefined props for exactOptionalPropertyTypes

    const page = pageFromRows(filtered, pageArgs);
    return { ...page, source: 'mock' };
  }
}
