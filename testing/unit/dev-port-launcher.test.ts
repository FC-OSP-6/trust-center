/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  dev launcher chooses and shares stable ports

  what this file proves:
    - the perl launcher skips the first blocked backend and frontend ports
    - explicit SERVER_PORT and VITE_DEV_PORT overrides are preserved

  why this matters:
    - vite and the server must agree on shared preselected ports before concurrent dev starts
    - local dev should keep working when default ports are already taken
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const launcherPath = path.resolve(process.cwd(), 'scripts/with-dev-port.pl');
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

async function findFirstTwoFreePortsInRange(
  startPort: number,
  endPort: number
): Promise<[number, number] | null> {
  let firstFree: number | null = null;

  for (let port = startPort; port <= endPort; port += 1) {
    try {
      const probe = await listenOnPort(port);
      await closeServer(probe);

      if (firstFree === null) {
        firstFree = port;
        continue;
      }

      return [firstFree, port];
    } catch {
      // port already in use  -->  keep scanning
    }
  }

  return null;
}

function runLauncher(
  managedKeys: string[],
  env: NodeJS.ProcessEnv = {}
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'perl',
      [
        launcherPath,
        ...managedKeys.flatMap(key => ['--manage', key]),
        '--',
        'node',
        '-e',
        "process.stdout.write(JSON.stringify({ serverPort: String(process.env.SERVER_PORT || ''), vitePort: String(process.env.VITE_DEV_PORT || '') }))"
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...env }
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });

    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', code => resolve({ stdout, stderr, code }));
  });
}

function readSelectedPorts(stdout: string): {
  serverPort: string;
  vitePort: string;
} {
  const lines = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const payload = lines.at(-1);

  if (!payload) {
    throw new Error(
      `expected launcher stdout to end with JSON, received: ${stdout}`
    );
  }

  return JSON.parse(payload) as { serverPort: string; vitePort: string };
}

afterEach(async () => {
  await Promise.all(blockers.splice(0).map(closeServer));
});

describe('dev port launcher', () => {
  it('skips the first blocked backend and frontend ports', async () => {
    const serverPorts = await findFirstTwoFreePortsInRange(4000, 4099);
    const vitePorts = await findFirstTwoFreePortsInRange(5173, 5199);

    if (!serverPorts || !vitePorts) {
      throw new Error(
        'expected at least two free ports in each dev port range'
      );
    }

    const [blockedServerPort, expectedServerPort] = serverPorts;
    const [blockedVitePort, expectedVitePort] = vitePorts;
    blockers.push(await listenOnPort(blockedServerPort));
    blockers.push(await listenOnPort(blockedVitePort));

    const result = await runLauncher(['SERVER_PORT', 'VITE_DEV_PORT']);
    const selectedPorts = readSelectedPorts(result.stdout);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(selectedPorts.serverPort).toBe(String(expectedServerPort));
    expect(selectedPorts.vitePort).toBe(String(expectedVitePort));
  });

  it('preserves explicit port overrides', async () => {
    const result = await runLauncher(['SERVER_PORT', 'VITE_DEV_PORT'], {
      SERVER_PORT: '4055',
      VITE_DEV_PORT: '5188'
    });
    const selectedPorts = readSelectedPorts(result.stdout);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(selectedPorts.serverPort).toBe('4055');
    expect(selectedPorts.vitePort).toBe('5188');
  });

  it('manages only the requested port env vars', async () => {
    const result = await runLauncher(['SERVER_PORT']);
    const selectedPorts = readSelectedPorts(result.stdout);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(Number(selectedPorts.serverPort)).toBeGreaterThanOrEqual(4000);
    expect(selectedPorts.vitePort).toBe('');
  });
});
