/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  client-side graphql data layer (single source of truth)

  - sends typed graphql requests through /graphql
  - provides one generic connection page fetch helper (controls + faqs)
  - provides one grouped overview-search fetch helper for 006E consumers
  - adds cache + in-flight dedupe to reduce duplicate requests
  - exports convenience wrappers + compatibility aliases for existing callsites
  - keeps react pages thin while preserving typed data access
  - requests taxonomy metadata so frontend can adopt it incrementally
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { ControlsConnection, FaqsConnection } from './types-frontend';
import controlsSeedData from '../../server/db/data/controls.json';
import faqsSeedData from '../../server/db/data/faqs.json';

// ----------  shared result types  ----------

type OverviewSearchResult = {
  search: string; // normalized search term echoed back by the backend
  controls: ControlsConnection; // grouped controls bucket for overview search
  faqs: FaqsConnection; // grouped faqs bucket for overview search
  totalCount: number; // sum of controls.totalCount + faqs.totalCount
};

// ----------  GraphQL transport types  ----------

type GraphqlFetchArgs<TVars> = {
  query: string; // graphql document string
  variables?: TVars; // graphql variables payload (optional)
};

type GraphqlErrorItem = {
  message?: string; // graphql error message (some servers may omit)
};

type GraphqlResponse<TData> = {
  data?: TData; // successful graphql data payload
  errors?: GraphqlErrorItem[]; // graphql error list (graphql can still return http 200)
};

type SeedControlsJson = {
  controls?: Array<{
    control_key?: string;
    title?: string;
    description?: string;
    section?: string;
    category?: string;
    subcategory?: string | null;
    tags?: string[] | null;
    source_url?: string | null;
  }>;
};

type SeedFaqsJson = {
  faqs?: Array<{
    faq_key?: string;
    question?: string;
    answer?: string;
    section?: string;
    category?: string;
    subcategory?: string | null;
    tags?: string[] | null;
  }>;
};

// ----------  request input types  ----------

type FetchConnectionArgs = {
  first: number; // page size requested by caller
  after?: string; // cursor boundary (omit key when absent)
  category?: string; // category filter (omit key when absent)
  search?: string; // search filter (omit key when absent)
  ttlMs?: number; // optional cache ttl override
};

type FetchAllConnectionArgs = {
  first?: number; // page size per paginated request
  category?: string; // category filter reused across all pages
  search?: string; // search filter reused across all pages
  ttlMs?: number; // cache ttl override
  maxPages?: number; // client-side safety cap
};

type FetchOverviewSearchArgs = {
  search: string; // required overview search term
  firstPerKind?: number; // optional per-kind visible row cap
  ttlMs?: number; // optional cache ttl override
};

type FetchVars = {
  first: number; // always required by graphql query
  after?: string; // present only when defined
  category?: string; // present only when defined
  search?: string; // present only when defined
}; // exactOptionalPropertyTypes-safe shape

type OverviewSearchVars = {
  search: string; // required grouped overview search term
  firstPerKind?: number; // optional grouped result cap
}; // exactOptionalPropertyTypes-safe shape

// ----------  shared constants  ----------

const GRAPHQL_URL = '/graphql'; // relative path works with dev proxy + production host
const DEFAULT_TTL_MS = 30_000; // small ttl reduces spammy refetches while staying fresh
const DEFAULT_PAGE_SIZE = 25; // default single-page fetch size
const DEFAULT_OVERVIEW_PAGE_SIZE = 5; // mirrors backend overviewSearch default
const MAX_PAGE_SIZE = 50; // mirrors backend clamp / resolver safety
const DEFAULT_MAX_PAGES = 25; // safety cap for "fetch all" pagination
const MOCK_CURSOR_PREFIX = 'mock'; // stable prefix keeps mock pagination cursors easy to detect

// ----------  graphql fetch wrapper  ----------

