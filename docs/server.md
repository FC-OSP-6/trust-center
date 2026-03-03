# Server

## Scope

The `server` layer is an Express application that exposes a small REST surface for health checks and mounts GraphQL Yoga at `/graphql`. It is intentionally thin at the HTTP layer and relies on the GraphQL and services layers for most application behavior.

## Current Architecture

Primary files and folders:

- `server/server.ts`
- `server/graphql/`
- `server/services/`
- `server/db/`
- `server/cache/`
- `server/auth/`
- `server/ai/`

The server currently acts as:

- HTTP bootstrap and middleware host
- GraphQL mounting point
- operational boundary for logging and error handling
- integration point for DB, cache, auth, and service modules

### Data Flow

1. HTTP request received.
2. GraphQL handler executes.
3. Resolver delegates to service.
4. Cache lookup occurs.
5. DB queried if cache miss.
6. Result cached.
7. Response returned.

## Entry Point and Boot

`server/server.ts` exports:

- `createServer()`
- `startServer()`

`createServer()` builds the Express app without listening. `startServer()` attaches the listener.

This split is a good testing decision because integration tests can boot the app without opening a long-lived process.

## Middleware Stack

The current middleware stack is intentionally small:

- `cors()`
- request logging
- `express.json()` for `/api` routes
- GraphQL mount
- shared 404 JSON handler
- shared 500 JSON handler

This keeps HTTP behavior legible and reduces the chance of middleware side effects becoming hard to debug.

## API Boundaries

### REST

Current REST surface:

- `GET /api/health`

The health route is intentionally DB-independent and returns a narrow JSON shape.

### GraphQL

Current GraphQL surface:

- `POST /graphql`
- GraphiQL in non-production mode

This makes GraphQL the main application boundary while keeping one operationally useful REST route outside it.

## Security Considerations

The current implementation includes basic but intentional security-related choices:

- admin mutation access is denied by default
- admin access requires an environment-provided secret and request header match
- browser-exposed values are kept under `VITE_*`
- GraphiQL is gated away from production mode
- server-only environment values are read through the backend runtime

This is not a production auth model. It is a controlled prototype model for local verification and development.

## Logging and Debugging

The server logs:

- request method, URL, status, and duration
- GraphQL request start events
- request-scoped cache events when perf debugging is enabled
- DB query timing when perf debugging is enabled
- fallback-to-seed events with request IDs and reasons

This is a strong prototype-level observability setup because it gives the team enough signal to reason about performance and failure paths without requiring a full external logging stack.

## Server Module Boundaries

### `server/graphql`

Schema, resolvers, context, node mapping, and GraphQL runtime setup.

### `server/services`

The primary application logic boundary. Owns reads, writes, validation, pagination, fallback decisions, memoization, and grouped search composition.

### `server/db`

Pool management, migrations, seed execution, and explain tooling.

### `server/cache`

Cache abstraction, active LRU adapter, Redis stub, deterministic key builders, and invalidation helpers.

### `server/auth`

Header-based admin auth extraction.

### `server/ai`

Early AI and knowledge modules. Present in the repo, but not yet integrated into the primary Trust Center route flow.

## Design Highlights

- The HTTP layer is intentionally small and testable.
- The server treats GraphQL as the contract boundary, not as the place where all backend logic lives.
- Logging and performance instrumentation are tied to request IDs instead of scattered console output.
- Operational modules such as cache, DB, and auth are separated from resolver and route files.

## Tradeoffs

### Thin server shell

Benefits:

- easy to test
- low HTTP-layer complexity
- fewer places for business logic to leak into routing

Tradeoffs:

- almost all meaningful behavior lives below the server entry point
- debugging deeper issues requires understanding GraphQL and service boundaries, not just Express routes

### GraphQL-dominant backend

Benefits:

- unified contract for the frontend
- strong alignment with typed data fetching
- simpler route surface

Tradeoffs:

- backend correctness and performance depend heavily on GraphQL-service discipline
- there is less separation between "API layer" and "application layer" than in a larger REST-style service decomposition

### Admin auth

Benefits:

- enables real local verification of mutation and invalidation paths
- keeps auth complexity low during prototyping

Tradeoffs:

- not suitable for production security requirements
- reviewers must not mistake the presence of auth checks for a production-ready auth posture

## Current Challenges

- The server hosts several architectural concerns at once: GraphQL runtime, DB access, caching, fallback behavior, and emerging AI modules.
- Mutation paths are implemented, but the surrounding product surface is still read-heavy, so write-path maturity is naturally lower.
- The current server is observability-aware but not yet integrated with a structured logging or monitoring platform.

## Notable Constraints

- GraphQL is the primary API. There is no parallel REST resource model for controls or FAQs.
- The Redis adapter is not wired, so shared caching is single-process.
- AI modules exist but are not yet a primary runtime dependency of the Trust Center UI.
- The server can boot without a DB connection, but most meaningful application reads still require either the DB or explicit fallback mode.

## Stretch and Future Work

- Harden admin auth and authorization
- Connect AI modules to a stable retrieval interface
- Expand structured observability beyond console logs
- Prepare the cache and runtime model for hosted multi-instance environments
