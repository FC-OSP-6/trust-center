# Trust Center Prototype

## Overview

> Trust Center is a full-stack cybersecurity assurance prototype that centralizes assessment data for brokers and clients in order to make it easier to retrieve, review, and discuss.

Cyber Quotient Evaluation (CYQU) is a cybersecurity assessment service provided by Aon Cyber Solutions. Clients submit products for risk evaluation, and the service generates structured analytics on cyber risk exposure. These outputs are used for:

- Insurance underwriting
- Sales enablement
- Vendor reviews
- Due diligence

Today, retrieving this information often requires brokers to manually request data from engineers — creating delays and inefficiencies. Trust Center solves this by providing a unified, scannable UI where security and compliance information is immediately accessible. The application exposes structured controls, FAQs, and supporting resources through a single browser experience backed by a GraphQL API and PostgreSQL.

This prototype focuses on:

- Structured data retrieval
- Performance optimization
- Caching strategy
- Schema integrity
- AI-assisted knowledge retrieval
- Scalable architecture patterns

Core implemented capabilities:

- route-based Trust Center UI with Overview, Controls, Resources, and FAQs
- GraphQL read APIs for controls, FAQs, and grouped overview search
- cursor-based pagination for controls and FAQs
- taxonomy-aware data model with section, category, and subcategory support
- database-backed reads with optional seed fallback for known local failure modes
- admin-ready GraphQL mutations for CRUD and cache invalidation
- layered performance controls: request memoization, shared read cache, deterministic cache keys
- token-based Stencil component system with dark/light theme support

## The Client's Wireframe Mockups

<img src="ReadMe-Images/Controls-Mockup.png" alt="Controls in Mockup" width="50%">
<img src="ReadMe-Images/Overview-Mockup.png" alt="Overview in Mockup" width="50%">
<img src="ReadMe-Images/FAQS-Mockup.png" alt="FAQs in Mockup" width="50%">

## Snapshots of Our MVP

<img src="ReadMe-Images/Controls-LightMode.png" alt="Controls in Light Mode" width="50%">
<img src="ReadMe-Images/Overview-DarkMode.png" alt="Overview in Dark Mode" width="50%">
<img src="ReadMe-Images/FAQS-Expand.png" alt="FAQs in Light Mode" width="50%">

## Documentation

- [Client](docs/client.md)
- [Config](docs/config.md)
- [Database](docs/db.md)
- [GraphQL](docs/graphql.md)
- [Optimizations](docs/optimizations.md)
- [Server](docs/server.md)
- [Stencil](docs/stencil.md)
- [Testing](docs/testing.md)

## Local Development

### Prerequisites

- Node.js compatible with the project toolchain
- npm
- PostgreSQL accessible through a `DATABASE_URL`

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

```bash
cp .env.example .env
```

Minimum variables required for the intended local path:

```env
HOST=http://localhost
SERVER_PORT=4000
DATABASE_URL=postgres://username:password@localhost:5432/trust-center
ADMIN_SECRET=replace-me
```

Additional runtime controls that already exist in the repository:

```env
DEBUG_PERF=false
CACHE_ADAPTER=lru
CACHE_MAX_ITEMS=500
ALLOW_SEED_FALLBACK=false
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=2000
```

Notes:

- `CACHE_ADAPTER=redis` is not operational yet. The adapter is a stub and will throw if selected.
- `ALLOW_SEED_FALLBACK=true` is intended for controlled local resilience, not as the default runtime mode.

### 3. Apply the schema and seed data

```bash
npm run db:migrate
npm run db:seed
```

For a full local reset:

```bash
npm run db:cleanapply
```

### 4. Start the application

Full stack watch mode (Stencil)):

```bash
npm run dev
```

Server and client only:

```bash
npm run dev:basic
```

### 5. Access the application

- UI: `http://localhost:5173/trust-center/`
  - Navigate between the SPA's main 4 sections: Overview, Controls, Resources, and FAQs.
  - Some cards are expandable: click "View All" or the "+" to show the rest of the contents.
  - Click on an external link or document and it will open in another tab.
- GraphiQL: `http://localhost:4000/graphql`
- Health endpoint: `http://localhost:4000/api/health`

### 6. Common commands