export async function graphqlFetch<TData, TVars>(
  args: GraphqlFetchArgs<TVars>
): Promise<{ data: TData }> {
  let res: Response; // declared outside try so we can inspect after fetch

  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST', // graphql over http post
      headers: { 'content-type': 'application/json' }, // json request body
      body: JSON.stringify({
        query: args.query, // graphql document
        variables: args.variables ?? {} // always send an object for consistency
      })
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown network error'; // normalize thrown values
    throw new Error(`NETWORK_ERROR: ${msg}`); // stable prefix helps downstream debugging
  }

  if (!res.ok) throw new Error(`NETWORK_ERROR: http ${res.status}`); // non-2xx still needs readable error

  const json = (await res.json()) as GraphqlResponse<TData>; // parse once and narrow manually

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const msg = json.errors
      .map(e => e.message ?? 'unknown graphql error')
      .join(' | '); // flatten messages
    throw new Error(`GRAPHQL_ERROR: ${msg}`); // graphql often returns 200 + errors
  }

  if (!json.data) throw new Error('GRAPHQL_ERROR: missing data'); // hard guard for malformed payloads

  return { data: json.data }; // success payload
}

// ----------  query documents  ----------

export const CONTROLS_CONNECTION_QUERY = /* GraphQL */ `
  query ControlsConnection(
    $first: Int!
    $after: String
    $category: String
    $search: String
  ) {
    controlsConnection(
      first: $first
      after: $after
      category: $category
      search: $search
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          controlKey
          title
          description
          section
          category
          subcategory
          tags
          sourceUrl
          updatedAt
        }
      }
    }
  }
`;

export const FAQS_CONNECTION_QUERY = /* GraphQL */ `
  query FaqsConnection(
    $first: Int!
    $after: String
    $category: String
    $search: String
  ) {
    faqsConnection(
      first: $first
      after: $after
      category: $category
      search: $search
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          faqKey
          question
          answer
          section
          category
          subcategory
          tags
          updatedAt
        }
      }
    }
  }
`;

export const OVERVIEW_SEARCH_QUERY = /* GraphQL */ `
  query OverviewSearch($search: String!, $firstPerKind: Int) {
    overviewSearch(search: $search, firstPerKind: $firstPerKind) {
      search
      totalCount
      controls {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            controlKey
            title
            description
            section
            category
            subcategory
            tags
            sourceUrl
            updatedAt
          }
        }
      }
      faqs {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            faqKey
            question
            answer
            section
            category
            subcategory
            tags
            updatedAt
          }
        }
      }
    }
  }
`;

// ----------  response wrapper maps  ----------

type ControlsConnectionData = {
  controlsConnection: ControlsConnection; // root field for controls query
};

type FaqsConnectionData = {
  faqsConnection: FaqsConnection; // root field for faqs query
};

type OverviewSearchData = {
  overviewSearch: OverviewSearchResult; // root field for grouped overview search
};

type ConnectionKind = 'controls' | 'faqs'; // supported connection families

type ConnectionByKind = {
  controls: ControlsConnection; // resolved connection type for controls
  faqs: FaqsConnection; // resolved connection type for faqs
};

type QueryDataByKind = {
  controls: ControlsConnectionData; // graphql response wrapper for controls
  faqs: FaqsConnectionData; // graphql response wrapper for faqs
};

const QUERY_BY_KIND: Record<ConnectionKind, string> = {
  controls: CONTROLS_CONNECTION_QUERY, // controls query doc
  faqs: FAQS_CONNECTION_QUERY // faqs query doc
};

// ----------  cache + in-flight dedupe  ----------

type CacheEntry<T> = {
  value: T; // cached response payload
  expiresAt: number; // epoch milliseconds expiration time
};

const pageCache = new Map<string, CacheEntry<unknown>>(); // response cache keyed by request kind + vars
const inFlight = new Map<string, Promise<unknown>>(); // dedupe concurrent identical requests

function getNowMs(): number {
  return Date.now(); // isolated helper for readability and possible tests
}

function getTtlMs(ttlMs: number | undefined): number {
  const n = Number(ttlMs); // normalize caller input

  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_MS; // fallback on invalid ttl

  return Math.floor(n); // integer milliseconds only
}

function getCached<T>(key: string): T | null {
  const hit = pageCache.get(key) as CacheEntry<T> | undefined; // recover typed cache value

  if (!hit) return null; // cache miss

  if (hit.expiresAt <= getNowMs()) {
    pageCache.delete(key); // opportunistic stale eviction
    return null; // stale entries behave like misses
  }

  return hit.value; // cache hit
}

