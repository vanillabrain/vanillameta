#!/usr/bin/env bash
# Proves a backup is restorable WITHOUT touching the running stack: restores the dump into a throwaway
# MySQL container, then opens every uploaded .duckdb file read-only and scans every table in it.
# Exits non-zero on any failure.
# Usage: restore-drill.sh <archive> [api-image]     (BACKUP_PASSPHRASE_FILE for .enc archives)
set -euo pipefail
umask 077
archive="${1:?usage: $0 <archive> [api-image]}"
image="${2:-${API_IMAGE:-ghcr.io/vanillabrain/vanillameta-api}:${IMAGE_TAG:?set IMAGE_TAG or pass the api image}}"
work=$(mktemp -d)
name="vm-restore-drill-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
fail() { echo "DRILL FAILED: $*" >&2; exit 1; }

case "$archive" in
  *.enc) [ -n "${BACKUP_PASSPHRASE_FILE:-}" ] || fail "BACKUP_PASSPHRASE_FILE is required for $archive"
         openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$archive" -out "$work/backup.tar" ;;
  *) cp "$archive" "$work/backup.tar" ;;
esac
tar -C "$work" -xf "$work/backup.tar"
(cd "$work" && sha256sum -c SHA256SUMS >/dev/null) || fail "checksum mismatch"
mkdir "$work/uploads" && tar -C "$work/uploads" -xzf "$work/uploads.tar.gz"
# The api image runs as an unprivileged user and must be able to read the mounted files.
chmod -R a+rX "$work/uploads"

pass=$(openssl rand -hex 12)
docker run -d --name "$name" --label owner=vanillameta-restore-drill \
  -e MYSQL_ROOT_PASSWORD="$pass" -e MYSQL_DATABASE=restored mysql:8.4 >/dev/null
for _ in $(seq 1 60); do
  docker exec -e MYSQL_PWD="$pass" "$name" mysqladmin ping -h127.0.0.1 --protocol=tcp -uroot --silent >/dev/null 2>&1 && break
  sleep 2
done
docker exec -e MYSQL_PWD="$pass" "$name" mysqladmin ping -h127.0.0.1 --protocol=tcp -uroot --silent >/dev/null 2>&1 || fail "mysql did not start"
gunzip -c "$work/db.sql.gz" | docker exec -i -e MYSQL_PWD="$pass" "$name" mysql -uroot restored || fail "dump did not load"

q() { docker exec -e MYSQL_PWD="$pass" "$name" mysql -uroot -N -B restored -e "$1"; }
tables=$(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='restored'")
migrations=$(q "SELECT COUNT(*) FROM migrations")
users=$(q "SELECT COUNT(*) FROM \`user\`")
[ "$tables" -gt 0 ] || fail "no tables restored"
[ "$migrations" -gt 0 ] || fail "no migration history restored"

files=$(find "$work/uploads" -name '*.duckdb' | wc -l | tr -d ' ')
bad=0
if [ "$files" -gt 0 ]; then
  docker run --rm -v "$work/uploads":/data:ro --entrypoint node "$image" -e '
    const { DuckDBInstance } = require("@duckdb/node-api");
    const { execSync } = require("child_process");
    (async () => {
      let bad = 0;
      for (const f of execSync("find /data -name \"*.duckdb\"").toString().split("\n").filter(Boolean)) {
        try {
          const db = await DuckDBInstance.create(f, { access_mode: "READ_ONLY" });
          const c = await db.connect();
          // Counting every table reads its data blocks, which a catalog query would not touch.
          const tables = (await c.runAndReadAll("SELECT table_name FROM information_schema.tables WHERE table_schema = \x27main\x27")).getRows();
          for (const [name] of tables) await c.runAndReadAll("SELECT count(*) FROM \"" + String(name).replace(/"/g, "\"\"") + "\"");
        } catch (e) { bad++; console.error("cannot open", f, String(e.message).slice(0, 120)); }
      }
      process.exit(bad ? 1 : 0);
    })();' || bad=1
fi
[ "$bad" -eq 0 ] || fail "some .duckdb files do not open"

echo "{\"restored\":true,\"tables\":$tables,\"migrations\":$migrations,\"users\":$users,\"duckdbFiles\":$files}"
