#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_CONTAINER="${APP_CONTAINER:-classroom-ready-app}"
DB_CONTAINER="${DB_CONTAINER:-classroom-ready-db}"
APP_IMAGE="${APP_IMAGE:-classroom-ready-app:latest}"
NETWORK_NAME="${NETWORK_NAME:-classroom-ready-net}"
DB_VOLUME="${DB_VOLUME:-classroom_ready_pg}"
UPLOAD_VOLUME="${UPLOAD_VOLUME:-classroom_ready_uploads}"
APP_UNIT="${APP_UNIT:-container-classroom-ready-app.service}"
HEALTH_URL="${HEALTH_URL:-}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

log() {
  printf '==> %s\n' "$*"
}

ensure_network() {
  if ! podman network exists "$NETWORK_NAME" >/dev/null 2>&1; then
    log "Create network $NETWORK_NAME"
    podman network create "$NETWORK_NAME" >/dev/null
  fi
}

ensure_volume() {
  local volume="$1"
  if ! podman volume exists "$volume" >/dev/null 2>&1; then
    log "Create volume $volume"
    podman volume create "$volume" >/dev/null
  fi
}

container_has_network() {
  local container="$1"
  podman inspect "$container" --format '{{json .NetworkSettings.Networks}}' | grep -q "\"$NETWORK_NAME\""
}

ensure_db() {
  if podman container exists "$DB_CONTAINER"; then
    if ! podman ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
      log "Start existing database container"
      podman start "$DB_CONTAINER" >/dev/null
    fi
  else
    log "Create database container"
    podman compose up -d db
  fi

  if ! container_has_network "$DB_CONTAINER"; then
    log "Connect database to $NETWORK_NAME"
    podman network connect "$NETWORK_NAME" "$DB_CONTAINER"
  fi
}

wait_for_db() {
  local db_user="${POSTGRES_USER:-classroom_ready}"
  local db_name="${POSTGRES_DB:-classroom_ready}"

  log "Wait for database readiness"
  for _ in {1..30}; do
    if podman exec "$DB_CONTAINER" pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  printf 'Database container is not ready after timeout.\n' >&2
  return 1
}

stop_app_service() {
  if systemctl --user cat "$APP_UNIT" >/dev/null 2>&1; then
    log "Stop app user service"
    systemctl --user stop "$APP_UNIT" || true
  fi
}

health_url() {
  if [[ -n "$HEALTH_URL" ]]; then
    printf '%s\n' "$HEALTH_URL"
    return
  fi

  local bind="${CLASSROOM_APP_BIND:-127.0.0.1:3020}"
  local port="${bind##*:}"
  local base="${NEXT_PUBLIC_BASE_PATH:-}"
  base="${base%/}"
  printf 'http://127.0.0.1:%s%s/api/health\n' "$port" "$base"
}

wait_for_app() {
  local url
  url="$(health_url)"

  log "Wait for app healthcheck"
  for _ in {1..30}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      curl -fsS "$url"
      printf '\n'
      return 0
    fi
    sleep 2
  done

  printf 'App healthcheck failed: %s\n' "$url" >&2
  podman logs --tail 100 "$APP_CONTAINER" >&2 || true
  return 1
}

ensure_network
ensure_volume "$DB_VOLUME"
ensure_volume "$UPLOAD_VOLUME"
ensure_db
wait_for_db

log "Build app image"
podman compose build app

stop_app_service

log "Recreate app container"
podman rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true

health_cmd='node -e "const http=require(\"node:http\"); let base=process.env.NEXT_PUBLIC_BASE_PATH||\"\"; if (base.endsWith(\"/\")) base=base.slice(0,-1); const path=base + \"/api/health\"; const req=http.get({host:\"127.0.0.1\",port:process.env.PORT||3000,path,timeout:4000},res=>process.exit(res.statusCode===200?0:1)); req.on(\"error\",()=>process.exit(1)); req.on(\"timeout\",()=>req.destroy(new Error(\"timeout\")));"'
create_args=(
  --name "$APP_CONTAINER"
  --network "$NETWORK_NAME"
  --publish "${CLASSROOM_APP_BIND:-127.0.0.1:3020}:3000"
  --volume "${UPLOAD_VOLUME}:/app/uploads"
  --env "DATABASE_URL=${DATABASE_URL:-postgresql://classroom_ready:classroom_ready_dev_change_me@classroom-ready-db:5432/classroom_ready?schema=public}"
  --env "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3020}"
  --env "NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-}"
  --env "UPLOAD_DIR=${UPLOAD_DIR:-/app/uploads}"
  --env "PORT=${PORT:-3000}"
  --env "HOSTNAME=${HOSTNAME:-0.0.0.0}"
  --health-cmd "$health_cmd"
  --health-interval 30s
  --health-timeout 5s
  --health-retries 3
  --health-start-period 60s
)

if [[ -f .env ]]; then
  create_args+=(--env-file .env)
fi

podman create "${create_args[@]}" "$APP_IMAGE" >/dev/null

if ! container_has_network "$APP_CONTAINER"; then
  log "Connect app to $NETWORK_NAME"
  podman network connect "$NETWORK_NAME" "$APP_CONTAINER"
fi

log "Regenerate user systemd unit"
podman generate systemd --name "$APP_CONTAINER" --files --restart-policy=on-failure --stop-timeout 30 >/dev/null
mkdir -p "$HOME/.config/systemd/user"
mv "container-${APP_CONTAINER}.service" "$HOME/.config/systemd/user/$APP_UNIT"
systemctl --user daemon-reload
systemctl --user reset-failed "$APP_UNIT" >/dev/null 2>&1 || true
systemctl --user enable --now "$APP_UNIT" >/dev/null

wait_for_app

log "Deployment completed"
