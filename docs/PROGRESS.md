# Progress Snapshot

Last updated: 2026-05-14

## Where we left off

Working on getting the **api running in Docker** end-to-end. The api now boots successfully in the container. Last action was generating the missing rename migration (`auth0_id` → `external_id`, `AUTH0` enum → `GOOGLE`) inside the container and re-seeding.

**Immediate next thing to verify:** the frontend (`web/`) at `http://localhost:5173` can log in as alice (`alice@example.com` / `Password123!`), view teams, etc. End-to-end smoke test of the full stack.

---

## Stack summary

- **API**: NestJS 11 / TypeScript / Prisma 7 / PostgreSQL 16
- **Web**: React 19 / Vite / Tailwind v4 / TanStack Query / Zustand / React Hook Form + Zod
- **Infra**: Docker Compose (postgres + redis + api), Prisma 7 with `prisma-client` generator + `@prisma/adapter-pg`

Auth: **local (bcrypt + own JWT)** + **direct Google OAuth** via provider abstraction. **No Auth0.**

---

## What's built

### API (api/)

| Wave | Feature | Tests |
|------|---------|-------|
| 1 | Prisma schema (User, Team, TeamMember, RefreshToken) + seed | — |
| 2 | Auth: register/login/refresh/logout + Google OAuth via provider abstraction (`OAuthProvider` interface, `GoogleProvider`, `OAuthProviderRegistry`); JWT middleware applied app-wide with auth exclusions | 25 |
| 3 | Users: `/me`, update `/me`, get by id, search | 6 |
| 4 | Teams: CRUD + RBAC via `TeamRoleGuard` + `@RequireRole`; member management (add/remove/leave/transfer-role) with last-owner protection | 24 |
| 5 | RFC 7807 problem details exception filter + `{ data: ... }` response envelope interceptor + structured ValidationPipe field errors | 12 |

**Total: 67 tests passing across 8 suites.**

Auth endpoints (all `/api/v1`):
- `POST /auth/register|login|refresh|logout`
- `POST /auth/oauth/:provider` (provider: `google`)

Users: `GET /users/me`, `PATCH /users/me`, `GET /users/:id`, `GET /users/search?q=&limit=`

Teams: `POST/GET /teams`, `GET/PATCH/DELETE /teams/:teamId`, `GET/POST /teams/:teamId/members`, `PATCH/DELETE /teams/:teamId/members/:userId`, `POST /teams/:teamId/leave`

### Web (web/)

Vite + React 19 SPA. Polished UI built with shadcn-style components on Radix:

- Auth pages: login, register, Google sign-in button (auto-hidden if `VITE_GOOGLE_CLIENT_ID` not set)
- Session bootstrap: persisted tokens (localStorage via Zustand), auto-refresh on 401 with deduped refresh-in-flight
- App shell: sidebar nav + top bar with avatar dropdown + light/dark/system theme toggle
- Dashboard: greeting + recent teams + empty-state CTA
- Profile: view/edit firstName, lastName, avatarUrl, timezone
- Teams: card grid, create dialog, detail page with member management, role-based UI gating, search-and-pick add-members dialog

API client (`web/src/api/client.ts`) handles bearer headers, RFC 7807 problem parsing, envelope unwrapping, and refresh-on-401 transparently.

### Real-time, Analytics

Only scaffolding. Not implemented yet.

---

## How to start the dev environment

```bash
# 1. From project root: bring up infra + api
docker compose -f docker-compose.yml -f docker-compose.dev.yml up postgres -d
docker compose -f docker-compose.yml -f docker-compose.dev.yml up api -d

# 2. (Only when schema or migrations change — usually skip)
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed

# 3. In another terminal: start the frontend
cd web && npm run dev
# Open http://localhost:5173
```

### Seed credentials
- **Alice** (local auth): `alice@example.com` / `Password123!`
- **Bob** (Google OAuth, fake `externalId` — not actually usable for sign-in)

### Test
```bash
cd api && npm test     # 67 tests
```

---

## Open issues / gotchas to remember

