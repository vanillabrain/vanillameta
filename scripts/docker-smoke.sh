#!/usr/bin/env bash
# 빠른 시작 스택(docker-compose.yml)을 실제로 띄워 로그인까지 확인한다.
#   scripts/docker-smoke.sh            # 빌드 → 기동 → 확인 → 정리
#   KEEP=1 scripts/docker-smoke.sh     # 확인 후 스택을 남겨 둔다(직접 열어 볼 때)
# 이 스크립트가 만든 프로젝트(vm-quickstart-smoke)만 정리한다. 다른 컨테이너는 건드리지 않는다.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT=vm-quickstart-smoke
PORT=${SMOKE_PORT:-13000}
TIMEOUT=${SMOKE_TIMEOUT:-900}

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
elif [ -x "$HOME/.docker/cli-plugins/docker-compose" ]; then
  COMPOSE=("$HOME/.docker/cli-plugins/docker-compose")
else
  echo "docker compose 를 찾을 수 없습니다." >&2
  exit 2
fi

export VM_BIND=127.0.0.1
# 개발자의 .env 가 모드를 바꿔도 이 시나리오는 관리 모드(guest 가 조직 admin)를 전제한다.
export BOOTSTRAP_ADMIN_USER_ID=guest
export VM_WEB_PORT=$PORT
export CORS_ORIGIN="http://localhost:$PORT"
compose() { "${COMPOSE[@]}" -p "$PROJECT" "$@"; }

HEADERS=$(mktemp)
BODY=$(mktemp)

