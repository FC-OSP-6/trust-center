/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  api fallback contract coverage

  - proves the client data layer falls back to bundled mock rows when graphql is unreachable
  - keeps demo resilience locked to the shared api seam instead of route-by-route behavior
  - verifies overview grouped-search fallback reuses the same seed-backed connection shapes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearApiCache,
  fetchControlsConnectionAll,
  fetchFaqsConnectionAll,
  fetchOverviewSearch
} from '../../client/src/api';

describe('api mock fallback', () => {
  const originalFetch = global.fetch;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clearApiCache(); // isolate cache state so each test exercises fetch/fallback deterministically
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearApiCache(); // cleanup shared cache for later tests
    consoleWarnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns seed-backed controls when graphql responds with an upstream failure', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response('upstream unavailable', {
          status: 502,
          statusText: 'Bad Gateway'
        })
    ) as typeof fetch;

    const result = await fetchControlsConnectionAll({
      first: 5,
      ttlMs: 1
    });

    expect(result.totalCount).toBeGreaterThan(0); // fallback should still surface meaningful rows
    expect(result.edges.length).toBeGreaterThan(0); // first page should contain rows from bundled mock data
    expect(result.edges[0]?.node.controlKey).toBeDefined(); // controls shape should remain compatible with the page components
    expect(result.edges[0]?.node.category).toBe('Access Control'); // first seed category anchors the mock payload contract
  });

  it('returns seed-backed faqs and grouped overview search when graphql throws transport errors', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('fetch failed because the server is down');
    }) as typeof fetch;

    const [faqs, overview] = await Promise.all([
      fetchFaqsConnectionAll({ first: 5, ttlMs: 1 }),
      fetchOverviewSearch({
        search: 'authentication',
        firstPerKind: 3,
        ttlMs: 1
      })
    ]);

    expect(faqs.totalCount).toBeGreaterThan(0); // faq mock fallback should surface bundled rows
    expect(faqs.edges[0]?.node.faqKey).toBeDefined(); // faq shape should remain page-compatible

    expect(overview.search).toBe('authentication'); // grouped search should still echo the normalized term
    expect(overview.totalCount).toBeGreaterThan(0); // grouped search should aggregate mock controls + faqs counts
    expect(overview.controls.edges.length).toBeLessThanOrEqual(3); // fallback should still honor per-kind caps
    expect(overview.faqs.edges.length).toBeLessThanOrEqual(3); // fallback should still honor per-kind caps
  });
});
