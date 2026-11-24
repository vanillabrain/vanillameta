#!/usr/bin/env bash
# Recreates every container of the run with the same ports and MCP addresses, then waits for the API.
# Usage: restart.sh
set -eu

. "$(dirname "$0")/env.sh"
cd "$VM_REPO_ROOT"
docker compose -p "$VM_PROJECT" -f docker-compose.yml up -d --force-recreate
for _ in $(seq 1 120); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$VM_API_URL/health")" = 200 ] && { echo "API is healthy at $VM_API_URL"; exit 0; }
  sleep 2
done
echo "FAIL: the API did not become healthy within 240 seconds" >&2
exit 1
