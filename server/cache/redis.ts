/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Redis adapter stub (placeholder only)

  - satisfies the Cache interface so TypeScript stays happy
  - every method intentionally throws — nothing is wired to a real Redis connection
  - swap this in via index.ts when CACHE_ADAPTER=redis in a future production setup
  - no redis npm package needed until this stub is replaced with a real implementation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ~ */

import type { Cache } from './cache'; // must implement this interface to be a valid adapter

export class RedisAdapter implements Cache {
  // _ prefix on params = TypeScript convention for "I know this exists but I'm not using it"
  // that silences the "unused variable" warning without needing to delete the param name

  get(_key: string): unknown | null {
    throw new Error('RedisAdapter: not implemented'); // will fail loudly if wired up too early
  }

  set(_key: string, _value: unknown, _ttlSeconds: number): void {
    throw new Error('RedisAdapter: not implemented');
  }

  del(_key: string): void {
    throw new Error('RedisAdapter: not implemented');
  }

  async getOrSet(
    _key: string,
    _ttlSeconds: number,
    _fn: () => Promise<unknown>
  ): Promise<unknown> {
    throw new Error('RedisAdapter: not implemented');
  }
}
