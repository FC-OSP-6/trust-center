/* ================================
  TL;DR  -->  express bootstrap + routes

  - sets up express middleware
  - mounts /api/health and /graphql
================================ */


import 'dotenv/config';  // load once and first so middleware have access to the api keys
import express from 'express';  // server factory  -->  http routes + middleware
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';  // express types (for middleware)
import cors from 'cors';  // allows cross-origin requests when not using dev proxy (curl, other clients)
import path from 'node:path';  // resolve entrypoint for ESM guard
import { pathToFileURL } from 'node:url';  // convert file path to file:// url for import.meta.url
import { createGraphqlHandler } from './graphql/index';  // mounts yoga at /graphql


export function createServer() {
  const app = express();  // instance returned below for testing without a listener


  // ----------  middleware  ----------

  app.use(cors());  // allow cross-origin requests from the vite dev server
  
  // request logger (printed once per request)
  app.use((req, res, next) => {
    const startMs = Date.now();  // start timer
    res.on('finish', () => console.log(`[req]  ${req.method}  ${req.originalUrl}  ${res.statusCode}  ${Date.now() - startMs}ms`));  // log duration on response finish
    next();  // allow the request to continue through routes
  });
  
  app.use('/api', express.json());  // automatically parse json bodies only for REST routes


  // ----------  server health check  ----------

  // should not require db  -->  endpoint must always be available
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      serviceName: 'trust-center-server',
      timestamp: new Date().toISOString(),
    });
  });


  // ----------  graphQL  ----------

  const graphqlHandler = createGraphqlHandler();  // Create GraphQL handler (no DB connection at import time ! )


  // Mount GraphQL endpoint
  app.use('/graphql', async (req, res, next) => {
    try {
      // Forward request to GraphQL Yoga handler
      await graphqlHandler(req, res);
    } catch (error) {
      console.error('GraphQL handler error:', error);
      next(error);  // bubble to global error handler
    }
  });


  // ----------  other routes  ----------





  // ----------  not found (must be after routes)  ----------

  app.use((_req, res) => res.status(404).json({ ok: false, error: 'not found' }));  // keep JSON shape consistent for bad routes


  // ----------  global error handler (must be last)  ----------

  const globalErrorHandler: ErrorRequestHandler = (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    console.error('[server error]', error);  // log for debugging

    // safe message (avoid leaking secrets)
    const message = error instanceof Error ? error.message : 'unknown middleware error';

    response.status(500).json({
      ok: false,
      error: message,
    });
  };

  app.use(globalErrorHandler);

  return app;
}


export function startServer() {
  const host = process.env.HOST ?? 'http://localhost';  // for logs
  const port = Number(process.env.SERVER_PORT ?? 4000);

  // first build the server
  const app = createServer();

  // then start the server
  return app.listen(port, () => {
    console.log(`🚀  Trust Center server is listening on port:  ${port}`);
    console.log(`📊  GraphQL endpoint:  ${host}:${port}/graphql`);
    console.log(`❤️   Health check:  ${host}:${port}/api/health`);
  });
}


// entrypoint guard (reduce side-effects)  -->  tests can import createServer without starting a listener
const isEntryPoint = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (isEntryPoint) startServer();  // start only when executed directly