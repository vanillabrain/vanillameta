#!/usr/bin/env bash
# Starts a fresh stack from an empty volume, runs the full proof, and keeps the stack for further driving.
# Usage: launch.sh [web_port api_port]     defaults 3710 4710. Set VM_COLIMA_PROFILE when Docker runs in colima.
# It records the run in the state file, so doctor.sh, restart.sh and cleanup.sh find the same stack from any shell.
set -euo pipefail

command -v lsof >/dev/null || { echo "refusing: lsof is required for the port check" >&2; exit 2; }

WEB_PORT=${1:-3710}; API_PORT=${2:-4710}
PG_PORT=${POSTGRES_HOST_PORT:-$((API_PORT == 4000 ? 5432 : API_PORT + 1000))}
unset VM_PROJECT VM_WEB_URL VM_API_URL VM_EVIDENCE_DIR
export VM_PROJECT=vm-artifacts-verify-$(date +%y%m%d%H%M%S)
export VM_WEB_URL=http://localhost:$WEB_PORT VM_API_URL=http://localhost:$API_PORT/v1
export VM_EVIDENCE_DIR=$HOME/.cache/vanillameta-verify/$VM_PROJECT

for port in "$WEB_PORT" "$API_PORT" "$PG_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "refusing: port $port is already in use. Pick other ports: launch.sh <web_port> <api_port>" >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2
    exit 2
  fi
done

STATE=${XDG_CACHE_HOME:-$HOME/.cache}/vanillameta-verify/current.env
mkdir -p "$(dirname "$STATE")" "$VM_EVIDENCE_DIR"
{
  echo "VM_PROJECT=$VM_PROJECT"
  echo "VM_WEB_URL=$VM_WEB_URL"
  echo "VM_API_URL=$VM_API_URL"
  echo "VM_EVIDENCE_DIR=$VM_EVIDENCE_DIR"
  if [ -n "${VM_COLIMA_PROFILE:-}" ]; then echo "VM_COLIMA_PROFILE=$VM_COLIMA_PROFILE"; fi
} >"$STATE"
echo "run $VM_PROJECT recorded in $STATE"

cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
KEEP=1 bash scripts/verify/mcp-artifacts-e2e.sh 2>&1 | tee "$VM_EVIDENCE_DIR/run.log"
