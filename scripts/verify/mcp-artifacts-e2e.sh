#!/usr/bin/env bash
# 한 줄로 MCP 아티팩트 시스템을 재판정한다.
#   scripts/verify/mcp-artifacts-e2e.sh          # 빌드 → 기동 → MCP 쓰기 → 화면 URL 확인 → 재기동 유지 → 정리
#   KEEP=1 scripts/verify/mcp-artifacts-e2e.sh   # 스택을 남겨 둔다(직접 열어 볼 때)
# 이 스크립트가 만든 compose 프로젝트(vm-artifacts-verify)만 정리한다.
# 전제: docker compose, curl, python3, 포트 3000·4000 비어 있음.
set -euo pipefail

cd "$(dirname "$0")/../.."
PROJECT=${VM_PROJECT:-vm-artifacts-verify}
WEB=${VM_WEB_URL:-http://localhost:3000}
API=${VM_API_URL:-http://localhost:4000/v1}
KEEP=${KEEP:-0}
EVIDENCE=${VM_EVIDENCE_DIR:-$(pwd)/.verify/mcp-artifacts}

command -v curl >/dev/null || { echo "curl 이 필요합니다" >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 가 필요합니다" >&2; exit 2; }
if docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose); else
  command -v docker-compose >/dev/null || { echo "docker compose 가 필요합니다" >&2; exit 2; }
  COMPOSE=(docker-compose)
fi
compose() { "${COMPOSE[@]}" -p "$PROJECT" "$@"; }

mkdir -p "$EVIDENCE"
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT
PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "PASS: $*"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL: $*"; }
json() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

cleanup() {
  if [ "$KEEP" = 1 ]; then echo "KEEP=1: 스택을 남겼습니다 ($WEB)"; return; fi
  compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_http() {
  local url=$1 expected=$2
  for _ in $(seq 1 120); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)
    [ "$code" = "$expected" ] && return 0
    sleep 2
  done
  return 1
}

echo "== 1. 깨끗한 볼륨에서 기동 =="
compose down -v >/dev/null 2>&1 || true
compose up -d --build --wait >"$EVIDENCE/build.log" 2>&1 || {
  echo "빌드/기동 실패 — $EVIDENCE/build.log" >&2
  exit 1
}
wait_http "$API/health" 200 && pass "backend /v1/health 200" || fail "backend /v1/health"
wait_http "$WEB/" 200 && pass "web 200" || fail "web"

echo "== 2. MCP 메타데이터 =="
META=$(curl -s "${API%/v1}/.well-known/oauth-protected-resource/v1/mcp")
echo "$META" >"$EVIDENCE/metadata.json"
echo "$META" | grep -q 'artifacts:write' && pass "metadata 에 artifacts 스코프" || fail "metadata 스코프"
UNAUTH=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/mcp" -H 'Content-Type: application/json' -d '{}')
[ "$UNAUTH" = 401 ] && pass "무인증 /v1/mcp 401" || fail "무인증 /v1/mcp ($UNAUTH)"

echo "== 3. OAuth (로그인 → 승인 → 토큰) =="
LOGIN=$(curl -sS -c "$JAR" -H 'Content-Type: application/json' \
  -d '{"userId":"guest","password":"Admin!@12"}' "$API/login/signin")
JWT=$(echo "$LOGIN" | json 'd["accessToken"]')
[ -n "$JWT" ] && pass "guest 로그인" || { fail "guest 로그인"; exit 1; }

# MCP 승인은 조직 소속을 요구한다. 이미 소속이면 409 이고 그대로 진행한다.
ORG_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" -H "Authorization: Bearer $JWT" \
  -H 'Content-Type: application/json' -d '{"name":"Verification"}' "$API/enterprise/organizations")
case "$ORG_CODE" in
  200|201) pass "검증용 조직 생성(guest=admin)" ;;
  409) pass "이미 조직에 소속" ;;
  *) fail "조직 준비 ($ORG_CODE)"; exit 1 ;;
