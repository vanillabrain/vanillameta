#!/bin/bash
# 데이터베이스 연결 및 상태 체크 스크립트

set -e

STAGE="${STAGE:-prod}"
REGION="${AWS_REGION:-ap-northeast-2}"

echo "🗄️ 데이터베이스 상태 체크 (Stage: $STAGE)"
echo "====================================================="

# RDS 인스턴스 정보 확인 (해당하는 경우)
if [ "$STAGE" = "prod" ]; then
  echo "📊 1. RDS 인스턴스 상태 확인"
  
  # RDS 인스턴스 목록 확인
  aws rds describe-db-instances \
    --region "$REGION" \
    --query 'DBInstances[?contains(DBInstanceIdentifier, `vanillameta`) || contains(DBInstanceIdentifier, `vanilla-meta`)].{
      Identifier: DBInstanceIdentifier,
      Status: DBInstanceStatus,
      Engine: Engine,
      Class: DBInstanceClass,
      Storage: AllocatedStorage,
      MultiAZ: MultiAZ,
      Endpoint: Endpoint.Address
    }' \
    --output table 2>/dev/null || echo "ℹ️ RDS 인스턴스를 찾을 수 없습니다 (외부 DB 사용 중일 수 있음)"

  # RDS 연결 수 확인
  echo -e "\n🔗 2. RDS 연결 메트릭 확인 (최근 1시간)"
  END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
  START_TIME=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)
  
  aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name DatabaseConnections \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 300 \
    --statistics Average,Maximum \
    --region "$REGION" \
    --query 'Datapoints[*].[Timestamp,Average,Maximum]' \
    --output table 2>/dev/null || echo "⚠️ RDS 메트릭을 가져올 수 없습니다"
fi

# Lambda에서 데이터베이스 연결 오류 확인
echo -e "\n🔍 3. Lambda 데이터베이스 연결 오류 확인"
LOG_GROUP="/aws/lambda/vanillameta-backend-api-${STAGE}-app"
START_TIME=$(date -d '1 hour ago' +%s)000

# 연결 오류 패턴 검색
CONNECTION_ERRORS=(
  "ECONNREFUSED"
  "ETIMEDOUT"
  "Too many connections"
  "Connection lost"
  "Pool exhausted"
  "getaddrinfo ENOTFOUND"
)

for error in "${CONNECTION_ERRORS[@]}"; do
  COUNT=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --filter-pattern "$error" \
    --start-time "$START_TIME" \
    --region "$REGION" \
    --query 'length(events)' \
    --output text 2>/dev/null || echo "0")
  
  if [ "$COUNT" -gt 0 ]; then
    echo "❌ $error: $COUNT 건"
  else
    echo "✅ $error: 발생하지 않음"
  fi
done

# 느린 쿼리 확인
echo -e "\n🐌 4. 느린 쿼리 확인 (2초 이상)"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "[timestamp, requestId, level, message, duration > 2000]" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'events[*].[timestamp,message]' \
  --output table 2>/dev/null | head -10 || echo "ℹ️ 느린 쿼리 로그를 찾을 수 없습니다"

# 연결 풀 상태 확인
echo -e "\n🏊 5. 연결 풀 상태 확인"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "Pool connections" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'events[-5:].message' \
  --output text 2>/dev/null || echo "ℹ️ 연결 풀 로그를 찾을 수 없습니다"

# 데이터베이스별 연결 테스트 함수
test_database_connection() {
  local db_type=$1
  local endpoint=$2
  local port=$3
  
  echo "🧪 $db_type 연결 테스트: $endpoint:$port"
  
  if command -v nc &> /dev/null; then
    if timeout 5 nc -z "$endpoint" "$port" 2>/dev/null; then
      echo "✅ $db_type 포트 연결 성공"
    else
      echo "❌ $db_type 포트 연결 실패"
    fi
  elif command -v telnet &> /dev/null; then
    if timeout 5 telnet "$endpoint" "$port" </dev/null 2>/dev/null | grep -q "Connected"; then
      echo "✅ $db_type 포트 연결 성공"
    else
      echo "❌ $db_type 포트 연결 실패"
    fi
  else
    echo "⚠️ nc 또는 telnet이 없어 연결 테스트를 건너뜁니다"
  fi
}

# 환경별 데이터베이스 테스트
echo -e "\n🌐 6. 네트워크 연결 테스트"

if [ "$STAGE" = "local" ]; then
  echo "로컬 환경: SQLite 사용"
  if [ -f "backend-api/database.sqlite" ]; then
    echo "✅ SQLite 파일 존재"
  else
    echo "❌ SQLite 파일 없음"
  fi
else
  # 실제 프로덕션/개발 환경에서는 환경 변수에서 DB 정보 가져오기
  echo "외부 데이터베이스 연결 테스트를 위해서는 DB 엔드포인트 정보가 필요합니다."
  echo "환경 변수 DB_HOST, DB_PORT를 확인하세요."
fi

# 슬로우 쿼리 분석을 위한 추천 쿼리
echo -e "\n💡 7. 수동 확인 권장사항"
echo "다음 SQL을 데이터베이스에서 실행하여 상태를 확인하세요:"
echo ""
echo "-- MySQL/MariaDB:"
echo "SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Max_used_connections');"
echo "SHOW VARIABLES WHERE Variable_name = 'max_connections';"
echo "SHOW PROCESSLIST;"
echo ""
echo "-- PostgreSQL:"
echo "SELECT count(*) as current_connections FROM pg_stat_activity;"
echo "SELECT setting as max_connections FROM pg_settings WHERE name='max_connections';"
echo "SELECT * FROM pg_stat_activity WHERE state = 'active';"

echo -e "\n✅ 데이터베이스 상태 체크 완료"
echo "상세한 분석을 위해 CloudWatch RDS 대시보드를 확인하세요:"
echo "https://console.aws.amazon.com/rds/home?region=$REGION#database-monitoring:"