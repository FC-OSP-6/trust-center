/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> request-scoped promise memoization helper

  - dedupes duplicate service reads within 1 graphql request
  - stores promises (not resolved values) so concurrent callers share work
  - deletes memo entries on rejection to avoid poisoned cache entries
  - optional debug logs to show hit/miss behavior
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ---------- debug flag helpers ----------

function isDebugPerfEnabled(): boolean {
  const raw = String(process.env.DEBUG_PERF ?? '').toLowerCase(); // env flags are strings
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'; // tolerate common truthy values
}

function logMemo(event: 'hit' | 'miss' | 'evict-on-error', key: string): void {
  if (!isDebugPerfEnabled()) return; // keep logs quiet unless explicitly enabled
  console.log(`[memo] ${event} key=${key}`); // single-line log for terminal scanning
}

// ---------- main helper ----------

export async function memoizePromise<T>(
  memo: Map<string, Promise<unknown>>,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = memo.get(key) as Promise<T> | undefined; // typed read from request-scoped memo map

  if (existing) {
    logMemo('hit', key); // duplicate call within same request reuses in-flight/resolved promise
    return existing; // return shared promise so callers dedupe work
  }

  logMemo('miss', key); // first call for this key in the request

  const pending = fn().catch((error: unknown) => {
    memo.delete(key); // remove failed promise so retries in same request can run again
    logMemo('evict-on-error', key); // debug visibility for rejection cleanup
    throw error; // preserve original failure behavior
  });

  memo.set(key, pending as Promise<unknown>); // store promise immediately to dedupe concurrent calls

  return pending; // caller awaits the same promise stored in the map
}
