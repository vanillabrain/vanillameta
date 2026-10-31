#!/usr/bin/env bash
# Backup of the PostgreSQL metadata (pg_dump) and the uploads volume (the .duckdb files).
# Run from cron on the VM, e.g.:  17 3 * * *  /opt/vanillameta/deploy/backup.sh
#
# - The archive is ALWAYS encrypted (BACKUP_PASSPHRASE_FILE is required): it holds user accounts, password
#   hashes, encrypted source configs and every uploaded dataset. No plaintext ARCHIVE is written; the staging
#   files (db.sql.gz, uploads.tar.gz) are plaintext in a 0700 directory and removed on exit, and leftovers
#   of a killed run are removed at the start of the next one.
# - By default the api is stopped for the duration of the dump and the copy (BACKUP_QUIESCE=true): DuckDB
#   files are single-writer and a copy taken while they are written can be torn. Downtime is the time the
#   dump and the copy take. Set BACKUP_QUIESCE=false to skip it and rely on restore-drill.sh instead.
# - Keep the passphrase and .env.prod OFF this VM as well (see README, "키 보관").
set -euo pipefail
umask 077
cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.prod}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 2; }
# Only the keys used here are read, and never evaluated as shell code.
envval() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }
BACKUP_DIR="${BACKUP_DIR:-$(envval BACKUP_DIR)}"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/vanillameta}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$(envval BACKUP_RETENTION_DAYS)}"; RETENTION_DAYS="${RETENTION_DAYS:-14}"
PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-$(envval BACKUP_PASSPHRASE_FILE)}"
S3_URI="${BACKUP_S3_URI:-$(envval BACKUP_S3_URI)}"
S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-$(envval BACKUP_S3_ENDPOINT)}"
QUIESCE="${BACKUP_QUIESCE:-$(envval BACKUP_QUIESCE)}"; QUIESCE="${QUIESCE:-true}"
# Only an explicit "false" turns the safety default off; any other spelling keeps it on.
case "$(echo "$QUIESCE" | tr '[:upper:]' '[:lower:]')" in false|0|no|off) QUIESCE=false ;; *) QUIESCE=true ;; esac

[ -n "$PASSPHRASE_FILE" ] && [ -r "$PASSPHRASE_FILE" ] && [ -s "$PASSPHRASE_FILE" ] \
  || { echo "BACKUP_PASSPHRASE_FILE must point to a readable, non-empty file" >&2; exit 2; }

COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)
mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || { echo "another backup is running" >&2; exit 5; }
# The lock guarantees no other run: anything left behind is from a run that was killed.
rm -rf "$BACKUP_DIR"/.work.* "$BACKUP_DIR"/*.partial

used=$(df -P "$BACKUP_DIR" | awk 'NR==2 {gsub("%","",$5); print $5}')
[ "$used" -lt 90 ] || { echo "disk is ${used}% full: refusing to back up" >&2; exit 3; }
[ "$used" -lt 80 ] || echo "warning: backup disk is ${used}% full" >&2

stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d "$BACKUP_DIR/.work.XXXXXX")
api_stopped=false
# Act on the container, not the compose service: `compose stop api` can also stop web and caddy, which
# depend on it and would not come back (they are stopped on purpose, so restart policies skip them).
api_cid=$("${COMPOSE[@]}" ps -aq api)
start_api() {
  docker start "$api_cid" >/dev/null
  for _ in $(seq 1 45); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$api_cid" 2>/dev/null)" = healthy ] && return 0
    sleep 2
  done
  echo "warning: api did not become healthy within 90s" >&2
  return 1
}
cleanup() {
  rm -rf "$work"
  if [ "$api_stopped" = true ]; then start_api || echo "FAILED to restart api" >&2; fi
}
trap cleanup EXIT

if [ "$QUIESCE" = true ]; then
  [ -n "$api_cid" ] || { echo "api container not found" >&2; exit 4; }
  docker stop -t 30 "$api_cid" >/dev/null
  api_stopped=true
fi

# shellcheck disable=SC2016  # the variables are meant to expand inside the container, not here
"${COMPOSE[@]}" exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  | gzip > "$work/db.sql.gz"

uploads_volume=$(docker volume ls -q --filter label=com.docker.compose.project=vanillameta --filter label=com.docker.compose.volume=uploads | head -1)
[ -n "$uploads_volume" ] || { echo "uploads volume not found" >&2; exit 4; }
docker run --rm -v "$uploads_volume":/data:ro alpine:3.20 tar -C /data -cf - . | gzip > "$work/uploads.tar.gz"

api_unhealthy=false
if [ "$api_stopped" = true ]; then start_api || api_unhealthy=true; api_stopped=false; fi

# A truncated stream must fail here, not at restore time.
gzip -t "$work/db.sql.gz" "$work/uploads.tar.gz"
tar -tzf "$work/uploads.tar.gz" >/dev/null
(cd "$work" && sha256sum db.sql.gz uploads.tar.gz > SHA256SUMS)

archive="$BACKUP_DIR/vanillameta-$stamp.tar.enc"
partial="$archive.partial"
# Stream straight into the encryptor so no plaintext archive is ever written.
tar -C "$work" -cf - db.sql.gz uploads.tar.gz SHA256SUMS \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass "file:$PASSPHRASE_FILE" -out "$partial"
mv "$partial" "$archive"

if [ -n "$S3_URI" ]; then
  aws s3 cp "$archive" "$S3_URI/$(basename "$archive")" ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} --only-show-errors
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'vanillameta-*.tar.enc' -mtime +"$RETENTION_DAYS" -delete
size=$(wc -c < "$archive" | tr -d ' ')
echo "{\"backup\":\"$archive\",\"bytes\":$size,\"quiesced\":$QUIESCE,\"offsite\":$([ -n "$S3_URI" ] && echo true || echo false)}"
[ "$api_unhealthy" = false ] || { echo "backup written, but the api did not become healthy" >&2; exit 6; }
