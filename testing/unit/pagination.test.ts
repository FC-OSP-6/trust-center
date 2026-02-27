/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  unit tests for shared pagination helpers

  what this file proves:
    - cursor encode/decode/validation is stable
    - page size/input normalization is safe
    - sql helper builders produce expected params + clauses
    - in-memory filtering + pagination behave like connection pagination

  why this is high-value:
    - these helpers are reused across resolvers/services
    - failures here can break graphql pagination for controls + faqs
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { describe, expect, it } from 'vitest';
import {
  type CursorPayload,
  toIso,
  clampFirst,
  normalizeText,
  escapeLike,
  encodeCursor,
  decodeCursor,
  isValidCursor,
  buildCategorySearchWhere,
  buildAfterBoundary,
  filterRowsByCategorySearch,
  pageFromRows
} from '../../server/services/pagination';

// ---------- test fixtures ----------

type Row = {
  id: string;
  category: string;
  title: string;
  description: string;
  updated_at: string;
};

const ROWS_DESC: Row[] = [
  {
    id: '00000000-0000-0000-0000-000000000003',
    category: 'Security',
    title: 'Patch Management',
    description: 'Automated OS patching and deployment windows',
    updated_at: '2026-02-24T12:00:00.000Z'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    category: 'Security',
    title: 'Access Reviews',
    description: 'Quarterly IAM access review process',
    updated_at: '2026-02-24T11:00:00.000Z'
  },
  {
    id: '00000000-0000-0000-0000-000000000001',
    category: 'Compliance',
    title: 'Vendor Risk',
    description: 'Third-party risk and due diligence controls',
    updated_at: '2026-02-24T10:00:00.000Z'
  }
]; // sorted desc by updated_at then id (matches connection assumptions)

// ---------- helper/unit coverage ----------

