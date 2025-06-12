---
task_id: T03_S03
sprint_sequence_id: S03
status: open
complexity: Medium
last_updated: 2025-06-12T17:00:00Z
---

# Task: TypeORM Query Optimization

## Description
TypeORM의 eager/lazy loading 전략을 최적화하여 데이터베이스 쿼리 효율성을 개선합니다. 각 엔티티의 연관 관계별로 적절한 로딩 전략을 설정하고, 불필요한 데이터 로딩을 방지하여 메모리 사용량과 응답 시간을 개선합니다.

## Goal / Objectives
- 엔티티별 최적의 로딩 전략 수립
- Eager loading의 과도한 사용 제거
- Lazy loading을 통한 선택적 데이터 로딩
- 쿼리 최적화를 통한 메모리 효율성 개선

## Acceptance Criteria
- [ ] 모든 엔티티의 연관 관계 로딩 전략이 검토됨
- [ ] 불필요한 eager loading이 제거됨
- [ ] API별 필요한 데이터만 로딩되도록 최적화됨
- [ ] 메모리 사용량이 20% 이상 감소
- [ ] TypeORM 최적화 가이드라인이 작성됨

## Subtasks
- [ ] 현재 엔티티 관계 및 로딩 전략 분석
  - [ ] @ManyToOne, @OneToMany 관계 검토
  - [ ] eager: true 설정 검토
  - [ ] cascade 옵션 검토
- [ ] API 엔드포인트별 필요 데이터 매핑
- [ ] 로딩 전략 재설계
- [ ] Select 쿼리 최적화
- [ ] 성능 측정 및 검증
- [ ] 최적화 가이드라인 문서화

## Technical Guidance

### Key interfaces and integration points
- **Entity Decorators**: @Entity, @Column, @ManyToOne, @OneToMany
- **Relation Options**: eager, lazy, cascade
- **Repository Methods**: find(), findOne(), createQueryBuilder()
- **Select Options**: relations, select, where

### Specific imports and module references
```typescript
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
```

### Existing patterns to follow
- Entity 정의 시 관계 설정
- Service 계층에서 필요한 관계만 로드
- DTO를 통한 응답 데이터 제어
- QueryBuilder를 통한 세밀한 쿼리 제어

### Database models to work with
- **Dashboard Entity**: widgets (OneToMany) - eager loading 검토 필요
- **Widget Entity**: dashboard (ManyToOne), dataset (OneToOne)
- **Dataset Entity**: database (ManyToOne), widget (OneToOne)
- **User Entity**: dashboards (OneToMany)
- **Database Entity**: datasets (OneToMany)

### Error handling approach
- Lazy loading 실패 시 적절한 에러 처리
- 순환 참조 방지
- 트랜잭션 범위 내 lazy loading 보장

## Implementation Notes

### Step-by-step implementation approach
1. 현재 엔티티 관계 매핑 분석
   ```typescript
   // 현재 eager loading 사용 예시 찾기
   @OneToMany(() => Widget, widget => widget.dashboard, { eager: true })
   ```
2. API 엔드포인트별 응답 데이터 요구사항 분석
3. 로딩 전략 재설계:
   - Eager Loading 제거 (특별한 경우 제외)
   - 필요시 명시적 관계 로딩
   - Partial selection 활용
4. Service 메서드 최적화
5. 성능 테스트 및 메모리 프로파일링

### Key architectural decisions to respect
- Entity는 순수하게 데이터 구조만 정의
- 복잡한 로딩 로직은 Service 계층에서 처리
- Controller는 단순 위임만 수행

### Testing approach
- 각 API 엔드포인트의 쿼리 수 측정
- 메모리 사용량 프로파일링
- 응답 데이터 완전성 검증
- Lazy loading 동작 검증

### Performance considerations
- Eager loading은 진짜 필요한 경우만 사용
- N+1 문제와 Over-fetching 사이의 균형
- 대량 데이터 처리 시 pagination 고려
- Partial selection으로 필요한 컬럼만 조회

### Example optimization patterns
```typescript
// Before - Over-fetching with eager loading
@Entity()
export class Dashboard {
  @OneToMany(() => Widget, widget => widget.dashboard, { 
    eager: true, 
    cascade: true 
  })
  widgets: Widget[];
}

// After - Selective loading
@Entity()
export class Dashboard {
  @OneToMany(() => Widget, widget => widget.dashboard)
  widgets: Widget[];
}

// Service layer - Load only when needed
async findDashboardWithWidgets(id: number) {
  return this.dashboardRepository.findOne({
    where: { id },
    relations: ['widgets'], // Explicitly load
    select: ['id', 'name', 'created_at'] // Select specific fields
  });
}

// Using QueryBuilder for fine control
async findDashboardSummary(userId: number) {
  return this.dashboardRepository
    .createQueryBuilder('dashboard')
    .select(['dashboard.id', 'dashboard.name'])
    .leftJoin('dashboard.widgets', 'widget')
    .addSelect('COUNT(widget.id)', 'widgetCount')
    .where('dashboard.user_id = :userId', { userId })
    .groupBy('dashboard.id')
    .getRawMany();
}
```

## Output Log
*(This section is populated as work progresses on the task)*