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
  const requestId = randomUUID();

  // Log request entry for trace correlation across services
  console.log(`[request:${requestId}] Incoming GraphQL request`);

  // DB adapter: wraps base query function with request-scoped timing instrumentation
  const dbAdapter = {
    query: createTimedQuery({
      requestId,
      enabled: DEBUG_PERF
    })
  };

  return {
    requestId: requestId,
    memo: new Map<string, Promise<unknown>>(),
    cache,
    db: dbAdapter,
    auth: {
      userEmail: null,
      roles: [],
      isAdmin: false
    }
  };
}
