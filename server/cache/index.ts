/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  cache entry point + singleton

  - reads CACHE_MAX_ITEMS from env to set the memory cap
  - creates ONE shared cache instance for the whole server process
  - re-exports Cache type + key builders so consumers only need one import
  - never create the cache inside a request handler — that would reset it every request
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { LruCacheAdapter } from './lru'; // the concrete implementation we're using now
import { RedisAdapter } from './redis'; // the placeholder for production
import type { Cache } from './cache'; // the interface type (import type = stripped at runtime)

// process.env.CACHE_MAX_ITEMS is always a string (env vars are strings)
// parseInt(..., 10) converts it to a number — 10 means base-10 (normal decimal)
// ?? '500' is the fallback: if the env var isn't set, default to 500 slots
const parsedMax = parseInt(process.env.CACHE_MAX_ITEMS ?? '500', 10);
const CACHE_MAX_ITEMS = isNaN(parsedMax) ? 500 : parsedMax;

// CACHE_ADAPTER allows us to swap implementations without changing code
// Default to 'lru' for local development and prototypes
const CACHE_ADAPTER = process.env.CACHE_ADAPTER ?? 'lru';

/**
 * Factory function to create the cache instance based on environment.
 * This fulfills the "createCacheFromEnv" requirement from the technical scope.
 */
function createCacheFromEnv(): Cache {
  if (CACHE_ADAPTER === 'redis') {
    return new RedisAdapter();
  }
  return new LruCacheAdapter(CACHE_MAX_ITEMS);
}

// this line runs ONCE when the module is first imported — never again
// every file that imports { cache } gets the same object in memory
// if you put this inside a function, you'd get a fresh empty cache on every call — wrong!
export const cache: Cache = createCacheFromEnv();

// re-export Cache type so consumers write: import { cache, Cache } from '../cache'
// instead of: import { cache } from '../cache' + import type { Cache } from '../cache/cache'
export type { Cache } from './cache';

// re-export key builders so there's one import point for everything cache-related
export { buildControlsKey, buildFaqsKey } from './keys';
export type { ListArgs } from './keys'; // also re-export the args type for convenience
