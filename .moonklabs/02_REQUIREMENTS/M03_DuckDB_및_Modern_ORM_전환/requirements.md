# M03: 기술 요구사항 상세

## 1. 기술 요구사항

### 1.1 DuckDB 요구사항

#### 버전 및 설정
```yaml
DuckDB:
  version: ">=0.10.0"
  configuration:
    memory_limit: "256MB"
    threads: 4
    wal_mode: true
    checkpoint_threshold: "100MB"
```

#### 필수 기능
- **OLAP 쿼리 최적화**
  - Window functions
  - CTEs (Common Table Expressions)
  - Parallel query execution
  - Columnar storage

- **데이터 타입 지원**
  - JSON/JSONB
  - Arrays
  - Timestamps with timezone
  - UUID

- **인덱스 및 최적화**
  - Adaptive Radix Tree (ART) indexes
  - Zone maps
  - Statistics 자동 수집

### 1.2 Drizzle ORM 요구사항

#### 버전 및 의존성
```json
{
  "dependencies": {
    "drizzle-orm": "^0.29.0",
    "duckdb": "^0.10.0",
    "@duckdb/node": "^0.10.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "@types/duckdb": "^0.10.0"
  }
}
```

#### 핵심 기능
- **스키마 정의**
  - TypeScript 기반 스키마
  - 관계 정의
  - 커스텀 타입

- **쿼리 빌더**
  - Type-safe queries
  - Raw SQL 실행
  - 트랜잭션 지원
  - Prepared statements

- **마이그레이션**
  - 자동 마이그레이션 생성
  - 버전 관리
  - 롤백 지원

### 1.3 인프라 요구사항

#### Docker 환경
```dockerfile
# 기본 이미지 요구사항
FROM node:18-alpine
RUN apk add --no-cache python3 make g++ 

# DuckDB 의존성
RUN apk add --no-cache libc6-compat
```

#### Lambda 환경
- **런타임**: Node.js 18.x
- **메모리**: 512MB → 256MB (최적화 후)
- **EFS 마운트**: `/mnt/efs/duckdb`
- **환경 변수**:
  ```
  DUCKDB_PATH=/mnt/efs/duckdb/vanillameta.db
  DUCKDB_MEMORY_LIMIT=256MB
  NODE_ENV=production
  ```

## 2. 마이그레이션 요구사항

### 2.1 데이터 마이그레이션

#### 마이그레이션 전략
1. **스키마 변환**
   - TypeORM 엔티티 → Drizzle 스키마
   - 데이터 타입 매핑
   - 인덱스 재정의

2. **데이터 전송**
   - SQLite → DuckDB 직접 전송
   - 배치 처리 (10,000 rows/batch)
   - 무결성 검증

3. **검증 단계**
   - Row count 검증
   - 데이터 타입 검증
   - 관계 무결성 검증

#### 마이그레이션 스크립트
```typescript
interface MigrationConfig {
  sourcePath: string;  // SQLite 파일 경로
  targetPath: string;  // DuckDB 파일 경로
  batchSize: number;   // 배치 크기
  validateData: boolean; // 데이터 검증 여부
}
```

### 2.2 코드 마이그레이션

#### 엔티티 변환 규칙
| TypeORM | Drizzle ORM |
|---------|-------------|
| @Entity() | table() |
| @Column() | column() |
| @PrimaryGeneratedColumn() | serial().primaryKey() |
| @ManyToOne() | references() |
| @OneToMany() | relations() |
| @CreateDateColumn() | timestamp().defaultNow() |
| @UpdateDateColumn() | timestamp().onUpdateNow() |

#### 리포지토리 패턴 변환
```typescript
// TypeORM (현재)
const users = await userRepository.find({
  where: { active: true },
  relations: ['roles']
});

// Drizzle ORM (목표)
const users = await db.query.users.findMany({
  where: eq(users.active, true),
  with: { roles: true }
});
```

## 3. 테스트 요구사항

### 3.1 단위 테스트

#### 테스트 범위
- **스키마 테스트**
  - 타입 정확성
  - 관계 정의
  - 제약 조건

- **쿼리 테스트**
  - CRUD 작업
  - 복잡한 조인
  - 집계 함수
  - Raw queries

- **성능 테스트**
  - 쿼리 실행 시간
  - 메모리 사용량
  - 동시성 처리

### 3.2 통합 테스트

#### 테스트 시나리오
1. **데이터 마이그레이션**
   - 전체 데이터 전송
   - 무결성 검증
   - 롤백 테스트

2. **API 엔드포인트**
   - 모든 REST API 테스트
   - 응답 시간 측정
   - 에러 처리

3. **대시보드 기능**
   - 위젯 로딩
   - 실시간 업데이트
   - 복잡한 필터링

### 3.3 성능 벤치마크

#### 측정 항목
| 작업 | SQLite+TypeORM | DuckDB+Drizzle (목표) |
|------|----------------|----------------------|
| 단순 SELECT | 10ms | 5ms |
| 복잡한 JOIN | 500ms | 50ms |
| 집계 쿼리 | 5000ms | 500ms |
| 대량 INSERT | 1000ms | 300ms |
| 메모리 사용량 | 512MB | 256MB |

## 4. 배포 요구사항

### 4.1 배포 전략

#### Blue-Green 배포
1. **Green 환경 준비**
   - 새로운 Lambda 함수
   - DuckDB + Drizzle 스택
   - 완전한 테스트

2. **트래픽 전환**
   - 5% → 25% → 50% → 100%
   - 각 단계별 모니터링
   - 즉시 롤백 가능

3. **Blue 환경 제거**
   - 안정화 후 7일 대기
   - 백업 생성
   - 리소스 정리

### 4.2 모니터링 요구사항

#### CloudWatch 메트릭
```yaml
CustomMetrics:
  - QueryExecutionTime
  - DatabaseConnectionCount
  - MemoryUsage
  - ColdStartDuration
  - ErrorRate
```

#### 알람 설정
- 쿼리 실행 시간 > 1초
- 메모리 사용량 > 80%
- 에러율 > 1%
- 콜드 스타트 > 3초

### 4.3 백업 및 복구

#### 백업 전략
- **일일 백업**: S3 업로드
- **시간별 스냅샷**: EFS 스냅샷
- **트랜잭션 로그**: 별도 보관

#### 복구 절차
1. 장애 감지 (1분 이내)
2. 백업 파일 확인 (5분 이내)
3. 복구 실행 (10분 이내)
4. 검증 및 재시작 (15분 이내)

## 5. 보안 요구사항

### 5.1 데이터 보안
- **암호화**: AES-256 (저장시)
- **전송 보안**: TLS 1.3
- **접근 제어**: IAM 역할 기반

### 5.2 쿼리 보안
- **SQL Injection 방지**: Prepared statements
- **쿼리 로깅**: 민감정보 마스킹
- **Rate limiting**: API 레벨 제한

## 6. 문서화 요구사항

### 6.1 기술 문서
- API 변경사항 문서
- 스키마 마이그레이션 가이드
- 성능 튜닝 가이드

### 6.2 운영 문서
- 배포 프로세스
- 모니터링 대시보드
- 장애 대응 매뉴얼

## 7. 교육 요구사항

### 7.1 개발팀 교육
- Drizzle ORM 기초 (4시간)
- DuckDB 최적화 (2시간)
- 마이그레이션 실습 (2시간)

### 7.2 운영팀 교육
- 모니터링 도구 (2시간)
- 백업/복구 절차 (2시간)
- 장애 대응 (1시간)