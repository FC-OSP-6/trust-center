# Config

## Purpose

Houses configuration for build tools, testing frameworks, linting, formatting, CI, and development scripts.

> ### Entry Points
>
> - vite.config.ts
> - vitest.config.ts
> - playwright.config.ts
> - .github/workflows
> - husky/
> - ESLint and Prettier configs

### Internal Structure

- Proxy configuration for /graphql or API endpoints.
- Test runner configuration.
- CI pipeline steps.
- Pre-commit hook configuration.

### Key Implementation Details

- Vite proxy to backend server.
- Husky enforces pre-commit checks.
- GitHub Actions executes CI.
- Testing environment defined per framework.

### Notable Constraints

- Dev proxy required for local integration.
- CI dependent on script stability.
