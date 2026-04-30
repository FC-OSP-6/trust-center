/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  cache interface (the contract)

  - defines what every cache adapter must be able to do
  - does NOT contain any logic — just method signatures
  - any class that says "implements Cache" must have all 4 methods
  - lets us swap LRU ↔ Redis without changing code that uses the cache
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

export interface Cache {
  // look up a value by key — returns null if the key is missing or has expired
  get<T = unknown>(key: string): Promise<T | null>;

  // store a value under a key with a TTL
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;

  // immediately remove a key — used when data changes and the cached version is stale
  del(key: string): Promise<void>;

  // remove ALL keys that start with a given prefix — returns how many were deleted
  // example: invalidatePrefix('controls:') wipes every controls list page from the cache at once
  invalidatePrefix(prefix: string): Promise<number>;

  // the smart combo: check cache first, only call fn() if there's a miss
  // fn is an async function that fetches the real data (e.g. a DB query)
  // returns a Promise because fn() is async and we may need to await it
  getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<T>;
}
