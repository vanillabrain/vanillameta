---
task_id: T05_S06
sprint_sequence_id: S06
status: open
complexity: Medium
last_updated: 2025-06-14T19:00:00Z
---

# Task: 백그라운드 작업 큐 시스템 구축

## Description
장시간 실행되는 대용량 쿼리를 백그라운드에서 처리하기 위한 작업 큐 시스템을 구축합니다. Lambda의 30초 타임아웃 제한을 우회하고, 사용자에게 비동기 처리 결과를 제공하는 구조가 필요합니다.

## Goal / Objectives
- 장시간 쿼리를 비동기로 처리하는 큐 시스템 구축
- 작업 상태 추적 및 결과 조회 API 제공
- 실패한 작업에 대한 자동 재시도 메커니즘

## Acceptance Criteria
- [ ] Bull Queue 또는 SQS 기반 작업 큐 구현
- [ ] 작업 제출, 상태 조회, 결과 조회 API 구현
- [ ] 작업 실패 시 재시도 로직 (최대 3회)
- [ ] 완료된 작업 결과 저장 및 조회
- [ ] 작업 진행률 실시간 업데이트

## Subtasks
- [ ] 작업 큐 인프라 선택 및 설정 (Bull/SQS)
- [ ] Job 프로세서 구현 (쿼리 실행 워커)
- [ ] 작업 상태 관리 엔티티 구현
- [ ] REST API 엔드포인트 구현
- [ ] 작업 결과 저장소 구현 (S3 또는 Redis)

## Technical Guidance

### Key Interfaces and Integration Points
- `src/dataset/dataset.service.ts` - 쿼리 실행 로직
- `src/common/monitoring/slow-query-monitor.service.ts` - 장시간 쿼리 모니터링
- `src/share-url/share-url.service.ts` - 결과 공유 참조
- Lambda 환경에서의 제약사항 고려

### Specific Imports and Module References
```typescript
// Bull Queue (if using Bull)
import { BullModule } from '@nestjs/bull';
import { Process, Processor } from '@nestjs/bull';
// AWS SDK (if using SQS)
import { SQS } from 'aws-sdk';
// Job tracking
import { Entity, Column } from 'typeorm';
```

### Existing Patterns to Follow
- 모듈 구조는 기존 NestJS 패턴 따름
- 엔티티는 base.entity.ts 상속
- 에러 처리는 HttpExceptionFilter 활용
- 로깅은 LoggerService 사용

### Database Models and API Contracts
- BackgroundJob 엔티티 (ID, 유형, 상태, 메타데이터)
- JobResult 엔티티 (작업 ID, 결과 위치, 생성 시간)
- 기존 Dataset, Widget과 연관관계

## Implementation Notes

### Step-by-Step Implementation Approach
1. 작업 큐 기술 선택 (Bull for 개발, SQS for 프로덕션)
2. background-job 모듈 생성
3. Job 프로세서 구현 (쿼리 실행, 상태 업데이트)
4. 작업 제출 및 관리 API 구현
5. 결과 저장 전략 구현 (대용량은 S3, 소량은 DB)
6. 클라이언트 폴링을 위한 상태 조회 최적화

### Key Architectural Decisions
- Lambda 환경: SQS + 별도 ECS/Fargate 워커 권장
- 개발 환경: Bull Queue + Redis
- 결과 저장: 1MB 이하는 DB, 초과는 S3
- 작업 보존: 완료 후 7일간 결과 보존

### Testing Approach
- 단위 테스트: Job 프로세서 로직 테스트
- 통합 테스트: 전체 작업 플로우 테스트
- 장애 테스트: 작업 실패 및 재시도 시나리오

### Performance Considerations
- 워커 스케일링 전략 (동시 작업 수 제한)
- 결과 조회 최적화 (캐싱, 인덱싱)
- 대용량 결과 스트리밍 다운로드
- 작업 큐 모니터링 및 알림

## Output Log
*(This section is populated as work progresses on the task)*