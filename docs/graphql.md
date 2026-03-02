# GraphQL

## Scope

GraphQL is the primary application API surface. The repository uses GraphQL Yoga mounted on Express and organizes the API around thin resolvers, request-scoped context injection, and service-owned business logic.

## Current Architecture

Primary files:

- `server/graphql/schema.ts`
- `server/graphql/resolvers.ts`
- `server/graphql/mutations.ts`
- `server/graphql/context.ts`
- `server/graphql/index.ts`
- `server/graphql/nodeMappers.ts`

The GraphQL layer currently provides:

- typed query and mutation contracts
- per-request dependency injection
- read-path delegation to services
- mutation-path delegation to validated service writes
- request-aware cache logging
- GraphiQL outside production

## Schema Structure

### Root queries

Current queries:

- `hello`
- `health`
- `debugContext`
- `controlsConnection`
- `faqsConnection`
- `overviewSearch`

The first three are debug and verification helpers. The last three are the active application-facing contracts.

### Root mutations

Current mutations:

- `adminInvalidateControlsReads`
- `adminInvalidateFaqsReads`
- `adminCreateControl`
- `adminUpdateControl`
- `adminDeleteControl`
- `adminCreateFaq`
- `adminUpdateFaq`
- `adminDeleteFaq`

The CRUD mutations are real backend hooks, even though the full admin GUI is not yet implemented.

### Connection model

Both controls and FAQs use connection-style responses with:

- `edges`
- `pageInfo`
- `totalCount`

That gives the frontend a stable pagination contract and aligns cleanly with the current cache key strategy and DB ordering model.

## Resolver Organization

Resolvers in `resolvers.ts` are intentionally thin.

Current responsibilities:

- reject invalid cursors early
- pass normalized inputs into services
- map service results into GraphQL node shapes
- keep grouped search and connection contracts consistent
- expose debug metadata for request verification

Mutation resolvers in `mutations.ts` follow the same pattern:

- auth check at the resolver boundary
- delegate create, update, delete, and invalidation work to services or cache helpers
- return narrow payloads for easier verification

This is the right architectural posture for GraphQL in a repository of this size. The resolver layer stays readable, and operational behavior remains centralized.

## Context Injection

`context.ts` creates the per-request dependency container.

Current context fields:

- `requestId`
- `memo`
- `cache`
- `db`
- `auth`

This is effectively dependency injection for the GraphQL execution boundary.

Why this is important:

- services do not need to reach into global request state
- request-scoped memoization becomes straightforward
- logging can be correlated by request ID
- auth and cache behavior can evolve without changing every resolver signature

## Pagination Logic

Pagination is cursor-based rather than page-number based.

Current characteristics:

- deterministic ordering by `updated_at desc, id desc`
- cursor encoding based on the sort tuple
- cursor validation before service work begins
- page-size clamping through shared helpers
- shared pagination helpers reused across controls and FAQs

This is a meaningful design choice. Offset pagination would have been easier to explain, but cursor pagination is better aligned with ordered reads, stable continuation, and cache identity.

## Caching Integration

GraphQL itself is not the cache owner. The GraphQL layer participates in caching through context and service calls.

Current integration points:

- per-request memoization available through `ctx.memo`
- shared cache available through `ctx.cache`
- request-aware cache logging in `graphql/index.ts`
- mutation-driven invalidation hooks

This preserves a clean separation: the GraphQL layer injects dependencies, but services still own the cache policy.

## Error Handling Patterns

Current error handling is explicit rather than framework-magical:

- invalid cursors throw readable errors before service execution
- GraphQL transport still returns a valid GraphQL envelope
- validation failures from services surface with stable prefixes such as `VALIDATION_ERROR`
- auth failures are blocked before mutation execution
- network and boot issues remain visible in the surrounding Express layer

## Design Highlights

- GraphQL context is treated as a dependency boundary, not just a metadata object.
- Resolver responsibilities are small and consistent across read and write paths.
- Connection contracts, caching, and DB ordering are aligned.
- Grouped overview search reuses existing entity services instead of creating a second search subsystem.

## Tradeoffs

### GraphQL-first backend surface

Benefits:

- one contract surface for the UI
- easier route-specific field selection
- consistent mutation and read semantics

Tradeoffs:

- GraphQL can hide backend inefficiencies if the service layer is weak
- the schema must be maintained carefully because it becomes the primary integration contract

### Thin resolvers and heavier services

Benefits:

- performance work and validation happen in one place
- read and write logic is easier to reuse
- tests can target core behavior below the schema layer

Tradeoffs:

- services become the main concentration point for backend complexity
- poorly managed service growth could eventually require further internal modularization

### Admin-ready mutation surface before a full admin UI

Benefits:

- write paths can be verified in GraphiQL today
- backend contracts are established early

Tradeoffs:

- the repository exposes more API surface than the current user-facing UI consumes
- reviewers must distinguish "implemented backend path" from "fully integrated product feature"

## Current Challenges

- Search, pagination, and taxonomy changes all affect the GraphQL contract and require coordination across multiple layers.
- The auth model is intentionally lightweight, so mutation safety depends on clear documentation and reviewer framing.
- The API surface is already strong enough that drift between schema, shared types, and manual client queries would become expensive without continued discipline.

## Notable Constraints

- There is no GraphQL code generation pipeline in the current repository.
- Admin access is demo-grade and header-based.
- The current GraphQL layer assumes the services layer remains the single source of truth for read and write behavior.
- `overviewSearch` is implemented at the backend contract level, but its frontend use is still limited.

## Stretch and Future Work

- Wire grouped overview search into a fuller end-user experience
- Add stronger mutation-path integration coverage
- Harden auth before treating admin mutations as more than local or demo tooling
