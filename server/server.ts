/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  express bootstrap + routes

  - sets up express middleware
  - mounts /api/health and /graphql
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import 'dotenv/config'; // load once and first so middleware have access to the api keys
import express from 'express'; // server factory  -->  http routes + middleware
import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
  Express,
  RequestHandler
} from 'express'; // express types (for middleware)
import cors from 'cors'; // allows cross-origin requests when not using dev proxy (curl, other clients)
import path from 'node:path'; // resolve entrypoint for ESM guard
import { pathToFileURL } from 'node:url'; // convert file path to file:// url for import.meta.url
import { createGraphQLHandler } from './graphql/index'; // mounts yoga at /graphql

// ---------- middleware helpers ----------

function createRequestLogger(): RequestHandler {
  return (req, res, next) => {
    const startMs = Date.now(); // start timer

    res.on('finish', () => {
      console.log(
        `[req]  ${req.method}  ${req.originalUrl}  ${res.statusCode}  ${Date.now() - startMs}ms`
      ); // log duration on response finish
    });

    next(); // allow the request to continue through routes
  };
}

const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ ok: false, error: 'not found' }); // keep JSON shape consistent for bad routes
};

const globalErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) => {
  console.error('[server error]', error); // log for debugging

  const message =
    error instanceof Error ? error.message : 'unknown middleware error'; // safe message avoids leaking non-error internals

  response.status(500).json({
    ok: false,
    error: message
  });
};

// ---------- graphql route helper ----------

function mountGraphQL(app: Express): void {
  const graphqlHandler = createGraphQLHandler(); // create graphql handler lazily during server bootstrap

  app.use('/graphql', async (req, res, next) => {
    try {
      await graphqlHandler(req, res); // forward request to graphql yoga handler
    } catch (error) {
      console.error('[graphql] handler error:', error); // keep graphql bootstrap/runtime failures visible in server logs
      next(error); // bubble to global error handler
    }
  });
}

export function createServer() {
  const app = express(); // instance returned below for testing without a listener

  // ---------- middleware ----------

  app.use(cors()); // allow cross-origin requests from the vite dev server
  app.use(createRequestLogger()); // request logger printed once per request
  app.use('/api', express.json()); // automatically parse json bodies only for REST routes

  // ---------- server health check ----------

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      serviceName: 'trust-center-server',
      timestamp: new Date().toISOString()
    });
  }); // should not require db  -->  endpoint must always be available

  // ---------- graphql ----------

  mountGraphQL(app); // mount graphql after generic middleware and before not-found handling

  // ---------- not found (must be after routes) ----------

  app.use(notFoundHandler);

  // ---------- global error handler (must be last) ----------

  app.use(globalErrorHandler);

  return app;
}

// ---------- server entry point ----------

export function startServer() {
  const host = process.env.HOST ?? 'http://localhost'; // for logs
  const port = Number(process.env.SERVER_PORT ?? 4000);
  const app = createServer(); // build the server before starting the listener

  return app.listen(port, () => {
    console.log(`🚀  Trust Center server is listening on port:  ${port}`);
    console.log(`📊  GraphQL endpoint:  ${host}:${port}/graphql`);
    console.log(`❤️   Health check:  ${host}:${port}/api/health`);
  });
}

// ---------- entrypoint guard ----------

const isEntryPoint =
  import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href; // tests can import createServer without starting a listener

if (isEntryPoint) startServer(); // start only when executed directly
