/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql integration smoke tests (http + yoga + schema)

  what this file proves first:
    - express mounts graphql yoga at /graphql
    - debug/root graphql queries execute without db access
    - per-request graphql context is created (requestId + auth defaults)
    - invalid cursor validation returns a graphql error response (200 + errors[])

  why this is a strong first graphql integration test:
    - exercises the real http transport + yoga + schema + resolvers
    - avoids database dependency by targeting debug fields and pre-service validation
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
    throw new Error('graphql test server failed to bind to a TCP port');
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

// ---------- integration smoke tests ----------

describe('graphql integration smoke', () => {
  it('returns hello/health + debugContext defaults from /graphql', async () => {
    const { response, json } = await postGraphQL<{
      data?: {
        hello: string;
        health: string;
        debugContext: { requestId: string; isAdmin: boolean };
      };
      errors?: Array<{ message: string }>;
    }>(/* GraphQL */ `
      query GraphqlSmoke {
        hello
        health
        debugContext {
          requestId
          isAdmin
        }
      }
    `);

    expect(response.status).toBe(200); // graphql application errors still use 200; this query should fully succeed
    expect(response.headers.get('content-type')).toContain('application/json'); // yoga should return json
    expect(json.errors).toBeUndefined(); // no graphql errors expected for debug queries
    expect(json.data).toBeDefined(); // success payload should include data

    expect(json.data?.hello).toBe('helloWorld from GraphQL!'); // proves schema + resolver wiring for hello
    expect(json.data?.health).toBe('OK'); // proves schema + resolver wiring for health
    expect(json.data?.debugContext.isAdmin).toBe(false); // default auth state from createGraphQLContext

    const requestId = json.data?.debugContext.requestId ?? '';
    expect(typeof requestId).toBe('string'); // requestId should be string
    expect(requestId.length).toBeGreaterThan(0); // requestId should not be empty
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    ); // randomUUID() format
  });

  it('returns a graphql error for invalid controlsConnection cursor (pre-service validation)', async () => {
    const { response, json } = await postGraphQL<{
      data?: unknown;
      errors?: Array<{ message: string }>;
    }>(
      /* GraphQL */ `
        query ControlsInvalidCursor($first: Int!, $after: String) {
          controlsConnection(first: $first, after: $after) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
              node {
                id
                title
              }
            }
          }
        }
      `,
      {
        first: 5,
        after: 'not-a-valid-cursor'
      }
    );

    expect(response.status).toBe(200); // graphql execution errors are returned in payload, not http 500
    expect(response.headers.get('content-type')).toContain('application/json'); // yoga json response expected
    expect(Array.isArray(json.errors)).toBe(true); // invalid cursor should surface via graphql errors[]
    expect(json.errors?.[0]?.message).toContain(
      'CURSOR_ERROR: invalid after cursor'
    ); // resolver validation should fail before service/db work
  });
});
