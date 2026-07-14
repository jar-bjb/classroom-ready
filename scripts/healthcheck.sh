#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_CONTAINER="${APP_CONTAINER:-classroom-ready-app}"
DB_CONTAINER="${DB_CONTAINER:-classroom-ready-db}"
APP_UNIT="${APP_UNIT:-container-classroom-ready-app.service}"
QUIET=0

if [[ "${1:-}" == "--quiet" ]]; then
  QUIET=1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

local_health_url() {
  local bind="${CLASSROOM_APP_BIND:-127.0.0.1:3020}"
  local port="${bind##*:}"
  local base="${NEXT_PUBLIC_BASE_PATH:-}"
  base="${base%/}"
  printf 'http://127.0.0.1:%s%s/api/health\n' "$port" "$base"
}

container_status() {
  local container="$1"
  if ! podman container exists "$container"; then
    printf 'missing'
    return
  fi

  podman inspect "$container" --format '{{.State.Status}}'
}

container_health() {
  local container="$1"
  if ! podman container exists "$container"; then
    printf '-'
    return
  fi

  podman inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}'
}

url="$(local_health_url)"
app_status="$(container_status "$APP_CONTAINER")"
db_status="$(container_status "$DB_CONTAINER")"
app_health="$(container_health "$APP_CONTAINER")"
unit_status="$(systemctl --user is-active "$APP_UNIT" 2>/dev/null || true)"
health_json="$(curl -fsS "$url")"

if [[ "$health_json" != *'"status":"ok"'* ]]; then
  printf 'Health endpoint returned non-ok payload: %s\n' "$health_json" >&2
  exit 1
fi

if [[ "$QUIET" -eq 1 ]]; then
  exit 0
fi

printf 'Class Ready healthcheck\n'
printf 'App container : %s (%s)\n' "$app_status" "$app_health"
printf 'DB container  : %s\n' "$db_status"
printf 'User service  : %s\n' "${unit_status:-unknown}"
printf 'Endpoint      : %s\n' "$url"
printf 'Payload       : %s\n' "$health_json"