describe('pagination helpers', () => {
  it('toIso normalizes valid timestamps and preserves invalid values as strings', () => {
    expect(toIso('2026-02-24T12:00:00Z')).toBe('2026-02-24T12:00:00.000Z'); // canonical iso normalization
    expect(toIso(new Date('2026-02-24T12:00:00Z'))).toBe(
      '2026-02-24T12:00:00.000Z'
    ); // Date input should also normalize
    expect(toIso('not-a-date')).toBe('not-a-date'); // invalid input should be preserved for safer debugging
  });

  it('clampFirst defaults invalid/non-positive values and caps large values', () => {
    expect(clampFirst(Number.NaN)).toBe(10); // invalid number falls back to default page size
    expect(clampFirst(0)).toBe(10); // non-positive values fall back to default page size
    expect(clampFirst(-5)).toBe(10); // negative values fall back to default page size
    expect(clampFirst(7)).toBe(7); // valid values should pass through
    expect(clampFirst(999)).toBe(50); // values above max should be capped
  });

  it('normalizes text and escapes LIKE wildcard characters', () => {
    expect(normalizeText('   cloud    security   controls  ')).toBe(
      'cloud security controls'
    ); // trim + collapse internal whitespace
    expect(escapeLike('100%_coverage')).toBe('100\\%\\_coverage'); // escape wildcard chars for safe ILIKE patterns
  });

  it('round-trips cursor payloads and rejects invalid cursors', () => {
    const payload: CursorPayload = {
      sortValue: '2026-02-24T12:00:00.000Z',
      id: '00000000-0000-0000-0000-000000000003'
    };

    const encoded = encodeCursor(payload); // create url-safe base64 cursor
    const decoded = decodeCursor(encoded); // decode back to payload

    expect(typeof encoded).toBe('string'); // encoded cursor should be string
    expect(encoded.length).toBeGreaterThan(0); // encoded cursor should not be empty
    expect(encoded).not.toContain('+'); // cursor should be url-safe
    expect(encoded).not.toContain('/'); // cursor should be url-safe
    expect(decoded).toEqual(payload); // round trip should preserve payload exactly
    expect(isValidCursor(encoded)).toBe(true); // valid encoded cursor passes validation

    expect(decodeCursor('not-base64-json')).toBeNull(); // invalid cursor should safely decode to null
    expect(isValidCursor('not-base64-json')).toBe(false); // validator should reject invalid cursor
  });

  it('buildCategorySearchWhere returns empty clause when no usable filters are provided', () => {
    expect(buildCategorySearchWhere({})).toEqual({
      whereSql: '',
      params: []
    }); // no filters means no WHERE clause

    expect(
      buildCategorySearchWhere({
        category: '   ',
        search: '   '
      })
    ).toEqual({
      whereSql: '',
      params: []
    }); // blank/whitespace filters should be ignored
  });

  it('buildCategorySearchWhere builds category + search predicates with escaped params', () => {
    const result = buildCategorySearchWhere({
      category: '  Security  ',
      search: ' iam_% '
    });

    expect(result.params).toEqual(['security', '%iam\\_\\%%']); // category param is pre-lowercased for the expression index path
    expect(result.whereSql).toContain('lower(category) = $1'); // index-friendly predicate keeps lower() on the column side only
    expect(result.whereSql).toContain("search_text ILIKE $2 ESCAPE '\\'"); // search predicate uses explicit escape char
    expect(result.whereSql.startsWith('where ')).toBe(true); // clause should be prefixed with WHERE
  });

  it('buildAfterBoundary returns sql + params for a valid cursor and throws for invalid cursor', () => {
    const after = encodeCursor({
      sortValue: '2026-02-24T12:00:00.000Z',
      id: '00000000-0000-0000-0000-000000000003'
    });

    const boundary = buildAfterBoundary(after, 3); // starting index should map to $3 and $4

    expect(boundary.params).toEqual([
      '2026-02-24T12:00:00.000Z',
      '00000000-0000-0000-0000-000000000003'
    ]); // boundary params should preserve cursor tuple order
    expect(boundary.sql).toContain('updated_at < $3::timestamptz'); // sortValue param index
    expect(boundary.sql).toContain('id < $4::uuid'); // id param index

    expect(() => buildAfterBoundary('bad-cursor', 1)).toThrow(
      'CURSOR_ERROR: invalid after cursor'
    ); // invalid cursor should fail with readable error
  });

  it('filterRowsByCategorySearch applies case-insensitive category equality + contains search', () => {
    const filtered = filterRowsByCategorySearch(
      ROWS_DESC,
      {
        category: ' security ',
        search: '  review  '
      },
      {
        getCategory: row => row.category,
        getSearchText: row => `${row.title} ${row.description}`
      }
    );

    expect(filtered).toHaveLength(1); // only Access Reviews row matches both filters
    expect(filtered[0]?.title).toBe('Access Reviews'); // verifies case-insensitive + normalized filter behavior
  });

  it('pageFromRows returns first page with hasNextPage/endCursor and totalCount (post-filter pre-page)', () => {
    const page = pageFromRows(ROWS_DESC, { first: 2 }); // request first 2 rows from 3-row dataset

    expect(page.rows).toHaveLength(2); // page should contain only requested count
    expect(page.rows.map(r => r.id)).toEqual([
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000002'
    ]); // preserves original desc order
    expect(page.hasNextPage).toBe(true); // extra row exists beyond requested page size
    expect(page.totalCount).toBe(3); // totalCount is pre-page count after boundary filtering
    expect(page.endCursor).not.toBeNull(); // endCursor should be generated from last page row
    expect(
      decodeCursor(page.endCursor as string) // decode for deterministic assertion
    ).toEqual({
      sortValue: '2026-02-24T11:00:00.000Z',
      id: '00000000-0000-0000-0000-000000000002'
    }); // endCursor should track the last row in returned page
  });

  it('pageFromRows applies after cursor boundary for descending order and computes next page metadata', () => {
    const firstPage = pageFromRows(ROWS_DESC, { first: 1 }); // get top row only
    const after = firstPage.endCursor ?? undefined; // use returned cursor to request next page

    const secondPage = pageFromRows(ROWS_DESC, { first: 1, after });

    expect(secondPage.rows).toHaveLength(1); // next page should contain one row
    expect(secondPage.rows[0]?.id).toBe('00000000-0000-0000-0000-000000000002'); // row after cursor should be the second item in desc order
    expect(secondPage.totalCount).toBe(2); // totalCount is post-boundary count (rows after cursor)
    expect(secondPage.hasNextPage).toBe(true); // one more row remains after this page
    expect(secondPage.endCursor).not.toBeNull(); // next page should still provide cursor
  });

  it('pageFromRows returns empty page metadata when cursor is beyond available rows', () => {
    const afterLast = encodeCursor({
      sortValue: '2026-02-24T10:00:00.000Z',
      id: '00000000-0000-0000-0000-000000000001'
    }); // cursor positioned at the last row

    const page = pageFromRows(ROWS_DESC, { first: 5, after: afterLast });

    expect(page.rows).toEqual([]); // no rows should remain after the last cursor
    expect(page.totalCount).toBe(0); // post-boundary filtered count should be zero
    expect(page.hasNextPage).toBe(false); // no extra rows can exist
    expect(page.endCursor).toBeNull(); // no rows means no endCursor
  });
});
