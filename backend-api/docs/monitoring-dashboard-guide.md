# CloudWatch 통합 모니터링 대시보드 가이드

## 개요

VanillaMeta Backend API의 통합 모니터링 대시보드는 시스템 전반의 운영 상태를 실시간으로 모니터링할 수 있는 CloudWatch 대시보드입니다. Lambda, API Gateway, RDS 등 주요 AWS 서비스의 메트릭을 한눈에 확인할 수 있습니다.

## 주요 기능

### 1. 통합 대시보드 구성

#### Lambda 함수 메트릭
- **호출 횟수**: 총 함수 호출 수
- **에러**: 함수 실행 중 발생한 에러 수
- **지연시간**: 평균, 최대, 최소 실행 시간
- **동시 실행**: 동시에 실행되는 함수 인스턴스 수
- **콜드 스타트**: 콜드 스타트 발생 횟수

#### API Gateway 메트릭
- **요청 수**: API 총 요청 수
- **4XX/5XX 에러**: 클라이언트 및 서버 에러 발생률
- **지연시간**: API 응답 시간 (평균, 최대, 최소)

#### RDS 메트릭 (선택적)
- **CPU 사용률**: 데이터베이스 CPU 사용률
- **메모리 사용률**: 사용 가능한 메모리
- **연결 수**: 활성 데이터베이스 연결 수
- **I/O 성능**: 읽기/쓰기 지연시간 및 IOPS
- **스토리지**: 사용 가능한 스토리지 공간

#### 커스텀 애플리케이션 메트릭
- **에러 수**: 애플리케이션 레벨 에러
- **느린 응답**: 5초 이상 걸린 요청
- **느린 쿼리**: 데이터베이스 느린 쿼리
- **연결 풀**: 데이터베이스 연결 풀 상태

### 2. 실시간 로그 분석

- **최근 에러 로그**: 최근 발생한 에러 및 5XX 응답
- **느린 API 엔드포인트**: 5초 이상 걸리는 API 목록
- **중요 느린 쿼리**: 성능에 심각한 영향을 주는 쿼리

### 3. 알람 설정 (프로덕션 환경)

#### 시스템 건강성 종합 알람
여러 개별 알람을 조합한 종합 시스템 상태 알람:
- 높은 에러율
- Lambda 함수 에러
- 높은 지연시간
- API Gateway 5XX 에러
- 중요 느린 쿼리

#### 개별 알람
- **API Gateway 5XX 알람**: 10개 이상의 5XX 에러 발생 시
- **RDS CPU 알람**: CPU 사용률 80% 초과 시
- **RDS 연결 수 알람**: 연결 수가 임계값 초과 시

## 배포 방법

### 1. 사전 요구사항

- AWS CLI 설치 및 구성
- CloudFormation 권한이 있는 AWS 계정
- (선택적) RDS 인스턴스 ID

### 2. 배포 스크립트 실행

```bash
# 개발 환경 배포
./scripts/deploy-monitoring-dashboard.sh dev

# 프로덕션 환경 배포 (RDS 포함)
RDS_INSTANCE_ID=your-rds-instance-id ./scripts/deploy-monitoring-dashboard.sh prod
```

### 3. 수동 배포

```bash
# CloudFormation 템플릿 검증
aws cloudformation validate-template \
  --template-body file://cloudformation/integrated-monitoring-dashboard.yml

# 스택 배포
aws cloudformation deploy \
  --template-file cloudformation/integrated-monitoring-dashboard.yml \
  --stack-name vanillameta-backend-api-dev-integrated-monitoring \
  --parameter-overrides \
    Environment=dev \
    ServiceName=vanillameta-backend-api \
    DBInstanceIdentifier=your-rds-instance-id \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

## 대시보드 접근 방법

### 1. AWS 콘솔을 통한 접근

1. AWS CloudWatch 콘솔 접속
2. 좌측 메뉴에서 "Dashboards" 선택
3. `vanillameta-backend-api-{environment}-integrated-monitoring` 대시보드 선택

### 2. 직접 URL 접근

배포 후 출력되는 대시보드 URL로 직접 접근:
```
https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards:name=vanillameta-backend-api-dev-integrated-monitoring
```

### 3. 접근 권한 설정

대시보드에 접근하려면 다음 IAM 정책이 필요합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetDashboard",
        "cloudwatch:ListDashboards",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "logs:GetLogEvents",
        "logs:StartQuery",
        "logs:StopQuery",
        "logs:GetQueryResults",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    }
  ]
}
```

