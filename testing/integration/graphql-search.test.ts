/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql search contract integration tests

  what this file proves:
    - overviewSearch is queryable over the real http + yoga + schema path
    - overviewSearch returns the grouped controls/faqs payload shape expected by the frontend
    - existing controlsConnection(search: ...) and faqsConnection(search: ...) still work
    - overviewSearch validation failures surface as graphql errors instead of silent fallback behavior

  why this file matters:
    - locks down the new search backend contract end to end
    - proves the grouped overview query did not break existing entity search contracts
    - keeps review evidence automated instead of relying only on GraphiQL screenshots
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { AddressInfo } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/server';

// ---------- test server lifecycle ----------

let server: HttpServer; // ephemeral listener created per test file run
let origin = ''; // base url for fetch calls (http://127.0.0.1:PORT)

// ---------- optional log silencing (keeps test output readable) ----------

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // silence request/data logs during integration tests
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // keep output focused on assertions
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // silence seed fallback warnings when applicable

  const app = createServer(); // import-safe app factory (does not auto-listen)

  server = await new Promise<HttpServer>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); // use ephemeral port to avoid collisions
    listener.on('error', reject);
  });

  const address = server.address(); // node returns string | addressinfo | null
  if (!address || typeof address === 'string') {
    throw new Error('graphql search test server failed to bind to a TCP port');
  }

  origin = `http://127.0.0.1:${(address as AddressInfo).port}`; // stable local origin for fetch
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve())); // close listener so vitest can exit cleanly
  });

  consoleLogSpy.mockRestore(); // restore console after this file completes
  consoleErrorSpy.mockRestore(); // restore console after this file completes
  consoleWarnSpy.mockRestore(); // restore console after this file completes
});

// ---------- graphql test helper ----------

