# ADR-002: Hybrid Node.js + Python Stack

## Status
Accepted

## Context
We need a backend stack that supports:
- High-performance REST API with automatic documentation
- Native support for WebSocket handling and real-time features
- Strong typing and data validation
- Heavy data processing for analytics, reports, and recommendations
- Developer productivity for a small team

The platform has two distinct workload profiles:
1. **I/O-bound**: CRUD operations, real-time messaging, notifications — high concurrency, low computation
2. **CPU-bound**: Analytics aggregation, trend analysis, report generation, ML-based recommendations — heavy data processing

No single language/framework optimally serves both profiles.

## Decision
Use a **hybrid stack**:
- **Node.js 20 LTS + NestJS + TypeScript** for the core API server and real-time service
- **Python 3.12 + FastAPI** for the analytics service

### Why NestJS for the API?
- Opinionated module/controller/service architecture enforces clean boundaries
- Built-in dependency injection, guards, interceptors, and pipes
- First-class WebSocket gateway support (Socket.IO adapter)
- Swagger/OpenAPI generation via decorators
- TypeScript provides compile-time safety; Prisma generates typed DB clients

### Why FastAPI for analytics?
- Python's data ecosystem is unmatched: pandas, numpy, scipy, scikit-learn
- FastAPI is async-native with auto OpenAPI docs (consistent with NestJS API style)
- Celery (Python) is the gold standard for periodic background jobs (daily/weekly aggregations)
- Natural path to ML-based workflow recommendations

## Alternatives Considered

**Node.js for everything (including analytics)**
- Considered: Single language simplifies hiring and shared code.
- Rejected: Node.js lacks mature data processing libraries. Attempting pandas-equivalent work in JS leads to custom code that Python handles out of the box.

**Python for everything (FastAPI)**
- Considered: Excellent async model, auto OpenAPI docs, strong data science ecosystem.
- Rejected: NestJS's module system, DI, and guards provide better architecture for a complex CRUD API with many modules. Node.js event loop is more mature for handling thousands of concurrent WebSocket connections.

**Go for API + Python for analytics**
- Considered: Go offers excellent concurrency and performance.
- Rejected: Slower development velocity for CRUD-heavy applications. Less ergonomic ORM ecosystem compared to Prisma. Not justified at our scale.

## Consequences

### Positive
- Each service uses the language best suited to its workload
- TypeScript shared between API and real-time service; shared types possible in a monorepo
- Both NestJS and FastAPI generate OpenAPI specs — consistent API documentation
- Analytics service can be developed and scaled independently
- Clear path to ML features without adding new infrastructure

### Negative
- Two language ecosystems to maintain (npm + pip, different CI pipelines)
- Developers need proficiency in both TypeScript and Python
- Cannot share code directly between Node.js and Python services

### Neutral
- Docker standardizes build/deploy regardless of language
- Both services connect to the same PostgreSQL and Redis — shared data layer simplifies integration
- API contracts between services should be versioned and documented
