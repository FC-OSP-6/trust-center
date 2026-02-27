/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> request-scoped promise memoization helper

  - dedupes duplicate service reads within 1 graphql request
  - stores promises (not resolved values) so concurrent callers share work
  - deletes memo entries on rejection to avoid poisoned memo entries
  - emits optional request-aware hit/miss logs when DEBUG_PERF is enabled
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ---------- debug flag helpers ----------

function isDebugPerfEnabled(): boolean {
  const raw = String(process.env.DEBUG_PERF ?? '').toLowerCase(); // env flags are strings
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'; // tolerate common truthy values
}

type MemoEvent = 'hit' | 'miss' | 'evict-on-error'; // supported memo lifecycle events

function logMemo(args: {
  requestId: string;
  event: MemoEvent;
  key: string;
}): void {
  if (!isDebugPerfEnabled()) return; // keep logs quiet unless perf debugging is enabled
  console.log(
    `[memo] requestId=${args.requestId} ${args.event} key=${args.key}`
  ); // one structured line keeps terminal traces easy to grep
}

// ---------- main helper ----------

export async function memoizePromise<T>(
  memo: Map<string, Promise<unknown>>,
  requestId: string,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = memo.get(key) as Promise<T> | undefined; // typed read from the request-scoped memo map

  if (existing) {
    logMemo({
      requestId,
      event: 'hit',
      key
    }); // duplicate call within the same request reuses the shared promise

    return existing; // return the already-stored promise so concurrent callers share the same work
  }

  logMemo({
    requestId,
    event: 'miss',
    key
  }); // first call for this key inside the current request

  const pending = fn().catch((error: unknown) => {
    memo.delete(key); // failed promises must be removed so retries can run again
    logMemo({
      requestId,
      event: 'evict-on-error',
      key
    }); // surface rejection cleanup during perf debugging
    throw error; // preserve original failure behavior
  });

  memo.set(key, pending as Promise<unknown>); // store the promise immediately to dedupe in-flight work

  return pending; // caller awaits the same promise that is stored in the memo map
}
