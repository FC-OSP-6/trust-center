# Server

## Purpose

Implements backend server, GraphQL endpoint, service layer, caching, and AI modules.

> ### Entry Points
>
> - server/index.ts

### Internal Structure

- GraphQL server setup.
- Service modules.
- Cache abstraction.
- Redis and LRU implementations.
- AI graph and knowledge modules.
- Middleware (if present in index): Not explicitly observable beyond GraphQL server configuration.

### Data Flow

1. HTTP request received.
2. GraphQL handler executes.
3. Resolver delegates to service.
4. Cache lookup occurs.
5. DB queried if cache miss.
6. Result cached.
7. Response returned.

### Key Implementation Details

- Explicit cache invalidation.
- Redis configuration optional.
- LRU fallback cache.
- AI directory includes graph and prompt definitions.

### Notable Constraints

- Requires Redis for distributed cache.
- Requires SQL database.
- Cache invalidation must be manually maintained.
