/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  GraphQL handler factory (transport layer only)

  - Builds executable GraphQL schema (typeDefs + resolvers)
  - Instantiates Yoga server
  - Injects request context factory (dependency container)
  - Does NOT construct dependencies directly
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { createYoga, createSchema } from 'graphql-yoga';

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
    context: createGraphQLContext // Per-request dependency injection
  });
}
