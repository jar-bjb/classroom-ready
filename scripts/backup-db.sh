#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_CONTAINER="${DB_CONTAINER:-classroom-ready-db}"
UPLOAD_VOLUME="${UPLOAD_VOLUME:-classroom_ready_uploads}"
BACKUP_DIR="${BACKUP_DIR:-backups}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-classroom_ready}"
POSTGRES_DB="${POSTGRES_DB:-classroom_ready}"
timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

db_backup="$BACKUP_DIR/classroom_ready_${timestamp}.sql.gz"
uploads_backup="$BACKUP_DIR/classroom_ready_uploads_${timestamp}.tar.gz"

if ! podman container exists "$DB_CONTAINER"; then
  printf 'Database container not found: %s\n' "$DB_CONTAINER" >&2
  exit 1
fi

printf 'Backup database to %s\n' "$db_backup"
podman exec -i "$DB_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -c > "$db_backup"

if podman volume exists "$UPLOAD_VOLUME" >/dev/null 2>&1; then
  printf 'Backup uploads to %s\n' "$uploads_backup"
  podman run --rm \
    -v "${UPLOAD_VOLUME}:/data:ro" \
    -v "${ROOT_DIR}/${BACKUP_DIR}:/backup" \
    alpine tar -czf "/backup/$(basename "$uploads_backup")" -C /data .
else
  printf 'Upload volume not found, skipped: %s\n' "$UPLOAD_VOLUME" >&2
fi

printf 'Backup completed\n'
