# Docker Strategy: Team Collaboration Platform

## Overview

All services run in Docker containers, orchestrated via Docker Compose. We maintain two configurations:

- **`docker-compose.dev.yml`** — local development with hot reload, debug ports, mounted source code
- **`docker-compose.prod.yml`** — production-optimized with multi-stage builds, health checks, restart policies, resource limits

Both share a common **`docker-compose.yml`** base file for infrastructure services (PostgreSQL, Redis, MinIO) that are identical across environments.

---

## Container Inventory

| Service | Image | Dev Port | Prod Port | Notes |
|---------|-------|----------|-----------|-------|
| **api** | Node 20 Alpine | 3000, 9229 (debug) | 3000 | NestJS API server |
| **realtime** | Node 20 Alpine | 3001, 9230 (debug) | 3001 | Socket.IO real-time service |
| **analytics** | Python 3.12 Slim | 8000 | 8000 | FastAPI analytics service |
| **analytics-worker** | Python 3.12 Slim | — | — | Celery worker (same image as analytics) |
| **livekit** | `livekit/livekit-server` | 7880, 7881 | 7880, 7881 | WebRTC SFU |
| **coturn** | `coturn/coturn` | 3478, 5349 | 3478, 5349 | TURN/STUN server |
| **postgres** | PostgreSQL 16 Alpine | 5432 | 5432 | Primary database |
| **redis** | Redis 7 Alpine | 6379 | 6379 | Cache, pub/sub, job queues |
| **minio** | MinIO | 9000, 9001 (console) | 9000 | S3-compatible file storage |
| **nginx** | Nginx Alpine | 80, 443 | 80, 443 | Reverse proxy / load balancer |

---

## Directory Structure

```
project-root/
├── docker/
│   ├── api/
│   │   ├── Dockerfile          # Multi-stage Node.js build
│   │   └── .dockerignore
│   ├── realtime/
│   │   ├── Dockerfile          # Multi-stage Node.js build
│   │   └── .dockerignore
│   ├── analytics/
│   │   ├── Dockerfile          # Multi-stage Python build
│   │   └── .dockerignore
│   ├── nginx/
│   │   ├── nginx.conf          # Base config
│   │   ├── nginx.dev.conf      # Dev overrides
│   │   └── nginx.prod.conf     # Prod overrides (SSL, caching)
│   └── coturn/
│       └── turnserver.conf     # coturn configuration
│
├── docker-compose.yml          # Base: infrastructure services
├── docker-compose.dev.yml      # Override: dev settings
├── docker-compose.prod.yml     # Override: prod settings
└── .env.example                # Template for environment variables
```

---

## Base Configuration (`docker-compose.yml`)

Defines the shared infrastructure services used in both dev and prod.

### Services

**PostgreSQL 16**
- Image: `postgres:16-alpine`
- Volume: `postgres_data:/var/lib/postgresql/data` (named volume, persists across restarts)
- Health check: `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`
- Environment: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from `.env`

**Redis 7**
- Image: `redis:7-alpine`
- Command: `redis-server --appendonly yes` (AOF persistence for session/job durability)
- Volume: `redis_data:/data`
- Health check: `redis-cli ping`

**MinIO**
- Image: `minio/minio`
- Command: `server /data --console-address ":9001"`
- Volume: `minio_data:/data`
- Environment: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- Health check: `mc ready local`

### Network

All services share a single Docker network (`teamcollab-network`, bridge driver). Services communicate via container names as hostnames (e.g., `postgres:5432`, `redis:6379`).

---

## Development Configuration (`docker-compose.dev.yml`)

Extends base with developer-friendly settings.

### Principles
- **Hot reload**: Source code mounted as bind mounts, file watchers trigger rebuilds
- **Debug ports**: Node.js inspector ports exposed for attaching debuggers (VS Code, Chrome DevTools)
- **No build optimization**: Skip minification, enable source maps
- **All ports exposed**: Direct access to every service for debugging

### Application Services

