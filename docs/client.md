# Client

## Scope

The `client` layer is a Vite + React single-page application that owns route composition, GraphQL data access, application-level theme persistence, and the integration boundary into the Stencil component system.

In the current implementation, React is intentionally the orchestration layer rather than the full visual system.

## Current Responsibilities

### Application entry points

Key files:

- `client/src/index.tsx`
- `client/src/app.tsx`

`index.tsx` boots the React tree and router. `app.tsx` defines the route table and shell behavior.

Current routes:

- `/overview`
- `/controls`
- `/resources`
- `/faqs`

Current shell behavior:

- `/` redirects to `/overview`
- known routes render the shared shell chrome
- unknown routes render a not-found view and hide shell chrome

This is a deliberate routing decision: it keeps invalid routes visually distinct and avoids rendering the Trust Center frame around unknown paths.

### Data fetching

The client-side GraphQL transport lives in `client/src/api.ts`.

It currently provides:

- a typed `graphqlFetch()` wrapper around `POST /graphql`
- query documents for controls, FAQs, and grouped overview search
- connection helpers for page-by-page reads and "fetch all" flows
- a client-side TTL cache
- in-flight request deduplication

This file is one of the more important frontend boundaries because it keeps page components thin and ensures fetch behavior stays consistent across routes.

### Page composition

Route-level sections live in `client/src/components/sections/`:

- `overview.tsx`
- `controls.tsx`
- `resources.tsx`
- `faqs.tsx`

These components are intentionally narrow. They fetch data, derive page-specific props, and pass serialized payloads into Stencil components.

### React-Stencil bridge

The shared integration layer lives in `client/src/components/shared.tsx`.

It owns:

- static content payloads for shared cards and resources
- category subnav derivation from live GraphQL data
- fragment and hash helpers
- shadow-DOM jump coordination for category navigation
- JSON serialization helpers used by Stencil props

This file is a strong example of deliberate separation of concerns. It keeps framework-bridging logic out of route files and out of the component library.

### Theme behavior

Theme state spans two layers:

- `client/src/theme.tsx` owns persistence and React-side state
- `aon-theme-toggle` emits `tc-theme-change` from the Stencil layer

Current behavior:

- theme is initialized before mount through the theme helper path
- the current theme is persisted in local storage under `tc-theme`
- React and Stencil both update `document.documentElement.dataset.theme`

## Data Flow

### Controls page example

```text
controls.tsx
  -> client/api.ts
  -> POST /graphql
  -> controlsConnection query
  -> GraphQL resolver
  -> controls service
  -> React receives ControlsConnection
  -> shared.tsx derives subnav rows
  -> controls JSON passed into <aon-control-card>
  -> Stencil parses and renders grouped categories
```

The important design choice is that the client does not ask Stencil to fetch or own route state. That responsibility stays in React.

## Registration and typing of custom elements

The application uses Stencil-generated custom elements directly in TSX. `client/src/types-frontend.ts` extends JSX intrinsic elements so the custom elements can be used with typed props.

This avoids React wrapper churn and keeps the integration layer closer to the actual browser contract.

## Proxy relevance

`vite.config.ts` proxies:

- `/graphql`
- `/api/health`

to the Express server.

That matters because the client uses relative endpoints during local development. The UI does not need to know a second backend origin, which reduces local setup friction and keeps the fetch layer environment-light.

## Design Highlights

- The route table is centralized and reused for both rendering and known-route checks.
- The data layer is explicit and typed without overcommitting to a heavier GraphQL client framework.
- Framework integration complexity is concentrated in one bridge module instead of leaking into every page.
- Theme synchronization is handled as a contract across the app shell and the component system, not as an isolated toggle widget.

## Tradeoffs

### Manual GraphQL client instead of Apollo or Relay

Benefits:

- smaller dependency surface
- transparent request flow
- simpler debugging in a prototype context

Tradeoffs:

- no normalized entity cache
- no generated hooks
- no schema-driven codegen guarantees
- more responsibility on the team to keep query documents and types aligned

### React plus Stencil instead of React-only UI

Benefits:

- clearer design-system boundary
- framework-agnostic reusable components
- stronger style encapsulation through shadow DOM

Tradeoffs:

- serialized props are runtime-validated, not compile-time validated across the boundary
- shadow-DOM navigation requires custom bridging
- debugging a route-level issue may require stepping through both React and Stencil layers

### Client cache layered on top of server cache

Benefits:

- repeated navigations and remounts are cheaper
- duplicate fetches in a single browser session are reduced

Tradeoffs:

- stale-data reasoning becomes more complex
- client and server caching policies must remain compatible once writes become more common

## Current Challenges

- Custom-element integration is smooth for rendering but more involved for navigation and event wiring.
- Shadow-DOM section scrolling requires explicit host and root coordination.
- The client can already consume richer taxonomy metadata than the UI fully exposes, which is good for forward compatibility but means some data surface is currently underused.
- The frontend is better architected than it is deeply UI-tested. Most automated confidence today is concentrated in backend and contract tests.

## Notable Constraints

- The application assumes the Vite base path `/trust-center/`.
- The client API layer expects the backend GraphQL schema to remain stable and manually maintained.
- The Stencil component boundary currently uses JSON payload props for richer objects.
- There is no route-level React state management framework beyond local component state and shared utilities.

## Stretch and Future Work

- Connect `overviewSearch` to a fuller Overview search UI
- Expand browser tests around custom-element interactions and deep-link behavior
- Reduce the amount of runtime JSON parsing at the React-Stencil boundary
- Introduce stronger frontend error-state coverage for route-level fetch failures
