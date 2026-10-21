# VanillaMeta 성능 테스트 가이드

## 개요

VanillaMeta 백엔드 API의 성능과 확장성을 보장하기 위한 종합적인 성능 테스트 가이드입니다.

## 테스트 도구

### 1. Jest 기반 성능 테스트
- **위치**: `backend-api/test/performance/`
- **목적**: 단위 및 통합 레벨의 성능 테스트
- **특징**: 메모리 사용량, 응답 시간, 동시성 테스트

### 2. Artillery
- **위치**: `backend-api/test/performance/artillery/`
- **목적**: HTTP 레벨 부하 테스트
- **특징**: 시나리오 기반 테스트, 점진적 부하 증가

### 3. k6
- **위치**: `backend-api/test/performance/k6/`
- **목적**: 고급 부하 및 스트레스 테스트
- **특징**: JavaScript 기반 시나리오, 상세한 메트릭

## 테스트 실행 방법

### Jest 성능 테스트

```bash
# 모든 성능 테스트 실행
yarn test:performance

# 부하 테스트만 실행
yarn test:load

# 향상된 부하 테스트 실행
yarn test:stress
```

### Artillery 테스트

```bash
# Artillery 설치 (전역)
npm install -g artillery

# 부하 테스트 실행
yarn artillery:run

# 리포트 생성
yarn artillery:report
```

### k6 테스트

```bash
# k6 설치
# macOS
brew install k6

# Linux
sudo apt-get update && sudo apt-get install k6

# Windows (Chocolatey)
choco install k6

# 부하 테스트 실행
yarn k6:load

# 스트레스 테스트 실행
yarn k6:stress

# 클라우드 실행 (k6 Cloud 계정 필요)
yarn k6:cloud
```

## 테스트 시나리오

### 1. API 응답 시간 테스트
- **목표**: 모든 API 엔드포인트가 적정 시간 내 응답
- **기준**:
  - 인증: < 2초
  - 대시보드 목록: < 3초
  - 위젯 생성: < 3초
  - 쿼리 실행: < 5초

### 2. 동시성 테스트
- **목표**: 동시 다발적 요청 처리 능력 검증
- **시나리오**:
  - 10-20개 동시 인증 요청
  - 50개 동시 대시보드 조회
  - 15개 동시 위젯 생성

### 3. 메모리 사용량 테스트
- **목표**: 메모리 누수 방지 및 안정적인 메모리 사용
- **기준**:
  - 대량 작업 시 메모리 증가 < 500MB
  - 반복 작업 시 메모리 누수 없음

### 4. 부하 테스트 (Artillery)
- **단계**:
  1. Warm-up: 5 req/s, 1분
  2. Ramp-up: 5 → 50 req/s, 2분
  3. Sustained: 50 req/s, 5분
  4. Stress: 100 req/s, 1분

### 5. 스트레스 테스트 (k6)
- **목표**: 시스템 한계점 파악
- **단계**:
  1. 100 VUs, 30초
  2. 200 VUs, 1분
  3. 500 VUs, 2분
  4. 1000 VUs, 3분
  5. 1500 VUs, 2분
  6. 2000 VUs, 1분 (한계 테스트)

## 성능 기준 (SLA)

### 응답 시간
- P95: < 2초
- P99: < 5초
- 평균: < 1초

### 처리량
- 최소: 50 req/s
- 목표: 100 req/s
- 피크: 200 req/s

### 에러율
- 정상 부하: < 1%
- 높은 부하: < 5%
- 스트레스: < 30%

### 가용성
- 목표: 99.9%
- 최소: 99.5%

## 모니터링 메트릭

### 애플리케이션 메트릭
- 응답 시간 (min, avg, max, p95, p99)
- 처리량 (req/s)
- 에러율 (%)
- 동시 사용자 수

### 시스템 메트릭
- CPU 사용률
- 메모리 사용량
- 네트워크 I/O
- 디스크 I/O

### 데이터베이스 메트릭
- 쿼리 응답 시간
- 연결 풀 사용률
- 슬로우 쿼리 수
- 데드락 발생 수

## 성능 최적화 체크리스트

### 코드 레벨
- [ ] N+1 쿼리 문제 해결
- [ ] 불필요한 데이터 로딩 제거
- [ ] 비효율적인 알고리즘 개선
- [ ] 메모리 누수 제거

### 데이터베이스
- [ ] 인덱스 최적화
- [ ] 쿼리 최적화
- [ ] 연결 풀 크기 조정
- [ ] 캐싱 전략 구현

### 인프라
- [ ] Lambda 메모리 크기 최적화
- [ ] API Gateway 설정 최적화
- [ ] CloudFront 캐싱 활용
- [ ] Auto Scaling 정책 설정

## 문제 해결 가이드

### 높은 응답 시간
1. CloudWatch Logs에서 슬로우 쿼리 확인
2. X-Ray 트레이싱으로 병목 구간 파악
3. 데이터베이스 쿼리 분석
4. 캐싱 적용 검토

### 메모리 부족
1. Lambda 메모리 크기 증가
2. 메모리 프로파일링 실행
3. 대용량 데이터 처리 방식 개선
4. 스트리밍 처리 적용

### 높은 에러율
1. CloudWatch Logs에서 에러 패턴 분석
2. 타임아웃 설정 확인
3. 재시도 로직 구현
4. Circuit Breaker 패턴 적용

## CI/CD 통합

### GitHub Actions
```yaml
- name: Run Performance Tests
  run: |
    yarn test:performance
    yarn artillery:run
```

### 성능 회귀 방지
- PR별 성능 테스트 실행
- 기준치 미달 시 머지 차단
- 성능 메트릭 트렌드 추적

## 리포트 및 대시보드

### CloudWatch Dashboard
- 실시간 성능 메트릭 모니터링
- 알람 설정 (응답 시간, 에러율)
- 커스텀 메트릭 시각화

### Artillery Report
- HTML 리포트 생성
- 응답 시간 분포
- 에러 분석
- 처리량 그래프

### k6 Report
- 상세 메트릭 JSON 출력
- HTML 리포트 생성
- k6 Cloud 대시보드 (선택사항)

## 베스트 프랙티스

1. **정기적 실행**: 주 1회 이상 성능 테스트 실행
2. **기준선 설정**: 정상 상태의 성능 지표 기록
3. **점진적 개선**: 한 번에 하나씩 최적화
4. **문서화**: 모든 성능 개선 사항 기록
5. **모니터링**: 프로덕션 환경 지속 모니터링

## 참고 자료

- [Artillery 문서](https://artillery.io/docs/)
- [k6 문서](https://k6.io/docs/)
- [AWS Lambda 성능 최적화](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [NestJS 성능 팁](https://docs.nestjs.com/techniques/performance)