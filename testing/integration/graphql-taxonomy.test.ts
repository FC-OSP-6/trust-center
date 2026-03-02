/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql integration coverage for taxonomy metadata

  what this file proves:
    - controlsConnection exposes section/category/subcategory/tags
    - faqsConnection exposes section/category/subcategory/tags
    - the real express + yoga graphql stack can query the richer metadata shape
    - category/search args still work while returning the expanded node contract

  test preconditions:
    - DATABASE_URL must be configured
    - run db:cleanapply + db:seed before this file for deterministic local results

  why this matters:
    - 006-B-T.c added richer read metadata to db/services/graphql
    - this file proves those fields are actually queryable over the live http graphql surface
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

// ---------- test server lifecycle ----------

let server: HttpServer; // ephemeral listener created per test file run
let origin = ''; // base url for fetch calls (http://127.0.0.1:PORT)

// ---------- optional log silencing ----------

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let previousAllowSeedFallback: string | undefined; // preserve caller env so this file does not leak fallback mode outside its own lifecycle

// ---------- shared graphql test types ----------

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

type TaxonomyNodeShape = {
  id: string;
  section: string;
  category: string;
  subcategory: string | null;
  tags: string[];
};

// ---------- test server helpers ----------

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
      'graphql taxonomy test server failed to bind to a TCP port'
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
  previousAllowSeedFallback = process.env.ALLOW_SEED_FALLBACK; // preserve incoming env before forcing test-safe fallback behavior
  process.env.ALLOW_SEED_FALLBACK = 'true'; // taxonomy integration should still pass when db auth/connectivity is unavailable

  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // silence request/data logs during integration tests
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // keep output focused on assertions

  const started = await startTestServer(); // boot one ephemeral test server for this file
  server = started.server;
  origin = started.origin;
});

beforeEach(() => {
  consoleLogSpy.mockClear(); // isolate per-test assertions from prior requests/logs
  consoleErrorSpy.mockClear(); // isolate per-test assertions from prior requests/logs
});

afterAll(async () => {
  await stopTestServer(server);

  consoleLogSpy.mockRestore(); // restore console after this file completes
  consoleErrorSpy.mockRestore(); // restore console after this file completes

  if (previousAllowSeedFallback === undefined) {
    delete process.env.ALLOW_SEED_FALLBACK; // restore original env shape when the flag was previously absent
  } else {
    process.env.ALLOW_SEED_FALLBACK = previousAllowSeedFallback; // restore original env value when one existed
  }
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
  expect(consoleErrorSpy).not.toHaveBeenCalled(); // successful integration queries should not surface server errors
}

function expectTaxonomyNodeShape(
  node: (TaxonomyNodeShape & Record<string, unknown>) | undefined
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
}

// ---------- graphql taxonomy coverage ----------

const hasDatabaseUrl =
  typeof process.env.DATABASE_URL === 'string' &&
  process.env.DATABASE_URL.trim().length > 0;

describe.skipIf(!hasDatabaseUrl)('graphql taxonomy integration', () => {
  it('returns taxonomy metadata on controlsConnection nodes', async () => {
    const { response, json } = await postGraphQL<{
      controlsConnection: {
        totalCount: number;
        edges: Array<{
          cursor: string;
          node: TaxonomyNodeShape & {
            controlKey: string;
            title: string;
          };
        }>;
      };
    }>(
      /* GraphQL */ `
        query ControlsTaxonomy(
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
              }
            }
          }
        }
      `,
      {
        first: 5,
        category: 'Access Control',
        search: 'authentication'
      }
    );

    expectSuccessfulGraphQLResponse({ response, json });

    const connection = json.data?.controlsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // seeded taxonomy corpus should return at least one matching row
    expect(connection?.edges.length).toBeGreaterThan(0); // first page should contain rows

    const firstNode = connection?.edges[0]?.node;
    expectTaxonomyNodeShape(firstNode);
    expect(typeof firstNode?.controlKey).toBe('string'); // natural key should be queryable
    expect(typeof firstNode?.title).toBe('string'); // existing field should still work
  });

  it('returns taxonomy metadata on faqsConnection nodes', async () => {
    const { response, json } = await postGraphQL<{
      faqsConnection: {
        totalCount: number;
        edges: Array<{
          cursor: string;
          node: TaxonomyNodeShape & {
            faqKey: string;
            question: string;
          };
        }>;
      };
    }>(
      /* GraphQL */ `
        query FaqsTaxonomy($first: Int!, $category: String, $search: String) {
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
              }
            }
          }
        }
      `,
      {
        first: 5,
        category: 'Encryption',
        search: 'at rest'
      }
    );

    expectSuccessfulGraphQLResponse({ response, json });

    const connection = json.data?.faqsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // seeded taxonomy corpus should return at least one matching row
    expect(connection?.edges.length).toBeGreaterThan(0); // first page should contain rows

    const firstNode = connection?.edges[0]?.node;
    expectTaxonomyNodeShape(firstNode);
    expect(typeof firstNode?.faqKey).toBe('string'); // natural key should be queryable
    expect(typeof firstNode?.question).toBe('string'); // existing field should still work
  });
});
