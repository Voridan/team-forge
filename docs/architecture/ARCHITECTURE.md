# System Architecture: Team Collaboration Platform

## 1. Requirements

### Functional Requirements

| Domain | Requirements |
|--------|-------------|
| **Auth & Users** | Registration, login (email + OAuth), password reset, profile management, role-based access (Owner, Admin, Member, Guest) |
| **Teams** | Create/archive teams, invite/remove members, assign roles, team settings |
| **Tasks** | Create/assign/update tasks, due dates, priorities, statuses, subtasks, comments, attachments, board and list views |
| **Messaging** | Real-time 1:1 and team channel messaging, message history, read receipts, typing indicators, file sharing |
| **Calls** | Audio/video calls within teams, screen sharing (via WebRTC with SFU) |
| **Analytics** | Activity tracking, task completion metrics, workload distribution reports, productivity trends, workflow recommendations |
| **Notifications** | In-app, email, and push notifications for task assignments, mentions, deadlines, messages |

### Non-Functional Requirements

| Category | Target |
|----------|--------|
| **Performance** | API response < 200ms p95, WebSocket message delivery < 100ms |
| **Availability** | 99.9% uptime (8.76h downtime/year) |
| **Scalability** | 10,000 concurrent users (MVP), horizontally scalable to 100K |
| **Security** | JWT auth with refresh tokens, RBAC, TLS 1.3, data encryption at rest, GDPR-aware |
| **Reliability** | RPO: 1 hour, RTO: 4 hours, daily backups |
| **Observability** | Structured logging, metrics collection, distributed tracing |

### Constraints

- Small team (1-3 developers initially)
- Greenfield project — no legacy dependencies
- Must support web clients (mobile apps later)
- Budget-conscious infrastructure

---

## 2. Architecture Pattern: Hybrid Modular Monolith

Given the small team size and greenfield nature, we adopt a **modular monolith** for the core API (Node.js), a **separate real-time service** (Node.js) for WebSocket/WebRTC traffic, and a **dedicated analytics service** (Python) for data-heavy processing.

### Why three services?

| Service | Language | Rationale |
|---------|----------|-----------|
| **API Server** | Node.js / NestJS | CRUD operations, auth, team/task management — benefits from NestJS module system, TypeScript, and fast I/O |
| **Real-Time Service** | Node.js | WebSocket connections are long-lived and connection-bound. Separating from the API allows independent scaling. Same language/ecosystem simplifies shared logic. |
| **Analytics Service** | Python / FastAPI | Data aggregation, report generation, workflow recommendations — Python's data ecosystem (pandas, numpy, scipy, scikit-learn) is unmatched for this workload |

### Why not full microservices?

Microservices add operational complexity (service discovery, distributed tracing, inter-service auth, deployment orchestration) that is unjustified for a small team. Three services is a pragmatic middle ground — each exists because it has fundamentally different runtime characteristics, not for organizational reasons.

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client (SPA)                                │
│                       React / Next.js                                │
└──┬──────────────┬────────────────┬───────────────┬───────────────────┘
   │ HTTPS        │ WSS            │ HTTPS         │ WebRTC media
   │ (REST)       │ (Socket.IO)    │ (REST)        │ + LiveKit signaling
   ▼              ▼                ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Nginx (Reverse Proxy / LB)                       │
