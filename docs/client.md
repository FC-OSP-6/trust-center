# Client

## Purpose

Implements the React-based frontend consuming the GraphQL API and rendering Trust Center content.

> ### Entry Points
>
> - client/src/main.tsx
> - client/src/App.tsx

### Internal Structure

- Pages directory for route-based components.
- Hooks for data fetching.
- Theme management utilities.
- GraphQL request handling.
- Stencil component registration.

### Data Flow

1. Component triggers data fetch.
2. GraphQL request sent to backend.
3. Response stored in component state.
4. UI renders using Stencil components.

### Key Implementation Details

- Vite dev server with proxy to backend.
- TypeScript configuration present.
- Playwright E2E config.
- Vitest unit test config.
- CSS token imports applied globally.

### Notable Constraints

- Depends on backend availability.
- Stencil components must be registered before usage.
- Theme system requires token structure integrity.
