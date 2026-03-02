# DB

## Purpose

Defines database schema, migrations, seed data, and DB utility access.

> ### Entry Points
>
> - SQL migration files.
> - Seed JSON files.
> - DB utility module.

### Internal Structure

- Migration directory.
- Seed data directory.
- Query execution utilities.
- Optional explain/read path utilities.

### Data Flow

1. GraphQL resolver calls service.
2. Service calls DB module.
3. DB executes SQL query.
4. Result returned to resolver.

### Key Implementation Details

- Migration-driven schema creation.
- Seed fallback logic.
- Explicit query utilities.
- Cache layer sits above DB access.

> Database engine: Not explicitly declared in repository root.

### Notable Constraints

- Requires external SQL database.
- Schema consistency tied to migration order.
