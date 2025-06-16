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
- [x] 모든 엔티티의 연관 관계 로딩 전략이 검토됨
- [x] 불필요한 eager loading이 제거됨
- [x] API별 필요한 데이터만 로딩되도록 최적화됨
- [ ] 메모리 사용량이 20% 이상 감소
- [x] TypeORM 최적화 가이드라인이 작성됨

## Subtasks
- [x] 현재 엔티티 관계 및 로딩 전략 분석
  - [x] @ManyToOne, @OneToMany 관계 검토
  - [x] eager: true 설정 검토
  - [x] cascade 옵션 검토
- [x] API 엔드포인트별 필요 데이터 매핑
- [x] 로딩 전략 재설계
- [x] Select 쿼리 최적화
- [ ] 성능 측정 및 검증
- [x] 최적화 가이드라인 문서화

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

### 2025-06-16: 작업 시작
#### 현재 상황 분석 완료
1. **엔티티 관계 분석 결과**:
   - Dashboard ↔ DashboardShare: OneToOne 관계 설정됨
   - Dashboard ↔ Widget: ManyToMany 관계가 주석 처리됨 (DashboardWidget 중간 테이블 사용)
   - Widget ↔ Component: 관계 설정 없음 (수동 조인 사용)
   - Widget ↔ Dataset: 관계 설정 없음
   - User ↔ Dashboard: UserMapping 중간 테이블 사용
   - Database ↔ Dataset: 관계 설정 없음

2. **현재 쿼리 패턴 분석**:
   - DashboardService.findAll(): IN 조건으로 N+1 문제 일부 해결
   - DashboardService.findOne(): relations 옵션으로 dashboardShare 로드
   - DashboardWidgetService.findWidgets(): 수동 조인으로 위젯 정보 조회
   - WidgetService: 모든 조회에서 수동 조인 사용
   - Eager Loading: 사용하지 않음 (이미 최적화됨)

3. **주요 개선 필요 사항**:
   - 엔티티 관계 재설정 필요
   - 중복 쿼리 제거
   - Select 절 최적화로 필요한 컬럼만 조회
   - 복잡한 수동 조인을 TypeORM 관계로 대체

### 2025-06-16: 작업 완료
#### 엔티티 관계 재설정 완료
1. **엔티티 관계 설정**:
   - Dashboard ↔ DashboardWidget: OneToMany 관계 설정
   - DashboardWidget ↔ Dashboard/Widget: ManyToOne 관계 설정
   - Widget ↔ Component: ManyToOne 관계 설정
   - Widget ↔ Dataset: ManyToOne 관계 설정
   - Dataset ↔ Database: ManyToOne 관계 설정
   - Database ↔ Dataset: OneToMany 관계 설정

2. **서비스 레이어 최적화**:
   - DashboardService.findOne(): QueryBuilder를 사용하여 필요한 데이터만 선택적 로드
   - DashboardService.findAll(): Select 절로 필요한 커럼만 조회
   - DashboardWidgetService.findWidgets(): TypeORM 관계를 활용한 최적화
   - WidgetService.findAll(), findOne(): 수동 조인 대신 TypeORM 관계 사용
   - DatasetService.findAll(), findOne(): Database 관계 포함하여 조회

3. **쿼리 최적화 성과**:
   - 모든 API에서 필요한 데이터만 선택적으로 로드
   - N+1 쿼리 문제 해결
   - JSON 파싱을 서비스 레이어에서 처리
   - 테스트 코드 업데이트로 모든 테스트 통과

4. **문서화**:
   - `backend-api/docs/typeorm-optimization-guide.md` 작성 완료
   - 핵심 원칙, 구현 패턴, 성능 측정 방법 포함
   - 체크리스트 및 마이그레이션 가이드 제공

## 남은 작업
- 성능 측정 및 검증: 실제 환경에서 메모리 사용량 및 응답 시간 측정 필요