1. **Two `.env` files.** Project root `.env` (Docker Compose, hostnames = `postgres`/`redis`) and `api/.env` (host-run Prisma, hostnames = `localhost`). Credentials must match between them. Or just always run Prisma inside the container with `docker compose exec api npx prisma ...`.

2. **Postgres init is one-shot.** Changing `POSTGRES_USER`/`POSTGRES_PASSWORD` in `.env` after first boot doesn't update the actual user — the volume retains original creds. If creds drift, `docker compose down -v` and re-run migrations + seed.

3. **Prisma 7 + tsc CJS gotcha.** The `prisma-client` generator emits ESM by default; we forced `moduleFormat = "cjs"` + `importFileExtension = ""` in `schema.prisma` so it works with NestJS's CJS build.

4. **Jest + jose (ESM).** Test setup needed `transformIgnorePatterns: ["node_modules/(?!(jose)/)"]` because `jwks-rsa` pulls in ESM-only `jose`.

5. **Google OAuth.** Set `VITE_GOOGLE_CLIENT_ID` in `web/.env` and `GOOGLE_CLIENT_ID` in `api/.env` (same value — the OAuth client ID from Google Cloud Console). Without it, the frontend hides the Google button and the backend's `/auth/oauth/google` endpoint will fail at request time.

6. **Frontend dev server proxies `/api` → `localhost:3000`.** No CORS config needed in dev. In prod, nginx would do this routing.

---

## Suggested next work (in order)

1. **Wave 6 — Tasks module** (api): Task model in schema, CRUD with team-scoped RBAC, comments, attachments. Frontend: tasks board (kanban or list) on the team detail page.
2. **Wave 7 — Messaging REST** (api): Channels + message history endpoints. Frontend: channel list + message history view (still no real-time yet).
3. **Wave 8 — Real-time service**: Socket.IO gateway with JWT validation on connect, Redis pub/sub for fanout. Frontend: live message updates, typing indicators, presence.
4. **Wave 9 — Notifications**: in-app notification feed + real-time push.
5. **Wave 10 — Calls**: LiveKit integration. Backend creates rooms + signed participant tokens; frontend uses LiveKit React SDK.
6. **Wave 11 — Analytics**: Python FastAPI service consuming activity events from Redis, aggregating to read-only tables, exposing reports.

The implementation plan is in `~/.claude/plans/memoized-nibbling-hippo.md` (Waves 1-5 detailed; 6+ noted briefly).

---

## File map (high level)

```
course_work/
├── api/                       # NestJS API — Waves 1-5 done
│   ├── prisma/                # Schema + migrations + seed
│   ├── src/
│   │   ├── common/            # Filters, interceptors, error catalog
│   │   ├── config/            # Env validation (class-validator)
│   │   ├── modules/
│   │   │   ├── auth/          # local + OAuth abstraction + Google provider
│   │   │   ├── users/
│   │   │   └── teams/         # RBAC guard + decorator
│   │   ├── prisma/            # Global PrismaModule + service
│   │   └── main.ts            # ValidationPipe, filter, interceptor wiring
│   └── prisma.config.ts       # Prisma 7 config (loads dotenv)
├── web/                       # React frontend — auth, profile, teams done
│   ├── src/
│   │   ├── api/               # client.ts + per-feature endpoints
│   │   ├── components/ui/     # shadcn-style primitives
│   │   ├── components/app/    # sidebar, top-bar, session-bootstrap
│   │   ├── features/          # auth/, users/, teams/ (hooks + UI)
│   │   ├── providers/         # query, theme, google oauth
│   │   ├── routes/            # page components
│   │   └── store/auth.ts      # Zustand with persist
├── realtime/                  # Socket.IO scaffold (not implemented)
├── analytics/                 # FastAPI scaffold (not implemented)
├── docker/                    # Dockerfiles + nginx + livekit configs
├── docker-compose.yml         # Base infra
├── docker-compose.dev.yml     # Dev overrides (hot reload, debug ports)
└── docs/
    ├── PROGRESS.md            # This file
    └── architecture/          # ADRs + API design + Docker design
```