cleanup() {
  status=$?
  rm -f "$HEADERS" "$BODY"
  if [ "$status" -ne 0 ]; then
    echo "--- 실패: 서비스 상태와 backend 로그 끝 40줄 ---" >&2
    compose ps >&2 || true
    compose logs --tail 40 backend >&2 || true
  fi
  if [ "${KEEP:-0}" = "1" ] && [ "$status" -eq 0 ]; then
    echo "스택을 남겼습니다: http://localhost:$PORT  (정리: ${COMPOSE[*]} -p $PROJECT down -v)"
  else
    compose down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

compose up -d --build --wait --wait-timeout "$TIMEOUT"
BASE="http://127.0.0.1:$PORT"

[ "$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$BASE/healthz")" = 200 ] || fail "웹 /healthz"
pass "웹 /healthz 200"

[ "$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$BASE/v1/health")" = 200 ] || fail "웹 경유 /v1/health"
pass "웹 경유 /v1/health 200 (nginx 프록시)"

CODE=$(curl -s --max-time 10 -D "$HEADERS" -o "$BODY" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"guest","password":"Admin!@12"}' "$BASE/v1/login/signin")
[ "$CODE" = 201 ] || fail "guest 로그인 응답 $CODE (기대 201)"
grep -q '"accessToken"' "$BODY" || fail "응답에 accessToken 없음"
grep -qi '^set-cookie: jwt_re=' "$HEADERS" || fail "jwt_re 쿠키 없음"
pass "guest 로그인 201, accessToken 발급, jwt_re 쿠키"

TOKEN=$(sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p' "$BODY")
[ -n "$TOKEN" ] || fail "accessToken 을 읽지 못함"

# api METHOD PATH [JSON] [TOKEN] -> 본문은 $BODY, 상태 코드는 stdout
api() {
  local method=$1 path=$2 data=${3:-} token=${4:-$TOKEN}
  curl -s --max-time 15 -X "$method" -o "$BODY" -w '%{http_code}' \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    ${data:+-d "$data"} "$BASE$path"
}
field() { sed -n "s/.*\"$1\":\([0-9][0-9]*\).*/\1/p" "$BODY" | head -1; }

# 관리 모드: 시드된 guest 는 조직의 admin 이다.
[ "$(api GET /v1/enterprise/context)" = 200 ] || fail "guest 조직 컨텍스트"
grep -q '"mode":"managed"' "$BODY" || fail "관리 모드 표시 없음: $(cat "$BODY")"
grep -q '"role":"admin"' "$BODY" || fail "guest 가 조직 admin 이 아님: $(cat "$BODY")"
ORG_ID=$(sed -n 's/.*"organization":{"id":\([0-9]*\).*/\1/p' "$BODY")
ORG_VERSION=$(sed -n 's/.*"organization":{"id":[0-9]*,"name":"[^"]*","version":\([0-9]*\).*/\1/p' "$BODY")
[ -n "$ORG_ID" ] && [ -n "$ORG_VERSION" ] || fail "조직 번호·버전을 읽지 못함: $(cat "$BODY")"
pass "관리 모드: guest 는 시드된 조직(#$ORG_ID)의 admin"

# 새 가입자는 조직 밖이라 쓸 수 없고, 연결되면 부여된 등급만큼만 쓴다.
# 같은 볼륨으로 다시 돌려도 가입이 충돌하지 않게 실행마다 다른 ID 를 쓴다.
VIEWER="smoke-viewer-$(date +%s)-$$"
SIGNUP=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$VIEWER\",\"password\":\"Smoke!@12\",\"email\":\"$VIEWER@example.invalid\"}" "$BASE/v1/login/signup")
[ "$SIGNUP" = 201 ] || fail "새 계정 가입 응답 $SIGNUP (기대 201)"
curl -s --max-time 15 -o "$BODY" -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$VIEWER\",\"password\":\"Smoke!@12\"}" "$BASE/v1/login/signin"
VTOKEN=$(sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p' "$BODY")
[ -n "$VTOKEN" ] || fail "새 계정 로그인 실패"

[ "$(api GET /v1/enterprise/context '' "$VTOKEN")" = 200 ] || fail "새 계정 컨텍스트"
grep -q '"canCreateOrganization":false' "$BODY" || fail "새 계정이 조직을 만들 수 있다고 응답: $(cat "$BODY")"
pass "새 가입자는 조직을 만들 수 없다고 안내받음"

CODE=$(api POST /v1/dashboard '{}' "$VTOKEN")
{ [ "$CODE" = 403 ] && grep -q 'ORGANIZATION_REQUIRED' "$BODY"; } || fail "조직 밖 계정의 쓰기 응답 $CODE: $(cat "$BODY")"
pass "조직 밖 계정의 쓰기는 403 ORGANIZATION_REQUIRED"

[ "$(api POST /v1/enterprise/enrollment "{\"organizationId\":$ORG_ID}" "$VTOKEN")" = 201 ] || fail "연결 코드 발급: $(cat "$BODY")"
ENROLL=$(sed -n 's/.*"enrollmentCode":"\([0-9a-f]*\)".*/\1/p' "$BODY")
[ -n "$ENROLL" ] || fail "연결 코드를 읽지 못함"

CODE=$(api POST /v1/enterprise/members "{\"userId\":\"$VIEWER\",\"team\":\"smoke\",\"role\":\"viewer\",\"enrollmentCode\":\"$ENROLL\",\"expectedVersion\":$ORG_VERSION}")
[ "$CODE" = 201 ] || fail "viewer 로 추가 응답 $CODE: $(cat "$BODY")"
MEMBER_ID=$(sed -n 's/.*"member":{"id":\([0-9]*\).*/\1/p' "$BODY")
ORG_VERSION=$(field organizationVersion)
[ -n "$MEMBER_ID" ] && [ -n "$ORG_VERSION" ] || fail "추가 응답 해석 실패: $(cat "$BODY")"
pass "admin 이 연결 코드로 새 계정을 viewer 로 추가"

[ "$(api GET /v1/ai/status '' "$VTOKEN")" = 200 ] || fail "viewer 읽기: $(cat "$BODY")"
CODE=$(api POST /v1/dashboard '{}' "$VTOKEN")
{ [ "$CODE" = 403 ] && grep -q 'ROLE_FORBIDDEN' "$BODY"; } || fail "viewer 쓰기 응답 $CODE: $(cat "$BODY")"
pass "viewer 는 읽을 수 있고 쓰기는 403 ROLE_FORBIDDEN"

CODE=$(api PATCH "/v1/enterprise/members/$MEMBER_ID" "{\"team\":\"smoke\",\"role\":\"editor\",\"active\":true,\"expectedVersion\":$ORG_VERSION}")
[ "$CODE" = 200 ] || fail "editor 로 변경 응답 $CODE: $(cat "$BODY")"
CODE=$(api POST /v1/dashboard '{}' "$VTOKEN")
# 빈 본문은 등급 검사를 통과한 뒤 입력 검증에서 400 으로 끝난다(403 이면 등급 때문에 막힌 것이다).
[ "$CODE" = 400 ] || fail "editor 로 바꾼 뒤 쓰기 응답 $CODE (기대 400, 403 이면 등급이 반영되지 않음): $(cat "$BODY")"
pass "admin 이 editor 로 바꾸면 같은 토큰의 쓰기가 등급을 통과해 입력 검증(400)까지 간다(등급 변경이 즉시 반영)"

CODE=$(api PATCH /v1/enterprise/members/1 "{\"team\":\"x\",\"role\":\"viewer\",\"active\":true,\"expectedVersion\":1}" "$VTOKEN")
{ [ "$CODE" = 403 ] && grep -q 'ROLE_FORBIDDEN' "$BODY"; } || fail "editor 의 등급 변경 시도 응답 $CODE: $(cat "$BODY")"
pass "editor 가 다른 사람의 등급을 바꾸려 하면 403 ROLE_FORBIDDEN"

WRONG=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{"userId":"guest","password":"wrong-password"}' "$BASE/v1/login/signin")
[ "$WRONG" = 401 ] || fail "잘못된 비밀번호 응답 $WRONG (기대 401)"
pass "잘못된 비밀번호는 401로 거절"

[ "$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$BASE/")" = 200 ] || fail "SPA 첫 화면"
pass "SPA 첫 화면 200"

echo "모든 확인 통과"
