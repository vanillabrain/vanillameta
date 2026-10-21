# CloudWatch Insights 쿼리 템플릿

VanillaMeta 백엔드 API의 로그 분석을 위한 CloudWatch Insights 쿼리 모음입니다.

## 기본 사용법

CloudWatch Console > Logs > Insights에서 아래 쿼리들을 복사하여 사용하세요.

**로그 그룹**: `/aws/lambda/vanillameta-backend-api-{환경}-app`

---

## 🔍 일반 분석 쿼리

### 1. 최근 에러 로그 조회
```sql
fields @timestamp, level, message, metadata.correlationId, metadata.context
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

### 2. HTTP 요청 분석
```sql
fields @timestamp, message, metadata.method, metadata.requestPath, metadata.statusCode, metadata.executionTime, metadata.correlationId
| filter metadata.method exists
| sort @timestamp desc
| limit 50
```

### 3. 응답 시간 분석 (느린 요청)
```sql
fields @timestamp, metadata.method, metadata.requestPath, metadata.executionTime, metadata.correlationId
| filter metadata.executionTime > 1000
| sort metadata.executionTime desc
| limit 20
```

---

## 📊 성능 분석 쿼리

### 4. API 엔드포인트별 평균 응답 시간
```sql
fields metadata.requestPath, metadata.executionTime
| filter metadata.executionTime exists
| stats avg(metadata.executionTime) as avgTime, count() as requestCount by metadata.requestPath
| sort avgTime desc
```

### 5. HTTP 상태 코드별 집계
```sql
fields metadata.statusCode
| filter metadata.statusCode exists
| stats count() as count by metadata.statusCode
| sort count desc
```

### 6. 시간대별 요청 수 (1시간 단위)
```sql
fields @timestamp, metadata.method
| filter metadata.method exists
| stats count() as requestCount by bin(5m)
| sort @timestamp
```

---

## 🔥 에러 분석 쿼리

### 7. 에러 유형별 분석
```sql
fields @timestamp, level, message, metadata.context, metadata.correlationId
| filter level in ["ERROR", "WARN"]
| stats count() as errorCount by level, metadata.context
| sort errorCount desc
```

### 8. 특정 correlation ID 추적
```sql
fields @timestamp, level, message, metadata
| filter metadata.correlationId = "YOUR_CORRELATION_ID_HERE"
| sort @timestamp
```

### 9. 데이터베이스 관련 에러
```sql
fields @timestamp, level, message, metadata.correlationId
| filter message like /database|connection|query|mysql/
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

---

## 👤 사용자 활동 분석

### 10. 사용자별 활동 분석
```sql
fields @timestamp, metadata.userId, metadata.method, metadata.requestPath
| filter metadata.userId exists
| stats count() as activityCount by metadata.userId
| sort activityCount desc
| limit 20
```

### 11. 인증 관련 로그
```sql
fields @timestamp, level, message, metadata.userId, metadata.correlationId
| filter message like /login|auth|token|jwt/
| sort @timestamp desc
| limit 100
```

---

## 🚨 보안 분석 쿼리

### 12. 실패한 로그인 시도
```sql
fields @timestamp, level, message, metadata.ip, metadata.userAgent
| filter message like /login/ and level = "ERROR"
| sort @timestamp desc
| limit 50
```

### 13. 비정상적인 요청 패턴
```sql
fields @timestamp, metadata.ip, metadata.userAgent, metadata.requestPath
| filter metadata.statusCode >= 400
| stats count() as failedRequests by metadata.ip
| sort failedRequests desc
| limit 20
```

---

## 📈 비즈니스 로직 분석

### 14. 대시보드 관련 활동
```sql
fields @timestamp, message, metadata.userId, metadata.requestPath
| filter metadata.requestPath like /dashboard/
| sort @timestamp desc
| limit 100
```

### 15. 위젯 생성/수정 로그
```sql
fields @timestamp, level, message, metadata.userId, metadata.correlationId
| filter message like /widget.*create|widget.*update|widget.*delete/
| sort @timestamp desc
| limit 50
```

### 16. 데이터베이스 연결 시도
```sql
fields @timestamp, level, message, metadata.correlationId
| filter message like /database.*connect|connection.*test/
| sort @timestamp desc
| limit 50
```

---

## 🛠️ 시스템 모니터링

### 17. Lambda 콜드 스타트 감지
```sql
fields @timestamp, @type, @requestId
| filter @type = "START"
| stats count() as coldStarts by bin(1h)
| sort @timestamp
```

### 18. 메모리 사용량 패턴
```sql
fields @timestamp, @maxMemoryUsed, @memorySize
| filter @type = "REPORT"
| stats avg(@maxMemoryUsed) as avgMemory, max(@maxMemoryUsed) as maxMemory by bin(1h)
| sort @timestamp
```

---

## 사용 팁

1. **시간 범위 설정**: 쿼리 실행 전 적절한 시간 범위를 설정하세요.
2. **Correlation ID 활용**: 특정 요청의 전체 플로우를 추적할 때 correlation ID를 사용하세요.
3. **필터 최적화**: 대용량 로그에서는 필터를 먼저 적용하여 성능을 향상시키세요.
4. **정규 표현식**: 복잡한 패턴 매칭에는 정규 표현식을 활용하세요.

---

## 자주 사용하는 필터 패턴

```sql
# 에러만
level = "ERROR"

# 특정 시간 이후
@timestamp > "2025-06-12 10:00:00"

# 특정 사용자
metadata.userId = "user123"

# 느린 응답
metadata.executionTime > 2000

# 특정 IP
metadata.ip = "192.168.1.1"

# HTTP 메서드
metadata.method in ["POST", "PUT", "DELETE"]
```