function setCached<T>(key: string, value: T, ttlMs: number) {
  pageCache.set(key, {
    value, // store payload
    expiresAt: getNowMs() + ttlMs // compute expiration timestamp
  });
}

async function getOrCreateCached<T>(
  cacheKey: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(cacheKey); // fast-path cache read

  if (cached) return cached; // return cached response immediately

  const pending = inFlight.get(cacheKey) as Promise<T> | undefined; // check in-flight dedupe map
  if (pending) return pending; // share pending identical request

  const requestPromise = (async () => {
    const value = await factory(); // run actual request once
    setCached(cacheKey, value, ttlMs); // cache successful result
    return value; // return typed payload
  })();

  inFlight.set(cacheKey, requestPromise); // register before await to dedupe races

  try {
    return await requestPromise; // resolve shared promise
  } finally {
    inFlight.delete(cacheKey); // cleanup regardless of success/failure
  }
}

export function clearApiCache() {
  pageCache.clear(); // clear cached payloads
  inFlight.clear(); // clear pending promise references
} // useful for tests, dev debugging, or manual refresh flows

// ----------  normalization helpers  ----------

function clampPageSize(value: number | undefined, fallback: number): number {
  const n = Number(value); // normalize unknown numeric input

  if (!Number.isFinite(n) || n <= 0) return fallback; // fallback on invalid values

  return Math.min(Math.floor(n), MAX_PAGE_SIZE); // backend-compatible clamp
}

function clampPositiveInt(value: number | undefined, fallback: number): number {
  const n = Number(value); // normalize unknown numeric input

  if (!Number.isFinite(n) || n <= 0) return fallback; // fallback on invalid values

  return Math.floor(n); // positive integer without MAX_PAGE_SIZE clamp
}

function normalizeText(value: string | undefined): string | undefined {
  if (value == null) return undefined; // preserve omitted semantics

  const normalized = String(value).trim().replace(/\s+/g, ' '); // trim + collapse internal whitespace so FE request identity matches backend normalization more closely
  if (normalized === '') return undefined; // omit empty strings

  return normalized; // valid normalized text
}

function normalizeMockSearchBlob(
  parts: Array<string | null | undefined>
): string {
  return parts
    .map(part => normalizeText(part ?? undefined) ?? '')
    .filter(Boolean)
    .join(' ')
    .toLowerCase(); // search parity does not need backend-perfect ranking, just stable inclusion matching
}

function shouldUseMockFallback(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (message.startsWith('NETWORK_ERROR:')) return true; // browser cannot reach graphql host
  if (lower.includes('failed to fetch')) return true; // fetch transport failure wording varies by browser/runtime
  if (lower.includes('load failed')) return true; // safari/webkit transport wording
  if (lower.includes('unexpected error')) return true; // graphql yoga masks some db outages behind a generic internal error
  if (lower.includes('connect')) return true; // connection refused / timed out / reset
  if (lower.includes('authentication failed')) return true; // db auth mismatch
  if (lower.includes('tenant or user not found')) return true; // hosted postgres startup/auth wording
  if (lower.includes('password authentication failed')) return true; // postgres auth wording
  if (lower.includes('does not exist')) return true; // missing schema/table or missing db endpoint

  return false;
}

