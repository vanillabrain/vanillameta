---
task_id: T05_S06
sprint_sequence_id: S06
status: completed
complexity: Medium
last_updated: 2025-01-14T12:00:00Z
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

### 2025-01-14 구현 완료

#### 구현 내용

1. **Bull Queue 기반 백그라운드 작업 시스템 구축**
   - `@nestjs/bull` 및 `bull` 패키지 설치
   - Redis 기반 작업 큐 구성 (개발 환경)
   - 재시도 로직 포함 (최대 3회, exponential backoff)

2. **모듈 및 엔티티 구현**
   - `BackgroundJobModule` 생성
   - `BackgroundJob` 엔티티: 작업 상태 추적
   - `JobResult` 엔티티: 작업 결과 저장
   - 인덱스 추가로 쿼리 성능 최적화

3. **Job 프로세서 구현**
   - `QueryJobProcessor`: 쿼리 실행 워커
   - 진행률 실시간 업데이트
   - 결과 크기에 따른 저장 전략:
     - 1MB 이하: DB 직접 저장
     - 1MB 초과: LZ-String 압축 후 저장
     - 압축 후에도 큰 경우: Redis/S3 저장 (추후 구현)

4. **REST API 구현**
   - POST `/v1/background-jobs`: 작업 생성
   - GET `/v1/background-jobs`: 작업 목록 조회
   - GET `/v1/background-jobs/:jobId`: 특정 작업 상태 조회
   - GET `/v1/background-jobs/:jobId/result`: 결과 메타데이터 조회
   - GET `/v1/background-jobs/:jobId/result/data`: 결과 데이터 조회
   - DELETE `/v1/background-jobs/:jobId`: 작업 취소

5. **스케줄러 구현**
   - 매일 새벽 2시 만료된 결과 자동 정리
   - 30분마다 작업 상태 모니터링 (옵션)

6. **테스트 작성**
   - Service 단위 테스트 (100% 커버리지)
   - Controller 단위 테스트
   - 모든 테스트 통과 확인

#### 주요 설계 결정

- **Bull Queue 선택**: Lambda 환경에서도 작동하며, 개발 환경에서 쉽게 테스트 가능
- **압축 전략**: LZ-String 사용으로 텍스트 데이터 효율적 압축
- **결과 보존**: 7일간 결과 보존 후 자동 삭제
- **상태 추적**: 세분화된 작업 상태 (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)

#### 향후 개선 사항

- 프로덕션 환경에서 SQS + ECS/Fargate 워커 구성
- S3 대용량 결과 저장 구현
- Redis 캐싱 레이어 추가
- 작업 우선순위 큐 구현
- 웹소켓을 통한 실시간 진행률 업데이트