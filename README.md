# Trust Center Prototype

## Overview

Trust Center is a full-stack prototype that centralizes cybersecurity assessment data for brokers and clients.

Cyber Quotient Evaluation (CYQU) is a cybersecurity assessment service provided by Aon Cyber Solutions. Clients submit products for risk evaluation, and the service generates structured analytics on cyber risk exposure. These outputs are used for:

- Insurance underwriting
- Sales enablement
- Vendor reviews
- Due diligence

Today, retrieving this information often requires brokers to manually request data from engineers — creating delays and inefficiencies.

Trust Center solves this by providing a unified, scannable UI where security and compliance information is immediately accessible.

This prototype focuses on:

- Structured data retrieval
- Performance optimization
- Caching strategy
- Schema integrity
- AI-assisted knowledge retrieval
- Scalable architecture patterns

## How to Run Locally

### 1. Environmental Setup

- Create a .env file and copy the contents of .env.example, filling in the required variables.

```bash
cp .env.example .env
```

Minimum required to run with a database:

- DATABASE_URL
- SERVER_PORT (defaults to 4000)
- HOST (defaults to http://localhost)
  Note: .env.example includes optional Supabase keys (client-side) and stretch AI provider config.

### 2. Install dependencies

From the root:

```bash
npm install
```

### 3. Database Setup

Run migrations:

```bash
npm run db:migrate
```

Seed the database:

```bash
npm run db:seed
```

Optional: clean apply (drops and rebuilds schema + seed flow, depending on your local DB config):

```bash
npm run db:cleanapply
```

### 4. Run the App

Runs server + client + stencil watch concurrently:

```bash
npm run dev
```

If you want only server + client (no stencil watch):

```bash
npm run dev:basic
```

Useful Scripts

```bash
npm run dev              # server + client + stencil watch
npm run dev:basic        # server + client
npm run dev:server       # server only (tsx watch)
npm run dev:client       # client only (vite)
npm run stencil          # stencil build --watch

npm run db:migrate
npm run db:seed
npm run db:cleanapply

npm run test             # vitest (server) + stencil jest tests (scaffolded)
npm run typecheck
npm run format
npm run format:check
```

### 5. Access the App

1. Git clone the repo, then navigate to the folder root.
2. In your terminal, run npm install from the repo root, then npm run dev to start the build for the server, client, and StencilJS.
3. Backend Data populates to FAQs + Controls.
4. Click the link for:

- localhost:5173/trust-center to access the UI
- localhost:4000/graphql for the Yoga GraphiQL GUI

5. Navigate between the SPA's main 4 sections: Overview, Controls, Resources, and FAQs.
6. Some cards are expandable: click "View All" or the "+" to show the rest of the contents.
7. Click on an external link or document and it will open in another tab.

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

## Why GraphQL?

- Aligns with Aon's use of GraphQL, ensuring consistency with their tech stack
- Allows the frontend to request exactly the data it needs, preventing over and under fetching
- Uses a single endpoint with a schema that is strongly typed
- Makes nested and relational data easier to query in one request
- Improves frontend-backend collaboration through a shared schema contract

## Why StencilJS?

- Aligns with Aon's use of Stencil, maintaining consistency with their architecture
- Allows for more flexibility because the web components are framework-agnostic
- Separates component prensentation (Stencil) from component behavior (React)
- Compiles to optimized, standards-based browser components
- Includes strong TypeScript support out of the box
- Reduces long-term framework lock-in risk

## Why Explicit DB Schema + Migrations?

- Enforces strict data integrity at the database layer
- Creates a single source of truth for the domain model
- Makes schema evolution safe, versioned, and reversible
- Enables predictable CI/CD deployments
- Reduces runtime validation complexity
- Improves collaboration between backend and analytics teams

## Why tests centralized in /testing?

- Separates production and test concerns clearly
- Allows shared mocks, fixtures, and integration helpers
- Encourages consistent test structure across domains
- Improves maintainability in larger repos
- Makes CI configuration cleaner
- Supports layered testing (unit, integration, API, UI)

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

## Repo Map:

```bash
├── README.md
├── package.json
├── docs/
│   ├── ai.md
│   ├── graphql.md
│   ├── db.md
│   └── server.md
│
├── client/                    # Vite + React frontend
│   └── src/
│       ├── app.tsx
│       ├── api.ts             # GraphQL client layer
│       ├── components/
│       │   ├── shared.tsx
│       │   └── sections/
│       │       ├── controls.tsx
│       │       ├── faqs.tsx
│       │       ├── overview.tsx
│       │       └── resources.tsx
│       └── assets/
│
├── server/                    # GraphQL API + backend optimization
│   ├── server.ts
│   ├── graphql/
│   │   ├── schema.ts
│   │   ├── resolvers.ts
│   │   └── mutations.ts
│   │
│   ├── services/              # Business logic layer
│   │   ├── controlsService.ts
│   │   ├── faqsService.ts
│   │   └── pagination.ts
│   │
│   ├── cache/                 # Multi-layer caching (LRU + Redis)
│   │   ├── cache.ts
│   │   ├── lru.ts
│   │   └── redis.ts
│   │
│   ├── db/
│   │   ├── migrations/
│   │   ├── seed.ts
│   │   └── data/
│   │
│   └── ai/                    # Knowledge graph + prompt layer
│       ├── graph.ts
│       ├── kb.ts
│       └── prompts.ts
│
├── stencil/                   # Web component design system
│   └── src/components/
│
└── testing/
    ├── api.test.ts
    ├── db.test.ts
    └── ui.test.tsx
```

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

> **This is an educational project developed by students at Codesmith.**
>
> - All data, content, and materials in this repository are used for **learning and demonstration purposes only**
> - This project is **not an official Aon product or service**
> - Any data presented is **sample/mock data** and does not represent actual client, business, or sensitive information
> - This repository and its contents are **not endorsed by, affiliated with, or representative of Aon plc or any of its subsidiaries**
> - Students and contributors should **not share any proprietary, confidential, or sensitive Aon information** in this public repository

## About This Project

This project was created as part of a learning experience at Codesmith in collaboration with Aon Cyber Solutions, exploring the development of a Trust Center application. The Trust Center concept is designed to provide transparency around security posture, compliance measures, and operational practices.

## License

This project is for educational purposes. Please respect intellectual property and do not use any concepts, designs, or materials for commercial purposes without appropriate permissions.
