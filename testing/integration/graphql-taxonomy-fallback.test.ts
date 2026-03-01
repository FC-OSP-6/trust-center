/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql integration coverage for forced seed fallback taxonomy reads

  what this file proves:
    - the live express + yoga graphql stack can serve taxonomy metadata in fallback mode
    - controlsConnection exposes section/category/subcategory/tags without a db
    - faqsConnection exposes section/category/subcategory/tags without a db
    - fallback mode is actually exercised (not silently bypassed) because the resolver logs fallback_to_seed
    - category/search args still work while returning the expanded node contract

  test strategy:
    - explicitly enable ALLOW_SEED_FALLBACK
    - explicitly remove DATABASE_URL for the test process
    - close any pre-existing db pool and clear service caches before booting the server
    - send real HTTP graphql requests to the mounted /graphql endpoint

  why this matters:
    - 006-B promised db/fallback field-shape parity
    - db-backed coverage already exists in graphql-taxonomy.test.ts
    - this file locks down the missing reviewer-grade proof for fallback-mode taxonomy reads
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { AddressInfo } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { createServer } from '../../server/server';
import { closeDbPool } from '../../server/db';
import { cache } from '../../server/cache';
import { resetSeedFallbackCachesForTests } from '../../server/services/seedFallback';

// ---------- test server lifecycle ----------

let server: HttpServer; // ephemeral listener created per test file run
let origin = ''; // base url for fetch calls (http://127.0.0.1:PORT)

// ---------- env snapshot ----------

const originalDatabaseUrl = process.env.DATABASE_URL; // restore caller env after this file completes
const originalAllowSeedFallback = process.env.ALLOW_SEED_FALLBACK; // restore caller env after this file completes

// ---------- optional log silencing + fallback assertions ----------

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // silence request/data logs during integration tests
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // capture fallback warnings for assertions without noisy terminal output
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // keep output focused on assertions

  await closeDbPool(); // close any prior db pool so this file cannot accidentally reuse a real connection from another test
  cache.invalidatePrefix?.('controls:list'); // clear shared controls read cache so fallback queries cannot hit stale db-backed entries
  cache.invalidatePrefix?.('faqs:list'); // clear shared faqs read cache so fallback queries cannot hit stale db-backed entries
  resetSeedFallbackCachesForTests(); // clear parsed fallback rows/manifest so this file reads fresh seed data

  process.env.ALLOW_SEED_FALLBACK = 'true'; // fallback must be explicitly enabled for the read path to use seed mode
  delete process.env.DATABASE_URL; // force db env validation to fail so the resolver must exercise fallback mode

  const app = createServer(); // import-safe app factory (does not auto-listen)

  server = await new Promise<HttpServer>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); // use ephemeral port to avoid collisions
    listener.on('error', reject);
  });

  const address = server.address(); // node returns string | addressinfo | null
  if (!address || typeof address === 'string') {
    throw new Error(
      'graphql taxonomy fallback test server failed to bind to a TCP port'
    );
  }

  origin = `http://127.0.0.1:${(address as AddressInfo).port}`; // stable local origin for fetch
});

beforeEach(() => {
  consoleLogSpy.mockClear(); // isolate assertions per test case
  consoleWarnSpy.mockClear(); // isolate assertions per test case
  consoleErrorSpy.mockClear(); // isolate assertions per test case
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve())); // close listener so vitest can exit cleanly
  });

  await closeDbPool(); // leave the process clean for later tests or local scripts
  // clear fallback-populated read cache entries after this file completes
  cache.invalidatePrefix?.('controls:list');
  cache.invalidatePrefix?.('faqs:list');
  resetSeedFallbackCachesForTests(); // clear parsed fallback rows/manifest after this file completes

  if (originalDatabaseUrl === undefined)
    delete process.env.DATABASE_URL; // restore deleted env exactly as we found it
  else process.env.DATABASE_URL = originalDatabaseUrl; // restore original db url for later scripts/tests

  if (originalAllowSeedFallback === undefined)
    delete process.env.ALLOW_SEED_FALLBACK; // restore deleted env exactly as we found it
  else process.env.ALLOW_SEED_FALLBACK = originalAllowSeedFallback; // restore original fallback flag for later scripts/tests

  // restore console after this file completes
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
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

function getWarnLines(): string[] {
  return consoleWarnSpy.mock.calls.map(call =>
    call.map(value => String(value)).join(' ')
  ); // flatten warn spy calls into human-readable lines for substring assertions
}

// ---------- graphql fallback taxonomy coverage ----------