**api (NestJS)**
- Build: `docker/api/Dockerfile` with `target: development` stage
- Volumes: `./api/src:/app/src` (bind mount source for hot reload)
- Command: `npm run start:dev` (uses `nest start --watch`)
- Ports: `3000:3000` (API), `9229:9229` (Node.js debug inspector)
- Environment: `NODE_ENV=development`
- Depends on: postgres, redis

**realtime (Socket.IO)**
- Build: `docker/realtime/Dockerfile` with `target: development`
- Volumes: `./realtime/src:/app/src`
- Command: `npm run start:dev`
- Ports: `3001:3001` (WebSocket), `9230:9230` (debug)
- Environment: `NODE_ENV=development`
- Depends on: redis

**analytics (FastAPI)**
- Build: `docker/analytics/Dockerfile` with `target: development`
- Volumes: `./analytics/app:/app/app`
- Command: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Ports: `8000:8000`
- Environment: `ENVIRONMENT=development`
- Depends on: postgres, redis

**analytics-worker (Celery)**
- Same image as analytics
- Volumes: `./analytics/app:/app/app`
- Command: `celery -A app.workers.celery_app worker --loglevel=info`
- No exposed ports
- Depends on: redis, postgres

**livekit**
- Image: `livekit/livekit-server`
- Ports: `7880:7880` (signaling), `7881:7881` (RTC), `50000-50060:50000-50060/udp` (media — small range for dev)
- Environment: `LIVEKIT_KEYS`, `LIVEKIT_TURN_SERVERS` (pointing to coturn)
- Config file mount: `./docker/livekit/livekit-dev.yaml:/etc/livekit.yaml`

**coturn**
- Image: `coturn/coturn`
- Ports: `3478:3478/udp`, `3478:3478/tcp`, `5349:5349/tcp`, `49152-49200:49152-49200/udp` (small relay range for dev)
- Config mount: `./docker/coturn/turnserver.conf:/etc/turnserver.conf`
- Environment: static credentials for dev (`TURN_USER`, `TURN_PASSWORD`)

**nginx**
- Image: `nginx:alpine`
- Ports: `80:80`
- Volumes: `./docker/nginx/nginx.dev.conf:/etc/nginx/nginx.conf`
- Depends on: api, realtime, analytics, livekit

### Development Workflow

```bash
# Start all services
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Start specific service (e.g., only API + infra)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up api postgres redis -d

# View logs
docker compose logs -f api

# Run database migrations (NestJS/Prisma)
docker compose exec api npx prisma migrate dev

# Run database migrations (Analytics/Alembic)
docker compose exec analytics alembic upgrade head

# Run API tests
docker compose exec api npm test

# Run analytics tests
docker compose exec analytics pytest

# Rebuild after dependency changes
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build api
```

---

## Production Configuration (`docker-compose.prod.yml`)

Optimized for security, performance, and reliability.

### Principles
- **Multi-stage builds**: Separate build and runtime stages, minimal final images
- **No source mounts**: Code is baked into the image at build time
- **Health checks**: Every service has a health check, dependencies use `depends_on: condition: service_healthy`
- **Restart policies**: `restart: unless-stopped` for all services
- **Resource limits**: CPU and memory limits to prevent runaway consumption
- **Non-root users**: All application containers run as non-root
- **Read-only filesystems**: Where possible, mount root filesystem as read-only
- **No debug ports**: Inspector ports not exposed

### Application Services

**api (NestJS)**
- Build: `docker/api/Dockerfile` with `target: production`
- Command: `node dist/main.js` (pre-compiled TypeScript)
- No volume mounts (code in image)
- Ports: `3000:3000` (internal only, not exposed to host — Nginx fronts it)
- Health check: `curl -f http://localhost:3000/api/v1/health || exit 1`
- Restart: `unless-stopped`
- Resource limits: `cpus: '1.0'`, `memory: 512M`
- Environment: `NODE_ENV=production`