또는 배포 시 생성되는 `DashboardAccessPolicy`를 사용자/역할에 연결:
```bash
aws iam attach-user-policy \
  --user-name your-username \
  --policy-arn arn:aws:iam::123456789012:policy/vanillameta-backend-api-dev-dashboard-access
```

## 대시보드 사용법

### 1. 시간 범위 설정

대시보드 우측 상단에서 원하는 시간 범위 선택:
- 최근 1시간
- 최근 24시간
- 최근 7일
- 최근 30일
- 사용자 정의 범위

### 2. 자동 새로고침

대시보드 우측 상단에서 자동 새로고침 설정:
- 10초
- 1분
- 5분
- 사용자 정의

### 3. 위젯 커스터마이징

각 위젯에서 우측 상단 메뉴 클릭:
- **View in metrics**: 메트릭 상세 보기
- **View logs**: 로그 상세 보기
- **Edit**: 위젯 설정 변경

### 4. 알람 구독 설정 (프로덕션)

SNS 토픽에 이메일 구독 추가:
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-2:123456789012:vanillameta-backend-api-prod-integrated-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## 메트릭 해석 가이드

### Lambda 메트릭
- **Duration**: 함수 실행 시간. 25초 이상이면 경고, 30초 도달 시 타임아웃
- **Errors**: 0이어야 정상. 1 이상이면 즉시 확인 필요
- **Throttles**: 0이어야 정상. 발생 시 동시 실행 한도 증가 고려

### API Gateway 메트릭
- **4XXError**: 클라이언트 오류. 급증 시 API 사용 패턴 확인
- **5XXError**: 서버 오류. 발생 시 즉시 조치 필요
- **Latency**: 1초 이하가 이상적. 5초 이상은 성능 문제

### RDS 메트릭
- **CPUUtilization**: 70% 이하 유지 권장
- **DatabaseConnections**: 인스턴스 클래스별 최대값의 80% 이하 유지
- **FreeableMemory**: 인스턴스 메모리의 25% 이상 유지

### 커스텀 메트릭
- **ConnectionPoolUtilization**: 80% 이하 유지. 초과 시 풀 크기 증가
- **SlowQueryCount**: 분당 10개 이하 유지. 초과 시 쿼리 최적화 필요
- **ErrorRate**: 1% 이하 유지. 초과 시 에러 원인 분석

## 문제 해결

### 대시보드가 표시되지 않는 경우
1. CloudWatch 권한 확인
2. 올바른 리전인지 확인
3. 스택 배포 상태 확인

### 메트릭이 표시되지 않는 경우
1. Lambda 함수가 실행되고 있는지 확인
2. CloudWatch Logs 권한 확인
3. 메트릭 네임스페이스 확인

### 알람이 작동하지 않는 경우
1. SNS 토픽 구독 확인
2. 알람 임계값 설정 확인
3. 메트릭 데이터 존재 여부 확인

## 모범 사례

1. **정기적인 모니터링**: 매일 대시보드를 확인하여 이상 징후 조기 발견
2. **알람 설정**: 중요 메트릭에 대한 알람 설정으로 자동 알림
3. **기준선 설정**: 정상 상태의 메트릭 값을 파악하여 이상 감지
4. **문서화**: 발생한 문제와 해결 방법을 문서화
5. **주기적인 리뷰**: 메트릭과 알람 설정을 주기적으로 검토 및 조정

## 추가 리소스

- [AWS CloudWatch 문서](https://docs.aws.amazon.com/cloudwatch/)
- [CloudWatch 대시보드 API](https://docs.aws.amazon.com/cloudwatch/latest/APIReference/)
- [CloudWatch Logs Insights 쿼리 구문](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)