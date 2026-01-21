# VanillaMeta 트러블슈팅 가이드

이 가이드는 VanillaMeta 플랫폼 운영 중 발생할 수 있는 다양한 문제들에 대한 체계적인 해결 방법을 제공합니다.

## 📋 목차

1. [Lambda 함수 관련 문제](#1-lambda-함수-관련-문제)
2. [데이터베이스 연결 문제](#2-데이터베이스-연결-문제)
3. [성능 문제](#3-성능-문제)
4. [프론트엔드 관련 문제](#4-프론트엔드-관련-문제)
5. [API Gateway 문제](#5-api-gateway-문제)
6. [인증 및 권한 문제](#6-인증-및-권한-문제)
7. [배포 관련 문제](#7-배포-관련-문제)
8. [모니터링 및 로그 문제](#8-모니터링-및-로그-문제)
9. [긴급 대응 절차](#9-긴급-대응-절차)
10. [예방 및 유지보수](#10-예방-및-유지보수)

---

## 1. Lambda 함수 관련 문제

### 1.1 Lambda 타임아웃 오류

**증상**
- API 응답 시간 초과 (30초)
- CloudWatch 로그에 "Task timed out after X seconds" 메시지
- 클라이언트에서 502 Bad Gateway 또는 504 Gateway Timeout

**원인**
- 대용량 데이터 처리 작업
- 외부 API 호출 지연
- 데이터베이스 쿼리 최적화 부족
- 콜드 스타트로 인한 초기화 지연

**해결 방법**

1. **CloudWatch Logs에서 타임아웃 패턴 확인**
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
     --filter-pattern "Task timed out" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

2. **Lambda 설정 조정**
   ```yaml
   # serverless.yml
   provider:
     memorySize: 2048  # 메모리 증가
     timeout: 30       # 최대 타임아웃
   ```

3. **쿼리 최적화**
   - 페이징 구현
   - 인덱스 확인
   - N+1 쿼리 해결

4. **콜드 스타트 최소화**
   - 웜업 플러그인 활성화
   - 프로비저닝된 동시성 설정 고려

### 1.2 메모리 부족 오류

**증상**
- "Runtime exited with error: signal: killed"
- Lambda 함수 메모리 사용량 급증
- 갑작스러운 함수 종료

**원인**
- 대용량 쿼리 결과 메모리 로딩
- 메모리 누수 (연결 객체 미해제)
- 비효율적인 데이터 처리 로직

**해결 방법**

1. **메모리 사용 패턴 분석**
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
     --filter-pattern "Max Memory Used" \
     --start-time $(date -d '24 hours ago' +%s)000
   ```

2. **메모리 설정 증가**
   ```yaml
   provider:
     memorySize: 3008  # 최대 메모리로 증가
   ```

3. **스트리밍 처리 구현**
   ```typescript
   // 대용량 데이터 처리 시 스트리밍 사용
   const stream = knex.select('*').from('large_table').stream();
   ```

### 1.3 콜드 스타트 문제

**증상**
- 첫 번째 요청의 응답 시간이 현저히 긴 경우 (5초 이상)
- CloudWatch에서 Init Duration이 긴 경우

**원인**
- Lambda 함수가 오랫동안 호출되지 않아 컨테이너가 종료됨
- 큰 의존성 패키지 로딩 시간

**해결 방법**

1. **웜업 플러그인 확인**
   ```bash
   # 웜업 상태 확인
   aws logs filter-log-events \
     --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
     --filter-pattern "WarmUp"
   ```

2. **프로비저닝된 동시성 설정** (프로덕션 환경)
   ```yaml
   functions:
     app:
       provisionedConcurrency: 2
   ```

---

## 2. 데이터베이스 연결 문제

### 2.1 연결 풀 고갈

**증상**
- "Too many connections" MySQL 오류
- 간헐적 데이터베이스 연결 실패
- 502 Bad Gateway 응답

**원인**
- 연결 누수 (connection not released)
- 동시 요청이 연결 풀 한계 초과
- 연결 풀 설정이 부적절

**해결 방법**

1. **현재 연결 상태 확인**
   ```sql
   -- MySQL에서 현재 연결 수 확인
   SHOW STATUS WHERE Variable_name = 'Threads_connected';
   SHOW VARIABLES WHERE Variable_name = 'max_connections';
   ```

2. **연결 풀 설정 조정**
   ```typescript
   // knex 연결 풀 설정
   pool: {
     min: 0,
     max: 10,  // RDS max_connections에 맞게 조정
     createTimeoutMillis: 30000,
     acquireTimeoutMillis: 30000,
     idleTimeoutMillis: 600000,
     reapIntervalMillis: 1000,
   }
   ```

3. **연결 누수 진단**
   ```bash
   # 활성 연결이 많은 프로세스 확인
   aws logs filter-log-events \
     --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
     --filter-pattern "Pool connections:" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

### 2.2 느린 쿼리

**증상**
- API 응답 시간 5초 이상
- CloudWatch에서 database query duration 증가
- 타임아웃 오류 빈발

**원인**
- 인덱스 부재 또는 비효율적 인덱스
- 대용량 테이블에서 풀 스캔
- 복잡한 JOIN 쿼리

**해결 방법**

1. **슬로우 쿼리 로그 분석**
   ```sql
   -- MySQL 슬로우 쿼리 로그 확인
   SHOW VARIABLES LIKE 'slow_query_log%';
   SHOW VARIABLES LIKE 'long_query_time';
   ```

2. **쿼리 실행 계획 확인**
   ```sql
   EXPLAIN SELECT * FROM large_table WHERE column = 'value';
   ```

3. **인덱스 추가**
   ```sql
   -- 필요한 인덱스 생성
   CREATE INDEX idx_column_name ON table_name(column_name);
   ```

### 2.3 외부 데이터베이스 연결 실패

**증상**
- 특정 외부 DB 연결 시 오류
- "connect ETIMEDOUT" 또는 "getaddrinfo ENOTFOUND"

**원인**
- 네트워크 연결 문제
- 자격 증명 오류
- 방화벽 또는 보안 그룹 설정

**해결 방법**

1. **연결 테스트**
   ```bash
   # 네트워크 연결 테스트
   telnet database-host 3306
   nslookup database-host
   ```

2. **VPC 및 보안 그룹 확인**
   - Lambda가 올바른 VPC에 있는지 확인
   - 보안 그룹에서 DB 포트 허용 확인

3. **자격 증명 검증**
   ```typescript
   // 연결 테스트 함수
   async function testConnection(config) {
     try {
       const connection = await knex(config);
       await connection.raw('SELECT 1');
       console.log('Connection successful');
     } catch (error) {
       console.error('Connection failed:', error.message);
     }
   }
   ```

---

## 3. 성능 문제

### 3.1 API 응답 지연

**증상**
- 평균 응답 시간 2초 이상
- 사용자 불만 증가
- CloudWatch에서 Duration 메트릭 상승

**원인**
- 비최적화된 데이터베이스 쿼리
- 과도한 API 호출
- 메모리 부족

**해결 방법**

1. **성능 병목 지점 식별**
   ```bash
   # API 응답 시간이 긴 요청 찾기
   aws logs filter-log-events \
     --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
     --filter-pattern '[timestamp, requestId, level, message, duration > 2000]'
   ```

2. **쿼리 최적화**
   - Eager/Lazy 로딩 최적화
   - 불필요한 JOIN 제거
   - 페이징 구현

3. **캐싱 구현**
   ```typescript
   // Redis 캐싱 예시
   const cached = await redis.get(cacheKey);
   if (cached) {
     return JSON.parse(cached);
   }
   
   const result = await query();
   await redis.setex(cacheKey, 300, JSON.stringify(result));
   ```

### 3.2 메모리 사용량 급증

**증상**
- Lambda 메모리 사용률 90% 이상
- 가비지 컬렉션 빈발
- 응답 시간 불규칙적 증가

**해결 방법**

1. **메모리 프로파일링**
   ```bash
   # 메모리 사용량 모니터링
   aws logs filter-log-events \
     --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
     --filter-pattern "Max Memory Used"
   ```

2. **메모리 최적화**
   - 대용량 객체 스트리밍 처리
   - 불필요한 객체 참조 제거
   - 메모리 설정 증가

---

## 4. 프론트엔드 관련 문제

### 4.1 빈 화면 (White Screen)

**증상**
- 로딩 후 빈 화면 표시
- 브라우저 콘솔에 JavaScript 오류

**원인**
- JavaScript 런타임 오류
- API 호출 실패
- 라우팅 문제

**해결 방법**

1. **브라우저 콘솔 확인**
   ```javascript
   // 개발자 도구에서 오류 메시지 확인
   console.error()
   ```

2. **API 응답 확인**
   ```bash
   # API 상태 확인
   curl -I https://api.vanillameta.com/v1/health
   ```

3. **라우팅 문제 해결**
   - React Router 설정 확인
   - 404 처리 로직 검증

### 4.2 차트 렌더링 오류

**증상**
- 차트가 표시되지 않음
- ECharts 관련 오류 메시지

**원인**
- 데이터 형식 불일치
- ECharts 라이브러리 로딩 실패
- 컨테이너 DOM 요소 부재

**해결 방법**

1. **데이터 형식 검증**
   ```javascript
   // 차트 데이터 형식 확인
   console.log('Chart data:', chartData);
   console.log('Chart options:', chartOptions);
   ```

2. **DOM 요소 확인**
   ```javascript
   // 차트 컨테이너 존재 여부 확인
   const container = document.getElementById('chart-container');
   if (!container) {
     console.error('Chart container not found');
   }
   ```

### 4.3 무한 로딩

**증상**
- 로딩 스피너가 계속 표시됨
- API 요청이 완료되지 않음

**원인**
- API 타임아웃
- 에러 처리 부족
- 상태 관리 오류

**해결 방법**

1. **네트워크 탭 확인**
   - 브라우저 개발자 도구에서 API 요청 상태 확인
   - 응답 시간 및 상태 코드 검토

2. **에러 핸들링 추가**
   ```javascript
   try {
     const response = await api.call();
     setData(response.data);
   } catch (error) {
     setError(error.message);
   } finally {
     setLoading(false);
   }
   ```

---

## 5. API Gateway 문제

### 5.1 CORS 오류

**증상**
- 브라우저에서 "Access to fetch at ... has been blocked by CORS policy"
- OPTIONS 요청 실패

**원인**
- CORS 설정 누락 또는 잘못된 설정
- 허용되지 않은 헤더 사용

**해결 방법**

1. **CORS 설정 확인**
   ```yaml
   # serverless.yml
   functions:
     app:
       events:
         - http:
             cors:
               origin: '*'
               headers: '*'
               allowCredentials: true
   ```

2. **브라우저에서 CORS 확인**
   ```bash
   # CORS 헤더 확인
   curl -H "Origin: https://app.vanillameta.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS \
        https://api.vanillameta.com/v1/dashboard
   ```

### 5.2 API Gateway 타임아웃

**증상**
- 30초 후 504 Gateway Timeout
- Lambda는 정상이지만 API Gateway에서 타임아웃

**원인**
- API Gateway 최대 타임아웃 (30초) 초과
- Lambda와 API Gateway 간 통신 문제

**해결 방법**

1. **응답 시간 최적화**
   - 비동기 처리로 전환
   - 배치 처리 구현

2. **타임아웃 설정 확인**
   ```yaml
   provider:
     apiGateway:
       binaryMediaTypes:
         - '*/*'
   ```

---

## 6. 인증 및 권한 문제

### 6.1 JWT 토큰 만료

**증상**
- 401 Unauthorized 응답
- "Token expired" 메시지

**해결 방법**

1. **토큰 갱신 로직 확인**
   ```javascript
   // 토큰 자동 갱신
   if (response.status === 401) {
     await refreshToken();
     return retryRequest();
   }
   ```

2. **토큰 유효성 검증**
   ```bash
   # JWT 토큰 디코딩
   echo "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." | \
   jwt-cli decode --no-verify
   ```

### 6.2 권한 부족 오류

**증상**
- 403 Forbidden 응답
- 특정 기능 접근 불가

**해결 방법**

1. **사용자 권한 확인**
   ```sql
   SELECT * FROM users WHERE id = 'user_id';
   SELECT * FROM user_roles WHERE user_id = 'user_id';
   ```

2. **권한 로직 검토**
   - 역할 기반 접근 제어 (RBAC) 확인
   - 리소스별 권한 매핑 검증

---

## 7. 배포 관련 문제

### 7.1 배포 실패

**증상**
- `serverless deploy` 명령어 실패
- CloudFormation 스택 업데이트 오류

**원인**
- AWS 자격 증명 문제
- CloudFormation 템플릿 오류
- 리소스 한계 초과

**해결 방법**

1. **AWS 자격 증명 확인**
   ```bash
   aws sts get-caller-identity
   aws configure list
   ```

2. **CloudFormation 스택 상태 확인**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name vanillameta-backend-api-prod
   ```

3. **롤백 후 재배포**
   ```bash
   serverless remove --stage prod
   serverless deploy --stage prod
   ```

### 7.2 환경 변수 누락

**증상**
- 배포 후 특정 기능 동작하지 않음
- "Environment variable not found" 오류

**해결 방법**

1. **환경 변수 확인**
   ```bash
   aws lambda get-function-configuration \
     --function-name vanillameta-backend-api-prod-app \
     --query 'Environment.Variables'
   ```

2. **serverless.yml 설정 확인**
   ```yaml
   provider:
     environment:
       DB_HOST: ${self:custom.DB_CONFIG.${self:custom.STAGE}.DB_HOST}
   ```

---

## 8. 모니터링 및 로그 문제

### 8.1 로그가 출력되지 않음

**증상**
- CloudWatch Logs에 로그가 나타나지 않음
- 디버깅 정보 부족

**원인**
- 로그 그룹 권한 문제
- 로그 레벨 설정 부적절

**해결 방법**

1. **로그 그룹 존재 확인**
   ```bash
   aws logs describe-log-groups \
     --log-group-name-prefix "/aws/lambda/vanillameta"
   ```

2. **IAM 권한 확인**
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "logs:CreateLogGroup",
       "logs:CreateLogStream",
       "logs:PutLogEvents"
     ],
     "Resource": "arn:aws:logs:*:*:*"
   }
   ```

### 8.2 메트릭 누락

**증상**
- CloudWatch 메트릭이 업데이트되지 않음
- 대시보드에 데이터가 없음

**해결 방법**

1. **메트릭 네임스페이스 확인**
   ```bash
   aws cloudwatch list-metrics \
     --namespace "VanillaMeta/prod"
   ```

2. **커스텀 메트릭 전송 확인**
   ```typescript
   // 메트릭 전송 로직 검증
   await cloudWatch.putMetricData({
     Namespace: 'VanillaMeta/prod',
     MetricData: [{
       MetricName: 'ApiRequests',
       Value: 1,
       Unit: 'Count'
     }]
   }).promise();
   ```

---

## 9. 긴급 대응 절차

### 9.1 서비스 완전 중단

**즉시 수행할 작업**

1. **서비스 상태 확인**
   ```bash
   # Health check
   curl https://api.vanillameta.com/v1/health
   
   # Lambda 함수 상태
   aws lambda get-function \
     --function-name vanillameta-backend-api-prod-app
   ```

2. **CloudWatch 대시보드 확인**
   - Lambda Errors
   - API Gateway 4XX/5XX
   - RDS Connections

3. **긴급 롤백**
   ```bash
   # 이전 버전으로 롤백
   serverless deploy --stage prod --package .serverless
   ```

### 9.2 에스컬레이션

**연락처 및 절차**
1. 1차: 개발팀 리드 (Slack #emergency)
2. 2차: DevOps 엔지니어
3. 3차: CTO/기술총괄

**정보 수집**
- 장애 발생 시간
- 영향 범위
- 오류 메시지
- CloudWatch 로그 링크

---

## 10. 예방 및 유지보수

### 10.1 정기 점검 (주간)

**체크리스트**
- [ ] CloudWatch 알람 상태 확인
- [ ] 디스크 사용량 (RDS)
- [ ] Lambda 메모리 사용률 추이
- [ ] 에러율 트렌드 분석
- [ ] 보안 업데이트 적용

### 10.2 성능 모니터링

**핵심 지표**
- API 응답 시간 (P95 < 2초)
- 에러율 (< 1%)
- Lambda 콜드 스타트 비율 (< 5%)
- 데이터베이스 연결 사용률 (< 80%)

### 10.3 정기 업데이트

**월간 작업**
- [ ] 의존성 보안 업데이트
- [ ] 슬로우 쿼리 분석 및 최적화
- [ ] 로그 보존 기간 정리
- [ ] 백업 복구 테스트

---

## 📞 긴급 연락망

| 역할 | 담당자 | 연락처 | 대응 시간 |
|------|--------|--------|----------|
| DevOps Lead | - | Slack #emergency | 24/7 |
| Backend Lead | - | Slack #backend | 업무시간 |
| Frontend Lead | - | Slack #frontend | 업무시간 |
| DBA | - | Slack #database | 24/7 |

---

## 📚 관련 문서

- [배포 가이드](./deployment/README.md)
- [모니터링 대시보드](https://cloudwatch.aws.amazon.com)
- [API 문서](./api-documentation.md)
- [아키텍처 가이드](./architecture.md)

---

**최종 업데이트**: 2025-06-17
**문서 버전**: 1.0
**검토 주기**: 월 1회

이 가이드는 지속적으로 업데이트되며, 새로운 이슈 발생 시 즉시 반영됩니다.