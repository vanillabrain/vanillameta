# VanillaMeta 부하 테스트 가이드

## 개요

VanillaMeta의 부하 테스트는 시스템의 성능 한계를 파악하고, 병목 지점을 식별하며, 확장성을 검증하기 위해 구현되었습니다.

## 테스트 구성

### 1. 테스트 도구

- **K6**: 주요 부하 테스트 도구
- **Artillery**: 추가 시나리오 테스트
- **Node.js**: 성능 기준선 및 분석 도구

### 2. 테스트 시나리오

#### 2.1 기본 부하 테스트 (`load-test.js`)
- **목적**: 정상적인 부하에서의 시스템 성능 확인
- **사용자 수**: 1 → 50 → 100명
- **지속시간**: 총 13분
- **시나리오**:
  - 인증 플로우
  - 대시보드 작업
  - 위젯 및 데이터 작업
  - 데이터베이스 쿼리
  - 동시성 테스트

#### 2.2 스트레스 테스트 (`stress-test.js`)
- **목적**: 시스템 한계점 확인
- **사용자 수**: 100 → 200 → 500 → 1000 → 1500 → 2000명
- **지속시간**: 총 11분
- **특징**:
  - 시나리오별 가중치 적용
  - 무거운/중간/가벼운 작업 분류
  - 시스템 복구 능력 테스트

#### 2.3 스파이크 테스트 (`spike-test.js`)
- **목적**: 갑작스런 트래픽 증가 대응 능력 확인
- **패턴**: 10명 → 100명 (30초 내)
- **지속시간**: 총 8분
- **측정항목**:
  - 에러율 증가
  - 응답시간 급증
  - 시스템 복구 시간

#### 2.4 지속성 테스트 (`endurance-test.js`)
- **목적**: 장시간 운영 시 안정성 확인
- **사용자 수**: 50명 고정
- **지속시간**: 1시간
- **검증항목**:
  - 메모리 누수
  - 성능 저하
  - 리소스 사용률

#### 2.5 API별 특화 테스트 (`api-specific-test.js`)
- **목적**: 각 API 엔드포인트별 성능 최적화
- **대상 API**:
  - Dashboard API (1.5초 이내)
  - Widget API (1초 이내)
  - Dataset API (0.8초 이내)
  - Query API (3초 이내)
  - Auth API (0.5초 이내)

## 실행 방법

### 1. 사전 준비

```bash
# K6 설치
curl -s https://dl.k6.io/key.gpg | sudo apt-key add -
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Artillery 설치
npm install -g artillery

# 의존성 설치
cd backend-api
npm install
```

### 2. 로컬 테스트

```bash
# 서버 시작
npm run start:local

# 기본 부하 테스트
./scripts/run-load-tests.sh basic local

# 스파이크 테스트
./scripts/run-load-tests.sh spike local

# API별 테스트
./scripts/run-load-tests.sh api local

# 전체 테스트 (endurance 제외)
./scripts/run-load-tests.sh all local
```

### 3. 스테이징/프로덕션 테스트

```bash
# 스테이징 환경
./scripts/run-load-tests.sh basic staging

# 프로덕션 환경 (주의!)
./scripts/run-load-tests.sh basic prod
```

### 4. 개별 테스트 실행

```bash
# K6 직접 실행
k6 run --env API_URL=http://localhost:3000 test/performance/k6/load-test.js

# Artillery 직접 실행
API_URL=http://localhost:3000 artillery run test/performance/artillery/artillery.yml
```

## 성능 기준선

### 1. 기준선 생성

```bash
# 기준선 생성
node scripts/performance-baseline.js create http://localhost:3000

# 기준선 확인
node scripts/performance-baseline.js show
```

### 2. 결과 분석

```bash
# 테스트 결과 분석
node scripts/performance-baseline.js analyze ./test-results/load-tests/20240101/results.json
```

### 3. 성능 임계값

| 메트릭 | 임계값 | 설명 |
|--------|--------|------|
| P95 응답시간 | < 2초 | 95% 요청이 2초 이내 |
| 평균 응답시간 | < 500ms | 평균 응답시간 |
| 에러율 | < 5% | 전체 요청 중 에러 비율 |
| 처리량 | > 50 req/s | 초당 최소 처리 요청 수 |
| 동시 사용자 | 100명 | 안정적 처리 가능 사용자 수 |

## CI/CD 통합

### 1. GitHub Actions

