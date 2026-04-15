# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Package manager:** `bun` (required — not npm/yarn).

### Development

```bash
bun run dev              # full stack: Express server + Vite client + Stencil watcher (all three in parallel)
bun run dev:basic        # server + client only (no Stencil watcher)
bun run dev:server       # Express API only (tsx watch)
bun run dev:client       # Vite only
```

Dev URLs: UI `http://localhost:5173/trust-center/`, API `http://localhost:4000/graphql`, health `http://localhost:4000/api/health`.

### Database

```bash
bun run db:migrate       # run pending SQL migrations (server/db/migrations/)
bun run db:seed          # seed controls + faqs from JSON data files
bun run db:cleanapply    # drop + recreate schema, then migrate (destructive)
```

Requires `DATABASE_URL` in `.env`.

### Testing

```bash
bun run test             # unit + integration (vitest)
bun run test:unit        # vitest run testing/unit
bun run test:integration # vitest run testing/integration
bun run test:watch       # vitest interactive watch mode
bun run test:stencil     # Stencil component specs (jest, runs inside stencil/)
bun run test:e2e         # Playwright e2e (headless Chrome — must be installed)
bun run test:e2e:headed  # Playwright with visible browser
bun run test:e2e:smoke   # app.spec.ts only
bun run test:e2e:subnav  # controls.spec.ts only
```

To run a single vitest file: `vitest run testing/unit/pagination.test.ts`

### Type checking & formatting

```bash
bun run typecheck        # tsc --noEmit
bun run format           # prettier --write .
bun run format:check     # prettier --check .
```

Pre-commit hook runs `lint-staged` → prettier on staged files automatically.

### Build

```bash
bun run build            # build:stencil then build:client → dist/
```

## Architecture

This is a **monorepo with three runtimes** that must all run together in dev:

### 1. Express server (`server/`)

Node/Bun Express app serving two endpoints:

- `GET /api/health` — liveness check, no DB dependency
- `POST /graphql` — GraphQL Yoga handler (schema + resolvers + mutations)

Entry: `server/server.ts`. The server is started with `tsx watch` in dev and `bun` in Docker.

**GraphQL layer** (`server/graphql/`): schema SDL in `schema.ts`, read resolvers in `resolvers.ts`, admin mutation resolvers in `mutations.ts`, shared DB-row→GraphQL-node mappers in `nodeMappers.ts`. Resolvers delegate to service layer — they do not query the DB directly.

**Service layer** (`server/services/`): owns all DB queries, caching, pagination, and fallback-to-seed logic. `controlsService.ts` and `faqsService.ts` each handle their domain's read + write paths. `searchService.ts` composes both for the grouped overview search.

**Cache** (`server/cache/`): LRU cache wrapper with Redis-compatible interface; invalidation helpers per domain.

**Database** (`server/db/`): `pg` pool singleton in `index.ts`. Migrations are plain SQL files in `server/db/migrations/` run in numeric order. Seed data is JSON in `server/db/data/`.

**AI** (`server/ai/`): LangGraph orchestration pipeline (`graph.ts`), knowledge-base retrieval (`kb.ts`), prompts (`prompts.ts`). Used by the `aiAnswer` GraphQL mutation.

### 2. React client (`client/src/`)

Vite-bundled React 18 SPA served at `/trust-center/` base path with React Router. Vite proxies `/graphql` and `/api/health` to the Express server in dev.

**Data layer** (`client/src/api.ts`): single file for all client-side GraphQL fetches. Includes cache + in-flight deduplication, mock/seed fallback when the server is unreachable, and the `askAi()` helper for the AI mutation. No component should call `fetch` or GraphQL directly — all data access goes through `api.ts`.

**Types** (`client/src/types-frontend.ts`): re-exports shared node/connection types from `types-shared.ts`, adds Stencil custom-element JSX prop typings, and AI UI types (`AiUiStatus`, `AiCitationUi`, `AiAnswerUi`).

**Shared types root** (`types-shared.ts`): the single source of truth for `Control`, `Faq`, `Connection<T>`, `PageInfo`, and grouped UI helper types. Consumed by both client and server.

**Page sections** (`client/src/components/sections/`): four pages (overview, controls, faqs, resources). Each page owns its data fetch, derives subnav from fetched data, and bridges subnav click events into Stencil shadow DOM via `useSubnavJump()`.

**Shared helpers** (`client/src/components/shared.tsx`): `InfoRail` (sticky sidebar with subnav card + AI slot), `AiStub` placeholder, `makeCategoryNav`, `useSubnavJump`, `ResourceCards`, `PortalCallout`, all static copy/content, and link-card serialization helpers.

### 3. Stencil design system (`stencil/`)

A separate Bun workspace. Stencil compiles custom elements that React consumes as native HTML elements. React passes data via serialized JSON string props (not objects). The compiled output lives in `stencil/dist/` and `stencil/loader/`.

Components are organized under `stencil/src/components/`: `layout/` (navbar, header, footer, theme-toggle), `control/` (control-card, subnav-card), `faq/` (faq-card), `overview/` (expansion-card), `shared-cards/` (link-card, blue-card, title). Stencil has its own `tsconfig.json`, test runner (jest via `test:stencil`), and `stencil.config.ts`.

### Key cross-cutting patterns

**React → Stencil bridge**: React serializes data to JSON strings before passing to Stencil components as props. Stencil parses them internally. Custom events from Stencil (e.g. `aonSubnavJump`) are listened to on the custom element host with `addEventListener` — not React synthetic events.

**Mock fallback**: `shouldUseMockFallback()` in `api.ts` detects network/DB failures and transparently returns seed-data-backed responses. This keeps the UI functional without a running database.

**Layout pattern** (controls + faqs pages): `<section className="info-grid">` wraps `<InfoRail>` (sticky left rail) + `<div className="info-main">` (scrolling content). The rail contains `<aon-subnav-card>` and the AI assistant slot.

**AI contract** (`spec.md` → `plan.md`): The CyQu Assistant feature follows a strict phased implementation plan defined in `.claude/changes/`. The Contract Agent (`contract-agent.md`), UI/UX Agent (`ui-ux-agent.md`), and Reviewer Agent (`reviewer-agent.md`) each own specific phases. Do not skip or combine phases.

## Docker dev (optional)

```bash
bun run dev:docker       # build + start full stack in Docker (local Postgres)
bun run dev:docker:db:init  # after stack is up: migrate + seed inside container
bun run dev:docker:down  # tear down containers
```

Remote DB override: set `DOCKER_REMOTE_DATABASE_URL` and use `bun run dev:docker:remote`.
