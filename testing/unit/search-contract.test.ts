/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  explicit search contract coverage

  - freezes shared normalization behavior before overview graphql work lands
  - proves existing connection-style blank search still behaves like no filter
  - proves overview search rejects blank, too-short, and too-long queries
  - keeps search semantics documented in executable tests instead of team lore
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { describe, expect, it } from 'vitest';
import {
  assertOverviewSearchInput,
  normalizeSearchInput
} from '../../server/services/pagination';

// ---------- shared search contract ----------

describe('shared search contract', () => {
  it('normalizeSearchInput trims outer whitespace and collapses internal whitespace', () => {
    expect(normalizeSearchInput('   zero   trust   review   ')).toBe(
      'zero trust review'
    ); // one canonical search term keeps db and fallback paths aligned
  });

  it('normalizeSearchInput returns undefined for blank and whitespace-only values', () => {
    expect(normalizeSearchInput(undefined)).toBeUndefined(); // omitted search should stay omitted
    expect(normalizeSearchInput('')).toBeUndefined(); // blank search should not create an empty filter
    expect(normalizeSearchInput('     ')).toBeUndefined(); // whitespace-only search should behave like no filter
  });

  it('assertOverviewSearchInput accepts a useful two-character search term', () => {
    expect(assertOverviewSearchInput('  ai  ')).toBe('ai'); // the minimum useful term should still be allowed
  });

  it('assertOverviewSearchInput rejects blank and too-short overview queries', () => {
    expect(() => assertOverviewSearchInput('   ')).toThrow(
      'SEARCH_ERROR: overviewSearch requires a non-empty search term'
    ); // overview search should not run as a blank catch-all

    expect(() => assertOverviewSearchInput('a')).toThrow(
      'SEARCH_ERROR: search must be at least 2 characters'
    ); // one-character overview searches are intentionally rejected
  });

  it('assertOverviewSearchInput rejects search terms longer than the contract max', () => {
    expect(() => assertOverviewSearchInput('x'.repeat(81))).toThrow(
      'SEARCH_ERROR: search must be at most 80 characters'
    ); // explicit max length keeps the prototype contract bounded
  });
});
