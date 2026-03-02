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

// ---------- shared graphql test types ----------

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

type FallbackTaxonomyNodeShape = {
  id: string;
  section: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  updatedAt: string;
};

// ---------- test environment helpers ----------

function clearTaxonomyReadCaches(): void {
  cache.invalidatePrefix?.('controls:list'); // clear shared controls read cache so fallback queries cannot hit stale db-backed entries
  cache.invalidatePrefix?.('faqs:list'); // clear shared faqs read cache so fallback queries cannot hit stale db-backed entries
}

function restoreEnvValue(
  key: 'DATABASE_URL' | 'ALLOW_SEED_FALLBACK',
  value: string | undefined
): void {
  if (value === undefined)
    delete process.env[key]; // restore deleted env exactly as we found it
  else process.env[key] = value; // restore original env value for later scripts/tests
}

async function startTestServer(): Promise<{
  server: HttpServer;
  origin: string;
}> {
  const app = createServer(); // import-safe app factory (does not auto-listen)

  const nextServer = await new Promise<HttpServer>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); // use ephemeral port to avoid collisions
    listener.on('error', reject);
  });

  const address = nextServer.address(); // node returns string | addressinfo | null
  if (!address || typeof address === 'string') {
    throw new Error(
      'graphql taxonomy fallback test server failed to bind to a TCP port'
    );
  }

  return {
    server: nextServer,
    origin: `http://127.0.0.1:${(address as AddressInfo).port}` // stable local origin for fetch
  };
}

async function stopTestServer(nextServer: HttpServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    nextServer.close(error => (error ? reject(error) : resolve())); // close listener so vitest can exit cleanly
  });
}

beforeAll(async () => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // silence request/data logs during integration tests
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // capture fallback warnings for assertions without noisy terminal output
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // keep output focused on assertions

  await closeDbPool(); // close any prior db pool so this file cannot accidentally reuse a real connection from another test
  clearTaxonomyReadCaches();
  resetSeedFallbackCachesForTests(); // clear parsed fallback rows/manifest so this file reads fresh seed data

  process.env.ALLOW_SEED_FALLBACK = 'true'; // fallback must be explicitly enabled for the read path to use seed mode
  delete process.env.DATABASE_URL; // force db env validation to fail so the resolver must exercise fallback mode

  const started = await startTestServer(); // boot one ephemeral test server for this file
  server = started.server;
  origin = started.origin;
});

// ---------- isolate assertions per test case ----------

beforeEach(() => {
  consoleLogSpy.mockClear();
  consoleWarnSpy.mockClear();
  consoleErrorSpy.mockClear();
});

afterAll(async () => {
  await stopTestServer(server);

  await closeDbPool(); // leave the process clean for later tests or local scripts
  clearTaxonomyReadCaches(); // clear fallback-populated read cache entries after this file completes
  resetSeedFallbackCachesForTests(); // clear parsed fallback rows/manifest after this file completes
  restoreEnvValue('DATABASE_URL', originalDatabaseUrl);
  restoreEnvValue('ALLOW_SEED_FALLBACK', originalAllowSeedFallback);

  consoleLogSpy.mockRestore(); // restore console after this file completes
  consoleWarnSpy.mockRestore(); // restore console after this file completes
  consoleErrorSpy.mockRestore(); // restore console after this file completes
});

// ---------- graphql test helpers ----------

async function postGraphQL<TData>(query: string, variables?: unknown) {
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

  const json = (await response.json()) as GraphQLResponse<TData>; // parse graphql json payload
  return { response, json };
}

function getWarnLines(): string[] {
  return consoleWarnSpy.mock.calls.map(call =>
    call.map(value => String(value)).join(' ')
  ); // flatten warn spy calls into human-readable lines for substring assertions
}

function expectSuccessfulGraphQLResponse<TData>(args: {
  response: Response;
  json: GraphQLResponse<TData>;
}): void {
  expect(args.response.status).toBe(200); // graphql execution success still returns 200
  expect(args.response.headers.get('content-type')).toContain(
    'application/json'
  ); // yoga should return json
  expect(args.json.errors).toBeUndefined(); // taxonomy query should execute without graphql errors
  expect(args.json.data).toBeDefined(); // data payload should exist
  expect(consoleErrorSpy).not.toHaveBeenCalled(); // fallback-mode taxonomy query should not surface server errors
}

function expectFallbackTaxonomyNodeShape(
  node: (FallbackTaxonomyNodeShape & Record<string, unknown>) | undefined
): void {
  expect(node).toBeDefined(); // edge node should exist
  expect(typeof node?.id).toBe('string'); // id remains part of the node contract
  expect(typeof node?.section).toBe('string'); // new broad taxonomy field should be present
  expect(typeof node?.category).toBe('string'); // compatibility field should still be present
  expect(
    node?.subcategory === null || typeof node?.subcategory === 'string'
  ).toBe(true); // nullable subcategory should match the schema contract
  expect(Array.isArray(node?.tags)).toBe(true); // tags should resolve as a non-null list
  expect((node?.tags ?? []).length).toBeGreaterThan(0); // taxonomy-expanded seed data should provide useful tags
  expect(typeof node?.updatedAt).toBe('string'); // fallback rows should still expose a GraphQL-safe timestamp
}

function expectFallbackWarning(
  resolverName: 'controlsConnection' | 'faqsConnection'
): void {
  const warnLines = getWarnLines();

  expect(
    warnLines.some(
      line =>
        line.includes(`resolver=${resolverName}`) &&
        line.includes('event=fallback_to_seed')
    )
  ).toBe(true); // prove the resolver actually exercised fallback mode instead of silently hitting the db path
}

// ---------- graphql fallback taxonomy coverage ----------

describe('graphql taxonomy fallback integration', () => {
  it('returns taxonomy metadata on controlsConnection nodes in forced fallback mode', async () => {
    const { response, json } = await postGraphQL<{
      controlsConnection: {
        totalCount: number;
        edges: Array<{
          cursor: string;
          node: FallbackTaxonomyNodeShape & {
            controlKey: string;
            title: string;
          };
        }>;
      };
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

    expectSuccessfulGraphQLResponse({ response, json });

    const connection = json.data?.controlsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // fallback seed corpus should return at least one matching row
    expect(connection?.edges.length).toBeGreaterThan(0); // first page should contain rows

    const firstNode = connection?.edges[0]?.node;
    expectFallbackTaxonomyNodeShape(firstNode);
    expect(typeof firstNode?.controlKey).toBe('string'); // natural key should be queryable
    expect(typeof firstNode?.title).toBe('string'); // existing field should still work
    expectFallbackWarning('controlsConnection');
  });

  it('returns taxonomy metadata on faqsConnection nodes in forced fallback mode', async () => {
    const { response, json } = await postGraphQL<{
      faqsConnection: {
        totalCount: number;
        edges: Array<{
          cursor: string;
          node: FallbackTaxonomyNodeShape & {
            faqKey: string;
            question: string;
          };
        }>;
      };
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

    expectSuccessfulGraphQLResponse({ response, json });

    const connection = json.data?.faqsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // fallback seed corpus should return at least one matching row
    expect(connection?.edges.length).toBeGreaterThan(0); // first page should contain rows

    const firstNode = connection?.edges[0]?.node;
    expectFallbackTaxonomyNodeShape(firstNode);
    expect(typeof firstNode?.faqKey).toBe('string'); // natural key should be queryable
    expect(typeof firstNode?.question).toBe('string'); // existing field should still work
    expectFallbackWarning('faqsConnection');
  });
});
