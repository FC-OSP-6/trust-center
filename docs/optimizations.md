# Optimizations

## Scope

Optimization decisions are distributed across the client, GraphQL context, services, cache adapters, and database design. This document covers the performance and read-path optimization strategy implemented in the repository today. It includes caching, request deduplication, deterministic keying, pagination, and DB-aware query shaping.

## Optimization Model

Optimization logic is service-owned, not resolver-owned. The implemented read path is best understood as:

```text
GraphQL resolver
  -> service
     -> request memoization
     -> shared cache
     -> DB adapter
```

## Current Optimization Layers

### Client-side request dedupe and TTL cache

`client/src/api.ts` currently includes:

- a small response cache
- TTL-based reuse
- in-flight request deduplication
- deterministic request keys

This reduces duplicate route-level fetches without introducing a larger data-fetching framework.

### Request-scoped promise memoization

`server/services/memo.ts` provides request-scoped memoization through a `Map<string, Promise<unknown>>`.

Current benefits:

- duplicate work inside one GraphQL request can collapse to a single promise
- concurrent calls reuse the same in-flight result
- failed promises are evicted so retries in the same request remain possible

This is a high-leverage optimization for GraphQL because one request can easily trigger repeated logical reads if the service layer is not careful.

### Shared cross-request cache

The server cache abstraction lives under `server/cache/`.

Current pieces:

- `cache.ts`
- `lru.ts`
- `redis.ts`
- `keys.ts`
- `invalidation.ts`
- `index.ts`

Current runtime behavior:

- active adapter: LRU
- future adapter surface: Redis stub
- current shared cache scope: process-local
- current invalidation style: prefix-based

### Deterministic key building

`server/cache/keys.ts` normalizes request identity around:

- `first`
- `after`
- `category`
- `search`
- auth scope
- grouped overview search inputs

This matters because cache value is not just about storing data. It depends on whether equivalent requests map to identical keys.

### Prefix-based invalidation

The current invalidation strategy clears entity-specific read domains through shared helpers rather than ad hoc deletion.

Benefits:

- invalidation logic is centralized
- write paths and admin invalidation mutations use the same conceptual mechanism
- services do not need to manually track every possible page key

Tradeoff:

- invalidation is intentionally coarse. It favors correctness and maintainability over hyper-granular eviction.

### Pagination as a performance choice

Cursor pagination in `server/services/pagination.ts` is part of the optimization strategy, not just an API style.

Benefits:

- aligns with ordered DB reads
- avoids offset growth costs
- keeps continuation semantics stable
- works naturally with deterministic cache identity

### DB-aware indexing

The migrations already reflect active read-path requirements:

- ordered index support on `updated_at desc, id desc`
- expression indexes on `lower(category)`
- precomputed search columns
- generated `search_vector` columns for future evolution

This is a strong sign that optimization has not been treated as an afterthought.

## Caching Strategy

### Current server-side cache behavior

The current server cache is used for DB-backed reads.

Important details:

- default TTL in service reads is 60 seconds
- only DB-backed results enter the shared cache path
- fallback seed results are intentionally excluded from shared cross-request caching
- request-aware cache logging can be enabled with `DEBUG_PERF=true`

Excluding fallback results from the shared cache is a good design choice. It prevents dev-only resilience behavior from silently becoming a long-lived cached truth source.

### Current client-side cache behavior

The client-side cache is narrower:

- intended for route-level reuse
- in-memory only
- local to a browser session
- designed to reduce repeated fetches and remount churn

## Design Highlights

- Optimization is layered by scope: per-request, cross-request, and client-side.
- Cache identity is deterministic rather than ad hoc.
- Invalidation has a shared policy surface.
- DB indexing and application query behavior are already being kept in sync.
- Grouped overview search reuses the established read path instead of bypassing it.

## Tradeoffs

### Multiple cache layers

Benefits:

- duplicate work is reduced at different scopes
- read-heavy flows benefit from fast repeat access

Tradeoffs:

- stale-data reasoning is more complex
- cache debugging requires clarity about which layer produced a hit

### Prefix invalidation instead of key-by-key invalidation

Benefits:

- simple and reliable
- easier to reason about in a prototype
- less risk of stale pages surviving a write

Tradeoffs:

- broader eviction than strictly necessary
- lower cache retention after writes

### LRU active, Redis hot-swap scaffolded

Benefits:

- local performance behavior is real and testable today
- the abstraction is in place for future evolution

Tradeoffs:

- the current cache is single-process only
- distributed or hosted deployments would not yet get shared cache coherence

### Search infrastructure ahead of active search path

Benefits:

- the schema is prepared for search evolution
- current behavior remains straightforward for the product team

Tradeoffs:

- the current search path is not yet the highest-performance path available
- moving to full-text semantics later will require careful product and query validation

## Current Challenges

- The repository already has enough optimization layers that observability matters. Without request-aware logs, debugging cache behavior would be much harder.
- The code must keep cache identity, pagination behavior, and DB ordering aligned. If one changes independently, correctness and performance can drift together.
- As the write path grows, cache invalidation discipline will matter more than raw cache size.

## Notable Constraints

- Redis hot swap is not fully implemented.
- Shared cache scope is currently one server process.
- Performance instrumentation is log-based, not a full metrics pipeline.
- No dedicated performance regression suite exists yet.

## Stretch and Future Work

- Implement the Redis adapter for shared or hosted environments
- Tighten invalidation granularity if write volume justifies it
- Validate and adopt a stronger search path
- Add repeatable performance checks around read-path behavior