**realtime (Socket.IO)**
- Build: `docker/realtime/Dockerfile` with `target: production`
- Command: `node dist/main.js`
- Ports: `3001:3001` (internal)
- Health check: `curl -f http://localhost:3001/health || exit 1`
- Restart: `unless-stopped`
- Resource limits: `cpus: '1.0'`, `memory: 512M`

**analytics (FastAPI)**
- Build: `docker/analytics/Dockerfile` with `target: production`
- Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4`
- Ports: `8000:8000` (internal)
- Health check: `curl -f http://localhost:8000/health || exit 1`
- Restart: `unless-stopped`
- Resource limits: `cpus: '2.0'`, `memory: 1G` (higher for data processing)

**analytics-worker (Celery)**
- Same image as analytics
- Command: `celery -A app.workers.celery_app worker --loglevel=warning --concurrency=4`
- No exposed ports
- Restart: `unless-stopped`
- Resource limits: `cpus: '2.0'`, `memory: 1G`

**livekit**
- Image: `livekit/livekit-server:v1.x` (pinned version, never `:latest`)
- Ports: `7880:7880`, `7881:7881`, `50000-60000:50000-60000/udp` (full media port range)
- Health check: LiveKit exposes a health endpoint
- Restart: `unless-stopped`
- Resource limits: `cpus: '2.0'`, `memory: 1G`

**coturn**
- Image: `coturn/coturn:latest` → pin to specific version in prod
- Ports: `3478:3478/udp`, `3478:3478/tcp`, `5349:5349/tcp`, `49152-65535:49152-65535/udp`
- Config: time-limited credentials (generated by API server, not static)
- Restart: `unless-stopped`
- Resource limits: `cpus: '1.0'`, `memory: 512M`

**nginx**
- Image: `nginx:alpine`
- Ports: `80:80`, `443:443`
- Volumes: SSL certs mount, `nginx.prod.conf`
- Restart: `unless-stopped`
- Config includes: SSL termination, gzip, caching headers, WebSocket proxy, rate limiting

### Infrastructure Services (prod overrides)

**PostgreSQL**
- Same image as base
- Additional config: `postgresql.conf` mount with tuned `shared_buffers`, `work_mem`, `max_connections`
- Backup volume mount for `pg_dump` cron
- Resource limits: `cpus: '2.0'`, `memory: 2G`

**Redis**
- Same image as base
- Config: `maxmemory 256mb`, `maxmemory-policy allkeys-lru`
- Resource limits: `cpus: '0.5'`, `memory: 512M`

---

## Dockerfile Strategy

### Node.js Services (API, Real-Time)

Multi-stage build with 3 stages:

```
Stage 1: "deps" — install all dependencies (including devDependencies)
  FROM node:20-alpine
  COPY package.json package-lock.json
  RUN npm ci

Stage 2: "build" — compile TypeScript
  FROM deps
  COPY src/ tsconfig.json nest-cli.json
  RUN npm run build

Stage 3a: "development" — dev target (hot reload)
  FROM deps
  COPY src/
  CMD ["npm", "run", "start:dev"]

Stage 3b: "production" — minimal runtime
  FROM node:20-alpine
  COPY --from=deps node_modules/ (production only: npm ci --omit=dev)
  COPY --from=build dist/
  USER node
  CMD ["node", "dist/main.js"]
```

Final production image: ~150MB (Alpine + production deps + compiled JS only).

### Python Service (Analytics)

Multi-stage build with 2 stages:

```
Stage 1: "builder" — install dependencies
  FROM python:3.12-slim
  COPY requirements.txt
  RUN pip install --no-cache-dir -r requirements.txt

Stage 2a: "development" — dev target (reload)
  FROM builder
  COPY app/
  CMD ["uvicorn", "app.main:app", "--reload", ...]

Stage 2b: "production" — minimal runtime
  FROM python:3.12-slim
  COPY --from=builder /usr/local/lib/python3.12/site-packages
  COPY app/
  USER nobody
  CMD ["uvicorn", "app.main:app", "--workers", "4", ...]
```

