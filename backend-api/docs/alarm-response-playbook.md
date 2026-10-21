# VanillaMeta 알람 대응 플레이북

## 📋 목차
1. [알람 우선순위 체계](#알람-우선순위-체계)
2. [알람별 대응 절차](#알람별-대응-절차)
3. [긴급 연락처](#긴급-연락처)
4. [사후 조치](#사후-조치)

## 알람 우선순위 체계

### 🚨 Critical (즉시 대응)
- **대응 시간**: 5분 이내
- **담당자**: 온콜 엔지니어 → 팀 리드 → CTO
- **알람 종류**:
  - Lambda 에러율 > 5%
  - API 5xx 에러 다수 발생
  - RDS 디스크 공간 부족
  - API 응답시간 > 3초

### ❗ High (30분 이내 대응)
- **대응 시간**: 30분 이내
- **담당자**: 온콜 엔지니어
- **알람 종류**:
  - Lambda 에러율 > 2%
  - Lambda 메모리 사용량 > 80%
  - RDS CPU > 70%
  - API 4xx 에러 급증

### ⚠️ Medium (업무시간 내 대응)
- **대응 시간**: 4시간 이내
- **담당자**: 담당 개발자
- **알람 종류**:
  - Lambda 콜드 스타트 비율 상승
  - RDS 연결 수 증가
  - DAU 감소

## 알람별 대응 절차

### 1. Lambda 에러율 알람

#### 증상
- Lambda 함수 에러율이 임계값 초과

#### 즉시 확인사항
```bash
# CloudWatch Logs에서 최근 에러 확인
aws logs filter-log-events \
  --log-group-name /aws/lambda/vanillameta-backend-api-prod-serverlessExpressLambdaFunction \
  --filter-pattern "ERROR" \
  --start-time $(date -d '10 minutes ago' +%s)000
```

#### 대응 절차
1. **에러 로그 분석**
   - CloudWatch Logs Insights에서 에러 패턴 확인
   - 특정 엔드포인트에서 발생하는지 확인

2. **일시적 조치**
   - 문제가 되는 엔드포인트 격리 검토
   - 필요시 이전 버전으로 롤백

3. **근본 원인 해결**
   - 버그 수정 및 핫픽스 배포
   - 테스트 케이스 추가

### 2. API 응답시간 지연

#### 증상
- API 평균 응답시간 3초 초과

#### 즉시 확인사항
```bash
# X-Ray 트레이스 확인
aws xray get-trace-summaries \
  --time-range-type LastHour \
  --filter-expression "responseTime > 3"
```

#### 대응 절차
1. **병목 지점 파악**
   - 느린 쿼리 확인 (RDS Performance Insights)
   - Lambda 메모리 사용량 확인
   - 외부 API 연동 지연 확인

2. **즉시 조치**
   - Lambda 메모리 증설 (3GB → 6GB)
   - RDS 쿼리 캐시 활성화
   - Redis 캐시 확인

3. **최적화**
   - 느린 쿼리 인덱스 추가
   - N+1 쿼리 제거
   - 불필요한 데이터 페칭 제거

### 3. Lambda 메모리 부족

#### 증상
- Lambda 메모리 사용률 80% 초과

#### 즉시 확인사항
```bash
# Lambda 메트릭 확인
aws cloudwatch get-metric-statistics \
  --namespace VanillaMeta/Lambda \
  --metric-name MemoryUtilization \
  --dimensions Name=FunctionName,Value=vanillameta-backend-api-prod-serverlessExpressLambdaFunction \
  --statistics Maximum \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300
```

#### 대응 절차
1. **메모리 사용 패턴 분석**
   - 특정 엔드포인트의 과도한 메모리 사용 확인
   - 메모리 누수 가능성 점검

2. **임시 조치**
   - Lambda 메모리 증설
   - 동시 실행 수 제한

3. **코드 최적화**
   - 대용량 데이터 스트리밍 처리
   - 메모리 캐시 크기 조정
   - 불필요한 객체 참조 제거

### 4. RDS CPU 사용률 높음

#### 증상
- RDS CPU 사용률 70% 초과

#### 즉시 확인사항
```sql
-- 현재 실행 중인 쿼리 확인
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- 느린 쿼리 통계
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### 대응 절차
1. **부하 원인 파악**
   - 느린 쿼리 식별
   - 동시 연결 수 확인
   - 락 대기 상황 확인

2. **즉시 조치**
   - 문제 쿼리 중단
   - 읽기 전용 복제본으로 트래픽 분산
   - 연결 풀 크기 조정

3. **최적화**
   - 인덱스 추가/재구성
   - 쿼리 실행 계획 개선
   - 파티셔닝 검토

### 5. RDS 디스크 공간 부족

#### 증상
- RDS 여유 스토리지 10GB 미만

#### 즉시 확인사항
```sql
-- 테이블별 크기 확인
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- 로그 파일 크기 확인
SELECT 
  name,
  size
FROM rds_log_files
ORDER BY size DESC;
```

#### 대응 절차
1. **즉시 공간 확보**
   - 오래된 로그 파일 삭제
   - 불필요한 임시 테이블 제거
   - VACUUM FULL 실행

2. **스토리지 확장**
   - RDS 스토리지 자동 확장 활성화
   - 수동으로 스토리지 크기 증가

3. **장기 대책**
   - 데이터 아카이빙 정책 수립
   - 파티셔닝 구현
   - 로그 로테이션 설정

### 6. API 에러 급증

#### 증상
- 4xx/5xx 에러 급증

#### 즉시 확인사항
```bash
# API Gateway 로그 분석
aws logs filter-log-events \
  --log-group-name API-Gateway-Execution-Logs_${REST_API_ID}/prod \
  --filter-pattern "[timestamp, request_id, event_type, error_message]" \
  --start-time $(date -d '30 minutes ago' +%s)000

# 에러 패턴 집계
aws logs insights query \
  --log-group-name /aws/lambda/vanillameta-backend-api-prod \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | stats count() by bin(5m)'
```

#### 대응 절차
1. **에러 유형 분석**
   - 400: 클라이언트 요청 검증 실패
   - 401/403: 인증/인가 문제
   - 500: 서버 내부 오류
   - 502/504: 타임아웃 또는 연결 문제

2. **즉시 조치**
   - 에러 발생 엔드포인트 격리
   - Rate Limiting 적용
   - 필요시 긴급 공지

3. **문제 해결**
   - 버그 수정 및 배포
   - 클라이언트 가이드 업데이트
   - 모니터링 강화

## 긴급 연락처

### 온콜 로테이션
| 주차 | 담당자 | 연락처 | 백업 담당자 |
|------|--------|--------|-------------|
| 1주차 | 홍길동 | 010-1234-5678 | 김철수 |
| 2주차 | 김철수 | 010-2345-6789 | 이영희 |
| 3주차 | 이영희 | 010-3456-7890 | 박민수 |
| 4주차 | 박민수 | 010-4567-8901 | 홍길동 |

### 외부 지원
- **AWS Support**: [AWS Support Console](https://console.aws.amazon.com/support)
- **DB 벤더 지원**: vendor-support@example.com

## 사후 조치

### 1. 인시던트 리포트 작성
모든 Critical 알람 대응 후 24시간 이내에 작성:

```markdown
## 인시던트 리포트 - [날짜]

### 개요
- **발생 시간**: YYYY-MM-DD HH:MM:SS KST
- **종료 시간**: YYYY-MM-DD HH:MM:SS KST
- **영향 범위**: [영향받은 사용자 수, 서비스]
- **심각도**: Critical/High/Medium

### 타임라인
- HH:MM - 알람 발생
- HH:MM - 1차 대응 시작
- HH:MM - 원인 파악
- HH:MM - 조치 완료
- HH:MM - 서비스 정상화

### 근본 원인
[상세 설명]

### 대응 조치
1. 즉시 조치 사항
2. 임시 해결책
3. 영구 해결책

### 개선 사항
- [ ] 재발 방지 대책
- [ ] 모니터링 개선
- [ ] 프로세스 개선
```

### 2. 포스트모템 미팅
- Critical 인시던트 발생 후 3일 이내 실시
- 참석자: 개발팀, 운영팀, 관련 이해관계자
- 블레임 없는 문화로 진행

### 3. 개선 액션 아이템
- JIRA 티켓 생성
- 다음 스프린트에 반영
- 완료 후 검증

## 알람 테스트 절차

### 월간 알람 테스트
매월 첫째 주 수요일 오후 2시 실시:

1. **Lambda 에러 시뮬레이션**
```bash
# 테스트 에러 발생
curl -X POST https://api.vanillameta.com/v1/test/trigger-error \
  -H "X-Test-Mode: true"
```

2. **메모리 사용량 테스트**
```bash
# 메모리 부하 테스트
curl -X POST https://api.vanillameta.com/v1/test/memory-load \
  -H "X-Test-Mode: true" \
  -d '{"size": "2GB", "duration": "60s"}'
```

3. **알람 전달 확인**
- 이메일 수신 확인
- Slack 알림 확인
- 대응 시간 측정

### 알람 설정 검토
분기별로 알람 임계값 및 설정 검토:
- 오경보 비율 분석
- 임계값 조정
- 새로운 알람 추가 검토