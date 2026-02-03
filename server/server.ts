/* ================================
  TL;DR  -->  express bootstrap + routes

  - sets up express middleware
  - mounts /api/health and /graphql
================================ */


import 'dotenv/config';  // load once and first so middleware have access to the api keys
import express from 'express';
import type {  Request, Response,  NextFunction,  ErrorRequestHandler, } from 'express';
import cors from 'cors';
import { createGraphqlHandler } from './graphql';


const app = express();
const host = process.env.HOST ?? "http://localhost";
const port = Number(process.env.SERVER_PORT ?? 4001);


// ----------  middleware  ----------

app.use(cors());  // allow cross-origin requests from the vite dev server
app.use("/api", express.json());  // automatically parse json bodies only for REST routes


// ----------  server health check  ----------

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'graphql-server',
  });
});


// ----------  graphQL  ----------

  // Create GraphQL handler (no DB connection at import time!)
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


// ----------  other routes  ----------




// ----------  global error handler (must be last)  ----------

const globalErrorHandler: ErrorRequestHandler = ( error: unknown,  request: Request,  response: Response,  next: NextFunction, ) => {
    console.error('[server error]', error); // log for dev debugging

    // safe message (avoid leaking secrets)
    const message = error instanceof Error ? error.message : 'unknown middleware error';

    response.status(400).json({
      ok: false,
      error: message,
    });
  }

app.use(globalErrorHandler);


// Start server
app.listen(port, () => {
  console.log(`🚀  Trust Center server is listening on port:  ${port}`);
  console.log(`📊  GraphQL endpoint:  ${host}:${port}/graphql`);
  console.log(`❤️  Health check:  ${host}:${port}/api/health`);
});