async function postGraphQL<T = unknown>(query: string, variables?: unknown) {
  const response = await fetch(`${origin}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables
    })
  }); // real http request to mounted yoga endpoint

  const json = (await response.json()) as T; // parse graphql json payload
  return { response, json };
}

// ---------- integration coverage ----------

describe('graphql search contract integration', () => {
  it('returns grouped overviewSearch results with connection-shaped controls + faqs buckets', async () => {
    const { response, json } = await postGraphQL<{
      data?: {
        overviewSearch: {
          search: string;
          totalCount: number;
          controls: {
            totalCount: number;
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string | null;
            };
            edges: Array<{
              node: {
                controlKey: string;
                title: string;
                category: string;
              };
            }>;
          };
          faqs: {
            totalCount: number;
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string | null;
            };
            edges: Array<{
              node: {
                faqKey: string;
                question: string;
                category: string;
              };
            }>;
          };
        };
      };
      errors?: Array<{ message: string }>;
    }>(
      /* GraphQL */ `
        query OverviewSearchVerify($search: String!, $firstPerKind: Int) {
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
                node {
                  controlKey
                  title
                  category
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
                node {
                  faqKey
                  question
                  category
                }
              }
            }
          }
        }
      `,
      {
        search: '  mfa  ',
        firstPerKind: 3
      }
    );

    expect(response.status).toBe(200); // graphql application responses should still be http 200
    expect(response.headers.get('content-type')).toContain('application/json'); // yoga should return json
    expect(json.errors).toBeUndefined(); // valid overview query should succeed
    expect(json.data).toBeDefined(); // successful execution should return a data payload

    const overview = json.data?.overviewSearch;
    expect(overview).toBeDefined(); // root grouped result should exist
    expect(overview?.search).toBe('mfa'); // backend should echo the normalized search term
    expect(typeof overview?.totalCount).toBe('number'); // grouped totalCount should be numeric

    expect(typeof overview?.controls.totalCount).toBe('number'); // controls bucket should expose connection metadata
    expect(typeof overview?.faqs.totalCount).toBe('number'); // faqs bucket should expose connection metadata
    expect(Array.isArray(overview?.controls.edges)).toBe(true); // controls bucket should expose edges[]
    expect(Array.isArray(overview?.faqs.edges)).toBe(true); // faqs bucket should expose edges[]

    expect(overview?.totalCount).toBe(
      (overview?.controls.totalCount ?? 0) + (overview?.faqs.totalCount ?? 0)
    ); // grouped total should equal the sum of both entity totals

    expect((overview?.controls.edges.length ?? 0) <= 3).toBe(true); // firstPerKind should cap visible controls rows
    expect((overview?.faqs.edges.length ?? 0) <= 3).toBe(true); // firstPerKind should cap visible faqs rows

    if ((overview?.controls.edges.length ?? 0) > 0) {
      expect(typeof overview?.controls.edges[0]?.node.controlKey).toBe(
        'string'
      ); // controls node shape should remain stable
      expect(
        (overview?.controls.edges[0]?.node.controlKey ?? '').length
      ).toBeGreaterThan(0); // control key should not be blank
      expect(typeof overview?.controls.edges[0]?.node.title).toBe('string'); // title should be present when a row exists
    }

    if ((overview?.faqs.edges.length ?? 0) > 0) {
      expect(typeof overview?.faqs.edges[0]?.node.faqKey).toBe('string'); // faqs node shape should remain stable
      expect(
        (overview?.faqs.edges[0]?.node.faqKey ?? '').length
      ).toBeGreaterThan(0); // faq key should not be blank
      expect(typeof overview?.faqs.edges[0]?.node.question).toBe('string'); // question should be present when a row exists
    }
  });

  it('preserves existing controlsConnection(search) and faqsConnection(search) query compatibility', async () => {
    const { response, json } = await postGraphQL<{
      data?: {
        controlsConnection: {
          totalCount: number;
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: Array<{
            node: {
              title: string;
              category: string;
            };
          }>;
        };
        faqsConnection: {
          totalCount: number;
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: Array<{
            node: {
              question: string;
              category: string;
            };
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    }>(
      /* GraphQL */ `
        query ExistingConnectionSearchVerify($first: Int!, $search: String!) {
          controlsConnection(first: $first, search: $search) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                title
                category
              }
            }
          }
          faqsConnection(first: $first, search: $search) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                question
                category
              }
            }
          }
        }
      `,
      {
        first: 3,
        search: 'access'
      }
    );

    expect(response.status).toBe(200); // graphql execution should succeed
    expect(json.errors).toBeUndefined(); // no errors expected for compatibility search query
    expect(json.data).toBeDefined(); // data payload should exist

    const controls = json.data?.controlsConnection;
    const faqs = json.data?.faqsConnection;

    expect(controls).toBeDefined(); // controlsConnection should remain available
    expect(faqs).toBeDefined(); // faqsConnection should remain available

    expect(typeof controls?.totalCount).toBe('number'); // controls totalCount should remain numeric
    expect(typeof faqs?.totalCount).toBe('number'); // faqs totalCount should remain numeric

    expect(Array.isArray(controls?.edges)).toBe(true); // controls edges should remain array-shaped
    expect(Array.isArray(faqs?.edges)).toBe(true); // faqs edges should remain array-shaped

    expect((controls?.edges.length ?? 0) <= 3).toBe(true); // requested first size should cap controls rows
    expect((faqs?.edges.length ?? 0) <= 3).toBe(true); // requested first size should cap faqs rows

    if ((controls?.edges.length ?? 0) > 0) {
      expect(typeof controls?.edges[0]?.node.title).toBe('string'); // controls node title should remain queryable
      expect(typeof controls?.edges[0]?.node.category).toBe('string'); // controls category should remain queryable
    }

    if ((faqs?.edges.length ?? 0) > 0) {
      expect(typeof faqs?.edges[0]?.node.question).toBe('string'); // faqs node question should remain queryable
      expect(typeof faqs?.edges[0]?.node.category).toBe('string'); // faqs category should remain queryable
    }
  });

  it('returns a graphql error for blank overviewSearch input', async () => {
    const { response, json } = await postGraphQL<{
      data?: {
        overviewSearch: unknown;
      };
      errors?: Array<{ message: string }>;
    }>(
      /* GraphQL */ `
        query OverviewSearchBlank($search: String!) {
          overviewSearch(search: $search) {
            search
            totalCount
          }
        }
      `,
      {
        search: '   '
      }
    );

    expect(response.status).toBe(200); // graphql execution errors are returned in the payload
    expect(Array.isArray(json.errors)).toBe(true); // invalid overview search should fail through graphql errors[]
    expect(typeof json.errors?.[0]?.message).toBe('string'); // error message should exist even if yoga masks internals
    expect((json.errors?.[0]?.message ?? '').length).toBeGreaterThan(0); // message should not be blank

    if (
      json.data &&
      typeof json.data === 'object' &&
      'overviewSearch' in json.data
    ) {
      expect(
        (json.data as { overviewSearch: unknown }).overviewSearch
      ).toBeNull(); // invalid field execution should null the field when graphql includes data
    }
  });
});