describe('graphql taxonomy fallback integration', () => {
  it('returns taxonomy metadata on controlsConnection nodes in forced fallback mode', async () => {
    const { response, json } = await postGraphQL<{
      data?: {
        controlsConnection: {
          totalCount: number;
          edges: Array<{
            cursor: string;
            node: {
              id: string;
              controlKey: string;
              title: string;
              section: string;
              category: string;
              subcategory: string | null;
              tags: string[];
              updatedAt: string;
            };
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    }>(
      /* GraphQL */ `
        query ControlsTaxonomyFallback(
          $first: Int!
          $category: String
          $search: String
        ) {
          controlsConnection(
            first: $first
            category: $category
            search: $search
          ) {
            totalCount
            edges {
              cursor
              node {
                id
                controlKey
                title
                section
                category
                subcategory
                tags
                updatedAt
              }
            }
          }
        }
      `,
      {
        first: 5,
        category: 'Access Control',
        search: 'documented'
      }
    );

    expect(response.status).toBe(200); // graphql execution success still returns 200
    expect(response.headers.get('content-type')).toContain('application/json'); // yoga should return json
    expect(json.errors).toBeUndefined(); // taxonomy query should execute without graphql errors
    expect(json.data).toBeDefined(); // data payload should exist

    const connection = json.data?.controlsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // fallback seed corpus should return at least one matching row
    expect(connection?.edges.length).toBeGreaterThan(0); // first page should contain rows

    const firstNode = connection?.edges[0]?.node;
    expect(firstNode).toBeDefined(); // edge node should exist
    expect(typeof firstNode?.id).toBe('string'); // id remains part of the node contract
    expect(typeof firstNode?.controlKey).toBe('string'); // natural key should be queryable
    expect(typeof firstNode?.title).toBe('string'); // existing field should still work
    expect(typeof firstNode?.section).toBe('string'); // new broad taxonomy field should be present
    expect(typeof firstNode?.category).toBe('string'); // compatibility field should still be present
    expect(
      firstNode?.subcategory === null ||
        typeof firstNode?.subcategory === 'string'
    ).toBe(true); // nullable subcategory should match the schema contract
    expect(Array.isArray(firstNode?.tags)).toBe(true); // tags should resolve as a non-null list
    expect((firstNode?.tags ?? []).length).toBeGreaterThan(0); // taxonomy-expanded seed data should provide useful tags
    expect(typeof firstNode?.updatedAt).toBe('string'); // fallback rows should still expose a GraphQL-safe timestamp
    expect(consoleErrorSpy).not.toHaveBeenCalled(); // fallback-mode taxonomy query should not surface server errors

    const warnLines = getWarnLines();
    expect(
      warnLines.some(
        line =>
          line.includes('resolver=controlsConnection') &&
          line.includes('event=fallback_to_seed')
      )
    ).toBe(true); // prove the resolver actually exercised fallback mode instead of silently hitting the db path
  });

  it('returns taxonomy metadata on faqsConnection nodes in forced fallback mode', async () => {
    const { response, json } = await postGraphQL<{
      data?: {
        faqsConnection: {
          totalCount: number;
          edges: Array<{
            cursor: string;
            node: {
              id: string;
              faqKey: string;
              question: string;
              section: string;
              category: string;
              subcategory: string | null;
              tags: string[];
              updatedAt: string;
            };
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    }>(
      /* GraphQL */ `
        query FaqsTaxonomyFallback(
          $first: Int!
          $category: String
          $search: String
        ) {
          faqsConnection(first: $first, category: $category, search: $search) {
            totalCount
            edges {
              cursor
              node {
                id
                faqKey
                question
                section
                category
                subcategory
                tags
                updatedAt
              }
            }
          }
        }
      `,
      {
        first: 5,
        category: 'Encryption',
        search: 'review'
      }
    );

    expect(response.status).toBe(200); // graphql execution success still returns 200
    expect(response.headers.get('content-type')).toContain('application/json'); // yoga should return json
    expect(json.errors).toBeUndefined(); // taxonomy query should execute without graphql errors
    expect(json.data).toBeDefined(); // data payload should exist

    const connection = json.data?.faqsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // fallback seed corpus should return at least one matching row
    expect(connection?.edges.length).toBeGreaterThan(0); // first page should contain rows

    const firstNode = connection?.edges[0]?.node;
    expect(firstNode).toBeDefined(); // edge node should exist
    expect(typeof firstNode?.id).toBe('string'); // id remains part of the node contract
    expect(typeof firstNode?.faqKey).toBe('string'); // natural key should be queryable
    expect(typeof firstNode?.question).toBe('string'); // existing field should still work
    expect(typeof firstNode?.section).toBe('string'); // new broad taxonomy field should be present
    expect(typeof firstNode?.category).toBe('string'); // compatibility field should still be present
    expect(
      firstNode?.subcategory === null ||
        typeof firstNode?.subcategory === 'string'
    ).toBe(true); // nullable subcategory should match the schema contract
    expect(Array.isArray(firstNode?.tags)).toBe(true); // tags should resolve as a non-null list
    expect((firstNode?.tags ?? []).length).toBeGreaterThan(0); // taxonomy-expanded seed data should provide useful tags
    expect(typeof firstNode?.updatedAt).toBe('string'); // fallback rows should still expose a GraphQL-safe timestamp
    expect(consoleErrorSpy).not.toHaveBeenCalled(); // fallback-mode taxonomy query should not surface server errors

    const warnLines = getWarnLines();
    expect(
      warnLines.some(
        line =>
          line.includes('resolver=faqsConnection') &&
          line.includes('event=fallback_to_seed')
      )
    ).toBe(true); // prove the resolver actually exercised fallback mode instead of silently hitting the db path
  });
});
