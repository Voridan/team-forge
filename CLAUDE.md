# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Instruction

You are AI assistant/mentor here to help me develop this project from ground up.

## Project Summary

The project is a digital platform designed to improve how teams collaborate, organize their work, and communicate. It provides a unified environment where team members can coordinate tasks, communicate in real time, and track progress toward shared goals.

Core capabilities:

- **Team management and collaboration** — create/manage teams, assign tasks, organize work, monitor progress
- **Integrated communication** — in-app messaging within team spaces and online calls (WebRTC via LiveKit)
- **Performance monitoring and analytics** — activity data collection, reports on work distribution, workflow recommendations

## Architecture

Three-service hybrid architecture:

- **API Server** (Node.js 20 / NestJS / TypeScript / Prisma) — auth, teams, tasks, messaging history, notifications
- **Real-Time Service** (Node.js / Socket.IO) — chat messaging, typing/presence, call coordination, push notifications
- **Analytics Service** (Python 3.12 / FastAPI / SQLAlchemy / Celery) — data aggregation, reports, trend analysis, recommendations

Infrastructure: PostgreSQL 16, Redis 7, LiveKit (WebRTC SFU with built-in TURN/STUN), MinIO/S3 (files), Nginx (reverse proxy). All services containerized with Docker Compose.

Design docs: `docs/architecture/ARCHITECTURE.md`, `docs/architecture/API_DESIGN.md`, `docs/architecture/DOCKER.md`, and ADRs in `docs/architecture/adr/`.

## Project Structure

Monorepo with 3 services, modular (not Clean Architecture). Each NestJS module owns its controller, service, DTOs, and tests. No shared library — extract later if duplication warrants it.

```
team-forge/
├── api/                          # NestJS API Server
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/               # Guards, interceptors, filters, decorators, shared DTOs
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── teams/
│   │   │   ├── tasks/
│   │   │   ├── messaging/
│   │   │   ├── calls/            # LiveKit integration
│   │   │   └── notifications/
│   │   └── prisma/               # Prisma client module + schema
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
├── realtime/                     # Real-Time Service (Socket.IO)
│   ├── src/
│   │   ├── main.ts
│   │   ├── gateway/              # chat, presence, notification, call-signaling gateways
│   │   ├── auth/                 # WebSocket auth middleware
│   │   ├── redis/                # Redis pub/sub adapter
│   │   └── types/
│   ├── test/
│   └── package.json
├── analytics/                    # Python Analytics Service
│   ├── app/
│   │   ├── main.py
│   │   ├── core/                 # Config, database, security
│   │   ├── routers/              # reports, metrics, recommendations
│   │   ├── services/             # aggregation, trends, recommendations
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas
│   │   └── workers/              # Celery tasks
│   ├── tests/
│   └── pyproject.toml
├── docker/                       # Dockerfiles & service configs (api/, realtime/, analytics/, livekit/, nginx/)
├── docs/                         # Design docs & ADRs
├── docker-compose.yml            # Base: infra services
├── docker-compose.dev.yml        # Dev overrides
├── docker-compose.prod.yml       # Prod overrides
└── .env.example
```

## Current State

The project is in the planning/design phase. Architecture, API, and Docker designs are complete. No source code yet.