```bash
npm run dev              # server + client + stencil watch
npm run dev:basic        # server + client
npm run dev:server       # server only (tsx watch)
npm run dev:client       # client only (vite)
npm run stencil          # stencil build --watch
npm run db:migrate
npm run db:seed
npm run db:cleanapply
npm run db:explain

npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:stencil

npm run typecheck
npm run format
npm run format:check
```

## Tech Stack

### Frontend

- **React** (Vite)
- **TypeScript**
- **GraphQL (client-side queries)**
- **Stencil** (Web Component design system)
- **React Router**
- **CSS**

### Backend

- **Node.js**
- **Express**
- **GraphQL Yoga**
- **Typescript**

### Data Layer

- **PostgreSQL(pg)**
- **SQL Migrations**
- **Seed Data System**

### Caching & Performance

- **In-memory LRU Cache**
- **Request-scoped Memoization**
- **Cache abstraction layer (Redis adapter scaffolded)**

### Testing

- **Vitest (unit + server tests)**
- **Playwright (end-to-end browser testing)**

### DevOps & Tooling

- **GitHub Actions (CI)**
- **Husky (pre-commit hooks)**
- **Lint-staged**
- **Prettier**

## Repository Structure

```bash
trust-center/
│
├── README.md
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── types-shared.ts
│
├── client/                    # Vite + React frontend
│   └── src/
│       ├── app.tsx
│       ├── api.ts             # GraphQL client layer
│       ├──└── assets/
│       └── components/
│           ├── shared.tsx
│           └── sections/
│
├── server/                    # GraphQL API + backend optimization
│   ├── server.ts
│   ├── auth/
│   ├── cache/                 # Multi-layer caching (LRU + Redis)
│   ├── db/
│   ├── graphql/
│   ├── services/              # Business logic layer
│   └── ai/                    # Knowledge graph + prompt layer
│
├── stencil/                   # Web component design system
│   ├── stencil.config.ts
│   └── src/components/
│
├── testing/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── docs/
    ├── client.md
    ├── config.md
    ├── db.md
    ├── graphql.md
    ├── server.md
    ├── stencil.md
    ├── testing.md
    └── optimizations.md
```

## Architecture Overview

<img src="ReadMe-Images/Architecture_Diagram.png" alt="Architecture Diagram" width="65%">

### Runtime flow

```text
Browser
  |
  v
Vite + React shell
  |
  |  JSON props + custom events
  v
Stencil web components
  |
  |  POST /graphql
  v
Express server
  |
  v
GraphQL Yoga
  |
  v
Resolvers (thin)
  |
  v
Services
  |\
  | \-- request memoization
  | \-- shared cache (LRU)
  |
  v
DB adapter
  |
  v
PostgreSQL
```

### Frontend composition

The frontend is intentionally split into two layers:

- **React** owns routing, data fetching, page composition, URL state, and app-level theme persistence.
- **Stencil** owns reusable presentation components such as the navbar, title, footer, cards, and theme toggle.

That split allows the repository to demonstrate a framework-agnostic component layer without forcing custom elements to own routing or network logic.

### Data flow

1. React mounts a route in `client/src/app.tsx`.
2. Route components call the manual GraphQL client in `client/src/api.ts`.
3. Vite proxies `/graphql` and `/api/health` to the Express server during development.
4. GraphQL Yoga creates request context with a request ID, request-scoped memo store, shared cache, DB adapter, and auth state.
5. Thin resolvers delegate to services.
6. Services apply normalization, caching, pagination, validation, DB access, and seed fallback when enabled and appropriate.
7. Resolvers map service rows into GraphQL node shapes.
8. React serializes payloads into Stencil custom elements for rendering.

### Caching and optimization layers

The current implementation has three distinct optimization layers:

- **Client-side TTL cache and in-flight request dedupe** in `client/src/api.ts`
- **Request-scoped promise memoization** in `server/services/memo.ts`
- **Shared cross-request cache** behind `server/cache/*`, with LRU active and Redis scaffolded

This is deliberate. GraphQL reduces over-fetching at the transport layer, but it does not eliminate duplicate work inside a request or across requests. The repository addresses those concerns at different boundaries.

### Theme and token system

The component system uses tokenized styling in `stencil/src/components/styles/`:

