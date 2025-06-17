# 슬로우 쿼리 모니터링 시스템

## 개요

VanillaMeta 백엔드 API는 데이터베이스 성능 최적화를 위한 포괄적인 슬로우 쿼리 모니터링 시스템을 제공합니다. 이 시스템은 TypeORM(내부 데이터베이스) 및 Knex(외부 데이터베이스 연결)에서 실행되는 모든 쿼리의 성능을 자동으로 추적합니다.

## 주요 기능

### 1. 자동 쿼리 성능 추적
- **TypeORM 쿼리**: 내부 MySQL 데이터베이스의 모든 쿼리 자동 모니터링
- **Knex 쿼리**: 외부 데이터베이스 연결을 통한 쿼리 모니터링
- **실행 시간 측정**: 각 쿼리의 정확한 실행 시간 기록
- **임계값 기반 감지**: 설정된 임계값을 초과하는 쿼리 자동 감지

### 2. 쿼리 분석 및 최적화 제안
- **실행 계획 분석**: EXPLAIN 분석을 통한 쿼리 성능 진단
- **인덱스 사용 확인**: 인덱스 활용 여부 및 효율성 분석
- **최적화 제안**: 자동으로 생성되는 쿼리 최적화 권장사항
- **다중 데이터베이스 지원**: MySQL, PostgreSQL, SQL Server, Oracle 등

### 3. CloudWatch 통합
- **실시간 메트릭**: CloudWatch로 자동 전송되는 성능 메트릭
- **심각도별 분류**: LOW, MEDIUM, HIGH, CRITICAL 수준으로 분류
- **대시보드 구성**: CloudWatch 대시보드를 통한 시각화

### 4. 관리 API
- **통계 조회**: 슬로우 쿼리 통계 및 트렌드 분석
- **쿼리 목록**: 필터링 및 페이징을 지원하는 쿼리 목록
- **해결 관리**: 쿼리 문제 해결 상태 추적
- **데이터 내보내기**: JSON/CSV 형식으로 데이터 내보내기

## 환경 설정

### 필수 환경 변수

```bash
# 슬로우 쿼리 임계값 (밀리초, 기본값: 1000ms = 1초)
SLOW_QUERY_THRESHOLD=1000

# 슬로우 쿼리 모니터링 활성화 (기본값: true)
SLOW_QUERY_MONITORING_ENABLED=true

# CloudWatch 설정 (AWS Lambda 환경에서 자동 설정)
AWS_REGION=us-east-1
```

### 임계값 설정 가이드

| 환경 | 권장 임계값 | 설명 |
|------|------------|------|
| 개발 | 500ms | 개발 중 성능 문제 조기 발견 |
| 스테이징 | 1000ms | 프로덕션과 유사한 설정 |
| 프로덕션 | 1000-3000ms | 실제 사용 환경에 맞춰 조정 |

## API 엔드포인트

### 1. 슬로우 쿼리 통계 조회

```http
GET /monitoring/slow-queries/stats?periodHours=24
Authorization: Bearer {JWT_TOKEN}
```

**응답 예시:**
```json
{
  "totalSlowQueries": 150,
  "avgExecutionTime": 2500.5,
  "maxExecutionTime": 15000,
  "mostFrequentQueries": [
    {
      "queryHash": "abc123",
      "query": "SELECT * FROM users WHERE...",
      "count": 25,
      "avgExecutionTime": 3200
    }
  ],
  "performanceByDatabase": [
    {
      "databaseId": 1,
      "databaseEngine": "mysql2",
      "count": 80,
      "avgExecutionTime": 2100
    }
  ],
  "severityDistribution": {
    "low": 100,
    "medium": 35,
    "high": 12,
    "critical": 3
  },
  "trendsLast24Hours": [
    {
      "hour": "2024-01-01 10:00:00",
      "count": 8,
      "avgExecutionTime": 2300
    }
  ]
}
```

### 2. 슬로우 쿼리 목록 조회

```http
GET /monitoring/slow-queries?page=1&limit=50&severity=HIGH
Authorization: Bearer {JWT_TOKEN}
```

**쿼리 파라미터:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 50)
- `startDate`: 시작 날짜
- `endDate`: 종료 날짜
- `databaseId`: 특정 데이터베이스 ID
- `severity`: 심각도 필터 (LOW, MEDIUM, HIGH, CRITICAL)
- `minExecutionTime`: 최소 실행 시간 (ms)
- `maxExecutionTime`: 최대 실행 시간 (ms)
- `resolved`: 해결 여부 (true/false)

### 3. 슬로우 쿼리 해결 처리

```http
PUT /monitoring/slow-queries/{id}/resolve
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "resolutionNotes": "인덱스 추가로 해결됨"
}
```

### 4. 모니터링 설정 조회/업데이트

