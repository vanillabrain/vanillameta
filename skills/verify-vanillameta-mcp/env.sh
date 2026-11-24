#!/usr/bin/env bash
# Restores the run variables from the state file when the shell lost them, then derives the values
# scripts/verify/mcp-artifacts-e2e.sh passes to Docker Compose, so every script targets the same stack.
# Bash scripts (launch, restart, doctor, cleanup) source it. From any other shell, including zsh, load the run with
#   eval "$(skills/verify-vanillameta-mcp/env.sh)"

VM_STATE_FILE=${XDG_CACHE_HOME:-$HOME/.cache}/vanillameta-verify/current.env
VM_REPO_ROOT=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)

if [ -f "$VM_STATE_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in VM_PROJECT|VM_WEB_URL|VM_API_URL|VM_EVIDENCE_DIR|VM_COLIMA_PROFILE)
      [ -n "$value" ] && [ -z "${!key:-}" ] && export "$key=$value" ;;
    esac
  done <"$VM_STATE_FILE"
fi

: "${VM_PROJECT:?no run found. Run launch.sh first, or set VM_PROJECT}"
case "$VM_PROJECT" in
  vm-artifacts-verify-*) ;;
  *) echo "refusing: $VM_PROJECT is not a vm-artifacts-verify-* project" >&2; exit 2 ;;
esac

VM_WEB_URL=${VM_WEB_URL:-http://localhost:3000}; VM_WEB_URL=${VM_WEB_URL%/}
VM_API_URL=${VM_API_URL:-http://localhost:4000/v1}; VM_API_URL=${VM_API_URL%/}
VM_WEB_PORT=${VM_WEB_URL##*:}
VM_API_PORT=${VM_API_URL%/v1}; VM_API_PORT=${VM_API_PORT##*:}
VM_PG_PORT=$((VM_API_PORT == 4000 ? 5432 : VM_API_PORT + 1000))

if [ -n "${VM_COLIMA_PROFILE:-}" ]; then
  export DOCKER_HOST="unix://$HOME/.colima/$VM_COLIMA_PROFILE/docker.sock"
  unset DOCKER_CONTEXT
  if [ -z "${DOCKER_CONFIG:-}" ] && ! command -v docker-credential-desktop >/dev/null 2>&1; then
    export DOCKER_CONFIG="${XDG_CACHE_HOME:-$HOME/.cache}/vanillameta-verify/docker-config"
    mkdir -p "$DOCKER_CONFIG"
  fi
fi

export FRONTEND_HOST_PORT=$VM_WEB_PORT BACKEND_HOST_PORT=$VM_API_PORT
[ "$VM_API_PORT" = 4000 ] || export POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT:-$VM_PG_PORT}
export MCP_PUBLIC_API_URL=$VM_API_URL MCP_PUBLIC_WEB_URL="$VM_WEB_URL/" CORS_ORIGIN=$VM_WEB_URL REACT_APP_API_URL=$VM_API_URL

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  for name in VM_PROJECT VM_WEB_URL VM_API_URL VM_EVIDENCE_DIR VM_COLIMA_PROFILE VM_REPO_ROOT DOCKER_HOST DOCKER_CONFIG \
    FRONTEND_HOST_PORT BACKEND_HOST_PORT POSTGRES_HOST_PORT MCP_PUBLIC_API_URL MCP_PUBLIC_WEB_URL CORS_ORIGIN REACT_APP_API_URL; do
    if [ -n "${!name:-}" ]; then printf 'export %s=%q\n' "$name" "${!name}"; fi
  done
fi
