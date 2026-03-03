/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  shared pagination + filtering helpers

  - provides cursor encoding/decoding for connection pagination
  - provides safe page size clamping + input normalization
  - provides shared sql helpers (where + after cursor boundary)
  - provides shared in-memory helpers (seed-mode filtering + slicing)
  - freezes one shared search contract for connection queries + overview search
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ----------  cursor payload (base64url json)  ----------

export type CursorPayload = {
  sortValue: string; // updated_at iso string
  id: string; // uuid tie-breaker
};

// ----------  constants  ----------

const MAX_PAGE_SIZE = 50; // safety cap --> avoids accidental heavy queries
const SEARCH_MIN_LENGTH = 2; // shortest useful overview search term (e.g. "ai")
const SEARCH_MAX_LENGTH = 80; // defensive cap keeps the prototype contract bounded

// ----------  helpers (timestamps + inputs)  ----------

export function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString(); // pg may return Date with custom parsers
  const asDate = new Date(value); // tolerate string timestamps
  if (Number.isNaN(asDate.getTime())) return String(value); // fallback for unexpected values
  return asDate.toISOString(); // canonical iso output
}

export function clampFirst(first: number): number {
  if (!Number.isFinite(first)) return 10; // default page size for bad inputs
  if (first <= 0) return 10; // default for non-positive values
  return Math.min(first, MAX_PAGE_SIZE); // enforce safety max
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' '); // trim + collapse internal spaces
}

export function escapeLike(value: string): string {
  return value.replace(/[%_]/g, m => `\\${m}`); // escape wildcard chars for LIKE/ILIKE
}

export function normalizeSearchInput(
  value: string | undefined
): string | undefined {
  if (value === undefined) return undefined; // preserve omitted semantics for existing connection queries

  const normalized = normalizeText(value); // trim outer whitespace + collapse internal whitespace once
  if (normalized === '') return undefined; // blank search behaves like no search filter on existing queries

  return normalized; // return one canonical search term for downstream callers
}

function assertSearchLength(value: string): string {
  if (value.length < SEARCH_MIN_LENGTH) {
    throw new Error(
      `SEARCH_ERROR: search must be at least ${SEARCH_MIN_LENGTH} characters`
    ); // reject overly-short overview queries before service work begins
  }

  if (value.length > SEARCH_MAX_LENGTH) {
    throw new Error(
      `SEARCH_ERROR: search must be at most ${SEARCH_MAX_LENGTH} characters`
    ); // reject unbounded overview queries so the contract stays explicit
  }

  return value; // validated length is safe to reuse across service/db/fallback paths
}

export function assertOverviewSearchInput(value: string): string {
  const normalized = normalizeSearchInput(value); // overview search starts from the same normalization path as existing reads

  if (!normalized) {
    throw new Error(
      'SEARCH_ERROR: overviewSearch requires a non-empty search term'
    ); // overview search should never run as a blank catch-all query
  }

  return assertSearchLength(normalized); // overview search also enforces the shared min/max contract
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

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload); // serialize payload deterministically
  const base64 = Buffer.from(json, 'utf8').toString('base64'); // encode to base64
  return toBase64Url(base64); // convert to url-safe cursor
}

export function decodeCursor(cursor: string): CursorPayload | null {
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

export function isValidCursor(cursor: string): boolean {
  return decodeCursor(cursor) !== null; // validator built on decodeCursor
}

// ---------- sql helpers (category + search filters) ----------

export function buildCategorySearchWhere(args: {
  category?: string;
  search?: string;
}): { whereSql: string; params: unknown[] } {
  const parts: string[] = []; // sql predicates
  const params: unknown[] = []; // parameter bag

  const categoryNorm =
    args.category && normalizeText(args.category) !== ''
      ? normalizeText(args.category)
      : undefined; // preserve existing category semantics while computing normalization once

  const searchNorm = normalizeSearchInput(args.search); // reuse the shared connection-search normalization helper

  if (categoryNorm) {
    // pre-lowercase the param so postgres only evaluates lower() on the indexed column side
    // aligns with the lower(category) expression index added in 002_indexes.sql
    // EXPLAIN: Index Scan using controls_category_lower_idx / faqs_category_lower_idx
    params.push(categoryNorm.toLowerCase()); // normalized lowercase param
    parts.push(`lower(category) = $${params.length}`); // index-friendly: lower() only on column, not param
  }

  if (searchNorm) {
    const needle = escapeLike(searchNorm.toLowerCase()); // normalize + escape wildcard chars
    params.push(`%${needle}%`); // param: contains pattern
    // prototype: ILIKE is a seq scan but acceptable for current dataset size
    // production path: switch to search_vector @@ plainto_tsquery('english', $N)
    // to use the GIN index (controls_search_vector_gin / faqs_search_vector_gin)
    // validate search semantics with UI team before switching (substring vs word-stem match)
    parts.push(`search_text ILIKE $${params.length} ESCAPE '\\'`); // explicit one-char escape for backslash
  }

  const whereSql = parts.length ? `where ${parts.join(' and ')}` : ''; // join predicates when present
  return { whereSql, params }; // return clause + params
}

// ----------  sql helpers (cursor boundary: desc order)  ----------

export function buildAfterBoundary(
  after: string | undefined,
  startingIndex: number
): {
  sql: string;
  params: unknown[];
} {
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

// ----------  in-memory helpers (seed mode)  ----------

export function filterRowsByCategorySearch<T>(
  rows: T[],
  args: { category?: string; search?: string },
  opts: {
    getCategory: (row: T) => string;
    getSearchText: (row: T) => string;
  }
): T[] {
  const categoryNorm = args.category
    ? normalizeText(args.category).toLowerCase()
    : ''; // normalize optional category
  const searchNorm = normalizeSearchInput(args.search)?.toLowerCase() ?? ''; // normalize optional search through the shared connection helper

  return rows.filter(row => {
    const catOk = categoryNorm
      ? opts.getCategory(row).toLowerCase() === categoryNorm
      : true; // category filter is strict match
    const searchOk = searchNorm
      ? opts.getSearchText(row).toLowerCase().includes(searchNorm)
      : true; // search filter is simple contains

    return catOk && searchOk; // keep row when all filters match
  });
}

export function pageFromRows<
  T extends { id: string; updated_at: string | Date }
>(
  rows: T[],
  args: { first: number; after?: string }
): {
  rows: T[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
} {
  const firstClamped = clampFirst(args.first); // enforce safe page size
  const decoded = args.after ? decodeCursor(args.after) : null; // decode cursor when present

  const filtered = decoded
    ? rows.filter(r => {
        const rTime = toIso(r.updated_at); // normalize row timestamp
        const cTime = decoded.sortValue; // cursor timestamp

        // desc order boundary: (r.updated_at, r.id) < (cursor.sortValue, cursor.id)
        if (rTime < cTime) return true;
        if (rTime > cTime) return false;
        return r.id < decoded.id;
      })
    : rows; // no cursor means no boundary

  const totalCount = filtered.length; // total is post-filter, pre-page
  const slice = filtered.slice(0, firstClamped + 1); // fetch one extra row for hasNextPage
  const hasNextPage = slice.length > firstClamped; // extra row means more results exist
  const pageRows = hasNextPage ? slice.slice(0, firstClamped) : slice; // drop extra row

  const last = pageRows.length ? pageRows[pageRows.length - 1] : null; // pick last row for endCursor
  const endCursor = last
    ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
    : null; // compute endCursor

  return { rows: pageRows, hasNextPage, endCursor, totalCount };
}
