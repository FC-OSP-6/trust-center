/* ================================
  TL;DR  -->  graphql handler factory

  - builds yoga graphql server + schema
  - creates per-request context (db stub + auth stub + requestId)
================================ */


import { createYoga, createSchema } from 'graphql-yoga';  // init functions for graphql factory using yoga
import type { YogaInitialContext } from 'graphql-yoga';  // context type for per-request context builder
import { randomUUID } from 'node:crypto';  // avoid uuid dependency  -->  randomized unique id generator


// ----------  request context shape  ----------

// auth placeholder
export type AuthContext = { 
  userEmail: null;  // user identifier
  isAuthenticated: false;  // auth flag
  isAdmin: false;  // admin flag
};

// request context shape  -->  shared across all resolvers per request
export type GraphQLContext = {
  db: null; // db placeholder (Day 2)
  auth: AuthContext;  // auth placeholder (Day 4)
  requestId: string;  // request trace id  -->  used in logs and debugging
};


// ----------  schema + resolvers  ----------

const typeDefs = `# schema definition (SDL)  -->  must include Query root type
  type DebugContext {
    requestId: String!
    isAdmin: Boolean!
  }

  type Query {
    hello: String!
    health: String!
    debugContext: DebugContext!
  }
`;

// resolver map  -->  functions return field values for the schema
const resolvers = {
  Query: {
    hello: () => 'helloWorld  from  GraphQL!',  // placeholder  -->  proves schema executes
    health: () => 'OK',  // placeholder  -->  proves server is healthy without DB
    debugContext: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => ({ requestId: ctx.requestId, isAdmin: ctx.auth.isAdmin }),  // debug helper  -->  proves context is wired
  },
};


// ----------  handler factory  ----------

export function createGraphQLHandler() {
  // schema wiring  -->  avoids graphql-modules until needed
  const schema = createSchema({ typeDefs, resolvers }); 

  return createYoga<GraphQLContext>({ // yoga handler  -->  mounted by express at /graphql
    // executable schema  -->  required for GET GraphiQL + POST execution
    schema,

    // endpoint path  -->  keeps behavior explicit
    graphqlEndpoint: '/graphql',

    // dev-only ide  -->  helps debugging during MVP
    graphiql: process.env.NODE_ENV !== 'production', 

    // per-request context builder  -->  runs once per request
    context: (initialContext: YogaInitialContext): GraphQLContext => {
      // unique ID per request for tracing
      const requestId = randomUUID(); 
      
      // trace log  -->  proves context exists
      console.log(`[gql]  ${requestId}  ${initialContext.request.method}  ${initialContext.request.url}`);

      // context sanity  -->  confirms required keys exist + admin is false by default (remove after EP0-T4-v2)
      console.log(`[gql ctx]  requestId=${requestId}  keys=db,auth,requestId  isAdmin=false`);

      return {
        // no DB side effects
        db: null, 
        // proves isAdmin false by default
        auth: { userEmail: null, isAuthenticated: false, isAdmin: false }, 
        // make uuid available to resolvers
        requestId, 
      };
    },
  });
}
