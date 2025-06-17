---
task_id: T08_S07
sprint_sequence_id: S07
status: completed
complexity: Low
last_updated: 2025-06-17T12:00:00Z
completed_at: 2025-06-17T12:00:00Z
---

# Task: 배포 및 운영 가이드 작성

## Description
VanillaMeta 서비스의 안전한 배포와 안정적인 운영을 위한 종합 가이드를 작성합니다. 배포 프로세스, 롤백 절차, 모니터링 방법, 백업/복구 전략 등 운영에 필요한 모든 정보를 체계적으로 문서화합니다.

## Goal / Objectives
- 표준화된 배포 프로세스 확립
- 운영 리스크 최소화
- 신규 팀원의 빠른 온보딩 지원

## Acceptance Criteria
- [x] 단계별 배포 프로세스 문서화
- [x] 롤백 시나리오 및 절차 명시
- [x] 환경별(dev/staging/prod) 배포 가이드
- [x] 배포 체크리스트 제공
- [x] 장애 대응 프로세스 정의
- [x] 백업 및 복구 절차 문서화

## Subtasks
- [x] 현재 배포 프로세스 분석 및 개선점 도출
- [x] 배포 자동화 스크립트 문서화
- [x] 환경별 설정 및 주의사항 정리
- [x] 모니터링 및 알람 대응 가이드 작성
- [x] 백업/복구 절차 및 테스트 방법 문서화
- [x] 운영 체크리스트 및 일일 점검 항목 작성

## Technical Guidance

### Key Interfaces and Integration Points
- Serverless Framework
- AWS Lambda, API Gateway, RDS
- GitHub Actions (CI/CD)
- CloudFormation
- AWS Systems Manager

### Specific Imports and Module References
```bash
# Serverless 배포 명령어
serverless deploy --stage prod
serverless rollback --stage prod
# AWS CLI 명령어
aws lambda update-function-code
aws cloudformation describe-stacks
```

### Existing Patterns to Follow
- 기존 serverless.yml 설정
- package.json의 배포 스크립트
- CloudFormation 템플릿 구조

### Database Models and API Contracts
- 데이터베이스 마이그레이션 절차
- API 버전 관리 전략

## Implementation Notes

### Step-by-Step Implementation Approach
1. 현재 배포 프로세스 전체 플로우 도식화
2. 각 단계별 상세 절차 문서화
3. 자동화 가능 영역 식별 및 스크립트화
4. 장애 시나리오별 대응 방안 수립
5. 운영 매뉴얼 초안 작성 및 검토
6. 실제 배포 시 검증 및 개선

### Key Architectural Decisions
- Blue/Green 배포 전략 채택
- 카나리 배포를 통한 점진적 롤아웃
- Infrastructure as Code 원칙 준수

### Testing Approach
- 스테이징 환경에서 전체 프로세스 검증
- 롤백 시나리오 실습
- 장애 복구 훈련 실시

### Performance Considerations
- 무중단 배포 보장
- 배포 중 성능 모니터링
- 리소스 프로비저닝 최적화

### Deployment Guide Structure
```markdown
# VanillaMeta 배포 및 운영 가이드

## 1. 배포 프로세스

### 1.1 사전 준비
- [ ] 코드 리뷰 완료
- [ ] 모든 테스트 통과
- [ ] 변경사항 문서화
- [ ] 롤백 계획 수립

### 1.2 개발 환경 배포
```bash
# 1. 환경 변수 확인
export NODE_ENV=dev
export AWS_PROFILE=vanillameta-dev

# 2. 의존성 설치
cd backend-api && yarn install
cd ../frontend-web && yarn install

# 3. 백엔드 배포
cd backend-api
yarn deploy:dev

# 4. 프론트엔드 배포
cd ../frontend-web
yarn deploy:dev
```

### 1.3 프로덕션 배포
```bash
# 1. 사전 체크
./scripts/pre-deploy-check.sh

