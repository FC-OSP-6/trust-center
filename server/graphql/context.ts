/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL request context factory

  - Defines the GraphQLContext type (resolver dependency contract)
  - Constructs per-request state (requestId, memoization map, auth state)
  - Injects shared process-level dependencies (cache instance)
  - Wraps DB access with optional performance instrumentation
  - Derives demo-grade admin auth from request headers through the auth module
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
import { extractAuth, type AuthState } from '../auth'; // request-derived demo auth extraction

// Enables DB query timing instrumentation when DEBUG_PERF=true
const DEBUG_PERF = process.env.DEBUG_PERF === 'true';

// ---------- context contract ----------

export type GraphQLContext = {
  requestId: string; // unique per request
  memo: Map<string, Promise<unknown>>; // request-scoped async result deduplication
  cache: Cache; // shared cache instance
  db: { query: typeof query }; // database adapter exposed to resolvers
  auth: AuthState; // request-derived auth state used by admin-ready mutations
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
 * - Derives authentication state from the incoming request
 *
 * This function is invoked once per incoming GraphQL request
 * by the server configuration.
 */

export function createGraphQLContext(
  _initialContext: YogaInitialContext
): GraphQLContext {
  const requestId = randomUUID(); // stable trace id for all logs produced by this request
  const auth = extractAuth(initialContext.request); // derive demo-grade admin state from request headers once

  // Log request entry for trace correlation across services
  // console.log(`[request:${requestId}] Incoming GraphQL request`);
  console.log(`[gql]  requestId = ${requestId}  event = request_start`);

  const dbAdapter = {
    query: createTimedQuery({
      requestId, // stamp all db timing logs with this request id
      enabled: DEBUG_PERF // only emit db timing logs when perf debugging is enabled
    })
  };

  return {
    requestId, // expose trace id to resolvers and debugContext
    memo: new Map<string, Promise<unknown>>(), // one memo map per request
    cache, // shared process-level cache instance
    db: dbAdapter, // request-aware db adapter
    auth // request-derived auth replaces the old hardcoded stub
  };
}
