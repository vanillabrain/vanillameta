# VanillaMeta 알람 정책 문서

## 1. 개요

이 문서는 VanillaMeta 시스템의 CloudWatch 알람 설정 정책을 정의합니다. 모든 알람은 시스템 안정성과 가용성을 보장하기 위해 설계되었습니다.

## 2. 알람 우선순위 정의

### P0 (Critical) - 즉시 대응 필요 (24/7)
즉각적인 조치가 필요한 서비스 중단 위험이 있는 상황

### P1 (High) - 30분 내 대응
서비스 품질에 심각한 영향을 미치는 상황

### P2 (Medium) - 업무시간 내 대응
성능 저하나 잠재적 문제 상황

### P3 (Low) - 다음 스프린트에서 검토
최적화나 개선이 필요한 상황

## 3. 알람 임계값 정의

### 3.1 Lambda 함수 알람

| 알람명 | 메트릭 | 임계값 | 평가 기간 | 우선순위 | 설명 |
|--------|--------|--------|-----------|----------|------|
| Lambda-Error-Rate-Critical | ErrorRate | > 5% | 2 x 5분 | P0 | Lambda 함수 에러율 5% 초과 |
| Lambda-Error-Rate-Warning | ErrorRate | > 2% | 2 x 5분 | P1 | Lambda 함수 에러율 2% 초과 |
| Lambda-Throttle | Throttles | > 10 | 1 x 5분 | P1 | Lambda 함수 스로틀링 발생 |
| Lambda-Duration-P99 | Duration P99 | > 9000ms | 2 x 5분 | P2 | 응답시간 99분위 9초 초과 |
| Lambda-Concurrent-Execution | ConcurrentExecutions | > 900 | 2 x 5분 | P1 | 동시 실행 수 900 초과 |

### 3.2 API Gateway 알람

| 알람명 | 메트릭 | 임계값 | 평가 기간 | 우선순위 | 설명 |
|--------|--------|--------|-----------|----------|------|
| API-Response-Time-Critical | Latency P99 | > 3000ms | 2 x 5분 | P0 | API 응답시간 3초 초과 |
| API-Response-Time-Warning | Latency P90 | > 1500ms | 2 x 5분 | P1 | API 응답시간 1.5초 초과 |
| API-5XX-Error-Rate | 5XXError | > 1% | 2 x 5분 | P0 | API 5XX 에러율 1% 초과 |
| API-4XX-Error-Rate | 4XXError | > 10% | 3 x 5분 | P2 | API 4XX 에러율 10% 초과 |
| API-Request-Count-Spike | Count | > 10000/분 | 2 x 1분 | P2 | API 요청 급증 감지 |

### 3.3 메모리 사용량 알람

| 알람명 | 메트릭 | 임계값 | 평가 기간 | 우선순위 | 설명 |
|--------|--------|--------|-----------|----------|------|
| Lambda-Memory-Critical | MemoryUtilization | > 85% | 2 x 5분 | P0 | Lambda 메모리 사용률 85% 초과 |
| Lambda-Memory-Warning | MemoryUtilization | > 75% | 2 x 5분 | P1 | Lambda 메모리 사용률 75% 초과 |

### 3.4 RDS 알람

| 알람명 | 메트릭 | 임계값 | 평가 기간 | 우선순위 | 설명 |
|--------|--------|--------|-----------|----------|------|
| RDS-CPU-Critical | CPUUtilization | > 80% | 2 x 5분 | P0 | RDS CPU 사용률 80% 초과 |
| RDS-CPU-Warning | CPUUtilization | > 70% | 3 x 5분 | P1 | RDS CPU 사용률 70% 초과 |
| RDS-Connection-Critical | DatabaseConnections | > 90% of max | 2 x 5분 | P0 | DB 연결 수 최대치의 90% 초과 |
| RDS-Free-Storage | FreeStorageSpace | < 1GB | 2 x 5분 | P1 | RDS 여유 공간 1GB 미만 |

### 3.5 비즈니스 메트릭 알람

| 알람명 | 메트릭 | 임계값 | 평가 기간 | 우선순위 | 설명 |
|--------|--------|--------|-----------|----------|------|
| Dashboard-Load-Slow | DASHBOARD_LOAD_TIME P90 | > 3000ms | 3 x 5분 | P2 | 대시보드 로딩 3초 초과 |
| Query-Cache-Hit-Low | QUERY_CACHE_HIT_RATE | < 50% | 3 x 5분 | P2 | 쿼리 캐시 적중률 50% 미만 |
| Widget-Render-Slow | WIDGET_RENDER_TIME P90 | > 1000ms | 3 x 5분 | P2 | 위젯 렌더링 1초 초과 |

## 4. 알림 채널 설정

### 4.1 이메일 알림
- P0: 운영팀 전체 + 개발팀 리더
- P1: 운영팀 담당자
- P2: 일일 요약 리포트
- P3: 주간 요약 리포트

### 4.2 Slack 알림
- 채널: #vanillameta-alerts
- P0: @channel 멘션 포함
- P1: @here 멘션 포함
- P2/P3: 멘션 없이 알림만

### 4.3 PagerDuty (향후 구현)
- P0 알람만 연동
- 에스컬레이션 정책 적용

## 5. 알람 억제 (Suppression) 정책

### 5.1 정기 점검 시간
- 매주 화요일 02:00-04:00 KST
- 알람 억제 또는 임계값 완화

### 5.2 배포 중 알람 억제
- 배포 시작 전 5분부터 배포 완료 후 10분까지
- P2, P3 알람만 억제

## 6. 알람 테스트 절차

### 6.1 월간 알람 테스트
1. 테스트 환경에서 임계값 도달 시뮬레이션
2. 알람 발생 확인 (5분 이내)
3. 알림 채널 전달 확인
4. 알람 복구 확인

### 6.2 분기별 장애 대응 훈련
1. 실제 알람 시나리오 시뮬레이션
2. 대응 플레이북 따라 조치
3. 대응 시간 측정 및 개선점 도출

## 7. 알람 설정 변경 프로세스

1. 변경 요청서 작성 (JIRA)
2. 영향도 분석
3. 테스트 환경 검증
4. 운영팀 리뷰 및 승인
5. 프로덕션 적용
6. 모니터링 (24시간)

## 8. 알람 히스토리 관리

- 모든 알람 발생 기록은 CloudWatch Logs에 90일간 보존
- 월간 알람 분석 리포트 작성
- False Positive 분석 및 임계값 조정

## 9. 비용 최적화

- 불필요한 알람 정기 검토 (분기별)
- 고해상도 메트릭은 P0, P1 알람만 사용
- 복합 알람 활용으로 개별 알람 수 감소