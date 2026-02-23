/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  LRU cache adapter (the real implementation)

  - implements the Cache interface using the lru-cache library
  - holds items in memory with a TTL (expiry time) per item
  - evicts the least-recently-used item when the store is full
  - used as the default adapter in prototype / single-node environments
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { LRUCache } from 'lru-cache'; // battle-tested LRU library — handles eviction + TTL for us
import type { Cache } from './cache'; // import the interface this class must satisfy

// lru-cache v10+ requires the value type to extend {} (no null/undefined in the generic)
// this union covers every JSON-safe value we'd realistically cache
// null is handled separately — our get() returns null to signal "cache miss", not as a stored value
type CacheVal = string | number | boolean | object;

export class LruCacheAdapter implements Cache {
  // private means nothing outside this class can touch lru directly
  // LRUCache<string, CacheVal> means: keys are strings, values are any JSON-safe type
  private lru: LRUCache<string, CacheVal>;

  // constructor runs once when you do: new LruCacheAdapter(500)
  // maxItems comes from the CACHE_MAX_ITEMS env var (set in index.ts)
  constructor(maxItems: number) {
    this.lru = new LRUCache<string, CacheVal>({
      max: maxItems, // hard cap on how many items can be stored at once
      ttl: 1000 * 60 * 5, // default TTL: 5 minutes (in milliseconds — lru-cache requires ms)
      ttlAutopurge: true // background sweep removes expired items so memory doesn't creep up
    });
  }

  // returns the stored value, or null if key doesn't exist or has expired
  // ?? null means: "if lru.get returns undefined, use null instead"
  get(key: string): unknown | null {
    return this.lru.get(key) ?? null;
  }

  // stores value under key with a per-item TTL override
  // ttlSeconds * 1000 converts to milliseconds because lru-cache always works in ms
  // "as CacheVal" is a safe cast — callers should only store JSON-safe values (documented on Cache interface)
  set(key: string, value: unknown, ttlSeconds: number): void {
    this.lru.set(key, value as CacheVal, { ttl: ttlSeconds * 1000 });
  }

  // immediately removes the key — useful when a write/mutation makes cached data stale
  del(key: string): void {
    this.lru.delete(key);
  }

  // the main workhorse method services will use
  async getOrSet(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<unknown>
  ): Promise<unknown> {
    const cached = this.get(key); // check the notepad first
    if (cached !== null) return cached; // cache hit — skip the DB entirely

    const value = await fn(); // cache miss — call fn() to fetch from DB (await = wait for it)
    this.set(key, value, ttlSeconds); // store the result so the next call is a hit
    return value; // return the freshly fetched value to the caller
  }
}