# 2. 데이터베이스 백업
aws rds create-db-snapshot \
  --db-instance-identifier vanillameta-prod \
  --db-snapshot-identifier vanillameta-prod-$(date +%Y%m%d%H%M%S)

# 3. 백엔드 배포 (카나리)
cd backend-api
serverless deploy --stage prod --canary

# 4. 모니터링 (15분)
watch -n 60 'aws cloudwatch get-metric-statistics ...'

# 5. 전체 배포
serverless deploy --stage prod

# 6. 프론트엔드 배포
cd ../frontend-web
yarn build:prod
yarn deploy:prod
```

## 2. 롤백 절차

### 2.1 Lambda 함수 롤백
```bash
# 이전 버전으로 즉시 롤백
serverless rollback --stage prod --timestamp 1234567890

# 또는 특정 버전으로 알리아스 변경
aws lambda update-alias \
  --function-name vanillameta-api-prod \
  --function-version 42
```

### 2.2 데이터베이스 롤백
```bash
# 스냅샷에서 복원
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vanillameta-prod-restore \
  --db-snapshot-identifier vanillameta-prod-20240101120000
```

## 3. 모니터링 및 알람

### 3.1 주요 모니터링 지표
- Lambda 에러율: < 0.1%
- API 응답시간: P99 < 3초
- 메모리 사용률: < 80%

### 3.2 알람 대응
1. Critical 알람: 즉시 대응 (24/7)
2. Warning 알람: 업무시간 내 대응
3. Info 알람: 일일 점검 시 확인

## 4. 백업 및 복구

### 4.1 자동 백업
- RDS: 일일 자동 백업 (7일 보관)
- S3: 버전 관리 활성화
- 코드: Git 태그 관리

### 4.2 복구 절차
1. 백업 시점 확인
2. 복구 환경 준비
3. 데이터 복원
4. 서비스 재시작
5. 검증 및 모니터링

## 5. 운영 체크리스트

### 일일 점검
- [ ] CloudWatch 대시보드 확인
- [ ] 에러 로그 검토
- [ ] 디스크 사용량 확인
- [ ] 백업 상태 확인

### 주간 점검
- [ ] 성능 메트릭 분석
- [ ] 보안 업데이트 확인
- [ ] 비용 분석
- [ ] 용량 계획 검토

### 월간 점검
- [ ] 장애 복구 훈련
- [ ] 문서 업데이트
- [ ] 팀 회고
- [ ] 개선 계획 수립
```

## Output Log
*(This section is populated as work progresses on the task)*

### 2025-06-17 - 배포 및 운영 가이드 작성 완료

#### 작업 내용
1. VanillaMeta 프로젝트 배포 프로세스 문서화
2. 환경별 배포 절차 상세 설명
3. 롤백 및 장애 대응 프로세스 정의
4. 모니터링 및 알람 대응 가이드 작성
5. 백업/복구 절차 문서화
6. 운영 체크리스트 제공

#### 문서 구조
- 배포 전 준비사항
- 환경별 배포 프로세스 (로컬/개발/프로덕션)
- 롤백 절차
- 모니터링 및 알람 대응
- 백업 및 복구
- 운영 체크리스트
- 트러블슈팅 가이드

---

# VanillaMeta 배포 및 운영 가이드

