# ADR-003: PostgreSQL as Primary Database

## Status
Accepted

## Context
The platform manages highly relational data: users belong to teams, teams contain tasks, tasks have assignees/comments/attachments, messages belong to channels within teams, and analytics aggregate across all entities.

We need a database that:
- Provides ACID transactions for data integrity (task assignments, team membership changes)
- Handles complex relational queries with joins (analytics, reporting)
- Supports flexible data via JSON for extensible fields (task metadata, notification payloads)
- Is well-supported, cost-effective, and operationally simple

## Decision
Use **PostgreSQL 16** as the single primary database for all modules.

All modules share one PostgreSQL instance, with logical separation via schema naming conventions (e.g., table prefixes per module). This aligns with our modular monolith approach — a shared database simplifies queries that span modules (e.g., analytics aggregating across teams and tasks).

## Alternatives Considered

**MongoDB**
- Considered: Flexible schema, good for messaging data.
- Rejected: Our data is fundamentally relational (users-teams-tasks-comments). Lack of strong multi-document transactions makes maintaining referential integrity complex. PostgreSQL's JSONB covers our flexible schema needs.

**MySQL**
- Considered: Mature, widely deployed.
- Rejected: PostgreSQL offers superior JSON support (JSONB), better full-text search, richer extension ecosystem (pg_trgm, PostGIS if needed), and more advanced query features (CTEs, window functions for analytics).

**Separate databases per module**
- Considered: Stronger isolation, independent scaling.
- Rejected: Adds operational overhead (multiple backups, migrations, connection pools). Cross-module queries become expensive joins via application code. Not justified at our scale.

## Consequences

### Positive
- Single database simplifies operations, backups, and monitoring
- ACID guarantees protect data integrity across all operations
- JSONB columns provide schema flexibility where needed (task metadata, notification payloads)
- Excellent tooling: pgAdmin, psql, mature SQLAlchemy support
- Read replicas available for scaling analytics queries later

### Negative
- Single database is a shared dependency — outage affects all modules
- Schema migrations require coordination (Alembic handles this)
- Vertical scaling has limits (mitigated: read replicas, PgBouncer, future sharding)

### Neutral
- Team should use connection pooling from the start (SQLAlchemy pool + PgBouncer in production)
- Analytics queries on the primary may need to move to a read replica as data grows