부하 테스트는 다음 상황에서 자동 실행됩니다:

- **매일 새벽 2시**: 정기적인 성능 모니터링
- **PR 생성/업데이트**: 성능에 영향을 줄 수 있는 변경사항
- **수동 실행**: 필요에 따른 수동 트리거

### 2. 워크플로우 구성

```yaml
# .github/workflows/performance-tests.yml
name: Performance Tests
on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
  pull_request:
    paths: ['src/**', 'package.json']
```

### 3. 결과 처리

- **성공**: 테스트 통과 시 결과 저장
- **실패**: PR 차단 및 알림 발송
- **회귀**: 성능 저하 감지 시 경고

## 결과 분석

### 1. 메트릭 이해

- **Response Time**: 요청-응답 시간
- **Throughput**: 초당 처리 요청 수
- **Error Rate**: 에러 발생 비율
- **Virtual Users**: 동시 사용자 수

### 2. 병목 지점 식별

#### 2.1 응답시간 증가
```
원인: 데이터베이스 쿼리 최적화 필요
해결: 인덱스 추가, 쿼리 개선
```

#### 2.2 에러율 증가
```
원인: 연결 풀 부족, 메모리 부족
해결: 연결 풀 설정 조정, 메모리 증설
```

#### 2.3 처리량 감소
```
원인: CPU 병목, 네트워크 대역폭
해결: 인스턴스 업그레이드, CDN 활용
```

### 3. 성능 최적화 우선순위

1. **데이터베이스 최적화**
   - 인덱스 추가
   - 쿼리 개선
   - 연결 풀 조정

2. **캐싱 전략**
   - Redis 캐시 활용
   - API 응답 캐싱
   - 정적 리소스 CDN

3. **아키텍처 개선**
   - Lambda 메모리 조정
   - 동시 실행 수 제한
   - 연결 풀 최적화

## 모니터링 및 알림

### 1. CloudWatch 메트릭

- **Lambda Duration**: 함수 실행 시간
- **Lambda Errors**: 함수 오류율
- **Lambda Concurrent Executions**: 동시 실행 수
- **RDS CPU Utilization**: 데이터베이스 CPU 사용률
- **RDS Connections**: 데이터베이스 연결 수

### 2. 알림 설정

```javascript
// CloudWatch 알람 예시
{
  "AlarmName": "HighResponseTime",
  "MetricName": "Duration",
  "Threshold": 5000,
  "ComparisonOperator": "GreaterThanThreshold"
}
```

### 3. 대시보드

- **성능 대시보드**: 실시간 메트릭 모니터링
- **트렌드 분석**: 장기적인 성능 변화 추적
- **알림 히스토리**: 과거 알림 이벤트 기록

## 트러블슈팅

### 1. 테스트 실행 실패

```bash
# 로그 확인
tail -f test-results/load-tests/latest/console.log

# 서버 상태 확인
curl -f http://localhost:3000/health

# 네트워크 연결 확인
ping localhost
```

### 2. 성능 회귀 감지

```bash
# 최신 기준선과 비교
node scripts/performance-baseline.js analyze latest-results.json

# 상세 분석
k6 run --out csv=detailed-results.csv test/performance/k6/load-test.js
```

### 3. 리소스 부족

```bash
# 시스템 리소스 확인
top
iostat
free -h

# 프로세스 확인
ps aux | grep node
```

## 모범 사례

### 1. 테스트 설계

- **점진적 부하 증가**: 급격한 증가보다는 단계적 증가
- **현실적 시나리오**: 실제 사용자 행동 패턴 반영
- **다양한 테스트 유형**: 각각의 목적에 맞는 테스트 수행

### 2. 결과 해석

- **트렌드 분석**: 단일 결과보다는 장기적 트렌드 확인
- **환경 고려**: 테스트 환경과 프로덕션 환경의 차이 인식
- **상관관계 분석**: 여러 메트릭 간의 관계 파악

### 3. 지속적 개선

- **정기적 실행**: 성능 회귀 조기 감지
- **기준선 업데이트**: 시스템 개선에 따른 기준선 갱신
- **피드백 루프**: 테스트 결과를 개발 프로세스에 반영

## 참고 자료

- [K6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://artillery.io/docs/)
- [성능 테스트 모범 사례](./TESTING_GUIDELINES.md)
- [모니터링 가이드](./cloudwatch-monitoring-guide.md)