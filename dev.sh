#!/usr/bin/env bash
#
# Dev helper script for TeamForge.
# Usage: ./dev.sh [command]
#
# Commands:
#   up                  (default) Start postgres, redis, minio, api, realtime, analytics, livekit, nginx;
#                       run migrations + ensure bucket
#   down                Stop all services (volumes preserved)
#   reset               Stop + wipe volumes (destroys DB and MinIO files), then 'up' + seed
#   migrate [name]      Run prisma migrate dev (with prompt if a new migration is needed)
#   seed                Run prisma db seed
#   logs [service]      Tail container logs (default: api). Examples: logs analytics, logs nginx
#   shell [service]     Open a shell inside a container (default: api). Examples: shell analytics
#   status              Show docker compose ps
#   help                Show this message

set -euo pipefail

export COMPOSE_FILE="docker-compose.yml:docker-compose.dev.yml"

# ----- colors -----
if [ -t 1 ]; then
  BLUE=$'\033[34m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  BLUE=''; GREEN=''; YELLOW=''; RED=''; DIM=''; RESET=''
fi

log()   { echo "${BLUE}▸${RESET} $*"; }
ok()    { echo "${GREEN}✓${RESET} $*"; }
warn()  { echo "${YELLOW}!${RESET} $*"; }
error() { echo "${RED}✗${RESET} $*" >&2; }

# ----- helpers -----

require_docker() {
  if ! docker info >/dev/null 2>&1; then
    error "Docker daemon is not running. Start Docker Desktop and retry."
    exit 1
  fi
}

ensure_env() {
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      warn ".env not found — copying from .env.example"
      cp .env.example .env
    else
      error "Neither .env nor .env.example exists at project root"
      exit 1
    fi
  fi
}

wait_for_healthy() {
  local service="$1"
  local attempts=30
  log "Waiting for ${service} to become healthy…"
  for ((i = 1; i <= attempts; i++)); do
    local status
    status=$(docker compose ps --format json "$service" 2>/dev/null | sed -n 's/.*"Health":"\([^"]*\)".*/\1/p' | head -n1)
    if [ "$status" = "healthy" ]; then
      ok "${service} is healthy"
      return 0
    fi
    sleep 1
  done
  error "${service} did not become healthy within ${attempts}s"
  return 1
}

ensure_minio_bucket() {
  log "Ensuring MinIO bucket exists…"
  local bucket
  bucket=$(grep -E '^S3_BUCKET=' .env | cut -d= -f2)
  bucket=${bucket:-teamcollab-files}
  docker compose exec -T minio sh -c "
    mc alias set local http://localhost:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD >/dev/null 2>&1 || true
    mc mb local/${bucket} --ignore-existing >/dev/null 2>&1 || true
  "
  ok "MinIO bucket '${bucket}' ready"
}

api_yarn_install_if_needed() {
  if needs_yarn_install api; then
    log "api: package.json changed — running yarn install"
    docker compose exec api yarn install
  fi
}

realtime_yarn_install_if_needed() {
  if needs_yarn_install realtime; then
    log "realtime: package.json changed — running yarn install"
    docker compose exec realtime yarn install --ignore-engines
  fi
}

# Reinstall if package.json is newer than yarn's integrity marker, or if
# node_modules is missing entirely. Cheap when nothing changed.
needs_yarn_install() {
  local service=$1
  ! docker compose exec -T "$service" sh -c '
    [ -d node_modules ] && [ -f node_modules/.yarn-integrity ] \
      && [ ! package.json -nt node_modules/.yarn-integrity ]
  ' >/dev/null 2>&1
}

# ----- commands -----

cmd_up() {
  require_docker
  ensure_env

  log "Bringing up postgres, redis, minio…"
  docker compose up -d postgres redis minio

  wait_for_healthy postgres
  wait_for_healthy redis
  wait_for_healthy minio

  log "Bringing up api, realtime, analytics, livekit, nginx…"
  docker compose up -d api realtime analytics livekit nginx

  api_yarn_install_if_needed
  realtime_yarn_install_if_needed
  ensure_minio_bucket

  log "Applying any pending migrations…"
  docker compose exec -T api npx prisma migrate deploy

  ok "Stack is up."
  echo
  echo "${DIM}  nginx     → http://localhost          (routes /api/, /ws/, /analytics/)${RESET}"
  echo "${DIM}  api       → http://localhost:3000     (direct, dev only)${RESET}"
  echo "${DIM}  realtime  → http://localhost:3001     (direct, dev only)${RESET}"
  echo "${DIM}  analytics → http://localhost/analytics/docs  (via nginx; no direct port)${RESET}"
  echo "${DIM}  minio     → http://localhost:9001     (console)${RESET}"
  echo "${DIM}  postgres  → localhost:5432${RESET}"
  echo
  echo "Next: ${BLUE}cd web && npm run dev${RESET} for the frontend"
  echo "Stream api logs: ${BLUE}./dev.sh logs${RESET}     (or ./dev.sh logs analytics, etc.)"
}

cmd_down() {
  require_docker
  log "Stopping services (volumes preserved)…"
  docker compose down
  ok "Stopped."
}

cmd_reset() {
  require_docker
  warn "This will DELETE all DB data and MinIO files. Continue? [y/N]"
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) log "Cancelled."; exit 0 ;;
  esac

  log "Tearing down with volumes…"
  docker compose down -v

  cmd_up

  log "Seeding database…"
  docker compose exec -T api npx prisma db seed
  ok "Reset + seed complete."
}

cmd_migrate() {
  require_docker
  local name="${1:-}"
  if [ -n "$name" ]; then
    docker compose exec api npx prisma migrate dev --name "$name"
  else
    docker compose exec api npx prisma migrate dev
  fi
}

cmd_seed() {
  require_docker
  docker compose exec api npx prisma db seed
}

cmd_logs() {
  require_docker
  local service="${1:-api}"
  docker compose logs -f "$service"
}

cmd_shell() {
  require_docker
  local service="${1:-api}"
  docker compose exec "$service" sh
}

cmd_status() {
  require_docker
  docker compose ps
}

cmd_help() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
}

# ----- dispatch -----

case "${1:-up}" in
  up)      cmd_up      ;;
  down)    cmd_down    ;;
  reset)   cmd_reset   ;;
  migrate) shift; cmd_migrate "$@" ;;
  seed)    cmd_seed    ;;
  logs)    shift; cmd_logs "$@" ;;
  shell)   shift; cmd_shell "$@" ;;
  status)  cmd_status  ;;
  help|-h|--help) cmd_help ;;
  *)
    error "Unknown command: $1"
    cmd_help
    exit 1
    ;;
esac
