# VanillaMeta CloudWatch 알람 대응 플레이북

## 목차
1. [알람 우선순위 체계](#알람-우선순위-체계)
2. [Critical 알람 대응](#critical-알람-대응)
3. [High Priority 알람 대응](#high-priority-알람-대응)
4. [Medium Priority 알람 대응](#medium-priority-알람-대응)
5. [알람 억제 절차](#알람-억제-절차)
6. [사후 조치](#사후-조치)

## 알람 우선순위 체계

### P0 - Critical (즉시 대응)
- **대응 시간**: 5분 이내
- **알림 채널**: 이메일 + Slack @channel 멘션
- **영향도**: 서비스 중단 또는 심각한 성능 저하

### P1 - High Priority (긴급 대응)
- **대응 시간**: 15분 이내
- **알림 채널**: 이메일 + Slack @here 멘션
- **영향도**: 부분적 서비스 장애 또는 성능 저하

### P2 - Medium Priority (일반 대응)
- **대응 시간**: 1시간 이내
- **알림 채널**: 이메일 + Slack (멘션 없음)
- **영향도**: 잠재적 문제 또는 경미한 성능 저하

## Critical 알람 대응

### 1. Lambda Error Rate Critical (에러율 > 5%)

**증상**: Lambda 함수 에러율이 5%를 초과

**즉시 조치**:
1. CloudWatch Logs Insights에서 최근 에러 로그 확인
   ```sql
   fields @timestamp, @message
   | filter @message like /ERROR/
   | sort @timestamp desc
   | limit 50
   ```

2. 에러 패턴 식별:
   - 타임아웃 에러: Lambda 메모리/타임아웃 설정 확인
   - DB 연결 에러: RDS 상태 및 연결 풀 확인
   - 권한 에러: IAM 역할 확인

3. 긴급 대응:
   - 필요시 이전 버전으로 롤백
   - 트래픽 제한 또는 우회 처리

**근본 원인 분석**:
- X-Ray 트레이싱으로 병목 구간 확인
- 최근 배포 내역 검토
- 외부 의존성 상태 확인

### 2. API 5XX Error Rate (에러율 > 1%)

**증상**: API Gateway 5XX 에러율이 1%를 초과

**즉시 조치**:
1. API Gateway 액세스 로그 확인
2. Lambda 함수 상태 확인
3. 백엔드 리소스 (RDS, ElastiCache) 상태 확인

**대응 방안**:
- API Gateway 캐싱 활성화
- 요청 제한(throttling) 임시 적용
- 오류 발생 엔드포인트 격리

### 3. Lambda Memory Critical (메모리 사용률 > 80%)

**증상**: Lambda 메모리 사용률이 80%를 초과

**즉시 조치**:
1. Lambda 함수 메모리 설정 증가 (임시)
2. 메모리 누수 가능성 확인:
   ```bash
   # CloudWatch Logs Insights
   fields @timestamp, @message
   | filter @message like /Memory/
   | stats avg(memoryUtilization) by bin(5m)
   ```

3. 콜드 스타트 최적화 검토

### 4. RDS CPU Critical (CPU 사용률 > 70%)

**증상**: RDS CPU 사용률이 70%를 초과

**즉시 조치**:
1. 실행 중인 쿼리 확인:
   ```sql
   SHOW PROCESSLIST;
   ```

2. 슬로우 쿼리 로그 분석
3. 필요시 읽기 전용 복제본으로 읽기 트래픽 분산

**장기 대응**:
- RDS 인스턴스 타입 업그레이드
- 쿼리 최적화
- 인덱스 추가/개선

### 5. RDS Free Storage Low (여유 공간 < 1GB)

**증상**: RDS 저장 공간이 1GB 미만

**즉시 조치**:
1. 불필요한 로그/백업 삭제
2. 스토리지 자동 확장 활성화
3. 임시 테이블/데이터 정리

## High Priority 알람 대응

### 1. Lambda Error Rate Warning (에러율 > 2%)

**대응 절차**:
1. 에러 트렌드 모니터링
2. 에러 로그 분석 및 패턴 식별
3. 필요시 개발팀 에스컬레이션

### 2. API Response Time Warning (P90 > 1.5초)

**대응 절차**:
1. 느린 엔드포인트 식별
2. 캐싱 전략 검토
3. 데이터베이스 쿼리 최적화

### 3. RDS Connection High (연결 수 > 80%)

**대응 절차**:
1. 연결 풀 설정 확인
2. 장시간 유지되는 연결 확인 및 종료
3. max_connections 파라미터 조정 검토

## Medium Priority 알람 대응

### 1. Dashboard Load Slow (P90 > 3초)

**대응 절차**:
1. 프론트엔드 성능 프로파일링
2. API 응답 시간 확인
3. CDN 캐시 적중률 확인

### 2. Query Cache Hit Low (캐시 적중률 < 50%)

**대응 절차**:
1. 캐시 키 전략 검토
2. 캐시 TTL 최적화
3. 자주 사용되는 쿼리 패턴 분석

## 알람 억제 절차

### 계획된 유지보수 시

1. AWS 콘솔에서 알람 비활성화:
   ```bash
   aws cloudwatch disable-alarm-actions --alarm-names "alarm-name"
   ```

2. 유지보수 완료 후 재활성화:
   ```bash
   aws cloudwatch enable-alarm-actions --alarm-names "alarm-name"
   ```

### 알람 스누즈 (임시 억제)

1. 특정 기간 동안 알람 억제가 필요한 경우
2. CloudWatch 콘솔에서 "Disable alarm actions" 선택
3. 작업 완료 후 반드시 재활성화

## 사후 조치

### 인시던트 리포트 작성

1. **발생 시간**: 알람 발생 및 해결 시간
2. **영향 범위**: 영향받은 사용자/기능
3. **근본 원인**: 문제 발생 원인 분석
4. **대응 조치**: 수행한 조치 사항
5. **개선 사항**: 재발 방지 대책

### 알람 임계값 조정

1. 오경보가 잦은 경우:
   - 임계값 상향 조정
   - 평가 기간 연장
   - 복합 알람 활용

2. 늦은 감지의 경우:
   - 임계값 하향 조정
   - 평가 기간 단축
   - 추가 메트릭 모니터링

### 자동화 개선

1. 자주 발생하는 문제에 대한 자동 복구 스크립트 작성
2. Lambda 함수를 통한 자동 스케일링 구현
3. 예방적 모니터링 강화

## 연락처

- **DevOps 팀**: devops@vanillameta.com
- **긴급 연락처**: +82-10-XXXX-XXXX
- **Slack 채널**: #vanillameta-alerts
- **PagerDuty**: vanillameta.pagerduty.com

## 참고 자료

- [AWS CloudWatch 문서](https://docs.aws.amazon.com/cloudwatch/)
- [VanillaMeta 모니터링 가이드](./cloudwatch-monitoring-guide.md)
- [메트릭 정의 문서](./metrics-definition.md)