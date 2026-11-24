#!/usr/bin/env bash
# Read-only. Prints one PASS or FAIL line per check and exits 0 only when the stack this run started answers.
# Usage: doctor.sh
set -u

. "$(dirname "$0")/env.sh"

fails=0
report() { if [ "$1" = ok ]; then echo "PASS: $2"; else echo "FAIL: $2"; fails=$((fails + 1)); fi; }
mine=(--filter "label=com.docker.compose.project=$VM_PROJECT")
psql_in() {
  local id
  id=$(docker ps "${mine[@]}" --filter label=com.docker.compose.service=postgres -q | head -1)
  [ -n "$id" ] && docker exec "$id" psql -U vanillameta -d vanillameta -At -c "$1" 2>/dev/null
}

[ "$(docker ps "${mine[@]}" --filter status=running -q | wc -l | tr -d ' ')" -ge 3 ] \
  && report ok "three containers of $VM_PROJECT are running" || report no "three containers of $VM_PROJECT are running"
docker ps "${mine[@]}" --format '{{.Ports}}' | grep -q ":$VM_API_PORT->4000/" \
  && report ok "Docker maps port $VM_API_PORT to the API of $VM_PROJECT" || report no "Docker maps port $VM_API_PORT to the API of $VM_PROJECT"
echo "INFO: listeners on port $VM_API_PORT: $(lsof -nP -iTCP:"$VM_API_PORT" -sTCP:LISTEN -Fc 2>/dev/null | sed -n 's/^c//p' | sort -u | tr '\n' ' ')"
curl -sf "$VM_API_URL/health" >/dev/null && report ok "API health" || report no "API health"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$VM_WEB_URL/")" = 200 ] && report ok "web serves /" || report no "web serves /"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$VM_API_URL/mcp" -H 'Content-Type: application/json' -d '{}')" = 401 ] \
  && report ok "unauthenticated /mcp answers 401 (MCP is on)" || report no "unauthenticated /mcp answers 401 (MCP is on)"
[ "$(psql_in "SELECT to_regclass('public.ai_artifact')")" = ai_artifact ] && report ok "table ai_artifact exists" || report no "table ai_artifact exists"
[ "$(psql_in "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_artifact'")" = 10 ] \
  && report ok "ai_artifact has its 10 columns" || report no "ai_artifact has its 10 columns"

[ "$fails" = 0 ]
