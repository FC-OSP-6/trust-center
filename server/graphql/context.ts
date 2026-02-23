/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  context

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { YogaInitialContext } from 'graphql-yoga'; // context type for per-request context builder
import { randomUUID } from 'node:crypto'; // avoid uuid dependency  -->  randomized unique id generator
import { query } from '../db/index';
import { cache } from '../cache';

const dbAdapter = { query };

// request context shape  -->  shared across all resolvers per request
export type GraphQLContext = {
  requestId: string; // created per request
  memo: Map<string, Promise<unknown>>; // created per request
  cache: Map<string, unknown>; // imported singleton
  db: { query: typeof query }; // thin adapter around existing query
  auth: {
    // placeholder
    userEmail?: string | null;
    roles: string[];
    isAdmin: boolean;
  };
};

// createGraphQLContext(initialContext) {
//     return()
// requestId: randomUUID(),
// memo: new Map(),
// auth: {
//     userEmail: "fakeemail@email.com",
//     roles: ['user'],
//     isAdmin:
// }
// }

export function createGraphQLContext(
  initialContext: YogaInitialContext
): GraphQLContext;
