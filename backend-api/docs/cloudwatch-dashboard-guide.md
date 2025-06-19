# CloudWatch 대시보드 가이드

## 개요

VanillaMeta의 CloudWatch 통합 대시보드는 시스템 전반의 운영 상태를 실시간으로 모니터링할 수 있는 중앙화된 대시보드입니다.

## 주요 기능

### 1. Lambda 함수 모니터링
- **호출 횟수**: 총 호출 수, 에러 수, 스로틀 발생 현황
- **응답 시간**: 평균, P99, 최대 지연시간
- **리소스 사용량**: 동시 실행 수, 메모리 사용률

### 2. API Gateway 모니터링
- **요청 및 에러**: 총 요청 수, 4XX/5XX 에러 현황
- **응답 시간**: 평균, P95, P99 지연시간

### 3. RDS 성능 모니터링
- **CPU 및 연결**: CPU 사용률, 데이터베이스 연결 수
- **메모리 및 스토리지**: 가용 메모리, 가용 저장 공간
- **I/O 성능**: 읽기/쓰기 지연시간, IOPS

### 4. Redis 캐시 모니터링
- **캐시 성능**: CPU 사용률, 현재 연결 수, Evictions
- **캐시 효율성**: 캐시 히트/미스, 캐시 사용량

### 5. 로그 분석
- **최근 에러 로그**: 실시간 에러 로그 조회
- **느린 API 엔드포인트**: 1초 이상 소요되는 요청 분석
- **HTTP 상태 코드 분포**: 상태 코드별 통계
- **사용자 활동**: 활성 사용자 추이 및 상위 사용자

### 6. 커스텀 메트릭
- **쿼리 캐시 효율성**: L1/L2 캐시 히트율
- **백그라운드 작업**: 대기/처리/실패 작업 현황

## 배포 방법

### 1. 자동 배포 (권장)

```bash
# 개발 환경
yarn deploy:dashboard:dev

# 프로덕션 환경
yarn deploy:dashboard:prod
```

### 2. 수동 배포

```bash
# CloudFormation 스택 생성
aws cloudformation create-stack \
    --stack-name vanillameta-cloudwatch-dashboard-dev \
    --template-body file://cloudformation/integrated-monitoring-dashboard.yml \
    --parameters \
        ParameterKey=Environment,ParameterValue=dev \
        ParameterKey=ServiceName,ParameterValue=vanillameta-backend-api \
        ParameterKey=RDSInstanceIdentifier,ParameterValue=vanillameta-rds \
        ParameterKey=RedisClusterName,ParameterValue=vanillameta-redis \
    --capabilities CAPABILITY_IAM \
    --region ap-northeast-2
```

## 대시보드 접근

1. AWS Console 로그인
2. CloudWatch > Dashboards 메뉴 이동
3. `vanillameta-backend-api-{환경}-integrated-dashboard` 선택

또는 배포 완료 후 출력된 URL 직접 접근:
```
https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards:name=vanillameta-backend-api-dev-integrated-dashboard
```

## 알람 설정

### 프로덕션 환경 알람

1. **높은 에러율**: 5분 동안 10개 이상의 에러
2. **Lambda 에러율**: 에러율 5% 초과
3. **API Gateway 5XX**: 5분 동안 5개 이상의 5XX 에러
4. **RDS CPU**: CPU 사용률 80% 초과
5. **RDS 연결 수**: 연결 수 임계값 초과
6. **Lambda 메모리**: 메모리 사용률 85% 초과

### 알람 이메일 구독

```bash
# SNS 토픽 구독
aws sns subscribe \
    --topic-arn arn:aws:sns:ap-northeast-2:123456789012:vanillameta-backend-api-prod-alerts \
    --protocol email \
    --notification-endpoint your-email@example.com
```

## 메트릭 수집 구조

### 1. 자동 수집 메트릭
- AWS 서비스 기본 메트릭 (Lambda, API Gateway, RDS, ElastiCache)
- CloudWatch Logs Insights를 통한 로그 기반 메트릭

### 2. 커스텀 메트릭
- `CloudWatchMetricsService`를 통한 애플리케이션 메트릭
- 실시간 메모리 모니터링
- API 응답 시간 추적
- 캐시 효율성 지표

### 3. 메트릭 네임스페이스
- `VanillaMeta/{environment}`: 커스텀 애플리케이션 메트릭
- `VanillaMeta/Lambda`: Lambda 특화 메트릭

## 모니터링 모범 사례

### 1. 정기적인 대시보드 확인
- 일일 점검: 전반적인 시스템 상태
- 주간 분석: 트렌드 및 패턴 파악
- 월간 리뷰: 용량 계획 및 최적화

### 2. 알람 응답 절차
1. 알람 발생 시 즉시 대시보드 확인
2. 관련 로그 그룹에서 상세 로그 분석
3. 문제 원인 파악 및 조치
4. 필요시 스케일링 또는 최적화 수행

### 3. 비용 최적화
- 불필요한 상세 메트릭은 비활성화
- 로그 보존 기간 적절히 설정 (개발: 7일, 운영: 30일)
- 대시보드 새로고침 주기 조정

## 트러블슈팅

### 메트릭이 표시되지 않을 때
1. Lambda 함수가 실행되고 있는지 확인
2. IAM 권한 확인 (`cloudwatch:PutMetricData`)
3. 메트릭 네임스페이스 및 차원 확인

### 알람이 작동하지 않을 때
1. SNS 토픽 구독 상태 확인
2. 알람 임계값 설정 검토
3. 메트릭 데이터 포인트 확인

### 대시보드 로딩이 느릴 때
1. 위젯 수 최적화
2. 시간 범위 조정
3. 불필요한 통계 제거

## 향후 개선 사항

1. **Grafana 통합**: 더 풍부한 시각화 옵션
2. **이상 탐지**: CloudWatch Anomaly Detector 활용
3. **자동 스케일링**: 메트릭 기반 자동 확장
4. **비용 분석**: Cost Explorer 통합

## 관련 문서

- [AWS CloudWatch 문서](https://docs.aws.amazon.com/cloudwatch/)
- [CloudFormation 템플릿](../cloudformation/integrated-monitoring-dashboard.yml)
- [CloudWatch Metrics Service](../src/common/monitoring/cloudwatch-metrics.service.ts)