- `tokens.css`
- `tokens-semantic.css`
- `tokens-dark.css`
- `typography.css`
- `global.css`

Dark mode is implemented and persisted today:

- Stencil renders the visible toggle
- React persists the chosen theme in local storage
- `document.documentElement.dataset.theme` is the shared switch used by the app and component system

## Key Technical Decisions

### Why choose GraphQL over REST?

GraphQL is the primary application API because the Trust Center needs one typed contract that can support multiple read shapes without multiplying route surface area.

In the current implementation, GraphQL supports:

- paginated controls
- paginated FAQs
- grouped overview search
- admin-ready mutation hooks

Why this is a good fit here:

- one endpoint keeps the client-server contract compact and easier to review
- each route can request only the fields it actually renders
- cursor-based connections align with the current read model and caching strategy
- the schema is a stable artifact for maintainers, reviewers, and future integration work

Tradeoff:

- GraphQL improves contract quality, not backend efficiency by itself. Resolver discipline, service boundaries, pagination strategy, and caching still determine whether the system performs well under load.

### Why use Stencil instead of React-only components?

Stencil is the component layer; React is the application shell.

This separation was chosen because:

- it mirrors the client partner's broader technical direction
- custom elements reduce long-term coupling between the UI library and the application shell
- page orchestration and route composition remain in React, while reusable visual primitives live in Stencil
- tokenized styling and shadow DOM provide stronger encapsulation for the design system

Tradeoff:

- React-Stencil integration is more complex than a pure React tree. Serialized props, custom event bridging, and shadow-DOM-aware navigation add coordination cost that would not exist in a React-only component model.

### Why keep business logic in services?

Resolvers are intentionally thin. The services layer owns:

- read path behavior
- pagination
- cache key selection
- invalidation
- fallback behavior
- write validation
- search normalization

Why this matters:

- the same logic can be reused across GraphQL fields instead of being duplicated in resolvers
- optimization work happens at a single architectural boundary
- the GraphQL layer stays easier to reason about, test, and extend
- read and write concerns remain closer to the data model than to the transport layer

Tradeoff:

- the service layer becomes the critical backend boundary. If it absorbs too much route-specific or schema-specific behavior, it can become overly central and harder to evolve safely.

### Why use layered caching with deterministic keys?

The cache design is built around deterministic key builders, request-scoped memoization, and centralized invalidation.

Why this is a strong choice:

- equivalent requests collapse to the same cache identity
- duplicate work can be avoided both within a request and across requests
- invalidation behavior is consistent across services and mutations
- the active LRU path is simple to run locally, while the Redis adapter preserves a path to shared caching later

Tradeoff:

- multi-layer caching increases reasoning complexity, especially once write traffic grows. Staleness, invalidation scope, and cache ownership need to remain explicit to keep behavior predictable.

### Why evolve the taxonomy now?

The database and GraphQL contracts expose section, category, and subcategory rather than preserving a flat category-only model.

Why this was worth doing now:

- the model better reflects how trust-center content is actually organized
- taxonomy validation is enforced in both seed and fallback paths
- search, grouping, and future retrieval features can build on a richer contract without another schema reset
- the API can grow without reworking the same conceptual model twice

Tradeoff:

- the current UI still leans primarily on category. Some of the richer taxonomy is infrastructure ahead of full route-level usage.

### Why centralize tests under /testing?

The repository keeps most automated tests in a dedicated `/testing` directory rather than scattering all tests across runtime folders.

Why this strategy works here:

- it separates test concerns from production code paths
- unit, integration, and browser-level coverage are easier to locate and review quickly
- shared fixtures, helpers, and environment setup can be managed consistently
- CI becomes easier to reason about because the suite structure mirrors the testing strategy directly

Tradeoff:

- centralized testing improves discoverability at the suite level, but it can reduce proximity between implementation files and their tests. That makes disciplined naming and coverage boundaries more important.

### Why use explicit schema and SQL migrations?

The database layer is managed through explicit SQL migrations and a versioned schema history instead of implicit runtime table creation.

Why this matters:

- schema changes are reviewable, ordered, and reproducible
- local development and CI can rebuild the same database state deterministically
- indexes, generated columns, and constraints stay visible as first-class design decisions
- the data model remains an explicit contract rather than an implementation side effect

