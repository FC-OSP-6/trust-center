/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Redis adapter stub (placeholder only)

  - satisfies the Cache interface so TypeScript stays happy
  - every method intentionally throws — nothing is wired to a real Redis connection
  - swap this in via index.ts when CACHE_ADAPTER=redis in a future production setup
  - no redis npm package needed until this stub is replaced with a real implementation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ~ */

import { createClient } from 'redis';
import type { Cache } from './cache'; // must implement this interface to be a valid adapter

// read config from env once at module load
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const NAMESPACE = process.env.CACHE_NAMESPACE ?? 'trust-center';

// prefix every key so different environments do not collide
function namespacedKey(key: string): string {
  return `${NAMESPACE}:${key}`;
}

// one shared client for the whole process - not one per request
let client: ReturnType<typeof createClient> | null = null;

async function getClient(): Promise<ReturnType<typeof createClient>> {
  if (client) return client; // reuse the existing connection

  client = createClient({ url: REDIS_URL });

  // log connect/disconnect events so boot problems are visible in the terminal
  client.on('error', err => console.error('[redis] client error', err));
  client.on('connect', () => console.log('[redis] connected'));
  client.on('end', () => console.log('[redis] connection closed'));

  await client.connect(); // need to make an explicit connect() call
  return client;
}

export class RedisAdapter implements Cache {
  // local in-flight map for stampede protection - same as LRU adapter
  // process-local only

  private inFlight = new Map<string, Promise<unknown>>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const c = await getClient();
    const raw = await c.get(namespacedKey(key));
    if (raw === null) return null; // key doesn't exist or has expired
    try {
      return JSON.parse(raw) as T; // deserialize
    } catch {
      // corrupted value - delete it and treat it as a miss
      await c.del(namespacedKey(key));
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const c = await getClient();
    // EX sets expiry in seconds - one atomic operation
    await c.set(namespacedKey(key), JSON.stringify(value), { EX: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    const c = await getClient();
    await c.del(namespacedKey(key));
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    const c = await getClient();
    const pattern = namespacedKey(prefix) + '*'; // match all keys under this prefix
    const keys: string[] = [];

    // SCAN iterates keys incrementally
    for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(...key);
    }
    if (keys.length > 0) {
      await c.del(keys);
    }
    return keys.length;
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // if another call is fetching this key, wait for it
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn()
      .then(async value => {
        await this.set(key, value, ttlSeconds);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }
}
