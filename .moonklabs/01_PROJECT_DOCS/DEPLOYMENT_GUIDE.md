# VanillaMeta 배포 가이드

## 목차
1. [개요](#개요)
2. [로컬 개발 환경 설정](#로컬-개발-환경-설정)
3. [AWS 환경 설정](#aws-환경-설정)
4. [배포 프로세스](#배포-프로세스)
5. [환경별 설정 관리](#환경별-설정-관리)
6. [트러블슈팅](#트러블슈팅)

## 개요

VanillaMeta는 백엔드(NestJS/AWS Lambda)와 프론트엔드(React)로 구성된 서버리스 애플리케이션입니다. 이 문서는 로컬 개발부터 프로덕션 배포까지의 전체 프로세스를 설명합니다.

### 배포 아키텍처
- **백엔드**: AWS Lambda + API Gateway
- **프론트엔드**: S3 + CloudFront
- **데이터베이스**: RDS MySQL (프로덕션), SQLite (로컬)
- **캐싱**: Redis (ElastiCache)
- **모니터링**: CloudWatch

## 로컬 개발 환경 설정

### 1. 사전 요구사항

```bash
# Node.js 설치 확인 (v14.x 이상)
node --version

# Yarn 설치
npm install -g yarn

# Serverless Framework 설치
npm install -g serverless

# AWS CLI 설치 및 설정
aws --version
aws configure

# Redis 설치 (macOS)
brew install redis

# Redis 설치 (Ubuntu)
sudo apt-get install redis-server
```

### 2. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 클론
git clone https://github.com/your-org/vanillameta.git
cd vanillameta

# 백엔드 의존성 설치
cd backend-api
yarn install

# Lambda Layer 의존성 설치
cd ../backend-api-libs-lambda-layer
yarn install

# 프론트엔드 의존성 설치
cd ../frontend-web
yarn install
```

### 3. 환경 변수 설정

#### 백엔드 환경 변수 (.env.local)
```bash
cd backend-api
cp .env.example .env.local
```

`.env.local` 파일 편집:
```env
# 기본 설정
NODE_ENV=local
PORT=3000

# 데이터베이스 설정 (로컬 SQLite)
DB_TYPE=sqlite
DB_DATABASE=./sqlite.db

# JWT 설정
JWT_SECRET=your-local-jwt-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-local-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Redis 설정
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS 설정 (로컬에서는 선택사항)
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

#### 프론트엔드 환경 변수 (.env.local)
```bash
cd frontend-web
cp .env.example .env.local
```

`.env.local` 파일 편집:
```env
REACT_APP_API_URL=http://localhost:3000/v1
REACT_APP_MODE=local
```

### 4. 로컬 서버 실행

```bash
# Redis 서버 시작
redis-server --daemonize yes

# 백엔드 서버 실행 (새 터미널)
cd backend-api
yarn start:local

# 프론트엔드 서버 실행 (새 터미널)
cd frontend-web
yarn start:local
```

### 5. 초기 데이터 설정

```bash
# 데이터베이스 마이그레이션 실행
cd backend-api
yarn migration:run

# 시드 데이터 생성
yarn seed
```

## AWS 환경 설정

### 1. AWS 계정 설정

#### IAM 사용자 생성
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*",
        "apigateway:*",
        "s3:*",
        "cloudformation:*",
        "iam:*",
        "logs:*",
        "cloudwatch:*",
        "rds:*",
        "elasticache:*",
        "cloudfront:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. RDS MySQL 설정

```bash
# RDS 인스턴스 생성
aws rds create-db-instance \
  --db-instance-identifier vanillameta-mysql \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password <password> \
  --allocated-storage 20
```

### 3. ElastiCache Redis 설정

```bash
# Redis 클러스터 생성
aws elasticache create-cache-cluster \
  --cache-cluster-id vanillameta-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1
```

### 4. S3 버킷 생성

```bash
# 프론트엔드 호스팅용 S3 버킷
aws s3 mb s3://vanillameta-frontend-prod

# 정적 웹사이트 호스팅 활성화
aws s3 website s3://vanillameta-frontend-prod \
  --index-document index.html \
  --error-document error.html
```

### 5. CloudFront 배포 생성

```bash
# CloudFront 배포 설정 파일 생성
cat > cloudfront-config.json << EOF
{
  "CallerReference": "vanillameta-$(date +%s)",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3-vanillameta-frontend-prod",
      "DomainName": "vanillameta-frontend-prod.s3.amazonaws.com",
      "S3OriginConfig": {
        "OriginAccessIdentity": ""
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-vanillameta-frontend-prod",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": { "Forward": "none" }
    },
    "MinTTL": 0
  },
  "Comment": "VanillaMeta Frontend Distribution",
  "Enabled": true
}
EOF

# CloudFront 배포 생성
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## 배포 프로세스

### 1. 개발 환경 배포

#### 백엔드 배포
```bash
cd backend-api

# serverless 설정 파일 생성
cp config.serverless.sample.yml config.serverless.yml

# 환경 변수 설정
export STAGE=dev
export AWS_PROFILE=vanillameta-dev

# Lambda Layer 배포
cd ../backend-api-libs-lambda-layer
serverless deploy --stage dev

# 백엔드 API 배포
cd ../backend-api
yarn deploy:dev
```

#### 프론트엔드 배포
```bash
cd frontend-web

# 개발 환경 빌드
yarn build:dev

# S3에 업로드
aws s3 sync build/ s3://vanillameta-frontend-dev --delete

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### 2. 프로덕션 배포

#### 배포 전 체크리스트
- [ ] 모든 테스트 통과 확인
- [ ] 코드 리뷰 완료
- [ ] 환경 변수 확인
- [ ] 데이터베이스 마이그레이션 준비
- [ ] 롤백 계획 수립

#### 백엔드 배포
```bash
cd backend-api

# 프로덕션 환경 변수 설정
export STAGE=prod
export AWS_PROFILE=vanillameta-prod

# 배포 전 테스트
yarn test
yarn test:e2e

# Lambda Layer 배포 (필요시)
cd ../backend-api-libs-lambda-layer
serverless deploy --stage prod

# 백엔드 API 배포
cd ../backend-api
yarn deploy:prod
```

#### 프론트엔드 배포
```bash
cd frontend-web

# 프로덕션 빌드
yarn build

# S3에 업로드
aws s3 sync build/ s3://vanillameta-frontend-prod --delete

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id PROD_DISTRIBUTION_ID \
  --paths "/*"
```

### 3. 배포 자동화 (GitHub Actions)

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '14'
          
      - name: Install dependencies
        run: |
          cd backend-api
          yarn install
          
      - name: Run tests
        run: |
          cd backend-api
          yarn test
          
      - name: Deploy to AWS Lambda
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          cd backend-api
          yarn deploy:prod

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '14'
          
      - name: Install dependencies
        run: |
          cd frontend-web
          yarn install
          
      - name: Build
        run: |
          cd frontend-web
          yarn build
          
      - name: Deploy to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws s3 sync frontend-web/build/ s3://vanillameta-frontend-prod --delete
          
      - name: Invalidate CloudFront
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

## 환경별 설정 관리

### 1. 환경 변수 관리 전략

#### AWS Systems Manager Parameter Store 사용
```bash
# 환경 변수 저장
aws ssm put-parameter \
  --name "/vanillameta/prod/db-password" \
  --value "your-secure-password" \
  --type SecureString

# serverless.yml에서 참조
environment:
  DB_PASSWORD: ${ssm:/vanillameta/prod/db-password~true}
```

### 2. 환경별 설정 파일

```
config/
├── default.json      # 공통 설정
├── local.json        # 로컬 개발
├── development.json  # 개발 서버
├── staging.json      # 스테이징
└── production.json   # 프로덕션
```

### 3. 환경별 차이점

| 설정 | 로컬 | 개발 | 프로덕션 |
|------|------|------|----------|
| 데이터베이스 | SQLite | MySQL (RDS) | MySQL (RDS) |
| 캐싱 | 로컬 Redis | ElastiCache | ElastiCache |
| 로깅 레벨 | DEBUG | INFO | ERROR |
| Lambda 메모리 | - | 512MB | 1024MB |
| Lambda 타임아웃 | - | 30s | 30s |

## 트러블슈팅

### 1. 일반적인 문제 해결

#### Lambda 콜드 스타트 문제
```yaml
# serverless.yml에 워밍업 플러그인 추가
plugins:
  - serverless-plugin-warmup

custom:
  warmup:
    enabled: true
    events:
      - schedule: rate(5 minutes)
```

#### 메모리 부족 에러
```yaml
# Lambda 메모리 크기 증가
provider:
  memorySize: 1024  # 512에서 1024로 증가
```

#### 데이터베이스 연결 문제
```typescript
// connection pooling 설정
{
  type: 'mysql',
  host: process.env.DB_HOST,
  port: 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  extra: {
    connectionLimit: 2,  // Lambda 환경에서는 작게 설정
    connectTimeout: 60000,
  }
}
```

### 2. 배포 실패 시 롤백

```bash
# 이전 버전으로 롤백
serverless rollback --timestamp 1234567890

# 특정 함수만 롤백
serverless rollback function -f functionName --timestamp 1234567890
```

### 3. 로그 확인

```bash
# CloudWatch 로그 확인
serverless logs -f functionName -t

# 특정 시간 범위 로그
serverless logs -f functionName --startTime 1h

# 로그 필터링
aws logs filter-log-events \
  --log-group-name /aws/lambda/vanillameta-api-prod \
  --filter-pattern "ERROR"
```

### 4. 성능 모니터링

```bash
# Lambda 메트릭 확인
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=vanillameta-api-prod \
  --statistics Average \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 3600
```

### 5. 비용 최적화

- Lambda 메모리 크기 최적화
- 불필요한 CloudWatch 로그 정리
- S3 수명 주기 정책 설정
- CloudFront 캐싱 최적화

## 배포 후 확인사항

### 1. 헬스체크
```bash
# API 헬스체크
curl https://api.vanillameta.com/v1/health

# 프론트엔드 확인
curl -I https://app.vanillameta.com
```

### 2. 모니터링 대시보드 확인
- CloudWatch 대시보드
- Lambda 함수 메트릭
- API Gateway 메트릭
- RDS 성능 메트릭

### 3. 알람 설정 확인
- Lambda 에러율
- API Gateway 4xx/5xx 에러
- RDS CPU/메모리 사용률
- ElastiCache 메모리 사용률