Tradeoff:

- explicit migrations require coordination across the database, service layer, and GraphQL contract. That adds change-management overhead, but it also prevents silent drift between the application model and the persistence layer.

## Common Problems

1. Cache Invalidation Complexity

- Multi-layer caching (LRU + Redis + memoization) increases performance but requires careful invalidation strategy.

2. GraphQL Over-Fetching at Resolver Level

- Even though GraphQL prevents client over-fetching, poor resolver implementation can still create N+1 query issues.

3. AI Layer Determinism

- Knowledge graph + prompt processing introduces non-deterministic outputs.
- Requires guardrails and structured response formatting.

4. Schema Evolution Risk

- Changes to DB schema require coordinated updates across GraphQL schema and services.

5. Frontend–Stencil Integration Friction

- Managing type definitions between React and Web Components requires careful typing and event handling.

## Notable Implementation Constraints

- The Redis adapter exists only as an interface-aligned stub. Shared caching is currently single-process and in-memory.
- The frontend GraphQL client is manual. There is no Apollo Client, Relay, or GraphQL code generation pipeline.
- Admin auth is demo-grade and header-based. It is sufficient for local mutation verification, not production authorization.
- Seed fallback is real and centralized, but it should be treated as a controlled development aid rather than a normal runtime dependency.
- Search infrastructure is ahead of the active search path. The schema supports generated `search_vector` columns, but the current read path still uses substring matching on `search_text`.
- Browser E2E coverage is intentionally shallow. `testing/e2e/controls.spec.ts` exists but is currently empty.
- The `server/ai` folder contains early modules, but AI retrieval is not yet integrated into the main user-facing application flow.

## Findings

- Splitting React and Stencil cleanly required a strict ownership model. Without that separation, routing, state, and rendering responsibilities would have drifted across both layers.
- GraphQL transport alone did not solve backend efficiency. Request memoization, shared caching, and service reuse were necessary to make the read path predictable.
- Taxonomy work affected more than schema shape. It had to be applied consistently across migrations, seed normalization, fallback loading, GraphQL nodes, and tests.
- Cursor pagination was a worthwhile investment because it aligns better with ordered read performance and stable cache identity than page-number pagination.
- The current architecture benefits from small, explicit utilities. Cache keys, search text builders, pagination helpers, and validation functions each keep drift out of the service layer.

## Stretch and Future Work

The repository already contains clear extension points for future work:

- Wire the grouped `overviewSearch` contract into a fuller Overview search experience
- Connect the AI modules to a stable retrieval path instead of leaving them as backend-adjacent scaffolding
- Replace header-based admin auth with a stronger auth and authorization model
- Complete the Redis adapter for multi-process or hosted environments
- Expand mutation-path tests and browser interaction tests
- Move search from substring matching toward a validated full-text or retrieval-oriented path

## Golden Demo Flow

1. Broker logs into Trust Center dashboard
2. Lands on Overview page
   - High-level cyber risk summary
   - Risk score visualization
   - Quick snapshot of compliance posture

3. Navigates to Controls section
   - Filter controls by category (Access, Encryption, Network, etc.)
   - Expand a control to see:
     - Description
     - Compliance mapping
     - Risk impact
     - Supporting documentation

4. Navigates to FAQs
   - Broker searches: "Do you use MFA?"
   - GraphQL query retrieves structured answer
   - AI layer optionally enriches with contextual explanation

5. Resources section
   - Download underwriting-ready documents
   - View compliance attestations
   - Access audit summaries

6. Performance demonstration
   - Show Redis cache hit in logs
   - Demonstrate LRU fallback
   - Invalidate cache via mutation
   - Re-fetch updated data

7. Mutation demo (Admin flow)
   - Update a control
   - Observe:
     - DB write
     - Cache invalidation
     - GraphQL refetch
     - UI update

8. Testing demo
   - Run Vitest suite
   - Show integration test passing for:
     - GraphQL resolver
     - Cache layer
     - DB service

## Disclaimer

> This prototype was built as part of a client-student partnership through Codesmith’s Future Code program. It explores solutions to a real-world case study provided by an external partner. This work does not represent employment or contracting with the partner. All intellectual property belongs to the partner. This is a time-boxed MVP and not a production system.
