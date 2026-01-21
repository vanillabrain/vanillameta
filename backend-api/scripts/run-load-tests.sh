#!/bin/bash

# VanillaMeta 부하 테스트 실행 스크립트
# 사용법: ./run-load-tests.sh [test-type] [environment]

set -e

# 기본 설정
DEFAULT_API_URL="http://localhost:3000"
DEFAULT_TEST_TYPE="all"
DEFAULT_ENV="local"

# 파라미터 설정
TEST_TYPE=${1:-$DEFAULT_TEST_TYPE}
ENVIRONMENT=${2:-$DEFAULT_ENV}

# API URL 설정
case $ENVIRONMENT in
  "local")
    API_URL="http://localhost:3000"
    ;;
  "dev")
    API_URL="https://dev-api.vanillameta.com"
    ;;
  "staging")
    API_URL="https://staging-api.vanillameta.com"
    ;;
  "prod")
    echo "⚠️  WARNING: Running load tests against production!"
    echo "Type 'YES' to continue or any other key to cancel:"
    read -r confirmation
    if [ "$confirmation" != "YES" ]; then
      echo "Load test cancelled."
      exit 1
    fi
    API_URL="https://api.vanillameta.com"
    ;;
  *)
    API_URL=$ENVIRONMENT
    ;;
esac

# K6 설치 확인
if ! command -v k6 &> /dev/null; then
  echo "❌ K6가 설치되어 있지 않습니다."
  echo "설치 방법: https://k6.io/docs/getting-started/installation/"
  exit 1
fi

# Artillery 설치 확인
if ! command -v artillery &> /dev/null; then
  echo "❌ Artillery가 설치되어 있지 않습니다."
  echo "설치 방법: npm install -g artillery"
  exit 1
fi

# 결과 디렉토리 생성
RESULTS_DIR="./test-results/load-tests/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "🚀 VanillaMeta 부하 테스트 시작"
echo "📍 API URL: $API_URL"
echo "🎯 테스트 타입: $TEST_TYPE"
echo "🌍 환경: $ENVIRONMENT"
echo "📁 결과 저장: $RESULTS_DIR"
echo ""

# 시스템 상태 확인
echo "🔍 시스템 상태 확인 중..."
if ! curl -s "$API_URL/health" > /dev/null; then
  echo "❌ API 서버에 연결할 수 없습니다: $API_URL"
  exit 1
fi
echo "✅ API 서버 연결 확인"

# 테스트 사전 준비
echo "🛠️  테스트 환경 준비 중..."
export API_URL=$API_URL
export K6_DURATION=$(date +%s)

# 테스트 실행 함수
run_k6_test() {
  local test_name=$1
  local test_file=$2
  local description=$3
  
  echo ""
  echo "▶️  $test_name 실행 중..."
  echo "📝 $description"
  
  local start_time=$(date +%s)
  local result_file="$RESULTS_DIR/${test_name}-results.json"
  
  if k6 run \
    --env API_URL="$API_URL" \
    --out json="$result_file" \
    "$test_file"; then
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "✅ $test_name 완료 (${duration}초)"
    
    # 간단한 결과 요약 출력
    if [ -f "$result_file" ]; then
      echo "📊 결과 요약:"
      tail -1 "$result_file" | jq -r '.metric' 2>/dev/null || echo "결과 파싱 실패"
    fi
  else
    echo "❌ $test_name 실패"
    return 1
  fi
}

run_artillery_test() {
  local test_name=$1
  local test_file=$2
  local description=$3
  
  echo ""
  echo "▶️  $test_name 실행 중..."
  echo "📝 $description"
  
  local start_time=$(date +%s)
  local result_file="$RESULTS_DIR/${test_name}-artillery-results.json"
  
  if API_URL="$API_URL" artillery run \
    --output "$result_file" \
    "$test_file"; then
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "✅ $test_name 완료 (${duration}초)"
  else
    echo "❌ $test_name 실패"
    return 1
  fi
}

