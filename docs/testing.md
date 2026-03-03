# Testing

## Scope

The repository uses layered testing with different tools for different concerns:

- Vitest for unit and integration testing
- Playwright for browser-level E2E checks
- Stencil's test runner for component-level testing

The current suite is strongest on backend performance and contract correctness.

## Testing Philosophy

Because the backend contract and read path are the most reused parts of the system, the current testing strategy favors confidence in the highest-risk technical areas first:

- pagination correctness
- taxonomy and seed normalization
- GraphQL contract behavior
- server bootstrap behavior
- route-level shell smoke behavior

## Current Coverage

### Unit tests

Current unit test files:

- `testing/unit/api.test.ts`
- `testing/unit/pagination.test.ts`
- `testing/unit/search-contract.test.ts`
- `testing/unit/taxonomy-seed.test.ts`

These tests currently cover:

- client-side cache and dedupe behavior
- cursor encoding and decoding
- search normalization rules
- taxonomy validation
- deterministic search-text composition

### Integration tests

Current integration files:

- `testing/integration/server.test.ts`
- `testing/integration/graphql.test.ts`
- `testing/integration/graphql-taxonomy.test.ts`
- `testing/integration/graphql-taxonomy-fallback.test.ts`
- `testing/integration/graphql-search.test.ts`

These tests currently cover:

- Express bootstrap and route contracts
- GraphQL transport and debug fields
- taxonomy-aware GraphQL behavior
- grouped search behavior
- fallback behavior under expected local failure cases

### E2E tests

Current E2E files:

- `testing/e2e/app.spec.ts`
- `testing/e2e/controls.spec.ts`

Implemented coverage today:

- root redirect to `/overview`
- shell visibility on known routes
- not-found route behavior and shell suppression

Important constraint:

- `testing/e2e/controls.spec.ts` exists but is currently empty

## Tool Usage

### Vitest

Vitest is used for:

- isolated helper validation
- server integration
- GraphQL integration
- executable contract coverage for normalization rules

This is where most of the technical confidence lives today.

### Playwright

Playwright is used for:

- browser boot verification
- route and shell smoke testing
- catching base-path and app-mount regressions

This is intentionally a light browser layer, not yet a comprehensive UX automation suite.

### Stencil runner

The repository includes `npm run test:stencil`, which maps to the Stencil spec runner. This supports component-level testing, though the broader testing story in the repository today is still centered on Vitest and Playwright.

## Design Highlights

- Tests target architectural contracts, not just superficial rendering.
- Search, taxonomy, and pagination semantics are documented in executable form.
- The app factory pattern makes server integration tests straightforward.
- Browser tests are focused on high-signal smoke paths rather than brittle, low-value selectors.

## Tradeoffs

### Backend-heavy test coverage

Benefits:

- protects the most reused logic
- gives strong confidence in the GraphQL-service-DB contract
- catches contract regressions early

Tradeoffs:

- UI interaction coverage is shallower
- some React-Stencil edge cases still depend on manual or future browser testing

### Smoke-oriented E2E rather than wide browser automation

Benefits:

- low maintenance overhead
- high signal on boot and routing failures
- faster iteration in a prototype setting

Tradeoffs:

- complex user flows are not deeply exercised
- component interaction regressions may escape unless covered elsewhere

### Multi-runner test model

Benefits:

- each tool is used where it is strongest
- backend, browser, and component concerns stay separated

Tradeoffs:

- responsibilities must stay clear
- missing coverage can hide between tool boundaries if the test plan is not explicit

## Current Challenges

- The most architecture-heavy parts of the repository are better tested than the most interaction-heavy parts.
- The React-Stencil boundary introduces UI cases that are harder to test thoroughly than ordinary React-only components.
- Mutation-path and invalidation-path testing is lighter than read-path testing.

## Notable Constraints

- E2E coverage is intentionally narrow.
- The current test suite is not a performance regression suite, even though the codebase includes performance instrumentation.
- Browser coverage is currently Chrome-focused through the local Playwright configuration.
- The test strategy assumes the main architectural risk is in backend correctness, not visual polish.

## Stretch and Future Work

- Implement meaningful browser coverage in `testing/e2e/controls.spec.ts`
- Add mutation and invalidation integration tests
- Expand Stencil component tests around prop parsing and event emission
- Add higher-signal tests for subnav and shadow-DOM navigation behavior
