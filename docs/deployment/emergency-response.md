# VanillaMeta 긴급 대응 가이드

## 1. 긴급 상황 분류

### Critical (즉시 대응)
- 서비스 전체 장애
- 데이터 손실 위험
- 보안 침해 의심
- 결제 시스템 장애

### Major (1시간 내 대응)
- 주요 기능 장애
- 성능 심각 저하 (응답시간 10초 초과)
- 일부 사용자 접속 불가

### Minor (업무시간 내 대응)
- 부가 기능 오류
- 간헐적 에러 발생
- UI/UX 이슈

## 2. 긴급 연락망

### 대응팀 구성
1. **1차 대응**: DevOps 엔지니어
   - 담당: 시스템 진단 및 초기 대응
   - 연락처: [DevOps 온콜 번호]

2. **2차 대응**: 개발팀 리드
   - 담당: 기술적 의사결정
   - 연락처: [개발팀 리드 번호]

3. **3차 대응**: CTO
   - 담당: 중대 의사결정
   - 연락처: [CTO 번호]

## 3. 장애 대응 프로세스

### Step 1: 상황 파악 (5분 이내)

```bash
# 1. 서비스 상태 확인
curl -I https://vanillameta.com
curl https://api.vanillameta.com/v1/health

# 2. CloudWatch 대시보드 확인
# https://console.aws.amazon.com/cloudwatch/

# 3. 최근 배포 확인
cd backend-api && git log -1 --oneline
cd frontend-web && git log -1 --oneline

# 4. 에러 로그 실시간 모니터링
./scripts/monitor-logs.sh prod
```

### Step 2: 영향 범위 파악 (10분 이내)

- [ ] 영향받는 사용자 수
- [ ] 영향받는 기능
- [ ] 데이터 무결성 상태
- [ ] 외부 서비스 연동 상태

### Step 3: 임시 조치 (15분 이내)

#### 옵션 1: 유지보수 페이지 활성화
```bash
# CloudFront 오리진을 유지보수 페이지로 변경
aws cloudfront update-distribution \
  --id DISTRIBUTION_ID \
  --default-root-object maintenance.html \
  --profile vanillameta-prod
```

#### 옵션 2: 이전 버전으로 즉시 롤백
```bash
# 롤백 스크립트 실행
./scripts/rollback.sh prod all
```

#### 옵션 3: 트래픽 제한
```bash
# API Gateway 쓰로틀링 설정
aws apigatewayv2 update-stage \
  --api-id API_ID \
  --stage-name prod \
  --throttle-settings BurstLimit=100,RateLimit=50 \
  --profile vanillameta-prod
```

### Step 4: 근본 원인 분석 (30분 이내)

```bash
# 1. 상세 에러 로그 분석
aws logs insights query \
  --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
  --start-time $(date -u -d '2 hours ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string '
    fields @timestamp, level, message, metadata.error
    | filter level = "ERROR"
    | stats count() by metadata.error
  '

# 2. 성능 메트릭 분석
# Lambda 메모리 사용량, 실행 시간 등 확인

# 3. 데이터베이스 상태 확인
aws rds describe-db-instances \
  --db-instance-identifier vanillameta-prod \
  --profile vanillameta-prod
```

### Step 5: 문제 해결 (상황에 따라)

#### 데이터베이스 문제
```bash
# 1. 느린 쿼리 확인
aws rds describe-db-log-files \
  --db-instance-identifier vanillameta-prod \
  --filename-contains slow \
  --profile vanillameta-prod

# 2. 연결 수 확인 및 정리
# RDS 콘솔에서 현재 연결 확인

# 3. 필요시 인스턴스 크기 증가
aws rds modify-db-instance \
  --db-instance-identifier vanillameta-prod \
  --db-instance-class db.r5.xlarge \
  --apply-immediately \
  --profile vanillameta-prod
```

#### Lambda 문제
```bash
# 1. 메모리 증가
aws lambda update-function-configuration \
  --function-name vanillameta-backend-api-prod-app \
  --memory-size 3008 \
  --profile vanillameta-prod

# 2. 동시 실행 제한 조정
aws lambda put-function-concurrency \
  --function-name vanillameta-backend-api-prod-app \
  --reserved-concurrent-executions 100 \
  --profile vanillameta-prod
```

### Step 6: 복구 확인 (복구 후 30분)

- [ ] 모든 API 엔드포인트 테스트
- [ ] 주요 사용자 시나리오 테스트
- [ ] 성능 지표 정상화 확인
- [ ] 에러율 모니터링

## 4. 사후 처리

### 즉시 (당일)
1. 장애 보고서 초안 작성
2. 영향받은 고객에게 공지
3. 임시 조치 정리

### 단기 (3일 이내)
1. 상세 장애 분석 보고서
2. 재발 방지 대책 수립
3. 모니터링 강화 방안

### 장기 (1주일 이내)
1. 시스템 개선 계획
2. 팀 회고 미팅
3. 프로세스 개선

## 5. 주요 시나리오별 대응

### 시나리오 1: 전체 서비스 다운
```bash
# 1. 상태 확인
curl -I https://vanillameta.com

# 2. CloudFront 확인
aws cloudfront get-distribution --id DIST_ID

# 3. S3 버킷 확인
aws s3 ls s3://vanillameta-frontend-prod/

# 4. 복구: CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id DIST_ID \
  --paths "/*"
```

### 시나리오 2: API 응답 없음
```bash
# 1. Lambda 함수 상태 확인
aws lambda get-function \
  --function-name vanillameta-backend-api-prod-app

# 2. API Gateway 상태 확인
aws apigatewayv2 get-api --api-id API_ID

# 3. 복구: Lambda 함수 재배포
serverless deploy --stage prod --force
```

### 시나리오 3: 데이터베이스 연결 실패
```bash
# 1. RDS 상태 확인
aws rds describe-db-instances \
  --db-instance-identifier vanillameta-prod

# 2. 보안 그룹 확인
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxx

# 3. 복구: 연결 재설정
aws rds reboot-db-instance \
  --db-instance-identifier vanillameta-prod
```

## 6. 예방 조치

### 일일
- 시스템 상태 모니터링
- 백업 확인
- 로그 검토

### 주간
- 성능 트렌드 분석
- 보안 업데이트 확인
- 용량 계획 검토

### 월간
- 장애 복구 훈련
- 시스템 전체 점검
- 문서 업데이트

## 7. 도구 및 리소스

### 모니터링 도구
- CloudWatch Dashboard: [URL]
- Datadog: [URL]
- PagerDuty: [URL]

### 문서
- AWS 서비스 상태: https://status.aws.amazon.com/
- 내부 Wiki: [URL]
- Runbook: [URL]

### 유용한 명령어 모음
```bash
# 별칭 설정 (~/.bashrc)
alias vm-prod-logs='./scripts/monitor-logs.sh prod'
alias vm-prod-check='./scripts/check-deployment.sh prod'
alias vm-prod-rollback='./scripts/rollback.sh prod'
```

---

**중요**: 이 문서는 정기적으로 업데이트되어야 하며, 모든 팀원이 숙지해야 합니다.