```http
GET /monitoring/slow-queries/config
PUT /monitoring/slow-queries/config
Authorization: Bearer {JWT_TOKEN}
```

**설정 예시:**
```json
{
  "enabled": true,
  "threshold": 1000,
  "maxLogEntries": 10000,
  "cleanupIntervalDays": 30,
  "alertThresholds": {
    "low": 1000,
    "medium": 3000,
    "high": 10000,
    "critical": 30000
  }
}
```

### 5. 데이터 내보내기

```http
GET /monitoring/slow-queries/export?format=csv&startDate=2024-01-01
Authorization: Bearer {JWT_TOKEN}
```

## 쿼리 분석 정보

### 수집되는 정보

1. **기본 정보**
   - 쿼리 텍스트
   - 실행 시간
   - 데이터베이스 ID 및 엔진
   - 실행 시간

2. **성능 메트릭**
   - 검사된 행 수 (rows examined)
   - 반환된 행 수 (rows returned)
   - 인덱스 사용 여부
   - 스캔 타입 (full table scan, index scan 등)

3. **실행 컨텍스트**
   - 사용자 ID
   - API 요청 경로
   - HTTP 메서드
   - 클라이언트 IP
   - Correlation ID

4. **최적화 정보**
   - 임시 테이블 사용 여부
   - 파일 정렬 사용 여부
   - 쿼리 비용
   - 최적화 제안사항

## CloudWatch 대시보드 구성

### 메트릭 네임스페이스
`VanillaMeta/{environment}/Database`

### 주요 메트릭

1. **SlowQueryCount**: 슬로우 쿼리 발생 횟수
2. **SlowQueryExecutionTime**: 슬로우 쿼리 실행 시간
3. **SlowQueryBySeverity**: 심각도별 슬로우 쿼리 수
4. **SlowQueryByDatabase**: 데이터베이스별 슬로우 쿼리 수

### 알람 설정 예시

```json
{
  "AlarmName": "VanillaMeta-SlowQuery-Critical",
  "MetricName": "SlowQueryBySeverity",
  "Namespace": "VanillaMeta/prod/Database",
  "Statistic": "Sum",
  "Period": 300,
  "EvaluationPeriods": 1,
  "Threshold": 5,
  "ComparisonOperator": "GreaterThanThreshold",
  "Dimensions": [{
    "Name": "Severity",
    "Value": "CRITICAL"
  }]
}
```

## 성능 최적화 가이드

### 일반적인 슬로우 쿼리 원인

1. **인덱스 부재**
   - 해결: WHERE 절에 사용되는 컬럼에 인덱스 추가
   - 예시: `CREATE INDEX idx_user_email ON users(email);`

2. **전체 테이블 스캔**
   - 해결: 선택적인 WHERE 조건 추가
   - 인덱스 활용도 확인

3. **과도한 JOIN**
   - 해결: 필요한 데이터만 JOIN
   - 서브쿼리 최적화 고려

4. **대량 데이터 정렬**
   - 해결: ORDER BY 컬럼에 인덱스 추가
   - LIMIT 사용으로 결과 제한

### 모니터링 베스트 프랙티스

1. **정기적인 검토**
   - 주간 단위로 슬로우 쿼리 통계 검토
   - 반복되는 패턴 식별 및 해결

2. **임계값 조정**
   - 환경과 요구사항에 맞춰 임계값 조정
   - 점진적으로 임계값을 낮춰 성능 개선

3. **우선순위 설정**
   - CRITICAL 및 HIGH 심각도 쿼리 우선 해결
   - 빈도가 높은 쿼리부터 최적화

4. **문서화**
   - 해결된 쿼리의 최적화 방법 기록
   - 팀 내 지식 공유

## 문제 해결

### 슬로우 쿼리가 감지되지 않는 경우

1. 환경 변수 확인
   ```bash
   echo $SLOW_QUERY_THRESHOLD
   echo $SLOW_QUERY_MONITORING_ENABLED
   ```

2. 로그 레벨 확인
   - 개발 환경: `debug` 레벨 권장
   - 프로덕션: `warn` 이상 권장

3. 데이터베이스 연결 확인
   - TypeORM 로깅 활성화 여부
   - Knex 이벤트 리스너 연결 상태

### 과도한 로깅 발생 시

1. 임계값 상향 조정
2. 특정 쿼리 패턴 제외 설정
3. 샘플링 비율 조정 (향후 기능)

## 향후 개선 계획

1. **실시간 알림**
   - Slack/이메일 통합
   - Critical 쿼리 즉시 알림

2. **자동 최적화**
   - 인덱스 자동 생성 제안
   - 쿼리 자동 리팩토링

3. **고급 분석**
   - 머신러닝 기반 이상 감지
   - 예측적 성능 분석

4. **대시보드 개선**
   - 웹 기반 실시간 대시보드
   - 커스텀 리포트 생성