esac

read -r VERIFIER CHALLENGE STATE < <(python3 - <<'PY'
import base64, hashlib, secrets
v = base64.urlsafe_b64encode(secrets.token_bytes(48)).decode().rstrip('=')
c = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).decode().rstrip('=')
print(v, c, secrets.token_hex(16))
PY
)
REDIRECT='http://localhost:53683/callback'
AUTH_URL="$API/mcp-oauth/authorize?response_type=code&client_id=claude-code&redirect_uri=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$REDIRECT")&code_challenge=$CHALLENGE&code_challenge_method=S256&state=$STATE&scope=artifacts%3Aread%20artifacts%3Awrite&resource=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$API/mcp")"
curl -sS -c "$JAR" -b "$JAR" -D "$EVIDENCE/authorize.headers" -o /dev/null "$AUTH_URL"
LOCATION=$(python3 - "$EVIDENCE/authorize.headers" <<'PY'
import sys
for line in open(sys.argv[1]):
    if line.lower().startswith('location:'):
        print(line.split(':', 1)[1].strip()); break
PY
)
TICKET=${LOCATION##*/}
[ -n "$TICKET" ] && pass "authorize → 승인 티켓" || { fail "authorize"; exit 1; }

REVIEW=$(curl -sS -b "$JAR" -H "Authorization: Bearer $JWT" -H "Origin: $WEB" \
  "$API/ai-connections/requests/$TICKET")
REVIEW_TOKEN=$(echo "$REVIEW" | json 'd["reviewToken"]')
printf '%s' "$REVIEW" >"$EVIDENCE/consent-review.json"
[ -n "$REVIEW_TOKEN" ] && pass "승인 화면 요청 조회" || { fail "승인 요청 조회"; exit 1; }
SCOPES=$(echo "$REVIEW" | json '",".join(d["requestedScopes"])')

DECISION=$(curl -sS -b "$JAR" -H "Authorization: Bearer $JWT" -H "Origin: $WEB" \
  -H 'Content-Type: application/json' \
  -d "{\"decision\":\"approve\",\"reviewToken\":\"$REVIEW_TOKEN\",\"scopes\":[$(echo "$SCOPES" | sed 's/[^,]*/"&"/g')]}" \
  "$API/ai-connections/requests/$TICKET/decision")
CODE=$(echo "$DECISION" | python3 -c 'import sys,json,urllib.parse as u;d=json.load(sys.stdin);print(u.parse_qs(u.urlparse(d["redirectUrl"]).query)["code"][0])')
[ -n "$CODE" ] && pass "연결 승인 → 인가 코드" || { fail "승인"; exit 1; }

TOKEN_JSON=$(curl -sS -H 'Host: localhost:4000' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=$REDIRECT" \
  --data-urlencode 'client_id=claude-code' \
  --data-urlencode "code_verifier=$VERIFIER" \
  --data-urlencode "resource=$API/mcp" \
  "$API/mcp-oauth/token")
TOKEN=$(echo "$TOKEN_JSON" | json 'd["access_token"]')
[ -n "$TOKEN" ] && pass "토큰 교환" || { fail "토큰 교환"; exit 1; }

echo "== 4. MCP 도구 호출 =="
mcp() {
  curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" "$API/mcp"
}
TOOLS=$(mcp tools/list '{}')
printf '%s' "$TOOLS" >"$EVIDENCE/tools.json"
for tool in vm_create_artifact vm_update_artifact vm_delete_artifact vm_get_artifact vm_list_artifacts; do
  echo "$TOOLS" | grep -q "\"$tool\"" && pass "도구 $tool" || fail "도구 $tool"
done

call() {
  local name=$1 args=$2
  mcp tools/call "{\"name\":\"$name\",\"arguments\":$args}"
}
payload_of() {
  python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("result",{}).get("content",[{}])[0].get("text",""))'
}

HTML_ID=$(call vm_create_artifact '{"kind":"html","title":"Hello Web","content":{"html":"<!doctype html><html><body><h1>Hello Web</h1><p>artifact body</p></body></html>"}}' | payload_of | json 'd["id"]')
DOC_ID=$(call vm_create_artifact '{"kind":"document","title":"Quarterly Note","content":{"markdown":"# Quarterly Note\n\nRevenue grew 12%."}}' | payload_of | json 'd["id"]')
SHEET_ID=$(call vm_create_artifact '{"kind":"sheet","title":"Sales Table","content":{"columns":["region","revenue"],"rows":[["Seoul",120],["Busan",80]]}}' | payload_of | json 'd["id"]')
CHART_ID=$(call vm_create_artifact '{"kind":"chart","title":"Monthly Chart","content":{"chartType":"bar","labels":["Jan","Feb"],"series":[{"name":"revenue","data":[10,20]}]}}' | payload_of | json 'd["id"]')
EXTRA_ID=$(call vm_create_artifact '{"kind":"html","title":"Delete Me","content":{"html":"<p>temporary</p>"}}' | payload_of | json 'd["id"]')
for pair in "html:$HTML_ID" "document:$DOC_ID" "sheet:$SHEET_ID" "chart:$CHART_ID"; do
  [ -n "${pair#*:}" ] && pass "생성 ${pair%%:*}" || fail "생성 ${pair%%:*}"
done

UPDATED=$(call vm_update_artifact "{\"id\":\"$DOC_ID\",\"expectedRevision\":1,\"content\":{\"markdown\":\"# Quarterly Note\n\nRevenue grew 15%.\"}}" | payload_of)
echo "$UPDATED" | grep -q '"revision":2' && pass "수정(document revision 2)" || fail "수정"
DELETED=$(call vm_delete_artifact "{\"id\":\"$EXTRA_ID\",\"expectedRevision\":1}" | payload_of)
echo "$DELETED" | grep -q '"deleted":true' && pass "삭제" || fail "삭제"
GONE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $JWT" "$API/ai-artifacts/$EXTRA_ID")
[ "$GONE" = 404 ] && pass "삭제 뒤 읽기 404" || fail "삭제 뒤 읽기 ($GONE)"
STALE=$(call vm_update_artifact "{\"id\":\"$DOC_ID\",\"expectedRevision\":1,\"title\":\"stale\"}")
echo "$STALE" | grep -qi 'revision mismatch' && pass "낡은 revision 거절" || fail "낡은 revision 거절"

echo "== 5. 사람이 읽는 URL과 내용 =="
for pair in "web:$HTML_ID:Hello Web" "document:$DOC_ID:Revenue grew 15%" "sheet:$SHEET_ID:Seoul" "chart:$CHART_ID:Jan"; do
  name=${pair%%:*}; rest=${pair#*:}; id=${rest%%:*}; needle=${rest#*:}
  body=$(curl -sS -H "Authorization: Bearer $JWT" "$API/ai-artifacts/$id")
  echo "$body" >"$EVIDENCE/read-$name.json"
  echo "$body" | grep -q "$needle" && pass "읽기 $name ($needle)" || fail "읽기 $name"
done
curl -sS -o /dev/null -w '%{http_code}' "$WEB/ai-artifacts/$HTML_ID" | grep -qx 200 \
  && pass "화면 URL $WEB/ai-artifacts/<id> 200" || fail "화면 URL"

echo "== 6. 재기동 후 유지 =="
compose up -d --force-recreate backend >/dev/null 2>&1
wait_http "$API/health" 200 || { fail "재기동 health"; }
AGAIN=$(curl -sS -H "Authorization: Bearer $JWT" "$API/ai-artifacts/$DOC_ID")
echo "$AGAIN" | grep -q 'Revenue grew 15%' && pass "재기동 뒤 document 유지" || fail "재기동 뒤 유지"

echo
echo "결과: PASS=$PASS FAIL=$FAIL  증거=$EVIDENCE"
[ "$FAIL" = 0 ]
