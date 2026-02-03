/* ================================
  TL;DR  -->  graphql handler factory

  - builds yoga/apollo server
  - creates per-request context (db, auth, optional loaders)
================================ */

/* ================================

TL;DR --> graphql handler factory

  

- builds yoga/apollo server

- creates per-request context (db, auth, optional loaders)

================================ */

  
  
  
  

import { createYoga, createSchema } from 'graphql-yoga';

import { useGraphQLModules } from '@envelop/graphql-modules';

//import { application } from './modules';

import { createApplication } from 'graphql-modules';

import type { YogaInitialContext } from 'graphql-yoga';

import { v4 as uuidv4 } from 'uuid';

  

// ============================================

// EP0-T4b: Define context object shape

// ============================================

  

/**

* Authentication context placeholder (Day 1)

* This shape will be populated in Day 4 without refactoring resolvers

*/

export interface AuthContext {

/** User email (null until auth integrated) */

userEmail: null;

/** Whether user is authenticated */

isAuthenticated: false;

/** Whether user has admin privileges */

isAdmin: false;

}

  

/**

* Request context object with exact top-level keys

* This stable shape ensures resolvers won't need refactoring when DB/auth are added

*/

export interface GraphQLContext {

/** Database connection placeholder (Day 2 will replace with actual DB) */

db: null;

/** Authentication context placeholder (Day 4 will populate) */

auth: AuthContext;

/** EP0-T4c: Unique request ID for tracing */

requestId: string;

}

  
  

// Simple schema definition

const typeDefs = `

type Query {

hello: String!

health: String!

}

`;

  

const resolvers = {

Query: {

hello: () => 'Hello from GraphQL!',

health: () => 'OK',

},

};

  
  
  
  
  
  
  

// ============================================

// EP0-T4a: Export handler factory with stable name

// ============================================

  

/**

* Factory function to create GraphQL handler with consistent context shape

* This ensures no DB connection is established at import time (EP0-T4d)

*/

export function createGraphqlHandler() {

// Build schema once at handler creation time

const schema = createSchema({

typeDefs: application.typeDefs,

resolvers: application.resolvers,

});

// Create and return the Yoga instance

return createYoga({

schema,

plugins: [

useGraphQLModules(application),

],

/**

* Context builder executed per request

* This is where request-specific data is created (EP0-T4d)

*/

context: (initialContext: YogaInitialContext): GraphQLContext => {

// EP0-T4c: Generate unique request ID for tracing

const requestId = uuidv4();

// Log request for tracing (would integrate with proper logger later)

console.log(`[GraphQL Request ${requestId}] ${initialContext.request.method} ${initialContext.request.url}`);

// Return stable context shape (EP0-T4b)

return {

db: null, // Placeholder - will be connected in Day 2

auth: {

userEmail: null,

isAuthenticated: false,

isAdmin: false,

},

requestId,

};

},

// Additional Yoga configuration can be added here

graphqlEndpoint: '/graphql',

graphiql: process.env.NODE_ENV !== 'production',

});

}

  

// Note: No DB connection is established at import time (EP0-T4d)

// The handler factory doesn't crash if DB env vars are missing

// because db.ts is not imported and db: null is just a placeholder

  
  

// Create the application instance

export const application = createApplication({

modules: [],

schemaBuilder: ({ typeDefs: td, resolvers: rs }) =>

createSchema({

typeDefs: td,

resolvers: rs,

}),

});

  

// Initialize with our schema

application.init({

typeDefs,

resolvers,

});