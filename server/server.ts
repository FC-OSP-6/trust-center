/* ================================
  TL;DR  -->  express bootstrap + routes

  - sets up express middleware
  - mounts /api/health and /graphql
================================ */


import 'dotenv/config';  // load once and first so middleware have access to the api keys
import express from 'express';
import type {  Request, Response,  NextFunction,  ErrorRequestHandler, } from 'express';
import cors from 'cors';


const app = express();
const host = process.env.HOST ?? "http://localhost";
const port = Number(process.env.SERVER_PORT ?? 4001);


// ----------  middleware  ----------

app.use(cors());  // allow cross-origin requests from the vite dev server
app.use(express.json());  // automatically parse json bodies


// ----------  graphQL  ----------




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
  console.log(`trust center server  -->  listening on port ${port} \n    view here:  ${host}:${port}/`);
  // console.log(`check health here:  ${host}:${port}/health`);
});