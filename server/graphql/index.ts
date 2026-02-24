/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL HTTP handler factory

  - Builds executable schema (typeDefs + resolvers)
  - Instantiates GraphQL Yoga HTTP transport
  - Injects request-scoped dependency container (createGraphQLContext)
  - Adds optional DB and cache instrumentation for observability
  - Exports: createGraphQLHandler()
  - Used by: HTTP/server entry point to mount GraphQL endpoint
  - Depends on: graphql-yoga runtime, schema, resolvers, context factory
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// GraphQL Yoga runtime (HTTP transport + executable schema utilities)
import { createYoga, createSchema } from 'graphql-yoga';
// DB instrumentation utility (adds request-scoped timing/logging)
import { createTimedQuery } from '../db/index.js';

import { typeDefs } from './schema'; // GraphQL SDL contract
import { resolvers } from './resolvers'; // Resolver map (execution layer)

import { createGraphQLContext } from './context'; // Dependency injection factory
import type { GraphQLContext } from './context'; // Shared context type

// ---------- GraphQL handler factory (HTTP wiring only) ----------

/**
 * Creates the GraphQL HTTP handler.
 *
 * Responsibilities:
 * - Builds executable schema from SDL + resolvers
 * - Configures Yoga transport layer
 * - Injects per-request GraphQLContext
 * - Applies request-scoped DB and cache instrumentation
 *
 * Used by the server entry point to mount the /graphql endpoint.
 */
export function createGraphQLHandler() {
  // Combine schema contract + resolvers into executable schema
  const schema = createSchema({ typeDefs, resolvers });

  return createYoga<GraphQLContext>({
    schema, // Executable GraphQL schema
    graphqlEndpoint: '/graphql', // Explicit endpoint path
    graphiql: process.env.NODE_ENV !== 'production', // Dev-only IDE
    // Construct request-scoped dependency container
    context: async initialContext => {
      const ctx = createGraphQLContext(initialContext);

      const requestId = ctx.requestId;
      const enabled = process.env.DEBUG_PERF === 'true';

      // ---------- Request-scoped DB instrumentation ----------
      ctx.db.query = createTimedQuery({
        requestId,
        enabled
      });

      // ---------- Request-scoped cache decorator ----------
      // Adds logging while preserving original cache interface
      // getOrSet(key, ttlSeconds, fn)

      // Preserve original cache instance to delegate behavior safely
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
