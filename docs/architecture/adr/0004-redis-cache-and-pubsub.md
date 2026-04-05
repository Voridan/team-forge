# ADR-004: Redis for Caching, Sessions, and Pub/Sub

## Status
Accepted

## Context
The platform requires:
1. **Low-latency caching** for frequently accessed data (user profiles, team memberships, permissions)
2. **Pub/sub messaging** to fan out real-time events across multiple WebSocket server instances
3. **Session/token storage** for refresh token tracking and revocation
4. **Message broker** for Celery background task queue

We need a solution that can serve all four roles without adding multiple infrastructure components.

## Decision
Use **Redis 7** as a unified cache, pub/sub system, session store, and Celery message broker.

## Alternatives Considered

**RabbitMQ (for pub/sub and task queue)**
- Considered: More robust message guarantees, better for complex routing.
- Rejected: Adds another infrastructure component. Redis pub/sub is sufficient for our real-time fan-out pattern (fire-and-forget to connected clients). Celery+Redis is simpler to operate than Celery+RabbitMQ at our scale.

**Memcached (for caching)**
- Considered: Simple, proven caching solution.
- Rejected: Redis provides caching AND pub/sub AND data structures. Using Memcached would require a separate pub/sub solution.

**Kafka (for event streaming)**
- Considered: Durable event log, replay capability.
- Rejected: Massive operational overhead for our scale. Redis pub/sub covers our real-time needs. If we need durable event streaming later, Kafka can be added alongside Redis.

## Consequences

### Positive
- Single infrastructure component serves four roles (cache, pub/sub, sessions, task broker)
- Sub-millisecond read latency for cached data
- Native pub/sub enables multi-instance real-time message delivery
- Celery has first-class Redis broker support
- Simple to operate and monitor

### Negative
- Redis pub/sub is fire-and-forget — messages are lost if no subscriber is listening (acceptable: messages are persisted to PostgreSQL separately)
- Single Redis instance is a single point of failure (mitigated: Redis Sentinel or Cluster in production)
- Memory-bound — must monitor and manage cache eviction policies

### Neutral
- Redis persistence (RDB/AOF) should be configured for session data durability
- Cache invalidation strategy must be defined per module (TTL-based for most, explicit invalidation for permissions)
