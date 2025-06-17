# VanillaMeta 알람 테스트 시나리오

## 1. 개요

이 문서는 CloudWatch 알람의 정상 작동을 검증하기 위한 테스트 시나리오를 정의합니다.

## 2. 테스트 환경 설정

### 2.1 사전 요구사항
- AWS CLI 설치 및 구성
- 테스트 환경 접근 권한
- Slack 테스트 채널 생성 (#vanillameta-alerts-test)
- 테스트용 이메일 주소

### 2.2 테스트 데이터
```bash
# 환경 변수 설정
export STAGE=dev
export SERVICE_NAME=vanillameta-backend-api
export REGION=ap-northeast-2
```

## 3. Lambda 함수 알람 테스트

### 3.1 Lambda Error Rate 알람 테스트

#### Critical (5% 초과)
```bash
# 에러를 발생시키는 테스트 페이로드
for i in {1..20}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "trigger-error"}' \
    --region ${REGION} \
    response.json
done

# 5분 후 알람 상태 확인
aws cloudwatch describe-alarms \
  --alarm-names "${SERVICE_NAME}-${STAGE}-Lambda-Error-Rate-Critical" \
  --region ${REGION}
```

#### Warning (2% 초과)
```bash
# 적은 수의 에러 발생
for i in {1..5}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "trigger-error"}' \
    --region ${REGION} \
    response.json
done
```

### 3.2 Lambda Throttle 알람 테스트
```bash
# 동시 실행 제한 임시 설정
aws lambda put-function-concurrency \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --reserved-concurrent-executions 1 \
  --region ${REGION}

# 동시 요청 발생
for i in {1..20}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{}' \
    --region ${REGION} \
    response_$i.json &
done

# 테스트 후 제한 해제
aws lambda delete-function-concurrency \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --region ${REGION}
```

### 3.3 Lambda Duration 알람 테스트
```bash
# 지연 시간을 유발하는 페이로드
aws lambda invoke \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --payload '{"test": "long-running", "delay": 10000}' \
  --region ${REGION} \
  response.json
```

### 3.4 Lambda Memory 알람 테스트
```bash
# 메모리 사용량을 증가시키는 페이로드
aws lambda invoke \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --payload '{"test": "high-memory", "size": "900MB"}' \
  --region ${REGION} \
  response.json
```

## 4. API Gateway 알람 테스트

### 4.1 API Response Time 알람 테스트
```bash
# API 엔드포인트 찾기
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='${STAGE}-${SERVICE_NAME}'].id" \
  --output text \
  --region ${REGION})

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"

# 느린 응답 테스트
for i in {1..10}; do
  curl -X POST ${API_URL}/test/slow \
    -H "Content-Type: application/json" \
    -d '{"delay": 4000}'
done
```

### 4.2 API Error Rate 알람 테스트

#### 5XX 에러 테스트
```bash
# 서버 에러 유발
for i in {1..20}; do
  curl -X POST ${API_URL}/test/error \
    -H "Content-Type: application/json" \
    -d '{"error": "internal-server-error"}'
done
```

#### 4XX 에러 테스트
```bash
# 클라이언트 에러 유발
for i in {1..50}; do
  curl -X POST ${API_URL}/invalid-endpoint \
    -H "Content-Type: application/json"
done
```

## 5. RDS 데이터베이스 알람 테스트

### 5.1 RDS CPU 사용률 알람 테스트

#### Critical (70% 초과)
```bash
# 부하 테스트 도구를 사용한 CPU 사용률 증가
# sysbench 설치 (Amazon Linux 2)
sudo yum install -y sysbench

# RDS 엔드포인트 정보
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier ${DB_INSTANCE_ID} \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text \
  --region ${REGION})

# CPU 부하 테스트 (주의: 프로덕션에서는 실행 금지)
sysbench cpu --cpu-max-prime=20000 --threads=4 --time=300 run

# 또는 MySQL 벤치마크 사용
mysqlslap \
  --host=${RDS_ENDPOINT} \
  --user=admin \
  --password=${DB_PASSWORD} \
  --auto-generate-sql \
  --concurrency=50 \
  --iterations=10 \
  --number-of-queries=1000
```

#### Warning (50% 초과)
```bash
# 낮은 부하로 테스트
mysqlslap \
  --host=${RDS_ENDPOINT} \
  --user=admin \
  --password=${DB_PASSWORD} \
  --auto-generate-sql \
  --concurrency=20 \
  --iterations=5 \
  --number-of-queries=500
```

### 5.2 RDS 연결 수 알람 테스트
```bash
# 다중 연결 생성 스크립트
for i in {1..100}; do
  mysql -h ${RDS_ENDPOINT} -u admin -p${DB_PASSWORD} -e "SELECT SLEEP(300);" &
done

# 현재 연결 수 확인
mysql -h ${RDS_ENDPOINT} -u admin -p${DB_PASSWORD} \
  -e "SHOW STATUS LIKE 'Threads_connected';"

# 테스트 후 연결 종료
killall mysql
```

### 5.3 RDS 메모리 알람 테스트
```bash
# 메모리 집약적 쿼리 실행
mysql -h ${RDS_ENDPOINT} -u admin -p${DB_PASSWORD} <<EOF
-- 큰 테이블 생성 및 조인
CREATE TEMPORARY TABLE test_large (
  id INT PRIMARY KEY,
  data TEXT
);

-- 데이터 삽입
INSERT INTO test_large 
SELECT seq, REPEAT('A', 1000) 
FROM seq_1_to_1000000;

-- 메모리 사용량 증가 쿼리
SELECT COUNT(*) FROM test_large t1 
JOIN test_large t2 ON t1.id < t2.id;
EOF
```

### 5.4 RDS 저장 공간 알람 테스트
```bash
# 대용량 테이블 생성 (주의: 테스트 환경에서만 실행)
mysql -h ${RDS_ENDPOINT} -u admin -p${DB_PASSWORD} <<EOF
CREATE TABLE IF NOT EXISTS test_storage (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  data LONGTEXT
) ENGINE=InnoDB;

-- 1GB 정도의 데이터 삽입
DELIMITER //
CREATE PROCEDURE fill_storage()
BEGIN
  DECLARE i INT DEFAULT 0;
  WHILE i < 1000 DO
    INSERT INTO test_storage (data) 
    VALUES (REPEAT('X', 1048576)); -- 1MB per row
    SET i = i + 1;
  END WHILE;
END//
DELIMITER ;

CALL fill_storage();

-- 테스트 후 정리
DROP PROCEDURE fill_storage;
DROP TABLE test_storage;
EOF
```

### 5.5 RDS 읽기/쓰기 지연 시간 알람 테스트
```bash
# 복잡한 쿼리로 지연 시간 증가
mysql -h ${RDS_ENDPOINT} -u admin -p${DB_PASSWORD} <<EOF
-- 읽기 지연 테스트
SELECT SQL_NO_CACHE 
  d1.*, d2.*, w.* 
FROM dashboard d1
JOIN dashboard d2 ON d1.user_id = d2.user_id
JOIN widget w ON d1.id = w.dashboard_id
WHERE d1.created_dt > DATE_SUB(NOW(), INTERVAL 1 YEAR)
ORDER BY RAND()
LIMIT 10000;

-- 쓰기 지연 테스트
START TRANSACTION;
INSERT INTO widget (dashboard_id, component_id, name, widget_option)
SELECT 
  dashboard_id, 
  component_id, 
  CONCAT('Test_', UUID()), 
  widget_option
FROM widget 
LIMIT 1000;
ROLLBACK;
EOF
```

## 6. 비즈니스 메트릭 알람 테스트

### 6.1 Dashboard Load Time 알람 테스트
```bash
# 대시보드 로딩 시간 메트릭 발행
aws cloudwatch put-metric-data \
  --namespace "VanillaMeta/Business" \
  --metric-name "DASHBOARD_LOAD_TIME" \
  --value 4000 \
  --unit Milliseconds \
  --dimensions DashboardId=test-dashboard \
  --region ${REGION}
```

### 6.2 Query Cache Hit Rate 알람 테스트
```bash
# 캐시 미스 메트릭 발행 (적중률 낮추기)
for i in {1..10}; do
  aws cloudwatch put-metric-data \
    --namespace "VanillaMeta/Business" \
    --metric-name "QUERY_CACHE_MISS" \
    --value 1 \
    --unit Count \
    --dimensions QueryType=test-query \
    --region ${REGION}
done

# 캐시 히트 메트릭 발행
aws cloudwatch put-metric-data \
  --namespace "VanillaMeta/Business" \
  --metric-name "QUERY_CACHE_HIT" \
  --value 1 \
  --unit Count \
  --dimensions QueryType=test-query \
  --region ${REGION}
```

## 7. 복합 알람 테스트

### 7.1 Service Health Composite 알람 테스트
```bash
# 여러 임계값을 동시에 초과
# 1. Lambda 에러 발생
for i in {1..10}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "trigger-error"}' \
    --region ${REGION} \
    response.json
done

# 2. 메모리 사용량 증가
aws cloudwatch put-metric-data \
  --namespace "VanillaMeta/${STAGE}" \
  --metric-name "LAMBDA_MEMORY_UTILIZATION" \
  --value 90 \
  --unit Percent \
  --region ${REGION}
```

### 7.2 Database Health Composite 알람 테스트
```bash
# RDS CPU와 읽기 지연 시간을 동시에 증가
# 1. CPU 부하 생성
mysqlslap \
  --host=${RDS_ENDPOINT} \
  --user=admin \
  --password=${DB_PASSWORD} \
  --auto-generate-sql \
  --concurrency=30 \
  --iterations=5 \
  --number-of-queries=1000 &

# 2. 동시에 복잡한 읽기 쿼리 실행
mysql -h ${RDS_ENDPOINT} -u admin -p${DB_PASSWORD} <<EOF
SELECT SQL_NO_CACHE COUNT(*) 
FROM information_schema.columns c1
CROSS JOIN information_schema.columns c2
LIMIT 1000000;
EOF
```

## 8. 알람 복구 테스트

### 8.1 알람 복구 확인
```bash
# 정상 메트릭 발행하여 알람 해제
for i in {1..20}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "success"}' \
    --region ${REGION} \
    response.json
done

# 알람 상태 확인
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --region ${REGION}
```

## 9. 알림 전달 테스트

### 9.1 이메일 알림 확인
1. 테스트 이메일 주소로 알람 알림 수신 확인
2. 이메일 제목과 내용의 정확성 검증
3. 알람 우선순위별 구분 확인

### 9.2 Slack 알림 확인
1. #vanillameta-alerts-test 채널 확인
2. 멘션 (@channel, @here) 동작 확인
3. 알람 색상 코드 확인 (빨강/주황/노랑)
4. 타임스탬프 및 한국 시간 표시 확인

## 10. 테스트 자동화 스크립트

### 10.1 전체 알람 테스트 실행
```bash
#!/bin/bash
# alarm-test.sh

set -e

echo "Starting VanillaMeta Alarm Tests..."

# Lambda Error Rate Test
echo "Testing Lambda Error Rate..."
./test-lambda-errors.sh

sleep 360  # 6분 대기

# API Response Time Test
echo "Testing API Response Time..."
./test-api-latency.sh

sleep 360

# Memory Usage Test
echo "Testing Memory Usage..."
./test-memory-usage.sh

sleep 360

# Check all alarms
echo "Checking alarm states..."
aws cloudwatch describe-alarms \
  --alarm-name-prefix "${SERVICE_NAME}-${STAGE}" \
  --query "MetricAlarms[?StateValue=='ALARM'].[AlarmName,StateValue]" \
  --output table \
  --region ${REGION}

echo "Alarm tests completed!"
```

## 11. 테스트 결과 검증

### 11.1 성공 기준
- [ ] 모든 알람이 설정된 임계값에서 트리거됨
- [ ] 알람 발생 시간이 5분 이내
- [ ] 이메일 알림이 정상적으로 수신됨
- [ ] Slack 알림이 올바른 채널에 전송됨
- [ ] 알람 복구 시 OK 상태로 전환됨

### 11.2 실패 시 조치사항
1. CloudWatch Logs에서 메트릭 필터 확인
2. SNS 토픽 구독 상태 확인
3. Lambda 함수 권한 확인
4. 알람 임계값 및 평가 기간 재검토

## 12. 정기 테스트 일정

- **월간 테스트**: 매월 첫째 주 화요일 14:00
- **분기별 전체 테스트**: 분기 마지막 주 목요일 10:00
- **긴급 패치 후**: 배포 완료 후 30분 이내

## 13. 테스트 로그 보관

모든 테스트 결과는 다음 경로에 저장:
- S3: `s3://vanillameta-monitoring/alarm-tests/${YYYY}/${MM}/${DD}/`
- 보관 기간: 1년