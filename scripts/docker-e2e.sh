#!/usr/bin/env bash
# 빠른 시작 스택(docker-compose.yml)을 실제로 띄워 ego-browser 로 화면 끝까지 e2e 를 돌린다.
#   scripts/docker-e2e.sh                 # 빌드 → 기동 → e2e → 정리
#   KEEP=1 scripts/docker-e2e.sh          # 끝난 뒤 스택을 남겨 둔다(직접 열어 볼 때)
#   E2E_SKIP_UP=1 scripts/docker-e2e.sh   # 이미 떠 있는 스택에 e2e 만 다시 돌린다(개발용)
#   E2E_ONLY='로그인|데이터' scripts/docker-e2e.sh   # 케이스 이름이 정규식에 맞는 것만
# 이 스크립트가 만든 프로젝트(vm-quickstart-e2e)만 정리한다. 다른 컨테이너는 건드리지 않는다.
# 필요한 것: docker compose, ego-browser(ego lite).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

PROJECT=vm-quickstart-e2e
PORT=${E2E_PORT:-13100}
TIMEOUT=${E2E_TIMEOUT:-900}

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "docker compose 를 찾을 수 없습니다." >&2
  exit 2
fi
command -v ego-browser >/dev/null 2>&1 || { echo "ego-browser 를 찾을 수 없습니다." >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "python3 를 찾을 수 없습니다." >&2; exit 2; }

export VM_BIND=127.0.0.1
# 개발자의 .env 가 모드를 바꿔도 이 시나리오는 관리 모드(guest 가 조직 admin)를 전제한다.
export BOOTSTRAP_ADMIN_USER_ID=guest
export VM_WEB_PORT=$PORT
export CORS_ORIGIN="http://localhost:$PORT"
compose() { "${COMPOSE[@]}" -p "$PROJECT" "$@"; }

# 원격 MCP 를 e2e 전용 OAuth 클라이언트 하나로 켠다. e2e 가 이 redirect 포트에서 잠시 콜백을 받는다(포트가 겹치면 E2E_MCP_PORT 로 바꾼다).
MCP_CLIENT_ID=e2e-client
MCP_REDIRECT=http://127.0.0.1:${E2E_MCP_PORT:-53682}/callback
MCP_SCOPES='["sources:read","documents:read","reports:read","comments:read","comments:write","suggestions:write","shares:write","dashboards:read","dashboards:write","dashboards:delete"]'
# 허용 범위가 좁은 두 번째 클라이언트: 광고 범위는 두 클라이언트 범위의 합집합이고, 좁은 쪽은 넓은 범위를 받지 못한다.
MCP_NARROW_ID=e2e-reader
MCP_NARROW_SCOPES='["sources:read","documents:read"]'
export MCP_PUBLIC_API_URL="http://localhost:$PORT/v1"
export MCP_PUBLIC_WEB_URL="http://localhost:$PORT/"
export MCP_OAUTH_CLIENTS_JSON="[{\"id\":\"$MCP_CLIENT_ID\",\"name\":\"E2E 클라이언트\",\"redirectUris\":[\"$MCP_REDIRECT\"],\"scopes\":$MCP_SCOPES},{\"id\":\"$MCP_NARROW_ID\",\"name\":\"E2E 읽기 클라이언트\",\"redirectUris\":[\"$MCP_REDIRECT\"],\"scopes\":$MCP_NARROW_SCOPES}]"

SCRIPT=$(mktemp)
SHOTS=${E2E_SHOTS:-$(mktemp -d)}
mkdir -p "$SHOTS"
cleanup() {
  status=$?
  rm -f "$SCRIPT" "${OUT:-}"
  if [ "$status" -ne 0 ] && [ "${E2E_SKIP_UP:-0}" != "1" ]; then
    echo "--- 실패: 서비스 상태와 backend 로그 끝 40줄 ---" >&2
    compose ps >&2 || true
    compose logs --tail 40 backend >&2 || true
  fi
  if [ "${E2E_SKIP_UP:-0}" = "1" ]; then
    :
  elif [ "${KEEP:-0}" = "1" ]; then
    echo "스택을 남겼습니다: http://localhost:$PORT  (정리: ${COMPOSE[*]} -p $PROJECT down -v)"
  else
    compose down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

if [ "${E2E_SKIP_UP:-0}" != "1" ]; then
  compose up -d --build --wait --wait-timeout "$TIMEOUT"
fi
[ "$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/healthz")" = 200 ] \
  || { echo "웹 /healthz 가 200 이 아닙니다." >&2; exit 1; }

# ego-browser 스크립트는 환경변수와 작업 디렉터리를 물려받지 않으므로 설정을 코드 앞에 붙인다.
{
  E2E_BASE="http://localhost:$PORT" E2E_ROOT="$ROOT" E2E_SHOTS_DIR="$SHOTS" E2E_MCP_CLIENT="$MCP_CLIENT_ID" \
    E2E_MCP_NARROW="$MCP_NARROW_ID" E2E_MCP_NARROW_SCOPES="$MCP_NARROW_SCOPES" \
    E2E_MCP_REDIRECT="$MCP_REDIRECT" E2E_MCP_SCOPES="$MCP_SCOPES" E2E_FILTER="${E2E_ONLY:-}" python3 - <<'PY'
import json, os
cfg = {
    "base": os.environ["E2E_BASE"],
    "root": os.environ["E2E_ROOT"],
    "shots": os.environ["E2E_SHOTS_DIR"],
    "mcp": {
        "clientId": os.environ["E2E_MCP_CLIENT"],
        "redirect": os.environ["E2E_MCP_REDIRECT"],
        "scopes": json.loads(os.environ["E2E_MCP_SCOPES"]),
        "narrowId": os.environ["E2E_MCP_NARROW"],
        "narrowScopes": json.loads(os.environ["E2E_MCP_NARROW_SCOPES"]),
    },
    "only": os.environ["E2E_FILTER"],
}
print("const CFG = " + json.dumps(cfg, ensure_ascii=False) + ";")
PY
  cat "$ROOT/scripts/e2e/docker-e2e.mjs"
} > "$SCRIPT"

OUT=$(mktemp)
ego-browser nodejs < "$SCRIPT" 2>&1 | tee "$OUT" || true
# 케이스가 하나도 돌지 않았으면(E2E_ONLY 오타 등) 통과로 보지 않는다.
if grep -qE '^E2E_RESULT total=[1-9][0-9]* pass=[0-9]+ fail=0$' "$OUT"; then
  exit 0
fi
echo "e2e 에 실패했거나 실행된 케이스가 없습니다." >&2
exit 1
