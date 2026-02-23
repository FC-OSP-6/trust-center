/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  cache interface (the contract)

  - defines what every cache adapter must be able to do
  - does NOT contain any logic — just method signatures
  - any class that says "implements Cache" must have all 4 methods
  - lets us swap LRU ↔ Redis without changing code that uses the cache
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

export interface Cache {
  // look up a value by key — returns null if the key is missing or has expired
  get(key: string): unknown | null;

  // store a value under a key; ttlSeconds controls how long before it expires
  set(key: string, value: unknown, ttlSeconds: number): void;

  // immediately remove a key — used when data changes and the cached version is stale
  del(key: string): void;

  // remove ALL keys that start with a given prefix — used after a mutation changes an entity
  // optional (?) because not every adapter needs to support it (e.g. Redis stub skips it)
  // example: invalidatePrefix('controls:') wipes every controls list page from the cache at once
  invalidatePrefix?(prefix: string): void;

  // the smart combo: check cache first, only call fn() if there's a miss
  // fn is an async function that fetches the real data (e.g. a DB query)
  // returns a Promise because fn() is async and we may need to await it
  getOrSet(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<unknown>
  ): Promise<unknown>;
}
