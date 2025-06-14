---
task_id: T04_S06
sprint_sequence_id: S06
status: open
complexity: Medium
last_updated: 2025-06-14T19:00:00Z
---

# Task: Redis 기반 쿼리 결과 캐싱 구현

## Description
자주 실행되는 대용량 쿼리의 결과를 Redis에 캐싱하여 응답 속도를 개선하고 데이터베이스 부하를 줄입니다. 현재는 모든 요청마다 데이터베이스에 직접 쿼리를 실행하여 성능 병목이 발생합니다.

## Goal / Objectives
- Redis를 활용한 쿼리 결과 캐싱 시스템 구축
- 캐시 히트율 80% 이상 달성
- 캐시된 쿼리는 1초 이내 응답

## Acceptance Criteria
- [ ] Redis 연결 및 캐싱 모듈 구현
- [ ] 쿼리 기반 캐시 키 생성 로직 구현
- [ ] 캐시 TTL 및 무효화 전략 구현
- [ ] 캐시 히트/미스 모니터링 구현
- [ ] 대용량 데이터에 대한 효율적인 직렬화/역직렬화

## Subtasks
- [ ] Redis 모듈 설정 및 연결 구현
- [ ] 캐시 서비스 구현 (get, set, invalidate)
- [ ] 쿼리 해시 기반 캐시 키 생성 로직
- [ ] DatasetService에 캐싱 레이어 통합
- [ ] 캐시 관리 API 구현 (조회, 삭제, 통계)

## Technical Guidance

### Key Interfaces and Integration Points
- `src/dataset/dataset.service.ts` - 쿼리 실행 위치
- `src/common/optimization/query-cache.service.ts` - 기존 캐시 서비스
- `src/widget/widget.service.ts` - 위젯 데이터 캐싱
- `src/database/database.service.ts` - DB 연결 정보

### Specific Imports and Module References
```typescript
// Redis client
import { Redis } from 'ioredis';
// NestJS Redis module
import { RedisModule } from '@nestjs-modules/ioredis';
// Serialization
import { compress, decompress } from 'lz-string';
// Hashing for cache keys
import { createHash } from 'crypto';
```

### Existing Patterns to Follow
- 기존 query-cache.service.ts의 인터페이스 확장
- 모듈 구조는 common/optimization 패턴 참조
- ConfigService를 통한 Redis 연결 설정

### Database Models and API Contracts
- 캐시 메타데이터 저장을 위한 별도 Redis 키 공간
- 쿼리 결과는 압축하여 저장 (대용량 데이터)
- 캐시 통계는 별도 Redis 해시에 저장

## Implementation Notes

### Step-by-Step Implementation Approach
1. Redis 모듈 설정 및 app.module에 통합
2. 향상된 QueryCacheService 구현
3. 쿼리 정규화 및 해시 키 생성 로직
4. 압축 알고리즘 적용 (LZ-string 또는 gzip)
5. DatasetService에 캐싱 데코레이터 적용
6. 캐시 워밍업 및 무효화 전략 구현

### Key Architectural Decisions
- Redis Cluster 지원을 위한 구조 설계
- 캐시 키: `query:${dbId}:${queryHash}`
- TTL: 기본 1시간, 쿼리 패턴에 따라 조정
- 대용량 데이터는 청크 단위로 저장

### Testing Approach
- 단위 테스트: 캐시 키 생성, 직렬화 테스트
- 통합 테스트: Redis 연동 및 캐싱 동작 테스트
- 성능 테스트: 캐시 히트/미스 시 응답 시간 비교

### Performance Considerations
- 직렬화/역직렬화 오버헤드 최소화
- 네트워크 대역폭을 위한 압축 필수
- 캐시 크기 제한 및 LRU 정책 적용
- 콜드 스타트 시 캐시 워밍업

## Output Log
*(This section is populated as work progresses on the task)*