function logMockFallback(
  target: 'controls' | 'faqs' | 'overviewSearch',
  error: unknown
) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[api] target=${target} event=mock_fallback reason=${message}`); // keeps local/demo fallback visible without surfacing a blocking UI error
}

function buildMockCursor(kind: ConnectionKind, index: number): string {
  return `${MOCK_CURSOR_PREFIX}:${kind}:${index}`;
}

function readMockCursor(
  kind: ConnectionKind,
  after: string | undefined
): number {
  const normalized = normalizeText(after);
  if (!normalized) return 0;

  const match = normalized.match(
    new RegExp(`^${MOCK_CURSOR_PREFIX}:${kind}:(\\d+)$`)
  );
  if (!match) return 0;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return Math.floor(parsed) + 1;
}

function normalizeTagList(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];

  return tags.map(tag => normalizeText(tag) ?? '').filter(Boolean);
}

function matchesOptionalCategory(
  value: string | undefined,
  category: string | undefined
): boolean {
  if (!category) return true;
  return (normalizeText(value) ?? '').toLowerCase() === category.toLowerCase();
}

function matchesOptionalSearch(
  blob: string,
  search: string | undefined
): boolean {
  if (!search) return true;
  return blob.includes(search.toLowerCase());
}

function toMockControlsRows(): ControlsConnection['edges'][number]['node'][] {
  const parsed = controlsSeedData as SeedControlsJson;

  return (parsed.controls ?? []).map(control => {
    const controlKey = normalizeText(control.control_key) ?? 'mock-control';

    return {
      id: `mock-control-${controlKey}`,
      controlKey,
      title: normalizeText(control.title) ?? 'Untitled control',
      description: normalizeText(control.description) ?? '',
      section: normalizeText(control.section) ?? 'General',
      category: normalizeText(control.category) ?? 'General',
      subcategory: normalizeText(control.subcategory ?? undefined) ?? null,
      tags: normalizeTagList(control.tags),
      sourceUrl: normalizeText(control.source_url ?? undefined) ?? null,
      updatedAt: '2020-01-01T00:00:00.000Z'
    };
  });
}

function toMockFaqRows(): FaqsConnection['edges'][number]['node'][] {
  const parsed = faqsSeedData as SeedFaqsJson;

  return (parsed.faqs ?? []).map(faq => {
    const faqKey = normalizeText(faq.faq_key) ?? 'mock-faq';

    return {
      id: `mock-faq-${faqKey}`,
      faqKey,
      question: normalizeText(faq.question) ?? 'Untitled FAQ',
      answer: normalizeText(faq.answer) ?? '',
      section: normalizeText(faq.section) ?? 'General',
      category: normalizeText(faq.category) ?? 'General',
      subcategory: normalizeText(faq.subcategory ?? undefined) ?? null,
      tags: normalizeTagList(faq.tags),
      updatedAt: '2020-01-01T00:00:00.000Z'
    };
  });
}

function buildMockConnection<K extends ConnectionKind>(
  kind: K,
  args: FetchConnectionArgs
): ConnectionByKind[K] {
  const first = clampPageSize(args.first, DEFAULT_PAGE_SIZE);
  const category = normalizeText(args.category);
  const search = normalizeText(args.search)?.toLowerCase();
  const start = readMockCursor(kind, args.after);

  if (kind === 'controls') {
    const filteredRows = toMockControlsRows().filter(row => {
      const blob = normalizeMockSearchBlob([
        row.controlKey,
        row.title,
        row.description,
        row.section,
        row.category,
        row.subcategory ?? undefined,
        ...(row.tags ?? [])
      ]);

      return (
        matchesOptionalCategory(row.category, category) &&
        matchesOptionalSearch(blob, search)
      );
    });

    const pageRows = filteredRows.slice(start, start + first);
    const edges = pageRows.map((node, index) => ({
      cursor: buildMockCursor(kind, start + index),
      node
    }));
    const endIndex = start + pageRows.length;

    return {
      edges,
      totalCount: filteredRows.length,
      pageInfo: {
        hasNextPage: endIndex < filteredRows.length,
        endCursor:
          edges.length > 0 ? (edges[edges.length - 1]?.cursor ?? null) : null
      }
    } as ConnectionByKind[K];
  }

  const filteredRows = toMockFaqRows().filter(row => {
    const blob = normalizeMockSearchBlob([
      row.faqKey,
      row.question,
      row.answer,
      row.section,
      row.category,
      row.subcategory ?? undefined,
      ...(row.tags ?? [])
    ]);

    return (
      matchesOptionalCategory(row.category, category) &&
      matchesOptionalSearch(blob, search)
    );
  });

  const pageRows = filteredRows.slice(start, start + first);
  const edges = pageRows.map((node, index) => ({
    cursor: buildMockCursor(kind, start + index),
    node
  }));
  const endIndex = start + pageRows.length;

  return {
    edges,
    totalCount: filteredRows.length,
    pageInfo: {
      hasNextPage: endIndex < filteredRows.length,
      endCursor:
        edges.length > 0 ? (edges[edges.length - 1]?.cursor ?? null) : null
    }
  } as ConnectionByKind[K];
}

function buildMockOverviewSearch(
  args: FetchOverviewSearchArgs
): OverviewSearchResult {
  const search = normalizeText(args.search);

  if (!search) {
    throw new Error(
      'INPUT_ERROR: overview search requires a non-empty search term'
    );
  }

  const firstPerKind = clampPageSize(
    args.firstPerKind,
    DEFAULT_OVERVIEW_PAGE_SIZE
  );
  const controls = buildMockConnection('controls', {
    first: firstPerKind,
    search
  });
  const faqs = buildMockConnection('faqs', {
    first: firstPerKind,
    search
  });

  return {
    search,
    controls,
    faqs,
    totalCount: controls.totalCount + faqs.totalCount
  };
}

// ----------  variable builders (exactOptionalPropertyTypes-safe)  ----------

function buildFetchVars(args: FetchConnectionArgs): FetchVars {
  const vars: FetchVars = {
    first: clampPageSize(args.first, DEFAULT_PAGE_SIZE) // always required
  };

  const after = normalizeText(args.after); // optional cursor
  const category = normalizeText(args.category); // optional category filter
  const search = normalizeText(args.search); // optional search filter

  if (after) vars.after = after; // omit key when absent
  if (category) vars.category = category; // omit key when absent
  if (search) vars.search = search; // omit key when absent

  return vars; // exactOptionalPropertyTypes-safe object
}

function buildOverviewSearchVars(
  args: FetchOverviewSearchArgs
): OverviewSearchVars {
  const search = normalizeText(args.search); // trim + collapse whitespace before sending the request
  if (!search) {
    throw new Error(
      'INPUT_ERROR: overview search requires a non-empty search term'
    ); // fail fast on blank searches so the UI does not spam the backend
  }

  return {
    search, // required overview search term
    firstPerKind: clampPageSize(args.firstPerKind, DEFAULT_OVERVIEW_PAGE_SIZE) // keep FE request size aligned with backend clamp/default behavior
  };
}

function stableRequestKey(kind: string, vars: Record<string, unknown>): string {
  return `${kind}:${JSON.stringify(vars)}`; // deterministic enough because key insertion order is controlled
}

// ----------  generic page fetch (typed by kind)  ----------

export async function fetchConnectionPage<K extends ConnectionKind>(
  kind: K,
  args: FetchConnectionArgs
): Promise<ConnectionByKind[K]> {
  const vars = buildFetchVars(args); // normalized graphql variables
  const ttlMs = getTtlMs(args.ttlMs); // normalized cache ttl
  const cacheKey = stableRequestKey(kind, vars); // request identity for cache + dedupe

  return getOrCreateCached(cacheKey, ttlMs, async () => {
    const query = QUERY_BY_KIND[kind]; // choose query document for current kind

    let res: { data: QueryDataByKind[K] };

    try {
      res = await graphqlFetch<QueryDataByKind[K], FetchVars>({
        query, // graphql document
        variables: vars // exactOptionalPropertyTypes-safe variables
      });
    } catch (error) {
      if (!shouldUseMockFallback(error)) throw error;
      logMockFallback(kind, error);
      return buildMockConnection(kind, args);
    }

    if (kind === 'controls') {
      return (res.data as QueryDataByKind['controls'])
        .controlsConnection as ConnectionByKind[K]; // extract controls root field
    }

    return (res.data as QueryDataByKind['faqs'])
      .faqsConnection as ConnectionByKind[K]; // extract faqs root field
  });
}

// ----------  overview search fetch ----------

export async function fetchOverviewSearch(
  args: FetchOverviewSearchArgs
): Promise<OverviewSearchResult> {
  const vars = buildOverviewSearchVars(args); // normalized overview-search variables
  const ttlMs = getTtlMs(args.ttlMs); // normalized cache ttl
  const cacheKey = stableRequestKey('overview-search', vars); // grouped-search identity for cache + dedupe

  return getOrCreateCached(cacheKey, ttlMs, async () => {
    try {
      const res = await graphqlFetch<OverviewSearchData, OverviewSearchVars>({
        query: OVERVIEW_SEARCH_QUERY, // grouped overview-search graphql document
        variables: vars // normalized overview-search variables
      });

      return res.data.overviewSearch; // extract grouped overview-search payload
    } catch (error) {
      if (!shouldUseMockFallback(error)) throw error;
      logMockFallback('overviewSearch', error);
      return buildMockOverviewSearch(args);
    }
  });
}

// ----------  convenience wrappers (single page)  ----------

export function fetchControlsConnectionPage(
  args: FetchConnectionArgs
): Promise<ControlsConnection> {
  return fetchConnectionPage('controls', args); // controls wrapper for callsite readability
}

export function fetchFaqsConnectionPage(
  args: FetchConnectionArgs
): Promise<FaqsConnection> {
  return fetchConnectionPage('faqs', args); // faqs wrapper for callsite readability
}

// ----------  generic fetch-all helper (multi-page merge)  ----------

async function fetchAllConnection<K extends ConnectionKind>(
  kind: K,
  args: FetchAllConnectionArgs
): Promise<ConnectionByKind[K]> {
  const first = clampPageSize(args.first, DEFAULT_PAGE_SIZE); // page size per request
  const ttlMs = getTtlMs(args.ttlMs); // normalized ttl reused across pages
  const maxPages = clampPositiveInt(args.maxPages, DEFAULT_MAX_PAGES); // safety cap without page-size clamp

  const category = normalizeText(args.category); // normalize once for all page requests
  const search = normalizeText(args.search); // normalize once for all page requests

  const firstPage = await fetchConnectionPage(kind, {
    first, // required page size
    ...(category ? { category } : {}), // omit undefined category
    ...(search ? { search } : {}), // omit undefined search
    ttlMs // normalized ttl
  });

  if (!firstPage.pageInfo.hasNextPage || !firstPage.pageInfo.endCursor)
    return firstPage; // single-page fast path

  const mergedEdges = [...firstPage.edges]; // merge buffer starts with first page edges
  let hasNextPage: boolean = firstPage.pageInfo.hasNextPage; // explicit type prevents literal narrowing to true
  let cursor: string | null = firstPage.pageInfo.endCursor; // explicit type allows later null assignment
  let pagesFetched = 1; // first page already counted

  while (hasNextPage && cursor && pagesFetched < maxPages) {
    const page: ConnectionByKind[K] = await fetchConnectionPage(kind, {
      first, // same page size for consistent pagination
      after: cursor, // continue from previous page end cursor
      ...(category ? { category } : {}), // preserve category filter
      ...(search ? { search } : {}), // preserve search filter
      ttlMs // preserve ttl behavior
    });

    mergedEdges.push(...page.edges); // append in server-returned order
    hasNextPage = page.pageInfo.hasNextPage; // update loop state from latest page
    cursor = page.pageInfo.endCursor ?? null; // normalize undefined to null for loop condition
    pagesFetched += 1; // increment safety counter
  }

  const lastEdge =
    mergedEdges.length > 0 ? mergedEdges[mergedEdges.length - 1] : undefined; // safe last-edge lookup

  const mergedPageInfo = {
    hasNextPage, // true when safety cap hit before exhausting all pages
    endCursor: hasNextPage ? (cursor ?? null) : (lastEdge?.cursor ?? null) // final merged cursor shape
  }; // connection-compatible pageInfo replacement

  const merged = {
    ...firstPage, // preserve totalCount and any top-level fields
    edges: mergedEdges, // replace edges with merged edges
    pageInfo: mergedPageInfo // replace pageInfo with merged pagination state
  } as ConnectionByKind[K];

  return merged; // merged connection preserves original kind type
}

// ----------  convenience wrappers (fetch all)  ----------

export function fetchAllControls(
  args: FetchAllConnectionArgs = {}
): Promise<ControlsConnection> {
  return fetchAllConnection('controls', args); // preferred modern name
}

export function fetchAllFaqs(
  args: FetchAllConnectionArgs = {}
): Promise<FaqsConnection> {
  return fetchAllConnection('faqs', args); // preferred modern name
}

// ----------  compatibility exports (legacy imports)  ----------

export function fetchControlsConnectionAll(
  args: FetchAllConnectionArgs = {}
): Promise<ControlsConnection> {
  return fetchAllControls(args); // alias for older section imports
}

export function fetchFaqsConnectionAll(
  args: FetchAllConnectionArgs = {}
): Promise<FaqsConnection> {
  return fetchAllFaqs(args); // alias for older section imports
}
