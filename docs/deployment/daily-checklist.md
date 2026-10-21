# VanillaMeta 일일 운영 체크리스트

## 매일 오전 9:00 점검 사항

### 1. 시스템 상태 확인 (5분)

- [ ] CloudWatch 대시보드 접속
  - URL: https://console.aws.amazon.com/cloudwatch/
  - 확인 항목:
    - [ ] Lambda 에러율 < 0.1%
    - [ ] API 응답시간 P99 < 3초
    - [ ] RDS CPU 사용률 < 70%
    - [ ] 메모리 사용률 < 80%

- [ ] 알람 확인
  ```bash
  # 최근 24시간 알람 이력 확인
  aws cloudwatch describe-alarm-history \
    --start-date $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
    --max-records 20 \
    --profile vanillameta-prod
  ```

### 2. 에러 로그 검토 (10분)

- [ ] 에러 로그 확인
  ```bash
  # 지난 24시간 에러 로그 요약
  aws logs filter-log-events \
    --log-group-name /aws/lambda/vanillameta-backend-api-prod-app \
    --filter-pattern ERROR \
    --start-time $(date -u -d '24 hours ago' +%s)000 \
    --profile vanillameta-prod \
    | jq '.events | length'
  ```

- [ ] 주요 에러 패턴 분석
  - 반복되는 에러가 있는가?
  - 새로운 유형의 에러가 발생했는가?
  - 즉시 조치가 필요한 에러가 있는가?

### 3. 성능 지표 확인 (5분)

- [ ] Lambda 콜드 스타트 비율
  ```bash
  # 콜드 스타트 횟수 확인
  aws cloudwatch get-metric-statistics \
    --namespace "VanillaMeta/prod" \
    --metric-name "ColdStartCount" \
    --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --statistics Sum \
    --profile vanillameta-prod
  ```

- [ ] API 응답 시간 추이
- [ ] 데이터베이스 쿼리 성능

### 4. 백업 상태 확인 (3분)

- [ ] RDS 자동 백업 성공 여부
  ```bash
  # 최신 자동 백업 확인
  aws rds describe-db-snapshots \
    --db-instance-identifier vanillameta-prod \
    --snapshot-type automated \
    --max-records 1 \
    --profile vanillameta-prod \
    | jq '.DBSnapshots[0] | {SnapshotId: .DBSnapshotIdentifier, Created: .SnapshotCreateTime, Status: .Status}'
  ```

- [ ] S3 버킷 동기화 상태
- [ ] 백업 스토리지 사용량

### 5. 보안 확인 (2분)

- [ ] 비정상적인 접근 시도
- [ ] API 키 만료 예정 확인
- [ ] SSL 인증서 유효기간 (30일 이상 남음)

### 6. 비용 모니터링 (5분)

- [ ] 일일 예상 비용 확인
  ```bash
  # Cost Explorer에서 어제 비용 확인
  aws ce get-cost-and-usage \
    --time-period Start=$(date -u -d 'yesterday' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
    --granularity DAILY \
    --metrics "UnblendedCost" \
    --group-by Type=DIMENSION,Key=SERVICE \
    --profile vanillameta-prod \
    | jq '.ResultsByTime[0].Groups[] | select(.Metrics.UnblendedCost.Amount > "1")'
  ```

- [ ] 비정상적인 비용 증가 여부
- [ ] 미사용 리소스 확인

## 점검 완료 후 조치사항

### 정상인 경우
1. Slack #ops 채널에 "✅ 일일 점검 완료 - 이상 없음" 메시지 전송
2. 점검 로그에 기록

### 이슈 발견 시
1. 긴급도에 따라 분류
   - **Critical**: 즉시 대응팀 호출
   - **Warning**: 업무시간 내 처리
   - **Info**: 주간 회의에서 논의

2. 이슈 티켓 생성
3. 관련 팀 알림

## 체크리스트 실행 스크립트

```bash
#!/bin/bash
# daily-check.sh
# 일일 점검 자동화 스크립트

echo "=== VanillaMeta Daily Health Check ==="
echo "Date: $(date)"
echo ""

# 여기에 위의 명령어들을 통합하여 자동화
./scripts/check-deployment.sh prod

echo ""
echo "=== Daily Check Complete ==="
```

## 참고사항

- 주말/공휴일에는 온콜 담당자가 점검
- 월 1회 전체 팀이 참여하는 상세 점검 실시
- 모든 점검 결과는 로그로 보관 (최소 3개월)