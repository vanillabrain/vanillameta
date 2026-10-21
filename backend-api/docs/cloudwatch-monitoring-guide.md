# CloudWatch 모니터링 가이드

VanillaMeta 백엔드 API의 CloudWatch 로그 및 모니터링 설정 가이드입니다.

## 📋 개요

이 문서는 다음 내용을 다룹니다:
- CloudWatch 로그 그룹 구성
- 환경별 로그 설정
- 메트릭 필터 및 알람
- 모니터링 대시보드
- 로그 분석 방법

---

## 🏗️ 아키텍처

### 로그 그룹 구조
```
/aws/lambda/vanillameta-backend-api-{환경}-app
├── dev (7일 보존)
├── prod (30일 보존)
└── local (3일 보존)
```

### 메트릭 네임스페이스
```
VanillaMeta/{환경}/
├── ErrorCount
├── Http5xxErrorCount
└── SlowResponseCount
```

---

## ⚙️ 환경별 설정

### 개발 환경 (dev)
- **로그 레벨**: DEBUG
- **보존 기간**: 7일
- **알람**: 비활성화
- **목적**: 개발 및 디버깅

### 운영 환경 (prod)
- **로그 레벨**: WARN
- **보존 기간**: 30일
- **알람**: 활성화
- **목적**: 안정적인 서비스 운영

### 로컬 환경 (local)
- **로그 레벨**: DEBUG
- **보존 기간**: 3일
- **알람**: 비활성화
- **목적**: 로컬 개발

---

## 📊 메트릭 필터

### 1. ErrorCount
```yaml
FilterPattern: '{ $.level = "ERROR" }'
```
- **목적**: 전체 에러 발생 횟수 추적
- **임계값**: 10건/5분 (운영 환경)

### 2. Http5xxErrorCount
```yaml
FilterPattern: '{ $.metadata.statusCode >= 500 }'
```
- **목적**: HTTP 5xx 서버 에러 추적
- **임계값**: 5건/5분 (운영 환경)

### 3. SlowResponseCount
```yaml
FilterPattern: '{ $.metadata.executionTime > 2000 }'
```
- **목적**: 느린 응답(2초 이상) 추적
- **임계값**: 20건/10분 (운영 환경)

---

## 🚨 알람 설정

### 운영 환경 알람

#### 1. High Error Rate
- **메트릭**: ErrorCount
- **조건**: 10건 초과 (5분간)
- **평가 기간**: 2회 연속

#### 2. Lambda Errors
- **메트릭**: AWS/Lambda Errors
- **조건**: 1건 이상
- **평가 기간**: 1회

#### 3. High Latency
- **메트릭**: AWS/Lambda Duration
- **조건**: 평균 5초 초과
- **평가 기간**: 3회 연속

---

## 📈 모니터링 대시보드

### 위젯 구성

1. **Error Metrics** (시계열)
   - ErrorCount
   - Http5xxErrorCount
   - SlowResponseCount

2. **Lambda Metrics** (시계열)
   - Duration
   - Invocations
   - Errors
   - Throttles

3. **Recent Error Logs** (로그 테이블)
   - 최근 에러 로그 20건

4. **API Response Times** (테이블)
   - 엔드포인트별 평균 응답 시간

5. **HTTP Status Distribution** (테이블)
   - 상태 코드별 요청 수

6. **API Gateway Metrics** (시계열)
   - API Gateway 관련 메트릭

7. **Top Active Users** (테이블)
   - 활동량 상위 사용자

---

## 🔍 로그 분석

### CloudWatch Insights 활용

#### 기본 분석 쿼리
```sql
-- 에러 로그 조회
fields @timestamp, level, message, metadata.correlationId
| filter level = "ERROR"
| sort @timestamp desc
| limit 100

-- 성능 분석
fields metadata.requestPath, metadata.executionTime
| filter metadata.executionTime > 1000
| stats avg(metadata.executionTime) as avgTime by metadata.requestPath
| sort avgTime desc
```

