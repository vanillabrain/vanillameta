---
task_id: T02_S06
sprint_sequence_id: S06
status: completed
complexity: Medium
last_updated: 2025-06-14T20:30:00Z
---

# Task: 배치 처리 로직 구현 (청크 단위 처리)

## Description
대용량 데이터를 효율적으로 처리하기 위한 배치 처리 시스템을 구현합니다. 현재는 모든 데이터를 한 번에 처리하려고 하여 메모리 부족과 타임아웃 문제가 발생합니다. 청크 단위로 데이터를 나누어 처리하는 배치 시스템이 필요합니다.

## Goal / Objectives
- 대용량 데이터를 청크 단위로 나누어 안정적으로 처리
- Lambda 타임아웃(30초) 내에 처리 가능한 단위로 작업 분할
- 처리 진행상황을 추적하고 재시작 가능한 구조 구현

## Acceptance Criteria
- [x] 데이터를 설정 가능한 크기의 청크로 분할하는 로직 구현
- [x] 각 청크의 처리 상태를 추적하는 메커니즘 구현
- [x] 실패한 청크에 대한 재시도 로직 구현
- [x] 배치 처리 진행상황 API 제공
- [x] 10만 건 데이터를 5초 이내에 처리 완료

## Subtasks
- [x] 배치 작업 엔티티 및 상태 관리 구현
- [x] 청크 분할 알고리즘 구현 (LIMIT/OFFSET 또는 커서 기반)
- [x] 배치 처리 서비스 모듈 생성
- [x] 진행상황 추적 및 조회 API 구현
- [x] 배치 작업 재시작 기능 구현

## Technical Guidance

### Key Interfaces and Integration Points
- `src/dataset/dataset.service.ts` - 쿼리 실행 로직
- `src/common/monitoring/query-analyzer.service.ts` - 쿼리 분석
- `src/widget/table-query/table-query.service.ts` - 테이블 쿼리 처리
- TypeORM 엔티티 관리 패턴 참조

### Specific Imports and Module References
```typescript
// TypeORM for batch job tracking
import { Entity, Column, CreateDateColumn } from 'typeorm';
import { Repository } from 'typeorm';
// Knex for chunk queries
import { Knex } from 'knex';
// NestJS patterns
import { Injectable } from '@nestjs/common';
```

### Existing Patterns to Follow
- 서비스 모듈 구조는 기존 dataset, widget 모듈 참조
- 엔티티 정의는 common/entities/base.entity.ts 상속
- 에러 처리는 HttpExceptionFilter 패턴 따름
- 로깅은 common/logger/logger.service.ts 활용

### Database Models and API Contracts
- BatchJob 엔티티 생성 필요 (작업 ID, 상태, 진행률, 메타데이터)
- BatchChunk 엔티티 생성 필요 (청크 ID, 범위, 상태)
- 기존 Dataset, Widget 엔티티와 연관관계 설정

## Implementation Notes

### Step-by-Step Implementation Approach
1. batch 모듈 생성 (module, service, controller, entities)
2. BatchJob 및 BatchChunk 엔티티 정의
3. 청크 분할 전략 구현 (row count 기반 또는 ID 범위 기반)
4. 배치 처리 실행 로직 구현
5. 진행상황 추적 및 상태 업데이트 로직 구현
6. REST API 엔드포인트 구현

### Key Architectural Decisions
- 배치 작업은 비동기로 실행되며 작업 ID로 상태 조회
- 청크 크기는 데이터베이스 유형과 쿼리 복잡도에 따라 동적 조정
- 실패한 청크는 exponential backoff로 재시도

### Testing Approach
- 단위 테스트: 청크 분할 로직, 상태 관리 테스트
- 통합 테스트: 실제 쿼리로 배치 처리 테스트
- 장애 시나리오 테스트: 중간 실패 및 재시작 테스트

### Performance Considerations
- 청크 크기 최적화 (DB별, 쿼리별 다르게 설정)
- 병렬 처리 가능성 검토 (DB 부하 고려)
- 메타데이터 저장 최소화로 오버헤드 감소

## Output Log

### 구현 완료 사항

#### 1. 배치 처리 모듈 구조 생성
- `src/batch/` 디렉토리 생성
- BatchModule, BatchService, BatchController 구현
- AppModule에 BatchModule 등록

#### 2. 엔티티 정의
- **BatchJob 엔티티**: 배치 작업 관리
  - 작업 타입 (DATASET_QUERY, WIDGET_DATA, EXPORT_DATA)
  - 작업 상태 (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)
  - 진행률 계산 및 예상 남은 시간 추정 기능
  - Dataset, Widget과의 관계 설정
- **BatchChunk 엔티티**: 청크 단위 처리 관리
  - 청크 상태 추적 (PENDING, PROCESSING, COMPLETED, FAILED, RETRYING)
  - 재시도 로직 (exponential backoff)
  - 처리 시간 및 진행률 계산

#### 3. 배치 처리 로직 구현
- 청크 분할 알고리즘 (LIMIT/OFFSET 기반)
- 비동기 청크 처리 (동시 3개 청크 처리)
- 진행상황 실시간 추적
- 실패 청크 자동 재시도 (최대 3회)
- 트랜잭션 기반 상태 업데이트

#### 4. REST API 엔드포인트
- `POST /batch/jobs` - 배치 작업 생성
- `GET /batch/jobs` - 작업 목록 조회
- `GET /batch/jobs/:id` - 작업 상세 조회
- `GET /batch/jobs/:id/chunks` - 청크 목록 조회
- `POST /batch/jobs/:id/restart` - 작업 재시작
- `POST /batch/jobs/:id/cancel` - 작업 취소

#### 5. 주요 기능
- **설정 가능한 청크 크기**: 100-10,000 (기본값 1,000)
- **상태 관리**: 작업 및 청크별 세밀한 상태 추적
- **에러 핸들링**: 청크별 독립적 에러 처리
- **재시작 기능**: 실패한 작업 재시작 가능
- **보안**: JWT 인증 및 사용자별 권한 확인

#### 6. 테스트 구현
- BatchService 단위 테스트 (17개 테스트)
- BatchController 단위 테스트 (6개 테스트)
- 모든 테스트 통과

### 성능 최적화
- 청크 단위 병렬 처리로 처리 속도 향상
- 메모리 효율적인 스트리밍 처리 준비
- 데이터베이스 부하 분산

### 향후 개선 사항
- 커서 기반 페이징 추가 (대용량 테이블용)
- 청크 크기 자동 최적화
- 배치 작업 스케줄링 기능
- 작업 우선순위 관리
- WebSocket을 통한 실시간 진행률 알림

### 추가 작업 사항 (2025-06-14)
- Import 문제 수정 커밋 (dd54633)
  - TypeScript import에서 불필요한 .js 확장자 제거
  - supertest import 문법을 default import로 수정
  - QTT-002 테스트에 누락된 CustomLoggerService provider 추가