/* ================================
  TL;DR  -->  graphql handler factory

  - builds yoga graphql server + schema
  - creates per-request context (db stub + auth stub + requestId)
================================ */

import { createYoga, createSchema } from 'graphql-yoga'; // init functions for graphql factory using yoga
import type { YogaInitialContext } from 'graphql-yoga'; // context type for per-request context builder
import { randomUUID } from 'node:crypto'; // avoid uuid dependency  -->  randomized unique id generator

import { typeDefs } from './schema'; // sdl contract  -->  source of truth for types + queries
import { resolvers } from './resolvers'; // resolver map  -->  executable behavior for schema fields

// ----------  request context shape  ----------

// auth placeholder
export type AuthContext = {
  userEmail: null; // user identifier
  isAuthenticated: false; // auth flag
  isAdmin: false; // admin flag
};

// request context shape  -->  shared across all resolvers per request
export type GraphQLContext = {
  db: null; // db placeholder (Day 2)
  auth: AuthContext; // auth placeholder (Day 4)
  requestId: string; // request trace id  -->  used in logs and debugging
};

// ----------  handler factory  ----------

export function createGraphQLHandler() {
  const schema = createSchema({ typeDefs, resolvers }); // schema wiring  -->  avoids graphql-modules until needed

  return createYoga<GraphQLContext>({
    schema, // executable schema  -->  required for GET GraphiQL + POST execution
    graphqlEndpoint: '/graphql', // endpoint path  -->  keeps behavior explicit
    graphiql: process.env.NODE_ENV !== 'production', // dev-only ide  -->  helps debugging during MVP

    // per-request context builder  -->  runs once per request
    context: (initialContext: YogaInitialContext): GraphQLContext => {
      const requestId = randomUUID(); // unique id per request for tracing

      // trace log  -->  proves context exists
      console.log(
        `[gql]  ${requestId}  ${initialContext.request.method}  ${initialContext.request.url}`
      );

      // context sanity  -->  confirms required keys exist + admin is false by default
      console.log(
        `[gql ctx]  requestId=${requestId}  keys=db,auth,requestId  isAdmin=false`
      );

      return {
        db: null, // no db side effects
        auth: { userEmail: null, isAuthenticated: false, isAdmin: false }, // default auth state
        requestId // make uuid available to resolvers
      };
    }
  });
}
