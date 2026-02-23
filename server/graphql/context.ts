/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL dependency container

  - Defines the GraphQLContext contract
  - Injects shared process-level dependencies (db, cache)
  - Creates per-request dependencies (requestId, memo, auth)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { YogaInitialContext } from 'graphql-yoga';
import { randomUUID } from 'node:crypto';

import { query } from '../db';
import { cache } from '../cache';
import type { Cache } from '../cache';

// ----------  Process-scoped dependencies (created once per server process) ----------

const dbAdapter = { query }; // thin DB wrapper (replaceable later)

// ----------  GraphQL context shape (available to all resolvers) ----------

export type GraphQLContext = {
  requestId: string; // unique per request
  memo: Map<string, Promise<unknown>>; // request-scoped dedupe
  cache: Cache; // shared cache instance
  db: { query: typeof query }; // injected DB access
  auth: {
    userEmail?: string | null;
    roles: string[];
    isAdmin: boolean;
  };
};

// ----------  Context factory (runs once per request) ----------

export function createGraphQLContext(
  initialContext: YogaInitialContext
): GraphQLContext {
  return {
    requestId: randomUUID(),
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
