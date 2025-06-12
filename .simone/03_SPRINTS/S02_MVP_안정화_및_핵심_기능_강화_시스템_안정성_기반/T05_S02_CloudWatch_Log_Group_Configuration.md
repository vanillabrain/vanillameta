---
task_id: T05_S02
sprint_sequence_id: S02
status: open
complexity: Low
last_updated: 2025-06-12T15:00:00Z
---

# Task: CloudWatch 로그 그룹 설정 및 최적화

## Description
현재 Lambda 함수의 로그가 기본 설정으로 CloudWatch에 저장되고 있지만, 로그 그룹이 체계적으로 구성되지 않아 검색과 분석이 어렵습니다. 이 태스크는 CloudWatch 로그 그룹을 최적화하고 효율적인 로그 관리 체계를 구축합니다.

## Goal / Objectives
- 환경별(dev/prod) 로그 그룹 분리
- 로그 보존 기간 정책 설정
- 로그 필터 및 메트릭 필터 구성
- 비용 효율적인 로그 관리

## Acceptance Criteria
- [ ] 개발/운영 환경별 로그 그룹 분리
- [ ] 로그 보존 기간 정책 적용 (dev: 7일, prod: 30일)
- [ ] 에러 로그 메트릭 필터 생성
- [ ] 로그 인사이트 쿼리 템플릿 작성
- [ ] 로그 스트림 네이밍 규칙 적용

## Subtasks
- [ ] Serverless 설정에서 로그 그룹 구성
- [ ] 로그 보존 정책 설정
- [ ] 메트릭 필터 생성 (에러율, 응답시간)
- [ ] CloudWatch Insights 쿼리 작성
- [ ] 로그 그룹 권한 설정
- [ ] 모니터링 대시보드 구성

## Technical Guidance

### Key interfaces and integration points in the codebase
- `serverless.yml` - CloudWatch 로그 설정
- Lambda 함수 환경 변수 설정
- CloudWatch Logs API 활용

### Specific imports and module references
```yaml
# serverless.yml
provider:
  logs:
    restApi:
      level: INFO
```

### Existing patterns to follow
- Serverless Framework 설정 패턴
- AWS 리소스 네이밍 컨벤션
- 태그 기반 리소스 관리

### Database models or API contracts to work with
- CloudWatch Logs 구조
- 구조화된 JSON 로그 형식과 연계

### Error handling approach used in similar code
- CloudWatch 알람과 연계
- 로그 수집 실패 시 폴백

## Implementation Notes

### Step-by-step implementation approach
1. serverless.yml에 로그 그룹 설정 추가
2. 환경별 로그 보존 기간 설정
3. 에러 패턴 메트릭 필터 생성
4. CloudWatch Insights 쿼리 템플릿 작성
5. 로그 그룹 접근 권한 설정
6. 비용 모니터링 설정

### Key architectural decisions to respect
- 환경별 분리로 운영 안정성 확보
- 비용과 분석 필요성의 균형
- 규정 준수 (로그 보존 기간)

### Testing approach based on existing test patterns
- 로그 출력 및 수집 검증
- 메트릭 필터 동작 테스트
- Insights 쿼리 검증

### Performance considerations if relevant
- 로그 수집이 Lambda 성능에 미치는 영향 최소화
- 필터링으로 불필요한 로그 감소

## Output Log
*(This section is populated as work progresses on the task)*