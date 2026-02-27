/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL request context factory

  - defines the GraphQLContext type used by resolvers/services
  - creates per-request state (requestId + memo map + auth stub)
  - injects shared process-level dependencies (cache)
  - wraps db access with optional request-aware timing instrumentation
  - logs request start with a dedicated GraphQL layer tag
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { YogaInitialContext } from 'graphql-yoga'; // framework-provided request metadata
import { randomUUID } from 'node:crypto'; // generates unique request trace ids

import { createTimedQuery, query } from '../db'; // db adapter + optional request-aware timing wrapper
import { cache } from '../cache'; // process-scoped cache singleton
import type { Cache } from '../cache'; // shared cache interface contract

const DEBUG_PERF = process.env.DEBUG_PERF === 'true'; // enables request-aware db timing logs

// ---------- context contract ----------

export type GraphQLContext = {
  requestId: string; // unique trace id for one GraphQL request
  memo: Map<string, Promise<unknown>>; // request-scoped promise dedupe storage
  cache: Cache; // shared process-scoped cache adapter
  db: { query: typeof query }; // request-aware db adapter exposed to services
  auth: {
    userEmail?: string | null;
    roles: string[];
    isAdmin: boolean;
  };
};

// ---------- context factory ----------

export function createGraphQLContext(
  _initialContext: YogaInitialContext
): GraphQLContext {
  const requestId = randomUUID(); // generate one trace id for this GraphQL request

  console.log(`[gql] requestId=${requestId} event=request_start`); // dedicated GraphQL start log avoids confusion with the HTTP access logger

  const dbAdapter = {
    query: createTimedQuery({
      requestId, // stamp all db timing logs with this request id
      enabled: DEBUG_PERF // only emit db timing logs when perf debugging is enabled
    })
  };

  return {
    requestId: requestId, // expose trace id to resolvers, services, and perf logs
    memo: new Map<string, Promise<unknown>>(), // fresh memo map per request so dedupe never leaks across requests
    cache, // inject shared cache singleton
    db: dbAdapter, // inject request-aware db adapter
    auth: {
      userEmail: null, // auth remains a stub in this prototype
      roles: [], // no role claims are attached yet
      isAdmin: false // default to non-admin until real auth lands
    }
  };
}