Final production image: ~200MB (Slim + deps + app code).

---

## Environment Variables

All configuration via environment variables (12-factor). Never baked into images.

### Variable Categories

| Category | Examples | Storage |
|----------|---------|---------|
| **Database** | `DATABASE_URL`, `POSTGRES_PASSWORD` | `.env` (dev), secrets manager (prod) |
| **Redis** | `REDIS_URL` | `.env` / secrets manager |
| **JWT** | `JWT_SECRET`, `JWT_EXPIRY` | `.env` / secrets manager |
| **LiveKit** | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` | `.env` / secrets manager |
| **coturn** | `TURN_SECRET`, `TURN_REALM` | `.env` / secrets manager |
| **MinIO/S3** | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | `.env` / secrets manager |
| **Service URLs** | `API_URL`, `ANALYTICS_URL`, `REALTIME_URL` | `.env` |

### `.env.example`

```env
# Database
POSTGRES_USER=teamcollab
POSTGRES_PASSWORD=changeme
POSTGRES_DB=teamcollab
DATABASE_URL=postgresql://teamcollab:changeme@postgres:5432/teamcollab

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# LiveKit
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret-change-in-production
LIVEKIT_URL=ws://livekit:7880

# coturn
TURN_SECRET=turn-secret-change-in-production
TURN_REALM=turn.teamcollab.io

# MinIO / S3
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=teamcollab-files

# Service URLs (for inter-service communication)
API_URL=http://api:3000
ANALYTICS_URL=http://analytics:8000
REALTIME_URL=http://realtime:3001
```

---

## Networking

### Dev Network
- Single bridge network: `teamcollab-network`
- All services on same network, communicate via container names
- All ports mapped to host for direct access

### Prod Network
- Frontend network: Nginx + application services
- Backend network: Application services + data stores
- Application services are on both networks; data stores only on backend network
- Only Nginx exposes ports to the host (80, 443)
- LiveKit and coturn expose their media ports directly (UDP traffic can't be proxied by Nginx)

```
┌── Frontend Network ──────────────────────────┐
│  Nginx ←→ API, Real-Time, Analytics, LiveKit │
└──────────────────────────────────────────────┘
        │
┌── Backend Network ───────────────────────────┐
│  API, Real-Time, Analytics ←→ PostgreSQL     │
│                              ←→ Redis        │
│                              ←→ MinIO        │
│  LiveKit ←→ Redis                            │
└──────────────────────────────────────────────┘
```

---

## Health Checks

| Service | Endpoint / Command | Interval | Timeout | Retries |
|---------|-------------------|----------|---------|---------|
| api | `GET /api/v1/health` | 30s | 5s | 3 |
| realtime | `GET /health` | 30s | 5s | 3 |
| analytics | `GET /health` | 30s | 5s | 3 |
| postgres | `pg_isready` | 10s | 5s | 5 |
| redis | `redis-cli ping` | 10s | 5s | 5 |
| minio | `mc ready local` | 30s | 5s | 3 |
| livekit | HTTP health endpoint | 30s | 5s | 3 |
| coturn | TCP port check on 3478 | 30s | 5s | 3 |

---

## Volumes

| Volume | Service | Purpose | Dev | Prod |
|--------|---------|---------|-----|------|
| `postgres_data` | postgres | Database files | Named volume | Named volume |
| `redis_data` | redis | AOF persistence | Named volume | Named volume |
| `minio_data` | minio | File storage | Named volume | Named volume |
| Source bind mounts | api, realtime, analytics | Hot reload | Bind mounts | Not used |

---

## Logging

### Development
- Docker default `json-file` logging driver
- View via `docker compose logs -f <service>`

### Production
- Structured JSON logs from all application services
- Centralized logging driver (e.g., `fluentd` or `json-file` with log rotation)
- Log rotation: `max-size: 10m`, `max-file: 3`
- Consider ELK/Loki stack for log aggregation (future enhancement)
