#!/usr/bin/env bash
# Removes the containers, network and volumes of the compose project this run started. Never touches evidence or images.
# It fails when it finds nothing to remove, so a lost or wrong project name cannot look like success.
# Usage: cleanup.sh
set -euo pipefail

. "$(dirname "$0")/env.sh"

docker info >/dev/null 2>&1 || { echo "FAIL: cannot reach the Docker daemon. Nothing was removed." >&2; exit 1; }
mine=(--filter "label=com.docker.compose.project=$VM_PROJECT")
if [ -z "$(docker ps -a "${mine[@]}" -q)" ] && [ -z "$(docker volume ls "${mine[@]}" -q)" ]; then
  echo "FAIL: nothing found for $VM_PROJECT. Stacks that exist:" >&2
  others=$(docker ps -a --format '{{.Label "com.docker.compose.project"}}' | grep '^vm-artifacts-verify-' | sort -u || true)
  echo "${others:-  (none)}" >&2
  exit 1
fi

cd "$VM_REPO_ROOT"
docker compose -p "$VM_PROJECT" -f docker-compose.yml down -v