## 목차
1. [개요](#1-개요)
2. [배포 아키텍처](#2-배포-아키텍처)
3. [배포 전 준비사항](#3-배포-전-준비사항)
4. [환경별 배포 프로세스](#4-환경별-배포-프로세스)
5. [롤백 절차](#5-롤백-절차)
6. [모니터링 및 알람](#6-모니터링-및-알람)
7. [백업 및 복구](#7-백업-및-복구)
8. [운영 체크리스트](#8-운영-체크리스트)
9. [트러블슈팅](#9-트러블슈팅)
10. [보안 고려사항](#10-보안-고려사항)

## 1. 개요

### 1.1 문서 목적
이 문서는 VanillaMeta 서비스의 안전한 배포와 안정적인 운영을 위한 종합 가이드입니다.

### 1.2 대상 독자
- DevOps 엔지니어
- 백엔드 개발자
- 프론트엔드 개발자
- 시스템 운영자

### 1.3 환경 구성
- **로컬 환경**: 개발자 로컬 머신
- **개발 환경**: AWS 개발 계정
- **프로덕션 환경**: AWS 프로덕션 계정

## 2. 배포 아키텍처

### 2.1 인프라 구성
```
┌─────────────────────────────────────────────────────────┐
│                     CloudFront                          │
│                  (CDN Distribution)                     │
└─────────────────┬───────────────┬──────────────────────┘
                  │               │
         ┌────────▼──────┐   ┌───▼────────────┐
         │   S3 Bucket   │   │  API Gateway   │
         │ (Frontend)    │   │   (REST API)   │
         └───────────────┘   └───────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │ Lambda Function │
                            │  (NestJS API)   │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │   RDS MySQL     │
                            │   (Database)    │
                            └─────────────────┘
```

### 2.2 기술 스택
- **백엔드**: NestJS + TypeScript + AWS Lambda
- **프론트엔드**: React + TypeScript + Material-UI
- **인프라**: AWS Serverless Framework
- **데이터베이스**: RDS MySQL / SQLite (로컬)

## 3. 배포 전 준비사항

### 3.1 필수 도구 설치
```bash
# Node.js 14.x 이상
node --version

# Yarn 패키지 매니저
yarn --version

# AWS CLI
aws --version

# Serverless Framework
serverless --version
```

### 3.2 AWS 자격 증명 설정
```bash
# AWS 프로필 설정
aws configure --profile vanillameta-dev
aws configure --profile vanillameta-prod

# 프로필 확인
aws sts get-caller-identity --profile vanillameta-dev
```

### 3.3 환경 변수 설정
```bash
# backend-api/.env.dev
DB_HOST=your-dev-db-host
DB_PORT=3306
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_NAME=vanillameta_dev

# frontend-web/.env.development
REACT_APP_API_URL=https://dev-api.vanillameta.com/v1
REACT_APP_MODE=development
```

### 3.4 배포 전 체크리스트
- [ ] 코드 리뷰 완료
- [ ] 모든 테스트 통과
- [ ] 브랜치 병합 완료
- [ ] 환경 변수 확인
- [ ] 데이터베이스 마이그레이션 준비
- [ ] 롤백 계획 수립
- [ ] 배포 공지 발송

## 4. 환경별 배포 프로세스

### 4.1 로컬 환경 실행

#### 백엔드 로컬 실행
```bash
cd backend-api

# 의존성 설치
yarn install

# SQLite 데이터베이스 초기화
yarn seed

# 로컬 서버 실행
yarn start:local
# http://localhost:3000 에서 실행됨
```

#### 프론트엔드 로컬 실행
```bash
cd frontend-web

# 의존성 설치
yarn install

# 개발 서버 실행
yarn start:local
# http://localhost:3006 에서 실행됨
```

### 4.2 개발 환경 배포

#### 백엔드 개발 환경 배포
```bash
cd backend-api

# 1. 환경 변수 설정
export AWS_PROFILE=vanillameta-dev
export NODE_ENV=dev

# 2. 의존성 설치 및 빌드
yarn install
yarn build

# 3. 테스트 실행
yarn test:baseline

# 4. 배포 실행
yarn deploy:dev

# 5. 배포 확인
serverless info --stage dev

# 6. 엔드포인트 테스트
curl https://dev-api.vanillameta.com/v1/health
```

#### 프론트엔드 개발 환경 배포
```bash
cd frontend-web

# 1. 환경 변수 설정
export AWS_PROFILE=vanillameta-dev

# 2. 빌드
yarn build:dev

# 3. 배포
yarn deploy:dev

# 4. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*" \
  --profile vanillameta-dev
```

### 4.3 프로덕션 환경 배포

#### 배포 전 확인사항
```bash
# 1. 현재 버전 태깅
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 2. 데이터베이스 백업
aws rds create-db-snapshot \
  --db-instance-identifier vanillameta-prod \
  --db-snapshot-identifier vanillameta-prod-$(date +%Y%m%d-%H%M%S) \
  --profile vanillameta-prod

# 3. 현재 Lambda 버전 확인
aws lambda list-versions-by-function \
  --function-name vanillameta-backend-api-prod-app \
  --profile vanillameta-prod
```

#### 백엔드 프로덕션 배포
```bash
cd backend-api

# 1. 환경 설정
export AWS_PROFILE=vanillameta-prod
export NODE_ENV=prod

# 2. 프로덕션 빌드
yarn install --production
yarn build

# 3. 배포 (카나리 배포)
serverless deploy --stage prod --canary

# 4. 모니터링 (15분간)
# CloudWatch 대시보드에서 메트릭 확인
# - 에러율
# - 응답 시간
# - 메모리 사용량

# 5. 전체 배포
serverless deploy --stage prod

# 6. 웜업 확인
aws logs tail /aws/lambda/vanillameta-backend-api-prod-app \
  --follow --filter-pattern "WarmUp" \
  --profile vanillameta-prod
```

#### 프론트엔드 프로덕션 배포
```bash
cd frontend-web

# 1. 환경 설정
export AWS_PROFILE=vanillameta-prod

# 2. 프로덕션 빌드
yarn build

# 3. 번들 사이즈 확인
yarn analyze

# 4. S3 배포
yarn deploy:prod

# 5. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id PROD_DISTRIBUTION_ID \
  --paths "/*" \
  --profile vanillameta-prod

# 6. 배포 검증
curl -I https://vanillameta.com
```

### 4.4 배포 후 검증
```bash
# 1. API 헬스체크
curl https://api.vanillameta.com/v1/health

# 2. 주요 기능 테스트
# - 로그인
# - 대시보드 조회
# - 위젯 생성
# - 데이터베이스 연결

# 3. 성능 테스트
ab -n 1000 -c 10 https://api.vanillameta.com/v1/health
```

## 5. 롤백 절차

### 5.1 Lambda 함수 롤백

#### 즉시 롤백 (이전 버전으로)
```bash
# 1. 현재 버전 확인
aws lambda get-function \
  --function-name vanillameta-backend-api-prod-app \
  --profile vanillameta-prod

# 2. 이전 버전으로 알리아스 변경
aws lambda update-alias \
  --function-name vanillameta-backend-api-prod-app \
  --name live \
  --function-version 42 \
  --profile vanillameta-prod

# 3. API Gateway 스테이지 변경
aws apigatewayv2 update-stage \
  --api-id YOUR_API_ID \
  --stage-name prod \
  --deployment-id PREVIOUS_DEPLOYMENT_ID \
  --profile vanillameta-prod
```

#### Serverless 롤백
```bash
# 특정 타임스탬프로 롤백
serverless rollback --stage prod --timestamp 1234567890

# 또는 리스트에서 선택
serverless rollback list --stage prod
serverless rollback --stage prod --timestamp selected_timestamp
```

### 5.2 프론트엔드 롤백

```bash
# 1. S3 버전 확인
aws s3api list-object-versions \
  --bucket vanillameta-frontend-prod \
  --prefix index.html \
  --profile vanillameta-prod

# 2. 이전 버전 복원
aws s3api copy-object \
  --bucket vanillameta-frontend-prod \
  --copy-source vanillameta-frontend-prod/index.html?versionId=PREVIOUS_VERSION_ID \
  --key index.html \
  --profile vanillameta-prod

# 3. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id PROD_DISTRIBUTION_ID \
  --paths "/*" \
  --profile vanillameta-prod
```

### 5.3 데이터베이스 롤백

```bash
# 1. 스냅샷 목록 확인
aws rds describe-db-snapshots \
  --db-instance-identifier vanillameta-prod \
  --profile vanillameta-prod

# 2. 스냅샷에서 복원
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vanillameta-prod-restore \
  --db-snapshot-identifier vanillameta-prod-20240101-120000 \
  --profile vanillameta-prod

# 3. 복원 상태 확인
aws rds describe-db-instances \
  --db-instance-identifier vanillameta-prod-restore \
  --profile vanillameta-prod

# 4. 엔드포인트 전환
# Lambda 환경 변수에서 DB_HOST 변경
```

## 6. 모니터링 및 알람

### 6.1 CloudWatch 대시보드

#### 주요 모니터링 지표
- **Lambda 메트릭**
  - Invocations: 호출 횟수
  - Errors: 에러 발생 횟수
  - Duration: 실행 시간
  - Concurrent Executions: 동시 실행 수
  - Throttles: 제한 발생 횟수

- **API Gateway 메트릭**
  - Count: API 호출 횟수
  - 4XXError: 클라이언트 에러
  - 5XXError: 서버 에러
  - Latency: 응답 시간

- **RDS 메트릭**
  - CPUUtilization: CPU 사용률
  - DatabaseConnections: DB 연결 수
  - FreeableMemory: 사용 가능 메모리
  - ReadLatency/WriteLatency: 읽기/쓰기 지연시간

### 6.2 알람 설정 및 대응

#### Critical 알람 (즉시 대응)

**1. 높은 에러율 알람**
- 조건: 5분간 에러율 > 1%
- 대응:
  ```bash
  # 최근 에러 로그 확인
  aws logs tail /aws/lambda/vanillameta-backend-api-prod-app \
    --follow --filter-pattern ERROR \
    --profile vanillameta-prod
  
  # 필요시 즉시 롤백
  ```

**2. API 응답시간 지연**
- 조건: P99 응답시간 > 3초
- 대응:
  ```bash
  # 느린 쿼리 확인
  aws logs insights query \
    --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
    --query-string 'fields @timestamp, metadata.executionTime | filter metadata.executionTime > 2000' \
    --profile vanillameta-prod
  ```

**3. 메모리 부족**
- 조건: 메모리 사용률 > 90%
- 대응:
  ```bash
  # Lambda 메모리 증가
  aws lambda update-function-configuration \
    --function-name vanillameta-backend-api-prod-app \
    --memory-size 2048 \
    --profile vanillameta-prod
  ```

#### Warning 알람 (업무시간 내 대응)

**1. 높은 콜드 스타트 빈도**
- 조건: 15분간 콜드 스타트 > 10회
- 대응: 웜업 설정 확인 및 예약 동시성 증가

**2. DB 연결 수 증가**
- 조건: DB 연결 수 > 80
- 대응: 연결 풀 설정 확인 및 불필요한 연결 정리

### 6.3 로그 분석

#### CloudWatch Insights 쿼리 예시

```sql
-- 에러 로그 분석
fields @timestamp, level, message, metadata.error
| filter level = "ERROR"
| stats count() by metadata.error
| sort count desc

-- 느린 API 엔드포인트 찾기
fields @timestamp, metadata.path, metadata.executionTime
| filter metadata.executionTime > 1000
| stats avg(metadata.executionTime) as avg_time by metadata.path
| sort avg_time desc

-- 사용자별 요청 분석
fields @timestamp, metadata.userId, metadata.path
| filter ispresent(metadata.userId)
| stats count() by metadata.userId
| sort count desc
| limit 20
```

## 7. 백업 및 복구

### 7.1 자동 백업 정책

#### RDS 백업
- **자동 백업**: 매일 03:00 KST
- **보존 기간**: 7일 (프로덕션), 3일 (개발)
- **스냅샷**: 주요 배포 전 수동 생성

#### S3 백업
- **버전 관리**: 활성화
- **수명 주기**: 90일 후 Glacier 이동
- **교차 리전 복제**: 재해 복구용

### 7.2 백업 검증

```bash
# RDS 백업 확인
aws rds describe-db-snapshots \
  --db-instance-identifier vanillameta-prod \
  --snapshot-type automated \
  --profile vanillameta-prod

# S3 버전 확인
aws s3api list-object-versions \
  --bucket vanillameta-frontend-prod \
  --max-items 10 \
  --profile vanillameta-prod
```

### 7.3 복구 절차

#### 데이터베이스 복구
```bash
# 1. 복구 지점 선택
RESTORE_TIME="2024-01-01T12:00:00.000Z"

# 2. Point-in-time 복구
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vanillameta-prod \
  --target-db-instance-identifier vanillameta-prod-pitr \
  --restore-time $RESTORE_TIME \
  --profile vanillameta-prod

# 3. 복구 상태 모니터링
watch -n 30 'aws rds describe-db-instances \
  --db-instance-identifier vanillameta-prod-pitr \
  --query "DBInstances[0].DBInstanceStatus" \
  --profile vanillameta-prod'
```

#### 애플리케이션 복구
```bash
# 1. Lambda 함수 복구
aws lambda update-function-code \
  --function-name vanillameta-backend-api-prod-app \
  --s3-bucket vanillameta-deployment-backup \
  --s3-key lambda/backup-20240101.zip \
  --profile vanillameta-prod

# 2. 환경 변수 복구
aws lambda update-function-configuration \
  --function-name vanillameta-backend-api-prod-app \
  --environment file://backup/env-vars.json \
  --profile vanillameta-prod
```

## 8. 운영 체크리스트

### 8.1 일일 점검 (매일 09:00)

- [ ] **CloudWatch 대시보드 확인**
  - Lambda 에러율 < 0.1%
  - API 응답시간 P99 < 3초
  - RDS CPU 사용률 < 70%

- [ ] **에러 로그 검토**
  ```bash
  aws logs filter-log-events \
    --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
    --filter-pattern ERROR \
    --start-time $(date -u -d '24 hours ago' +%s)000 \
    --profile vanillameta-prod
  ```

- [ ] **백업 상태 확인**
  - RDS 자동 백업 성공 여부
  - S3 동기화 상태

- [ ] **비용 확인**
  - Lambda 실행 비용
  - CloudFront 전송 비용
  - RDS 인스턴스 비용

### 8.2 주간 점검 (매주 월요일)

- [ ] **성능 분석**
  - 주간 트래픽 패턴 분석
  - 느린 쿼리 최적화 대상 식별
  - Lambda 콜드 스타트 비율 확인

- [ ] **보안 업데이트**
  ```bash
  # 의존성 취약점 확인
  cd backend-api && yarn audit
  cd ../frontend-web && yarn audit
  ```

- [ ] **용량 계획**
  - RDS 스토리지 사용률 확인
  - Lambda 동시 실행 한도 검토
  - S3 버킷 크기 확인

- [ ] **알람 검토**
  - 불필요한 알람 제거
  - 새로운 알람 추가 필요성 검토

### 8.3 월간 점검 (매월 첫째 주)

- [ ] **장애 복구 훈련**
  - 백업 복구 테스트
  - 롤백 절차 검증
  - 장애 시나리오 시뮬레이션

- [ ] **문서 업데이트**
  - 배포 가이드 개선사항 반영
  - 새로운 기능/변경사항 문서화
  - 트러블슈팅 가이드 업데이트

- [ ] **비용 최적화**
  - Reserved Instance 검토
  - 미사용 리소스 정리
  - 비용 절감 방안 도출

- [ ] **팀 회고**
  - 월간 장애 분석
  - 개선 사항 도출
  - 다음 달 계획 수립

## 9. 트러블슈팅

### 9.1 일반적인 문제 해결

#### Lambda 콜드 스타트 문제
```bash
# 1. 현재 웜업 상태 확인
aws logs filter-log-events \
  --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
  --filter-pattern "WarmUp" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# 2. 예약된 동시성 설정
aws lambda put-provisioned-concurrency-config \
  --function-name vanillameta-backend-api-prod-app \
  --provisioned-concurrent-executions 5
```

#### 메모리 부족 에러
```bash
# 1. 현재 메모리 사용량 확인
aws logs insights query \
  --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
  --query-string 'fields @timestamp, @memoryUsed / 1000 / 1000 as memoryUsedMB | stats max(memoryUsedMB)'

# 2. 메모리 증가
aws lambda update-function-configuration \
  --function-name vanillameta-backend-api-prod-app \
  --memory-size 2048
```

#### API Gateway 타임아웃
```bash
# 1. 타임아웃 설정 확인
aws apigatewayv2 get-integration \
  --api-id YOUR_API_ID \
  --integration-id YOUR_INTEGRATION_ID

# 2. 타임아웃 증가 (최대 29초)
aws apigatewayv2 update-integration \
  --api-id YOUR_API_ID \
  --integration-id YOUR_INTEGRATION_ID \
  --timeout-in-millis 29000
```

### 9.2 긴급 대응 절차

#### 서비스 전체 장애
1. **즉시 확인**
   - CloudWatch 대시보드
   - 최근 배포 이력
   - AWS Service Health Dashboard

2. **임시 조치**
   - 유지보수 페이지 활성화
   - 이전 버전으로 즉시 롤백
   - 고객 공지 발송

3. **원인 분석**
   - 에러 로그 수집
   - 관련 메트릭 분석
   - 근본 원인 파악

4. **복구 및 개선**
   - 문제 해결
   - 재배포
   - 사후 분석 보고서 작성

## 10. 보안 고려사항

### 10.1 접근 제어
- IAM 역할 최소 권한 원칙
- MFA 필수 사용
- API 키 정기 교체

### 10.2 데이터 보호
- RDS 암호화 활성화
- S3 버킷 암호화
- HTTPS 전용 통신

### 10.3 보안 모니터링
- AWS GuardDuty 활성화
- CloudTrail 로그 분석
- 정기적인 보안 감사

---

## 부록

### A. 유용한 스크립트

#### 배포 상태 확인 스크립트
```bash
#!/bin/bash
# check-deployment.sh

STAGE=${1:-prod}
PROFILE="vanillameta-${STAGE}"

echo "=== Lambda Function Status ==="
aws lambda get-function \
  --function-name vanillameta-backend-api-${STAGE}-app \
  --query 'Configuration.[FunctionArn, Runtime, MemorySize, Timeout, LastModified]' \
  --profile $PROFILE

echo -e "\n=== Recent Invocations ==="
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=vanillameta-backend-api-${STAGE}-app \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --profile $PROFILE

echo -e "\n=== Error Rate ==="
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=vanillameta-backend-api-${STAGE}-app \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --profile $PROFILE
```

#### 로그 모니터링 스크립트
```bash
#!/bin/bash
# monitor-logs.sh

STAGE=${1:-prod}
PROFILE="vanillameta-${STAGE}"
LOG_GROUP="/aws/lambda/vanillameta-backend-api-${STAGE}-app"

echo "Monitoring logs for $LOG_GROUP..."
echo "Press Ctrl+C to stop"

aws logs tail $LOG_GROUP \
  --follow \
  --format short \
  --profile $PROFILE
```

### B. 참고 링크

- [AWS Lambda 모범 사례](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Serverless Framework 문서](https://www.serverless.com/framework/docs/)
- [NestJS 공식 문서](https://docs.nestjs.com/)
- [React 배포 가이드](https://create-react-app.dev/docs/deployment/)

---

이 문서는 지속적으로 업데이트되며, 최신 버전은 프로젝트 저장소에서 확인할 수 있습니다.