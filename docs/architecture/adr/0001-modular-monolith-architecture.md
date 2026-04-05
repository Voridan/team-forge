# ADR-001: Hybrid Modular Architecture (3 Services)

## Status
Accepted

## Context
We are building a team collaboration platform from scratch with a small team (1-3 developers). The platform has three distinct workload profiles:

1. **CRUD API** — team management, task management, auth, notifications (I/O-bound, request/response)
2. **Real-time** — chat messaging, presence, typing indicators, call signaling (persistent connections, connection-bound)
3. **Analytics** — data aggregation, trend analysis, report generation, recommendations (CPU-bound, data-heavy)

We need an architecture that:
- Is simple to develop, deploy, and debug with a small team
- Maintains clear domain boundaries for future extraction
- Allows each workload to use the best-suited technology and scale independently

## Decision
Adopt a **three-service architecture**:

1. **API Server** (Node.js / NestJS) — modular monolith containing auth, users, teams, tasks, messaging history, and notifications modules
2. **Real-Time Service** (Node.js / Socket.IO) — handles WebSocket connections, WebRTC signaling, presence
3. **Analytics Service** (Python / FastAPI) — data aggregation, reports, trend analysis, workflow recommendations

All three services share PostgreSQL and Redis. Services communicate via Redis pub/sub (events) and HTTP (analytics queries).

## Alternatives Considered

**Full Microservices (one per domain)**
- Rejected: Operational overhead (service discovery, distributed tracing, inter-service auth, separate deployments) is unjustified for a small team. We'd spend more time on infrastructure than product.

**Two services (monolith + real-time), analytics inside monolith**
- Rejected: Analytics workloads benefit from Python's data ecosystem (pandas, numpy, scikit-learn). Embedding analytics in Node.js would mean reimplementing mature Python libraries or accepting inferior tooling.

**Pure Monolith (everything in one process)**
- Rejected: WebSocket connections are long-lived and connection-bound. Data processing is CPU-bound. Mixing all three workload profiles in one process prevents independent scaling and creates resource contention.

**Serverless (AWS Lambda / Cloud Functions)**
- Rejected: Poor fit for WebSocket connections and real-time features. Cold starts add latency. Vendor lock-in conflicts with Docker-first approach.

## Consequences

### Positive
- Each service uses the language/framework best suited to its workload profile
- Simple deployment: three services + data stores, all in Docker Compose
- NestJS module system enforces clean domain boundaries within the API server
- Real-time and analytics can scale independently of the core API
- Clear path to ML-based recommendations without infrastructure changes

### Negative
- Two language ecosystems to maintain (TypeScript + Python)
- Shared database means schema changes require coordination
- Cannot deploy API modules independently (entire NestJS server redeploys)
- Inter-service communication adds some complexity vs. a pure monolith

### Neutral
- Team must maintain discipline around NestJS module boundaries
- Docker standardizes build/deploy regardless of language differences
- API contracts between services should be versioned
