#!/usr/bin/env bash
# Consistent backup of the MySQL metadata (mysqldump --single-transaction) and the uploads volume
# (the .duckdb files). Run from cron on the VM, e.g.:  17 3 * * *  /opt/vanillameta/deploy/backup.sh
# DuckDB files are copied while the API may write to them. Run at a quiet hour and prove the result
# with restore-drill.sh; a file caught mid-write fails the openability check there.
set -euo pipefail
umask 077
cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.prod}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 2; }
set -a; . "$ENV_FILE"; set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vanillameta}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)
mkdir -p "$BACKUP_DIR"

used=$(df -P "$BACKUP_DIR" | awk 'NR==2 {gsub("%","",$5); print $5}')
[ "$used" -lt 90 ] || { echo "disk is ${used}% full: refusing to back up" >&2; exit 3; }
[ "$used" -lt 80 ] || echo "warning: backup disk is ${used}% full" >&2

stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d "$BACKUP_DIR/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT

"${COMPOSE[@]}" exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --no-tablespaces "$MYSQL_DATABASE"' \
  | gzip > "$work/db.sql.gz"

uploads_volume=$(docker volume ls -q --filter label=com.docker.compose.project=vanillameta --filter label=com.docker.compose.volume=uploads | head -1)
[ -n "$uploads_volume" ] || { echo "uploads volume not found" >&2; exit 4; }
docker run --rm -v "$uploads_volume":/data:ro alpine:3.20 tar -C /data -cf - . | gzip > "$work/uploads.tar.gz"

# A truncated stream must fail here, not at restore time.
gzip -t "$work/db.sql.gz" "$work/uploads.tar.gz"
tar -tzf "$work/uploads.tar.gz" >/dev/null
(cd "$work" && sha256sum db.sql.gz uploads.tar.gz > SHA256SUMS)

archive="$BACKUP_DIR/vanillameta-$stamp.tar"
tar -C "$work" -cf "$archive" db.sql.gz uploads.tar.gz SHA256SUMS
if [ -n "${BACKUP_PASSPHRASE_FILE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$archive" -out "$archive.enc"
  rm -f "$archive"
  archive="$archive.enc"
fi

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$archive" "$BACKUP_S3_URI/$(basename "$archive")" \
    ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} --only-show-errors
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'vanillameta-*.tar*' -mtime +"$RETENTION_DAYS" -delete
size=$(wc -c < "$archive" | tr -d ' ')
echo "{\"backup\":\"$archive\",\"bytes\":$size,\"encrypted\":$([ -n "${BACKUP_PASSPHRASE_FILE:-}" ] && echo true || echo false),\"offsite\":$([ -n "${BACKUP_S3_URI:-}" ] && echo true || echo false)}"
