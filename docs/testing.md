# Testing

## Purpose

Defines unit, integration, and end-to-end testing strategy.

> ### Entry Points
>
> - vitest.config.ts
> - playwright.config.ts
> - Test directories in client and server

### Internal Structure

- Unit tests.
- Integration tests.
- E2E tests.
- CI integration for test runs.

### Key Implementation Details

- Vitest for unit and integration tests.
- Playwright for browser-level E2E.
- Test scripts integrated into package.json.
- CI executes test suites.

### Notable Constraints

- RE2E requires running backend.
- Vitest relies on Vite environment configuration.
