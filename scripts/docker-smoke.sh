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

WRONG=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{"userId":"guest","password":"wrong-password"}' "$BASE/v1/login/signin")
[ "$WRONG" = 401 ] || fail "잘못된 비밀번호 응답 $WRONG (기대 401)"
pass "잘못된 비밀번호는 401로 거절"

[ "$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$BASE/")" = 200 ] || fail "SPA 첫 화면"
pass "SPA 첫 화면 200"

echo "모든 확인 통과"
