/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  vite config respects coordinated dev ports

  what this file proves:
    - vite uses the chosen VITE_DEV_PORT for its local server
    - vite proxies api routes to the chosen SERVER_PORT

  why this matters:
    - the combined dev launcher only works if vite consumes both values consistently
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import viteConfig from '../../vite.config';

const originalServerPort = process.env.SERVER_PORT;
const originalViteDevPort = process.env.VITE_DEV_PORT;
const blockers: net.Server[] = [];

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

async function listenOnPort(port: number): Promise<net.Server> {
  const server = net.createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  return server;
}

afterEach(() => {
  if (originalServerPort === undefined) {
    delete process.env.SERVER_PORT;
  } else {
    process.env.SERVER_PORT = originalServerPort;
  }

  if (originalViteDevPort === undefined) {
    delete process.env.VITE_DEV_PORT;
  } else {
    process.env.VITE_DEV_PORT = originalViteDevPort;
  }

  return Promise.all(blockers.splice(0).map(closeServer));
});

describe('vite config dev ports', () => {
  it('uses coordinated backend and frontend env ports', async () => {
    process.env.SERVER_PORT = '4056';
    process.env.VITE_DEV_PORT = '5181';

    const resolved = await viteConfig({
      command: 'serve',
      mode: 'development'
    });

    expect(resolved.server?.port).toBe(5181);
    expect(resolved.server?.proxy?.['/graphql']).toMatchObject({
      target: 'http://localhost:4056'
    });
    expect(resolved.server?.proxy?.['/api/health']).toMatchObject({
      target: 'http://localhost:4056'
    });
  });

  it('scans for the next frontend port when no override is set', async () => {
    delete process.env.VITE_DEV_PORT;
    blockers.push(await listenOnPort(5173));

    const resolved = await viteConfig({
      command: 'serve',
      mode: 'development'
    });

    expect(resolved.server?.port).toBe(5174);
  });

  it('keeps Playwright scripts unwrapped so existing local dev servers can be reused', () => {
    const packageJson = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
    ) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['test:e2e']).toBe('playwright test');
    expect(packageJson.scripts['test:e2e:headed']).toBe(
      'playwright test --headed'
    );
    expect(packageJson.scripts['dev:server']).toBe(
      'perl scripts/with-dev-port.pl --manage SERVER_PORT -- tsx watch server/server.ts'
    );
    expect(packageJson.scripts['dev:server:start']).toBe(
      'perl scripts/with-dev-port.pl --manage SERVER_PORT -- bun server/server.ts'
    );
  });
});
