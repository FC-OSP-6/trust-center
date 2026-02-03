


/* ================================

TL;DR --> express bootstrap + routes

  

- sets up express middleware

- mounts /api/health and /graphql

================================ */

  
  

/* ================================

TL;DR --> express bootstrap + routes

  

- sets up express middleware

- mounts /api/health and /graphql

================================ */

import express from 'express';

import cors from 'cors';

import { createGraphqlHandler } from './graphql'; // EP0-T4a: Import our handler factory

  

/**

* EP0-T3a: Creates the Express app WITHOUT starting it

* This is like building your LEGO tower but not placing it on the table yet

* Tests can call this to get a server without actually starting it!

*/

export function createServer() {

const app = express();

// Middleware setup

app.use(cors());

app.use(express.json());

// ============================================

// EP0-T3b: Health check route

// ============================================

app.get('/api/health', (_req, res) => {

res.status(200).json({

status: 'OK',

timestamp: new Date().toISOString(),

service: 'graphql-server',

});

});

// ============================================

// EP0-T3c: Mount GraphQL route

// ============================================

// EP0-T4: Create GraphQL handler (no DB connection at import time!)

const graphqlHandler = createGraphqlHandler();

// Mount GraphQL endpoint

app.use('/graphql', async (req, res) => {

try {

// Forward request to GraphQL Yoga handler

await graphqlHandler(req, res);

} catch (error) {

console.error('GraphQL handler error:', error);

res.status(500).json({

error: 'Internal Server Error',

message: error instanceof Error ? error.message : 'Unknown error',

});

}

});

// ============================================

// Additional routes can be added here

// ============================================

// Basic 404 handler for unmatched routes

app.use('*', (_req, res) => {

res.status(404).json({

error: 'Not Found',

message: 'Route not found',

});

});

// Return the app (but don't start it!)

return app;

}

  

/**

* EP0-T3a: Actually starts the server by calling listen()

* This is like placing your assembled LEGO tower on the table

* Production uses this, tests don't!

*/

export function startServer() {

const app = createServer(); // First, build it

const SERVER_PORT = process.env.PORT || 4000;

// Now place it on the table (start listening)

const server = app.listen(SERVER_PORT, () => {

console.log(`🚀 Server running on port ${SERVER_PORT}`);

console.log(`📊 GraphQL endpoint: http://localhost:${SERVER_PORT}/graphql`);

console.log(`❤️ Health check: http://localhost:${SERVER_PORT}/api/health`);

console.log(`⚡ GraphiQL: http://localhost:${SERVER_PORT}/graphql (when NODE_ENV !== 'production')`);

});

return server;

}

  

// Only start if this file is run directly (not imported by tests)

if (require.main === module) {

startServer();

}
