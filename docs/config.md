# Config

## Scope

Configuration is distributed across root-level tooling files, environment variables, tool-specific config files, and workspace settings. This document describes that configuration surface: build tools, testing frameworks, linting, formatting, CI, and development scripts.

## Configuration Model

### Root-level application config

Primary files:

- `package.json`
- `.env.example`
- `.prettierrc`
- `.gitattributes`
- `tsconfig.json`

These files define the project scripts, environment surface, formatting conventions, line-ending policy, and base TypeScript behavior.

### Build and dev config

Primary files:

- `vite.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `stencil/stencil.config.ts`

These files divide configuration by runtime concern instead of forcing one global config abstraction.

## Environment Strategy

The environment model is split between browser-visible and server-only variables.

### Browser-visible variables

Current variables with `VITE_` prefix:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`

These are documented in `.env.example` but are not the dominant path for the current React-to-Express development flow.

### Server-only variables

Current server-side variables include:

- `HOST`
- `SERVER_PORT`
- `DATABASE_URL`
- `DB_POOL_MAX`
- `DB_POOL_IDLE_TIMEOUT_MS`
- `DB_POOL_CONNECTION_TIMEOUT_MS`
- `DEBUG_PERF`
- `CACHE_ADAPTER`
- `CACHE_MAX_ITEMS`
- `ALLOW_SEED_FALLBACK`
- `ADMIN_SECRET`
- optional AI and retrieval-related variables
- optional `ADMIN_EMAIL_ALLOWLIST`

The environment surface already anticipates future work, but only a subset is active in the core Trust Center path today.

## Tooling Configuration

### Vite

`vite.config.ts` currently:

- enables the React plugin
- sets the base path to `/trust-center/`
- dedupes `react` and `react-dom`
- proxies `/graphql` and `/api/health` to the Express server
- outputs the client build to `dist`

This file is important because it encodes the current assumption that the Trust Center app is mounted under a base path, not at the web root.

### Vitest

`vitest.config.ts` currently:

- includes `testing/unit`, `testing/integration`, and colocated server tests
- excludes Playwright E2E tests and Stencil output
- defaults to the Node environment

This matches the current testing emphasis: backend logic and integration confidence first, UI test depth second.

### Playwright

`playwright.config.ts` currently:

- runs only `testing/e2e`
- points its base URL at `http://localhost:5173/trust-center/`
- starts the full stack with `npm run dev`
- reuses an existing local server outside CI
- targets installed Chrome rather than a Playwright-managed browser

This is pragmatic for local development and review demos, but it is not yet a broad cross-browser strategy.

### Stencil

`stencil/stencil.config.ts` currently:

- sets the namespace
- points to the local `tsconfig.json`
- emits both `dist` and `dist-custom-elements`
- applies a shared global stylesheet

That config supports the repository's main Stencil goal: treat the component system as a reusable custom-element layer rather than a React-only library.

## Script Surface

The current scripts are intentionally explicit.

Important scripts:

- `npm run dev`
- `npm run dev:basic`
- `npm run dev:server`
- `npm run dev:client`
- `npm run stencil`
- `npm run build`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:cleanapply`
- `npm run db:explain`
- `npm run test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:stencil`
- `npm run typecheck`

This is a good configuration choice for a reviewable prototype because each subsystem can be exercised independently.

## CI and pre-commit behavior

The repository already has lightweight hygiene automation:

- Husky pre-commit hook
- lint-staged
- Prettier formatting rules
- Git attributes for text and binary handling

The current approach favors low-friction consistency over a heavier lint-and-policy stack.

## Design Highlights

- Configuration is distributed by concern instead of hidden behind a single custom loader.
- The environment file makes the difference between browser-safe and server-only values explicit.
- Tool configs align with the architecture: Vite for the SPA, Stencil for the component system, Vitest for logic and integration, Playwright for browser smoke coverage.
- Script names are operationally useful and map closely to subsystem boundaries.

## Tradeoffs

### Distributed config instead of a central config package

Benefits:

- easier to inspect in a small-to-medium repository
- lower abstraction overhead
- tool-native configuration is clearer for maintainers

Tradeoffs:

- there is no single "configuration API" to validate or document all runtime settings
- environment and tool assumptions must be kept in sync manually

### Environment surface ahead of active implementation

Benefits:

- future AI, retrieval, and admin work already has a documented landing zone
- local setup does not need to be redesigned for each new capability

Tradeoffs:

- reviewers must distinguish active runtime config from forward-looking placeholders
- unused settings can create noise if they are not documented clearly

### Formatting-first quality gates

Benefits:

- low contributor friction
- quick wins on consistency

Tradeoffs:

- formatting does not replace semantic linting
- some code quality guarantees still depend on TypeScript and tests rather than lint rules

## Current Challenges

- The repository has multiple runtimes in play: React, Express, and Stencil. That makes local orchestration more realistic, but also increases failure modes during boot.
- The app assumes a specific base path and local proxy setup, which must stay aligned across Vite, Playwright, and route logic.
- Redis is represented in config, but the adapter is still a stub. The configuration surface is therefore slightly ahead of the operational implementation.

## Notable Constraints

- `/config` is conceptual, not physical. Configuration is intentionally distributed.
- `CACHE_ADAPTER=redis` is not usable yet.
- The current environment handling does not use a dedicated schema-validation library.
- The current repo does not define separate deployment-tier config sets beyond standard env variables.

## Stretch and Future Work

- Add environment schema validation for runtime safety
- Add lint rules alongside existing formatting checks
- Harden CI around browser coverage and mutation-path testing
- Formalize production deployment config once the hosting model is defined
