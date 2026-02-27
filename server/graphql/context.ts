/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL request context factory

  - Defines the GraphQLContext type (resolver dependency contract)
  - Constructs per-request state (requestId, memoization map, auth defaults)
  - Injects shared process-level dependencies (cache instance)
  - Wraps DB access with optional performance instrumentation
  - Exports: GraphQLContext type, createGraphQLContext()
  - Consumed by: GraphQL server initialization (context configuration)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// GraphQL Yoga request context type (framework-provided per request metadata)
import type { YogaInitialContext } from 'graphql-yoga';
// Generates unique request identifiers for tracing and logging
import { randomUUID } from 'node:crypto';

// Database access layer (raw query + optional timed instrumentation wrapper)
import { createTimedQuery, query } from '../db';
// Shared in-memory or distributed cache instance (process-scoped)
import { cache } from '../cache';
import type { Cache } from '../cache';

// Enables DB query timing instrumentation when DEBUG_PERF=true
const DEBUG_PERF = process.env.DEBUG_PERF === 'true';

// ---------- GraphQLContext contract (injected into all resolvers) ----------

export type GraphQLContext = {
  requestId: string; // unique per request
  memo: Map<string, Promise<unknown>>; // request-scoped async result deduplication
  cache: Cache; // shared cache instance
  db: { query: typeof query }; // database adapter exposed to resolvers
  auth: {
    userEmail?: string | null;
    roles: string[];
    isAdmin: boolean;
  };
};

// ---------- Context factory (runs once per request) ----------

/**
 * Creates the GraphQL execution context for a single request.
 *
 * Responsibilities:
 * - Generates a unique requestId for tracing
 * - Wraps DB access with optional performance instrumentation
 * - Initializes request-scoped memoization storage
 * - Attaches shared process-level dependencies (cache)
 * - Initializes default authentication state
 *
 * This function is invoked once per incoming GraphQL request
 * by the server configuration.
 */

export function createGraphQLContext(
  initialContext: YogaInitialContext
): GraphQLContext {
  const requestId = randomUUID(); // generate one trace id per GraphQL request

  // Log request entry for trace correlation across services
  console.log(`[req] requestId=${requestId} event=incoming_graphql_request`);

  // DB adapter: wraps base query function with request-scoped timing instrumentation
  const dbAdapter = {
    query: createTimedQuery({
      requestId, // bind requestId into db timing logs for this request
      enabled: DEBUG_PERF // only emit db timing logs when perf debugging is enabled
    })
  };

  return {
    requestId: requestId, // expose the request trace id to all resolvers/services
    memo: new Map<string, Promise<unknown>>(), // create a fresh request-scoped memo map for this one request
    cache, // inject the process-scoped shared cache instance
    db: dbAdapter, // inject the request-scoped db adapter wrapper
    auth: {
      userEmail: null, // auth is still a placeholder in this prototype
      roles: [], // no role data is attached yet
      isAdmin: false // default to non-admin until real auth exists
    }
  };
}
