# DB

## Scope

The database layer (DB) is PostgreSQL-backed and owns persistence for controls and FAQs, schema evolution through SQL migrations, and seed normalization for local and CI environments. The `/db` folder supports the Trust Center read and write paths by treating the database as an active part of the architecture rather than passive storage.

## Current Architecture

Primary files:

- `server/db/index.ts`
- `server/db/seed.ts`
- `server/db/explainReadPaths.ts`
- `server/db/migrations/001_init.sql`
- `server/db/migrations/002_indexes.sql`
- `server/db/migrations/003_taxonomy.sql`

The DB module currently owns:

- lazy pool creation
- environment validation for DB config
- shared query execution
- migration application and tracking
- seed execution
- request-scoped timed query wrappers for perf tracing

## Database Choice

The repository uses PostgreSQL via Supabase through `pg`.

Why this is appropriate for the current implementation:

- relational structure fits controls and FAQs well
- SQL migrations are a strong match for explicit schema review
- the read path benefits from ordered indexes and expression indexes
- generated columns support forward-looking search work without changing the application contract

## Schema Structure

### Core tables

The current domain model is centered on:

- `public.controls`
- `public.faqs`

Both tables include:

- UUID primary key
- natural key (`control_key` or `faq_key`)
- descriptive content fields
- `category`
- `section`
- `subcategory`
- `tags`
- `search_text`
- generated `search_vector`
- audit-style timestamps
- `updated_at` plus `id` ordering support for cursor pagination

### Schema evolution

The migration sequence shows deliberate evolution:

- `001_init.sql` creates the base tables, search fields, and primary indexes
- `002_indexes.sql` adds expression indexes to align with actual `lower(category)` query behavior
- `003_taxonomy.sql` adds section and subcategory without breaking the existing category-based read path

That progression matters. It reflects a pattern of changing the schema only when the application contract has already justified the change.

## Connection Handling

`server/db/index.ts` creates the pool lazily through `getDbPool()`.

That design has two important effects:

- the process can boot far enough to serve non-DB routes like `/api/health` before failing on DB setup
- tests and scripts can import the module without immediately forcing a connection

The DB layer also exposes `closeDbPool()` so test and script processes can exit cleanly.

## Migration and Seed Strategy

### Migrations

Migrations are:

- filesystem-based
- applied in lexical order
- tracked in `schema_migrations`
- run transactionally per migration file

This keeps schema boot reproducible in local development and CI.

### Seed flow

The seed pipeline in `server/db/seed.ts` is more than a simple JSON insert. It currently:

- reads seed JSON from `server/db/data`
- validates and applies taxonomy rules
- normalizes whitespace and tags
- builds deterministic search text
- upserts via natural keys instead of naive insert-only behavior

That makes the seed layer part of the data-quality contract.

## Performance Considerations

Current performance-relevant DB choices include:

- ordered indexes on `updated_at desc, id desc`
- expression indexes on `lower(category)`
- generated `search_vector` columns
- precomputed `search_text`
- `db:explain` helper for read-path inspection

These are not generic optimizations. They are directly aligned with the implemented read path.

## Data Modeling Rationale

The current schema balances present and future needs:

- `category` remains the compatibility grouping field used by the UI and GraphQL filters
- `section` and `subcategory` introduce a richer taxonomy without forcing immediate UI redesign
- natural keys allow deterministic seeding and upsert behavior
- `search_text` keeps the current substring-search contract straightforward

## Design Highlights

- The schema is versioned and migration-driven, not code-generated ad hoc.
- Query shape and index shape are already being aligned explicitly.
- The seed path and fallback path both rely on the same taxonomy contract, reducing drift.
- Pagination requirements influenced the physical schema and indexes.

## Tradeoffs

### Explicit SQL migrations over an ORM migration layer

Benefits:

- schema is easy to inspect and review
- index choices and generated columns are first-class
- there is no abstraction leak around important SQL behavior

Tradeoffs:

- The team must manage schema evolution discipline directly
- Application types and SQL schema still need deliberate synchronization

### Richer taxonomy before full UI adoption

Benefits:

- Future search, navigation, and retrieval work has a stable data model
- The repository avoids repeated schema churn for the same concept

Tradeoffs:

- Some fields are ahead of full end-user exposure
- A richer schema surface increases the number of invariants that tests and seed logic must preserve

### Generated full-text infrastructure alongside substring search

Benefits:

- The repo is prepared for future search evolution
- Current user-facing search behavior remains simple and predictable

Tradeoffs:

- There is a gap between available schema capability and the active read-path predicate
- Reviewers must understand that the GIN infrastructure is not yet the primary search path

## Current Challenges

- Schema changes ripple through GraphQL nodes, services, seeds, and tests. The repository already reflects that coordination cost.
- Maintaining parity between DB-backed rows and fallback rows requires shared normalization and taxonomy logic.
- Search evolution must preserve user-facing behavior while improving performance. The current codebase has laid groundwork, but the contract still needs careful validation if it changes.

## Notable Constraints

- PostgreSQL is required for the intended local flow.
- `ALLOW_SEED_FALLBACK` can hide some environment or connectivity failures when enabled, so it should be used intentionally.
- Search still relies on substring matching over `search_text` in the active path.
- The current schema does not yet add section- or subcategory-specific indexes because the read path does not filter on those fields today.

## Stretch and Future Work

- Validate and adopt a stronger full-text or retrieval-oriented search path
- Extend admin-write auditing if the mutation path matures further
- Add broader query-plan verification as data volume grows
- Evolve the schema only when new query contracts justify new indexes or fields