│    /api/* → API Server       /ws/* → Real-Time Service               │
│    /analytics/* → Analytics  /livekit/* → LiveKit (port 7880)        │
└──┬──────────────┬────────────────┬───────────────┬───────────────────┘
   │              │                │               │
   ▼              ▼                ▼               ▼
┌────────────┐ ┌────────────────┐ ┌─────────────┐ ┌─────────────────┐
│ API Server │ │ Real-Time Svc  │ │ Analytics   │ │ LiveKit (SFU)   │
│ (NestJS)   │ │ (Node+Socket.IO│ │ (FastAPI)   │ │ (WebRTC media)  │
│            │ │                │ │             │ │                 │
│┌──────────┐│ │- Chat messaging│ │- Ingest     │ │- Room mgmt      │
││ Auth     ││ │- Typing/presenc│ │- Aggregation│ │- Media routing   │
│├──────────┤│ │- Notifications │ │- Reports    │ │- Simulcast       │
││ Teams    ││ │- Call coord.   │ │- Trends     │ │- Recording       │
│├──────────┤│ │               │ │- Recommend. │ │                 │
││ Tasks    ││ └───────┬────────┘ └──────┬──────┘ └────────┬────────┘
│├──────────┤│         │                 │                 │
││ Messaging││         │                 │          ┌──────▼────────┐
││ (history)││         │                 │          │   coturn       │
│├──────────┤│         │                 │          │  (TURN/STUN)  │
││ Notif.   ││         │                 │          │  NAT traversal│
│└──────────┘│         │                 │          └───────────────┘
└──────┬─────┘         │                 │
       │               │                 │
       ▼               ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Data Layer                                   │
│                                                                      │
│  ┌──────────────┐    ┌──────────┐    ┌────────────────┐             │
│  │ PostgreSQL   │    │  Redis   │    │  S3 / MinIO    │             │
│  │ (primary DB) │    │  (cache, │    │ (file storage  │             │
│  │              │    │   pub/sub,│    │  + call        │             │
│  │              │    │   queues) │    │  recordings)   │             │
│  └──────────────┘    └──────────┘    └────────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Core API** | Node.js 20 LTS / NestJS / TypeScript | Opinionated module system aligns with modular monolith, excellent I/O perf, TypeScript safety |
| **ORM** | Prisma | Type-safe DB access, auto-generated TypeScript types, declarative migrations |
| **Analytics API** | Python 3.12 / FastAPI | Async REST API, auto OpenAPI docs, access to pandas/numpy/scikit-learn |
| **Analytics ORM** | SQLAlchemy 2.0 + Alembic | Mature async support, complex analytical queries |
| **Primary DB** | PostgreSQL 16 | ACID transactions, JSONB, excellent for relational team/task data |
| **Cache / Pub-Sub** | Redis 7 | Caching, real-time pub/sub fan-out, BullMQ job broker |
| **File Storage** | MinIO (dev) / S3 (prod) | S3-compatible API, attachments and file sharing |
| **Background Jobs** | BullMQ (Node.js), Celery (Python) | BullMQ for email/notifications, Celery for analytics aggregation — each uses Redis as broker |
| **Auth** | JWT (access + refresh tokens) | Stateless auth, 15min access tokens, refresh rotation |
| **Real-Time** | Socket.IO (on NestJS WebSocket gateway) + Redis adapter | Multi-instance WebSocket fan-out via Redis pub/sub |
| **WebRTC SFU** | LiveKit (self-hosted) | Room management, media routing, simulcast, recording — complete SFU with client/server SDKs |
| **TURN/STUN** | coturn | Open-source NAT traversal server, ensures connectivity through firewalls (UDP/TCP/TLS) |
| **Reverse Proxy** | Nginx | SSL termination, path-based routing, load balancing, WebSocket proxying |
| **Containerization** | Docker + Docker Compose | Consistent environments, isolated services |

---

## 5. Service Structures

### API Server (NestJS)

```
api/
├── src/
│   ├── main.ts                    # NestJS bootstrap
│   ├── app.module.ts              # Root module — imports all domain modules
│   ├── common/                    # Shared infrastructure
│   │   ├── config/                # ConfigModule (env-based)
│   │   ├── guards/                # AuthGuard, RolesGuard
│   │   ├── interceptors/          # Logging, transform response
│   │   ├── filters/               # Exception filters
│   │   ├── decorators/            # @CurrentUser, @Roles
│   │   └── dto/                   # Shared DTOs (pagination, etc.)
│   │
│   ├── modules/
│   │   ├── auth/                  # Authentication & user management
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts # POST /auth/register, /auth/login, etc.
│   │   │   ├── auth.service.ts    # Business logic
│   │   │   ├── strategies/        # JWT strategy, OAuth strategies
│   │   │   └── dto/               # RegisterDto, LoginDto, etc.
│   │   │
│   │   ├── users/                 # User profile management
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── teams/                 # Team management
│   │   │   ├── teams.module.ts
│   │   │   ├── teams.controller.ts
│   │   │   ├── teams.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── tasks/                 # Task management
│   │   │   ├── tasks.module.ts
│   │   │   ├── tasks.controller.ts
│   │   │   ├── tasks.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── messaging/             # Message persistence & history
│   │   │   ├── messaging.module.ts
│   │   │   ├── messaging.controller.ts
│   │   │   ├── messaging.service.ts
│   │   │   └── dto/
│   │   │
│   │   └── notifications/         # Notification management
│   │       ├── notifications.module.ts
│   │       ├── notifications.controller.ts
│   │       ├── notifications.service.ts
│   │       └── dto/
│   │
│   └── prisma/                    # Prisma client module
│       ├── prisma.module.ts
│       ├── prisma.service.ts
│       └── schema.prisma          # Database schema
│
├── test/                          # e2e tests
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### Real-Time Service (Node.js)

```
realtime/
├── src/
│   ├── main.ts                    # Server bootstrap
│   ├── gateway/                   # Socket.IO gateway
│   │   ├── chat.gateway.ts        # Message handling
│   │   ├── presence.gateway.ts    # Online/typing status
│   │   ├── notification.gateway.ts
│   │   └── call-signaling.gateway.ts  # WebRTC signaling
│   ├── auth/                      # WebSocket auth middleware
│   ├── redis/                     # Redis pub/sub adapter
│   └── types/                     # Shared event types
├── package.json
└── tsconfig.json
```

### Analytics Service (Python / FastAPI)

```
analytics/
├── app/
│   ├── main.py                    # FastAPI entry point
│   ├── core/
│   │   ├── config.py              # Settings (pydantic-settings)
│   │   ├── database.py            # SQLAlchemy async engine
│   │   └── security.py            # Service-to-service auth validation
│   │
│   ├── routers/
│   │   ├── reports.py             # GET /analytics/reports/...
│   │   ├── metrics.py             # GET /analytics/metrics/...
│   │   └── recommendations.py     # GET /analytics/recommendations/...
│   │
│   ├── services/
│   │   ├── aggregation.py         # Data aggregation logic
│   │   ├── trends.py              # Trend analysis (pandas)
│   │   └── recommendations.py     # Workflow recommendations
│   │
│   ├── models/                    # SQLAlchemy models
│   ├── schemas/                   # Pydantic schemas
│   │
│   └── workers/                   # Celery tasks
│       ├── celery_app.py
│       ├── aggregate_daily.py     # Periodic aggregation
│       └── generate_reports.py    # Scheduled report generation
│
├── requirements.txt
├── pyproject.toml
└── tests/
```

---

## 6. Inter-Service Communication

```
┌────────────┐   activity events   ┌────────────┐
│ API Server │ ──── (Redis) ─────▶ │ Analytics  │
│  (NestJS)  │                     │  (FastAPI) │
│            │ ◀── HTTP GET ────── │            │
│            │  (reports/metrics)   │            │
└─────┬──────┘                     └────────────┘
      │
      │  Redis pub/sub (chat events, notifications)
      ▼
┌────────────┐
│ Real-Time  │
│  Service   │
└────────────┘
```

| Path | Mechanism | Pattern |
|------|-----------|---------|
| API → Real-Time | Redis pub/sub | API publishes events (task assigned, new comment); real-time service pushes to connected clients |
| API → Analytics | Redis event stream | API publishes activity events; analytics service consumes and aggregates |
| Client → Analytics | HTTP via Nginx | Client requests reports/dashboards; Nginx routes `/analytics/*` to FastAPI |
| Analytics → DB | SQLAlchemy (read-heavy) | Analytics reads from PostgreSQL, writes aggregated results back |
| Real-Time → API | Redis pub/sub | Real-time service publishes messages; API server persists to DB via BullMQ worker |

---

## 7. Data Flow Patterns

### Request/Response (REST API)
```
Client → Nginx → NestJS Controller → Guard (auth) → Service → Prisma → PostgreSQL
       → DTO transform → Client
```

### Real-Time Messaging
```
Client A (Socket.IO) → Real-Time Service → Redis Pub/Sub → Real-Time Service → Client B
                                         ↓
                            Redis stream → API Server (BullMQ worker) → PostgreSQL (persist)
                                         ↓
                            Redis stream → Analytics Service (activity event)
```

### Analytics Pipeline
```
Activity events (Redis) → Celery worker → Aggregation (pandas) → PostgreSQL (aggregated tables)
                                                                ↓
Client → Nginx → FastAPI → Read aggregated data → Response
```

---

## 8. WebRTC Architecture (Calls)

### Overview

Audio/video calls use **LiveKit** as an SFU (Selective Forwarding Unit) and **coturn** for NAT traversal. LiveKit runs as a separate service with its own signaling protocol — our real-time service coordinates call lifecycle (initiate, notify participants), but actual media flows through LiveKit.

### Component Roles

| Component | Responsibility |
|-----------|---------------|
| **API Server** | Creates LiveKit rooms, generates participant tokens (via LiveKit Node.js SDK) |
| **Real-Time Service** | Notifies users of incoming calls, coordinates join/leave events via Socket.IO |
| **LiveKit Server** | SFU — receives media from each participant, selectively forwards to others. Manages room state, quality adaptation (simulcast/dynacast), and optional recording |
| **coturn** | TURN/STUN — discovers public IPs (STUN) and relays media when direct peer-to-peer fails (TURN). Configured as LiveKit's external TURN server |
| **Client (LiveKit JS SDK)** | Connects directly to LiveKit for media, uses `livekit-client` SDK for WebRTC negotiation |

### Call Flow

```
1. User A clicks "Start Call" in team channel
   │
   ▼
2. Client → API Server: POST /api/v1/teams/{teamId}/calls
   │  API Server creates a LiveKit room (via livekit-server-sdk)
   │  API Server generates a LiveKit participant token for User A
   │  Returns: { roomName, token, livekitUrl }
   │
   ▼
3. API Server → Real-Time Service (Redis pub/sub): "call:started" event
   │  Real-Time Service pushes "call:incoming" to all team members via Socket.IO
   │
   ▼
4. User A connects to LiveKit with token
   │  Client (livekit-client SDK) → LiveKit Server (WSS signaling + WebRTC media)
   │
   │  LiveKit ←→ coturn (ICE candidates, TURN relay if needed)
   │
   ▼
5. User B joins the call
   │  Client → API Server: POST /api/v1/teams/{teamId}/calls/{callId}/join
   │  API Server generates a LiveKit token for User B
   │  Client connects to LiveKit with token
   │
   ▼
6. Media flows via LiveKit SFU
   │
   │  User A ──(audio/video)──→ LiveKit ──(selective forward)──→ User B
   │  User B ──(audio/video)──→ LiveKit ──(selective forward)──→ User A
   │
   │  If direct UDP fails (firewall/NAT):
   │  User ←──(TURN relay)──→ coturn ←──→ LiveKit
   │
   ▼
7. Call ends
   │  Last participant leaves → LiveKit closes room
   │  LiveKit webhook → API Server: room closed
   │  API Server logs call duration → Analytics Service
```

### Network Topology

```
                         ┌──────────────────┐
                         │    coturn         │
                         │  (TURN/STUN)     │
                         │  UDP: 3478       │
                         │  TCP: 3478       │
                         │  TLS: 5349       │
                         │  Relay: 49152-   │
                         │         65535    │
                         └────────┬─────────┘
                                  │ TURN relay
                                  │ (when direct fails)
                                  │
┌──────────┐   WebRTC    ┌───────▼──────────┐   WebRTC    ┌──────────┐
│ Client A │ ◄──────────►│   LiveKit SFU    │◄───────────►│ Client B │
│          │  media+sig   │                  │  media+sig  │          │
│          │  (UDP/TCP)   │  WSS: 7880       │  (UDP/TCP)  │          │
│          │              │  RTC: 7881       │             │          │
└──────────┘              │  UDP: 50000-     │             └──────────┘
                          │       60000      │
                          └──────────────────┘
                                  │
                                  │ webhooks (HTTP)
                                  ▼
                          ┌──────────────────┐
                          │   API Server     │
                          │   (NestJS)       │
                          └──────────────────┘
```

### LiveKit Integration Points

| Integration | How |
|-------------|-----|
| **Room creation** | API Server calls `RoomServiceClient.createRoom()` via `livekit-server-sdk-js` |
| **Token generation** | API Server creates signed `AccessToken` with room + participant identity, grants (publish, subscribe, screen share) |
| **Call notifications** | API Server publishes event to Redis → Real-Time Service notifies team via Socket.IO |
| **Webhooks** | LiveKit sends room/participant events to API Server endpoint (room started, participant joined/left, room closed) |
| **Recording** | LiveKit Egress API writes recordings to S3/MinIO, API Server stores metadata |
| **Client** | `@livekit/components-react` provides pre-built React UI components (video tiles, controls, screen share) |

### coturn Configuration

coturn provides STUN (public IP discovery) and TURN (media relay) for clients behind restrictive NATs or corporate firewalls.

| Setting | Value | Purpose |
|---------|-------|---------|
| **Listening port** | 3478 (UDP + TCP) | Standard STUN/TURN port |
| **TLS port** | 5349 | TURNS (TURN over TLS) for restrictive firewalls that block UDP |
| **Relay ports** | 49152-65535 | UDP port range for media relay |
| **Auth mechanism** | Time-limited credentials | API Server generates short-lived TURN credentials, passed to clients alongside LiveKit tokens |
| **Realm** | `turn.teamcollab.io` | TURN realm identifier |

LiveKit is configured with coturn's address as its external TURN server via `LIVEKIT_TURN_SERVERS` env variable. Clients receive TURN/STUN server info as part of the ICE configuration from LiveKit.

### Scaling Considerations

- **LiveKit** scales horizontally — multiple instances can serve different rooms. For large deployments, LiveKit supports multi-node routing.
- **coturn** is stateless for STUN, stateful per-relay for TURN. A single coturn instance handles thousands of concurrent relays. Scale vertically (more bandwidth) or add instances behind DNS round-robin.
- Call recordings are stored in S3/MinIO, so the SFU doesn't accumulate state.
- LiveKit's Redis integration enables multi-node room distribution.

---

## 9. Scaling Strategy

### Phase 1: MVP
- Single instance of each service (API, Real-Time, Analytics, LiveKit, coturn) behind Nginx
- Single PostgreSQL instance
- Single Redis instance
- All services in Docker Compose on a single server

### Phase 2: Growth (1K-10K users)
- Multiple API server instances (Nginx round-robin)
- Multiple real-time service instances (Redis adapter handles fan-out)
- PostgreSQL read replica for analytics queries
- BullMQ / Celery worker scaling (add workers independently)
- LiveKit multi-node (Redis-backed room distribution)
- coturn: scale vertically (bandwidth) or add instances via DNS round-robin

### Phase 3: Scale (10K+ users)
- PgBouncer for connection pooling
- Redis Cluster for pub/sub and caching
- Dedicated analytics read replica
- CDN for static assets and file downloads
- Consider Kafka if event volume outgrows Redis streams
- Dedicated coturn instances per region for lower media latency

---

## 9. Security Model

| Layer | Mechanism |
|-------|-----------|
| **Transport** | TLS 1.3 everywhere (Nginx terminates SSL) |
| **Authentication** | JWT access tokens (15min) + refresh tokens (7d, rotated) |
| **Authorization** | RBAC: Owner > Admin > Member > Guest, enforced via NestJS Guards |
| **Service-to-Service** | Shared secret / internal JWT for API → Analytics calls |
| **API Protection** | Rate limiting (Nginx + NestJS throttler), class-validator DTOs, CORS |
| **Data** | Passwords: bcrypt via argon2, Encryption at rest: PostgreSQL disk encryption |
| **WebSocket** | JWT validation on Socket.IO handshake, per-room authorization |
| **WebRTC (LiveKit)** | Signed participant tokens with scoped grants (per-room, publish/subscribe permissions) |
| **TURN (coturn)** | Time-limited credentials generated by API Server, rotated per session |

---

## 10. Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| PostgreSQL down | Full API outage | Automated failover (replication), connection retry logic |
| Redis down | No real-time messaging, degraded cache | Fallback to DB for critical paths, reconnect logic |
| Real-time service down | No live chat/notifications | Messages queued in Redis, delivered on reconnect |
| Analytics service down | No reports/dashboards | API server returns cached last-known data, events queue in Redis |
| BullMQ workers down | Delayed emails/persistence | Redis retains jobs, workers auto-recover on restart |
| File storage down | No uploads/downloads | Retry logic, queue failed uploads |
| LiveKit down | No new calls, active calls drop | Clients receive disconnect event, UI shows "call ended". Restart recovers service. No data loss (call logs already persisted via webhooks) |
| coturn down | ~10-15% of users can't join calls (those behind strict NAT) | Most users unaffected (direct UDP works). Monitor connectivity, restart coturn. Consider standby instance |
