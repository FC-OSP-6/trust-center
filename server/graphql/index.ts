/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL HTTP handler factory

  - builds the executable schema from typeDefs + resolvers
  - creates the GraphQL Yoga handler used by the server entry point
  - injects a per-request GraphQLContext for every request
  - decorates the shared cache with request-aware logging
  - preserves the full cache contract while adding debug visibility
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { createYoga, createSchema } from 'graphql-yoga'; // GraphQL Yoga runtime + schema builder

import { typeDefs } from './schema'; // GraphQL SDL contract
import { resolvers } from './resolvers'; // resolver execution map

import { createGraphQLContext } from './context'; // per-request dependency injection factory
import type { GraphQLContext } from './context'; // shared request context type
import type { Cache } from '../cache'; // shared cache interface so the decorator preserves the full contract

// ---------- local debug helpers ----------

function isDebugPerfEnabled(): boolean {
  const raw = String(process.env.DEBUG_PERF ?? '').toLowerCase(); // env flags arrive as strings
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'; // tolerate common truthy values
}

// ---------- cache decorator ----------

function decorateCacheWithRequestLogging(
  cache: Cache,
  requestId: string
): Cache {
  const debugEnabled = isDebugPerfEnabled(); // compute once per request so nested calls stay cheap

  return {
    get(key) {
      return cache.get(key); // pass through direct cache reads unchanged
    },

    set(key, value, ttlSeconds) {
      cache.set(key, value, ttlSeconds); // pass through direct cache writes unchanged
    },

    del(key) {
      cache.del(key); // pass through targeted cache deletes unchanged
    },

    async getOrSet(key, ttlSeconds, fn) {
      const existing = cache.get(key); // peek first so we can log hit vs miss before delegating

      if (debugEnabled) {
        console.log(
          `[cache] requestId=${requestId} ${
            existing !== null ? 'hit' : 'miss'
          } key=${key}`
        ); // structured request-aware cache log for terminal scanning
      }

      return cache.getOrSet(key, ttlSeconds, fn); // delegate actual cache behavior to the real adapter
    },

    invalidatePrefix(prefix) {
      if (debugEnabled) {
        console.log(
          `[cache] requestId=${requestId} invalidatePrefix prefix=${prefix}`
        ); // request-aware invalidation log helps when we wire admin mutations later
      }

      cache.invalidatePrefix?.(prefix); // preserve optional prefix invalidation support from the underlying adapter
    }
  };
}

// ---------- handler factory ----------

export function createGraphQLHandler() {
  const schema = createSchema({ typeDefs, resolvers }); // combine SDL + resolvers into one executable schema

  return createYoga<GraphQLContext>({
    schema, // executable schema consumed by GraphQL Yoga
    graphqlEndpoint: '/graphql', // keep the endpoint explicit for server/router clarity
    graphiql: process.env.NODE_ENV !== 'production', // enable GraphiQL outside production
    context: async initialContext => {
      const ctx = createGraphQLContext(initialContext); // build the per-request dependency container first

      ctx.cache = decorateCacheWithRequestLogging(ctx.cache, ctx.requestId); // preserve full cache interface while adding request-aware logs

      return ctx; // return the finished context for this request
    }
  });
}
