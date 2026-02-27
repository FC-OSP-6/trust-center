/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  integration smoke tests for express server bootstrap

  what this file proves first:
    - vitest can import and boot the express app
    - /api/health responds with the expected JSON contract
    - unknown routes return the shared JSON 404 shape

  why this is a strong first integration test:
    - fast
    - no database dependency required
    - catches route/middleware/bootstrap regressions early
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
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // request logger noise is not useful in this file
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // keep failures focused on test assertions

  const app = createServer(); // import-safe app factory (does not auto-listen)

  // start on an ephemeral port so tests do not collide with local dev servers
  server = await new Promise<HttpServer>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });

  const address = server.address(); // node returns string | addressinfo | null
  if (!address || typeof address === 'string') {
    throw new Error('test server failed to bind to a TCP port');
  }

  origin = `http://127.0.0.1:${(address as AddressInfo).port}`; // stable local origin for fetch
});

afterAll(async () => {
  // close the ephemeral server so vitest can exit cleanly
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });

  consoleLogSpy.mockRestore(); // restore console after this file completes
  consoleErrorSpy.mockRestore(); // restore console after this file completes
});

// ---------- integration smoke tests ----------

describe('server integration smoke', () => {
  it('returns 200 + health JSON from /api/health', async () => {
    const response = await fetch(`${origin}/api/health`); // node 18+ global fetch

    expect(response.status).toBe(200); // explicit status check for health contract
    expect(response.headers.get('content-type')).toContain('application/json'); // health endpoint should always be json

    const body = (await response.json()) as {
      ok: boolean;
      serviceName: string;
      timestamp: string;
    };

    expect(body.ok).toBe(true); // canonical success flag
    expect(body.serviceName).toBe('trust-center-server'); // catches accidental rename/regression
    expect(typeof body.timestamp).toBe('string'); // timestamp should be serializable json string
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false); // timestamp must be ISO-parseable
  });

  it('returns shared JSON 404 shape for unknown routes', async () => {
    const response = await fetch(`${origin}/this-route-does-not-exist`);

    expect(response.status).toBe(404); // unknown route should hit global not-found middleware
    expect(response.headers.get('content-type')).toContain('application/json'); // keep 404 response API-friendly

    const body = await response.json();

    expect(body).toEqual({
      ok: false,
      error: 'not found'
    }); // verifies your standardized 404 JSON contract
  });
});
