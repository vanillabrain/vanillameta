---
task_id: T02_S03
sprint_sequence_id: S03
status: open
complexity: Medium
last_updated: 2025-06-12T17:00:00Z
---

# Task: N+1 Query Resolution

## Description
TypeORM 사용 시 발생하는 N+1 쿼리 문제를 식별하고 해결합니다. 연관 관계가 있는 엔티티를 조회할 때 발생하는 불필요한 추가 쿼리를 제거하여 데이터베이스 부하를 감소시키고 응답 시간을 개선합니다.

## Goal / Objectives
- N+1 쿼리 발생 패턴 식별
- 연관 관계 로딩 전략 최적화
- Join 쿼리를 활용한 효율적인 데이터 조회
- 쿼리 수 감소를 통한 성능 개선

## Acceptance Criteria
- [ ] 모든 N+1 쿼리 패턴이 식별되고 문서화됨
- [ ] 주요 API 엔드포인트의 쿼리 수가 50% 이상 감소
- [ ] 연관 관계 로딩 전략이 최적화됨
- [ ] 성능 개선이 테스트로 검증됨
- [ ] N+1 쿼리 방지 가이드라인이 작성됨

## Subtasks
- [ ] N+1 쿼리 발생 지점 식별
  - [ ] Dashboard와 Widget 관계 분석
  - [ ] Widget과 Dataset 관계 분석
  - [ ] User와 Dashboard 관계 분석
  - [ ] Database와 Dataset 관계 분석
- [ ] TypeORM 쿼리 로깅 설정 및 분석
- [ ] 연관 관계 로딩 전략 수정
- [ ] QueryBuilder를 사용한 Join 쿼리 구현
- [ ] 성능 테스트 및 검증
- [ ] 개발 가이드라인 작성

## Technical Guidance

### Key interfaces and integration points
- **Service Layer**: 각 모듈의 service.ts 파일에서 repository 메서드 호출
- **Repository Pattern**: TypeORM Repository 및 QueryBuilder 사용
- **Entity Relations**: @OneToMany, @ManyToOne, @OneToOne 관계 정의
- **Controller Layer**: API 응답에 필요한 데이터 범위 정의

### Specific imports and module references
```typescript
import { Repository, QueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
```

### Existing patterns to follow
- Repository 메서드에서 `relations` 옵션 사용
- QueryBuilder의 `leftJoinAndSelect()` 활용
- Select 쿼리에서 필요한 필드만 선택
- DTO를 통한 응답 데이터 최적화

### Database models to work with
- **Dashboard-Widget**: 1:N 관계, 대시보드 조회 시 위젯 목록 필요
- **Widget-Dataset**: 1:1 관계, 위젯 조회 시 데이터셋 정보 필요
- **User-Dashboard**: 1:N 관계, 사용자별 대시보드 목록 조회
- **Database-Dataset**: 1:N 관계, 데이터베이스별 데이터셋 조회

### Error handling approach
- 쿼리 실행 실패 시 상세 로그 기록
- 연관 데이터 누락 시 적절한 기본값 처리
- 순환 참조 방지

## Implementation Notes

### Step-by-step implementation approach
1. TypeORM 쿼리 로깅 활성화
   ```typescript
   logging: ['query', 'error']
   ```
2. 각 서비스의 findAll, findOne 메서드 검토
3. N+1 발생 패턴 식별 및 기록
4. 적절한 로딩 전략 선택:
   - Eager Loading: 항상 필요한 관계
   - Lazy Loading: 선택적으로 필요한 관계
   - Join Query: 복잡한 조건이 있는 경우
5. 개선된 쿼리 구현 및 테스트

### Key architectural decisions to respect
- 기존 DTO 구조 유지
- Service 계층에서 데이터 조회 로직 처리
- Controller는 단순 호출만 담당

### Testing approach
- 쿼리 카운트 측정 테스트
- 응답 시간 비교 테스트
- 대량 데이터 환경에서의 성능 테스트
- 연관 데이터 무결성 검증

### Performance considerations
- 필요한 데이터만 Select
- 불필요한 Join 회피
- 페이지네이션 적용 시 주의
- 캐싱 전략 고려

### Example patterns to implement
```typescript
// Before (N+1 problem)
const dashboards = await this.dashboardRepository.find();
for (const dashboard of dashboards) {
  const widgets = await this.widgetRepository.find({ 
    where: { dashboard_id: dashboard.id } 
  });
}

// After (Join query)
const dashboards = await this.dashboardRepository.find({
  relations: ['widgets'],
});

// Or using QueryBuilder
const dashboards = await this.dashboardRepository
  .createQueryBuilder('dashboard')
  .leftJoinAndSelect('dashboard.widgets', 'widget')
  .getMany();
```

## Output Log

### 2025-06-12 진행 사항

1. **N+1 쿼리 발생 지점 식별 완료**
   - Dashboard 서비스의 findAll 메서드에서 심각한 N+1 쿼리 발견
   - Dashboard와 DashboardShare 관계에서 개별 조회 문제 발견
   
2. **Dashboard 서비스 개선**
   - findAll 메서드: for 루프를 IN 조건 쿼리로 변경
   - findOne 메서드: Join을 사용하여 관련 데이터 한 번에 조회
   
3. **성능 테스트 작성**
   - `test/performance/n-plus-one-query.spec.ts` 파일 생성
   - 쿼리 카운트 측정을 통한 N+1 문제 해결 검증
   - 모든 테스트 통과 확인
   
4. **가이드라인 문서 작성**
   - `docs/n-plus-one-query-prevention-guide.md` 생성
   - N+1 쿼리 문제 설명 및 해결 방법 문서화
   - 실제 코드 예시와 체크리스트 포함

### 개선 결과
- Dashboard findAll: N개의 대시보드 조회 시 N+1번 쿼리 → 1번 쿼리로 개선
- Dashboard findOne: 2번 쿼리(dashboard + share) → 1번 Join 쿼리로 개선