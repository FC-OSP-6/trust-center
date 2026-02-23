/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql handler factory

  - builds yoga graphql server + schema
  - creates per-request context (db stub + auth stub + requestId)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { createYoga, createSchema } from 'graphql-yoga'; // init functions for graphql factory using yoga

import { typeDefs } from './schema'; // sdl contract  -->  source of truth for types + queries
import { resolvers } from './resolvers'; // resolver map  -->  executable behavior for schema fields

import { createGraphQLContext } from './context.ts';

// ----------  handler factory  ----------

export function createGraphQLHandler() {
  const schema = createSchema({ typeDefs, resolvers }); // schema wiring  -->  avoids graphql-modules until needed

  return createYoga<GraphQLContext>({
    schema, // executable schema  -->  required for GET GraphiQL + POST execution
    graphqlEndpoint: '/graphql', // endpoint path  -->  keeps behavior explicit
    graphiql: process.env.NODE_ENV !== 'production' // dev-only ide  -->  helps debugging during MVP
  });
}
