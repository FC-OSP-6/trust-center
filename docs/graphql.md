# GraphQL

## Purpose

Defines schema, resolvers, context, and GraphQL server setup.

> ### Entry Points
>
> - server/graphql/schema
> - server/graphql/resolvers
> - GraphQL server instantiation in server entry

### Internal Structure

- Type definitions.
- Query resolvers.
- Mutation resolvers.
- Context injection.

### Data Flow

1. Client sends GraphQL request.
2. Server parses query.
3. Resolver executes service logic.
4. Service interacts with cache and DB.
5. Response returned to client.

### Key Implementation Details

- Pagination logic present.
- Filtering logic implemented.
- Resolver delegates business logic to services.
- Cache wrapping applied at service layer.

### Notable Constraints

- Schema evolution requires resolver updates.
- Context object must provide service dependencies.
