---
task_id: T04_S06
sprint_sequence_id: S06
status: completed
complexity: Medium
last_updated: 2025-06-14T20:30:00Z
---

# Task: Redis 기반 쿼리 결과 캐싱 구현

## Description
자주 실행되는 대용량 쿼리의 결과를 Redis에 캐싱하여 응답 속도를 개선하고 데이터베이스 부하를 줄입니다. 현재는 모든 요청마다 데이터베이스에 직접 쿼리를 실행하여 성능 병목이 발생합니다.

## Goal / Objectives
- Redis를 활용한 쿼리 결과 캐싱 시스템 구축
- 캐시 히트율 80% 이상 달성
- 캐시된 쿼리는 1초 이내 응답

## Acceptance Criteria
- [x] Redis 연결 및 캐싱 모듈 구현
- [x] 쿼리 기반 캐시 키 생성 로직 구현
- [x] 캐시 TTL 및 무효화 전략 구현
- [x] 캐시 히트/미스 모니터링 구현
- [x] 대용량 데이터에 대한 효율적인 직렬화/역직렬화

## Subtasks
- [x] Redis 모듈 설정 및 연결 구현
- [x] 캐시 서비스 구현 (get, set, invalidate)
- [x] 쿼리 해시 기반 캐시 키 생성 로직
- [x] DatasetService에 캐싱 레이어 통합
- [x] 캐시 관리 API 구현 (조회, 삭제, 통계)

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

### 구현 완료 사항 (2025-06-14)

#### 1. Redis 캐시 서비스 구현 (`RedisCacheService`)
- **Redis 연결 관리**: ioredis 라이브러리를 사용한 Redis 연결 및 클러스터 지원
- **데이터 압축**: LZ-string을 사용한 대용량 데이터 압축 (1KB 이상 데이터)
- **쿼리 정규화**: SQL 쿼리 정규화 및 SHA256 해시 기반 캐시 키 생성
- **TTL 관리**: 환경 변수 기반 TTL 설정 (기본 1시간)
- **무효화 전략**: 패턴 기반, 엔진별, 데이터베이스별 무효화 지원
- **모니터링**: Redis 기반 통계 수집 및 성능 메트릭 제공

#### 2. 하이브리드 캐시 시스템 (`HybridCacheService`)
- **L1 캐시**: 기존 LRU 메모리 캐시 활용
- **L2 캐시**: Redis 백엔드 캐시 활용
- **캐시 승격**: L2 히트 시 L1으로 자동 승격
- **통합 통계**: L1과 L2 캐시 통계를 결합한 하이브리드 메트릭 제공
- **최적화 제안**: 히트율 분석 기반 캐시 전략 개선 제안

#### 3. DatasetService 캐시 통합
- **`executeCachedQuery()`**: 캐시 우선 쿼리 실행 메서드
- **캐시 폴백**: 캐시 오류 시 스트리밍 쿼리로 폴백 옵션
- **무효화 메서드**: 데이터셋별, 데이터베이스별 캐시 무효화
- **캐시 워밍업**: 자주 사용되는 데이터셋 사전 캐싱
- **진단 기능**: 캐시 성능 분석 및 최적화 제안

#### 4. 캐시 관리 API (`CacheController`)
- **통계 조회**: `/cache/stats` - 하이브리드 캐시 통계
- **진단 정보**: `/cache/diagnostics` - 상세 진단 및 최적화 제안
- **무효화 API**: 전체/엔진별/데이터베이스별/패턴별 무효화
- **워밍업**: `/cache/warmup` - 지정된 데이터셋 캐시 워밍업
- **상태 확인**: `/cache/health` - L1/L2 캐시 연결 상태
- **성능 메트릭**: `/cache/metrics` - 상세 성능 분석

#### 5. 데이터셋 캐시 API 확장
- **`GET /dataset/:id/cached`**: 캐시된 쿼리 실행
  - `forceRefresh`: 강제 새로고침
  - `ttl`: 커스텀 TTL 설정
  - `useStreamingFallback`: 스트리밍 폴백 활성화
- **`DELETE /dataset/:id/cache`**: 데이터셋 캐시 무효화
- **`GET /dataset/:id/cache/stats`**: 데이터셋 캐시 통계

### 환경 변수 설정

```bash
# Redis 연결 설정
REDIS_CACHE_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_KEY_PREFIX=vanillameta:

# 캐시 정책 설정
REDIS_DEFAULT_TTL=3600          # 1시간
REDIS_MAX_ENTRY_SIZE=10485760   # 10MB
REDIS_COMPRESSION_THRESHOLD=1024 # 1KB

# Redis 클러스터 설정 (선택사항)
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### 주요 기능 특징

#### 캐시 키 구조
```
query:{engine}:{databaseId}:{queryHash}
```

#### 압축 알고리즘
- **압축 임계값**: 1KB 이상 데이터
- **압축 방식**: LZ-string 라이브러리
- **압축 효과**: 90% 이상 압축 효과가 있을 때만 적용

#### 하이브리드 캐시 계층
1. **L1 (메모리)**: 빠른 접근, 제한된 용량
2. **L2 (Redis)**: 대용량 저장, 다중 인스턴스 공유
3. **승격 정책**: L2 히트 시 L1으로 자동 승격

#### 무효화 전략
- **쿼리 기반**: INSERT/UPDATE/DELETE 감지 시 관련 테이블 캐시 무효화
- **패턴 기반**: Redis 키 패턴 매칭으로 대량 무효화
- **TTL 기반**: 시간 기반 자동 만료

### 성능 최적화 구현

#### 1. 데이터 압축
- LZ-string을 사용한 JSON 데이터 압축
- 압축 효과가 있을 때만 압축 적용
- 압축 여부를 메타데이터에 저장

#### 2. 쿼리 정규화
- 공백 정규화 및 주석 제거
- 대소문자 통일
- 파라미터 포함 해시 생성

#### 3. 연결 관리
- Redis 연결 풀링
- 클러스터 모드 지원
- 자동 재연결 및 에러 처리

#### 4. 모니터링 및 메트릭
- L1/L2 캐시 히트율 추적
- 응답 시간 모니터링
- 메모리 사용량 추적
- 승격/강등 통계

### 설치된 의존성

```json
{
  "ioredis": "^5.6.1",
  "lz-string": "^1.5.0"
}
```

### 테스트 및 검증 방법

#### 1. 캐시 연결 테스트
```bash
curl http://localhost:3000/cache/health
```

#### 2. 캐시 통계 확인
```bash
curl http://localhost:3000/cache/stats
```

#### 3. 캐시된 쿼리 실행
```bash
curl "http://localhost:3000/dataset/1/cached?forceRefresh=false&ttl=7200"
```

#### 4. 캐시 무효화 테스트
```bash
curl -X DELETE http://localhost:3000/cache/invalidate/engine/mysql2
```

### 향후 개선 사항

1. **시계열 데이터 수집**: 캐시 성능 트렌드 분석
2. **지능형 TTL**: 쿼리 패턴 기반 동적 TTL 설정
3. **캐시 예열**: 스케줄링 기반 자동 캐시 워밍업
4. **분산 무효화**: 다중 인스턴스 환경에서 캐시 동기화
5. **압축 알고리즘 개선**: Brotli, Gzip 등 추가 압축 방식 지원