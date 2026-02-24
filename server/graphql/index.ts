/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL handler factory (transport layer only)

  - Builds executable GraphQL schema (typeDefs + resolvers)
  - Instantiates Yoga server
  - Injects request context factory (dependency container)
  - Does NOT construct dependencies directly
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { createYoga, createSchema } from 'graphql-yoga';
import { createTimedQuery } from '../db/index.js';

import { typeDefs } from './schema'; // SDL contract (schema definition)
import { resolvers } from './resolvers'; // Resolver map (execution layer)

import { createGraphQLContext } from './context'; // Dependency injection factory
import type { GraphQLContext } from './context'; // Shared context type

// ----------  GraphQL handler factory (HTTP wiring only) ----------

export function createGraphQLHandler() {
  // Combine schema contract + resolvers into executable schema
  const schema = createSchema({ typeDefs, resolvers });

  return createYoga<GraphQLContext>({
    schema, // Executable GraphQL schema
    graphqlEndpoint: '/graphql', // Explicit endpoint path
    graphiql: process.env.NODE_ENV !== 'production', // Dev-only IDE
    context: async initialContext => {
      const ctx = createGraphQLContext(initialContext);

      const requestId = ctx.requestId;
      const enabled = process.env.DEBUG_PERF === 'true';

      // --------------------------
      // DB timing wrapper
      // --------------------------
      ctx.db.query = createTimedQuery({
        requestId,
        enabled
      });

      // --------------------------
      // Cache wrapper (SAFE + preserves methods)
      // Cache.getOrSet(key, ttlSeconds, fn)
      // --------------------------
      const originalCache = ctx.cache;

      ctx.cache = {
        get: originalCache.get.bind(originalCache),
        set: originalCache.set.bind(originalCache),
        del: originalCache.del.bind(originalCache),

        async getOrSet(key, ttlSeconds, fn) {
          const existing = originalCache.get(key); // returns unknown | null

          if (enabled) {
            console.log(
              `[cache] requestId=${requestId} ${
                existing !== null ? 'hit' : 'miss'
              } key=${key}`
            );
          }

          return originalCache.getOrSet(key, ttlSeconds, fn);
        }
      };

      return ctx;
    }
  });
}