#### Correlation ID 추적
```sql
-- 특정 요청 전체 플로우 추적
fields @timestamp, level, message, metadata
| filter metadata.correlationId = "YOUR_ID_HERE"
| sort @timestamp
```

### 로그 구조

#### 표준 로그 포맷
```json
{
  "timestamp": "2025-06-12 19:30:00.123",
  "level": "INFO",
  "message": "HTTP Request processed",
  "context": "HTTP",
  "metadata": {
    "correlationId": "uuid-v4",
    "method": "POST",
    "requestPath": "/api/dashboard",
    "statusCode": 200,
    "executionTime": 150,
    "userId": "user123",
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

---

## 🔧 운영 가이드

### 일일 모니터링 체크리스트

1. **대시보드 확인**
   - [ ] 에러 발생률 정상 범위 내
   - [ ] API 응답 시간 적절
   - [ ] Lambda 함수 정상 동작

2. **알람 상태 확인**
   - [ ] 활성화된 알람 없음
   - [ ] SNS 알림 정상 수신

3. **로그 분석**
   - [ ] 에러 로그 패턴 분석
   - [ ] 성능 이슈 식별
   - [ ] 사용자 활동 패턴 분석

### 문제 발생 시 대응

#### 1. 에러율 증가
```sql
-- 에러 유형 분석
fields level, message, metadata.context
| filter level = "ERROR"
| stats count() by message, metadata.context
| sort count desc
```

#### 2. 응답 시간 증가
```sql
-- 느린 엔드포인트 식별
fields metadata.requestPath, metadata.executionTime
| filter metadata.executionTime > 2000
| stats avg(metadata.executionTime) as avgTime, count() as slowCount by metadata.requestPath
| sort avgTime desc
```

#### 3. 특정 사용자 이슈
```sql
-- 사용자별 에러 분석
fields metadata.userId, level, message
| filter metadata.userId = "PROBLEM_USER_ID"
| filter level in ["ERROR", "WARN"]
| sort @timestamp desc
```

---

## 💰 비용 최적화

### 로그 보존 정책
- **개발**: 7일 (빠른 피드백, 비용 절약)
- **운영**: 30일 (컴플라이언스, 장기 분석)
- **로컬**: 3일 (최소 보존)

### 로그 레벨 최적화
- **운영**: WARN 이상 (노이즈 감소)
- **개발**: DEBUG (상세 디버깅)

### 메트릭 필터 최적화
- 필요한 메트릭만 생성
- 정확한 필터 패턴 사용
- 불필요한 메트릭 정기 검토

---

## 📚 참고 자료

### AWS 문서
- [CloudWatch Logs User Guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [CloudWatch Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)

### 내부 문서
- [CloudWatch Insights 쿼리 템플릿](./cloudwatch-insights-queries.md)
- [모니터링 대시보드 설정](../cloudformation/monitoring-dashboard.yml)

---

## 🔄 정기 검토 사항

### 월간 검토
- [ ] 로그 보존 정책 적정성
- [ ] 알람 임계값 조정 필요성
- [ ] 비용 대비 효과 분석

### 분기별 검토
- [ ] 대시보드 위젯 최적화
- [ ] 새로운 메트릭 필요성
- [ ] 로그 구조 개선 사항

---

## 🚀 배포 명령어

### Serverless 배포 (로그 설정 포함)
```bash
# 개발 환경
yarn deploy:dev

# 운영 환경
yarn deploy:prod
```

### CloudFormation 대시보드 배포
```bash
aws cloudformation deploy \
  --template-file cloudformation/monitoring-dashboard.yml \
  --stack-name vanillameta-monitoring-prod \
  --parameter-overrides Environment=prod
```

### 로그 그룹 수동 생성 (필요시)
```bash
aws logs create-log-group \
  --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
  --retention-in-days 30
```