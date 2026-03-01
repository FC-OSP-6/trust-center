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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer } from '../../server/server';

// ---------- test server lifecycle ----------

let server: HttpServer; // ephemeral listener created per test file run
let origin = ''; // base url for fetch calls (http://127.0.0.1:PORT)

// ---------- optional log silencing ----------

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // silence request/data logs during integration tests
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // keep output focused on assertions

  const app = createServer(); // import-safe app factory (does not auto-listen)

  server = await new Promise<HttpServer>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); // use ephemeral port to avoid collisions
    listener.on('error', reject);
  });

  const address = server.address(); // node returns string | addressinfo | null
  if (!address || typeof address === 'string') {
    throw new Error(
      'graphql taxonomy test server failed to bind to a TCP port'
    );
  }

  origin = `http://127.0.0.1:${(address as AddressInfo).port}`; // stable local origin for fetch
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve())); // close listener so vitest can exit cleanly
  });

  consoleLogSpy.mockRestore(); // restore console after this file completes
  consoleErrorSpy.mockRestore(); // restore console after this file completes
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

// ---------- graphql taxonomy coverage ----------

describe('graphql taxonomy integration', () => {
  it('returns taxonomy metadata on controlsConnection nodes', async () => {
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
            };
          }>;
        };
      };
      errors?: Array<{ message: string }>;
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

    expect(response.status).toBe(200); // graphql execution success still returns 200
    expect(response.headers.get('content-type')).toContain('application/json'); // yoga should return json
    expect(json.errors).toBeUndefined(); // taxonomy query should execute without graphql errors
    expect(json.data).toBeDefined(); // data payload should exist

    const connection = json.data?.controlsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // seeded taxonomy corpus should return at least one matching row
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
  });

  it('returns taxonomy metadata on faqsConnection nodes', async () => {
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
            };
          }>;
        };
      };
      errors?: Array<{ message: string }>;
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

    expect(response.status).toBe(200); // graphql execution success still returns 200
    expect(response.headers.get('content-type')).toContain('application/json'); // yoga should return json
    expect(json.errors).toBeUndefined(); // taxonomy query should execute without graphql errors
    expect(json.data).toBeDefined(); // data payload should exist

    const connection = json.data?.faqsConnection;
    expect(connection).toBeDefined(); // root connection payload should be present
    expect(connection?.totalCount).toBeGreaterThan(0); // seeded taxonomy corpus should return at least one matching row
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
  });
});