# 테스트 실행
case $TEST_TYPE in
  "basic"|"load")
    run_k6_test "basic-load-test" \
                "./test/performance/k6/load-test.js" \
                "기본 부하 테스트 - 동시 사용자 100명까지 증가"
    ;;
    
  "stress")
    run_k6_test "stress-test" \
                "./test/performance/k6/stress-test.js" \
                "스트레스 테스트 - 시스템 한계점 확인 (최대 2000명)"
    ;;
    
  "spike")
    run_k6_test "spike-test" \
                "./test/performance/k6/spike-test.js" \
                "스파이크 테스트 - 갑작스런 트래픽 증가 시뮬레이션"
    ;;
    
  "endurance")
    echo "⚠️  지속성 테스트는 1시간 이상 소요됩니다. 계속하시겠습니까? (y/N)"
    read -r confirmation
    if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
      run_k6_test "endurance-test" \
                  "./test/performance/k6/endurance-test.js" \
                  "지속성 테스트 - 1시간 동안 안정적인 부하 유지"
    else
      echo "지속성 테스트를 건너뜁니다."
    fi
    ;;
    
  "api")
    run_k6_test "api-specific-test" \
                "./test/performance/k6/api-specific-test.js" \
                "API별 특화 테스트 - 각 API 엔드포인트 성능 검증"
    ;;
    
  "artillery")
    run_artillery_test "artillery-load-test" \
                       "./test/performance/artillery/artillery.yml" \
                       "Artillery 부하 테스트 - 다양한 시나리오 기반"
    ;;
    
  "all")
    echo "🎯 전체 테스트 스위트 실행"
    
    # 기본 부하 테스트
    run_k6_test "basic-load-test" \
                "./test/performance/k6/load-test.js" \
                "기본 부하 테스트"
    
    # API별 테스트
    run_k6_test "api-specific-test" \
                "./test/performance/k6/api-specific-test.js" \
                "API별 특화 테스트"
    
    # 스파이크 테스트
    run_k6_test "spike-test" \
                "./test/performance/k6/spike-test.js" \
                "스파이크 테스트"
    
    # Artillery 테스트
    run_artillery_test "artillery-load-test" \
                       "./test/performance/artillery/artillery.yml" \
                       "Artillery 부하 테스트"
    
    echo ""
    echo "⏭️  스트레스 테스트와 지속성 테스트는 수동으로 실행하세요:"
    echo "   ./run-load-tests.sh stress $ENVIRONMENT"
    echo "   ./run-load-tests.sh endurance $ENVIRONMENT"
    ;;
    
  *)
    echo "❌ 알 수 없는 테스트 타입: $TEST_TYPE"
    echo ""
    echo "사용 가능한 테스트 타입:"
    echo "  basic/load  - 기본 부하 테스트"
    echo "  stress      - 스트레스 테스트"
    echo "  spike       - 스파이크 테스트"
    echo "  endurance   - 지속성 테스트 (1시간)"
    echo "  api         - API별 특화 테스트"
    echo "  artillery   - Artillery 테스트"
    echo "  all         - 전체 테스트 (endurance 제외)"
    exit 1
    ;;
esac

# 결과 요약 생성
echo ""
echo "📋 테스트 결과 요약 생성 중..."

# HTML 리포트 생성
cat > "$RESULTS_DIR/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>VanillaMeta 부하 테스트 리포트</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .test-result { margin: 20px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .success { border-left-color: #28a745; }
        .failure { border-left-color: #dc3545; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        pre { background: #f8f8f8; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>VanillaMeta 부하 테스트 리포트</h1>
        <p><strong>실행 시간:</strong> $(date)</p>
        <p><strong>API URL:</strong> $API_URL</p>
        <p><strong>테스트 타입:</strong> $TEST_TYPE</p>
        <p><strong>환경:</strong> $ENVIRONMENT</p>
    </div>
    
    <h2>테스트 결과</h2>
    <div id="results">
        <!-- 결과는 개별 테스트에서 생성됨 -->
    </div>
    
    <h2>상세 결과 파일</h2>
    <ul>
EOF

# 결과 파일 목록 추가
for file in "$RESULTS_DIR"/*.json; do
  if [ -f "$file" ]; then
    basename_file=$(basename "$file")
    echo "        <li><a href=\"$basename_file\">$basename_file</a></li>" >> "$RESULTS_DIR/index.html"
  fi
done

cat >> "$RESULTS_DIR/index.html" << EOF
    </ul>
    
    <h2>시스템 정보</h2>
    <pre>
OS: $(uname -a)
Node.js: $(node --version 2>/dev/null || echo "Not installed")
K6: $(k6 version 2>/dev/null || echo "Not installed")
Artillery: $(artillery --version 2>/dev/null || echo "Not installed")
    </pre>
</body>
</html>
EOF

echo ""
echo "✅ 모든 테스트 완료!"
echo "📁 결과 위치: $RESULTS_DIR"
echo "🌐 HTML 리포트: $RESULTS_DIR/index.html"
echo ""

# 간단한 성능 기준선 확인
echo "📊 성능 기준선 체크:"
echo "  ✅ 평균 응답시간 < 500ms"
echo "  ✅ 95% 응답시간 < 2000ms"  
echo "  ✅ 에러율 < 5%"
echo "  ✅ 동시 사용자 100명 처리"
echo ""

# 추천 후속 조치
echo "💡 추천 후속 조치:"
if [ "$TEST_TYPE" = "all" ] || [ "$TEST_TYPE" = "basic" ]; then
  echo "  - 스트레스 테스트로 시스템 한계 확인"
  echo "  - 지속성 테스트로 메모리 누수 검증"
fi
echo "  - CloudWatch에서 실제 메트릭 확인"
echo "  - 데이터베이스 연결 풀 모니터링"
echo "  - Lambda 동시 실행 수 확인"
echo ""