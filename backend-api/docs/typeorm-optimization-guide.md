# TypeORM 쿼리 최적화 가이드라인

## 1. 개요
이 문서는 VanillaMeta 백엔드 API의 TypeORM 쿼리 최적화 방법과 모범 사례를 제공합니다.

## 2. 핵심 원칙

### 2.1 Eager Loading 사용 금지
- **원칙**: 엔티티 관계에서 `eager: true` 옵션을 사용하지 않습니다.
- **이유**: 불필요한 데이터 로딩으로 메모리 사용량 증가 및 성능 저하
- **대안**: 필요시 명시적으로 relations를 지정하여 로드

### 2.2 선택적 데이터 로딩
- **원칙**: API 엔드포인트별로 필요한 데이터만 선택적으로 로드합니다.
- **방법**: QueryBuilder의 select() 메서드 활용

### 2.3 N+1 쿼리 문제 방지
- **원칙**: 반복문 내에서 개별 쿼리 실행을 피합니다.
- **방법**: JOIN, IN 조건, relations 옵션 활용

## 3. 구현 패턴

### 3.1 엔티티 관계 설정
```typescript
// Good - Lazy loading by default
@Entity()
export class Dashboard extends BaseEntity {
  @OneToMany(() => DashboardWidget, dashboardWidget => dashboardWidget.dashboard)
  dashboardWidgets: DashboardWidget[];
}

// Bad - Eager loading
@Entity()
export class Dashboard extends BaseEntity {
  @OneToMany(() => DashboardWidget, dashboardWidget => dashboardWidget.dashboard, { 
    eager: true 
  })
  dashboardWidgets: DashboardWidget[];
}
```

### 3.2 선택적 관계 로딩
```typescript
// Good - 필요한 관계만 명시적으로 로드
async findOne(id: number) {
  return await this.repository
    .createQueryBuilder('entity')
    .leftJoinAndSelect('entity.relation', 'relation')
    .where('entity.id = :id', { id })
    .getOne();
}

// Bad - 모든 데이터 로드
async findOne(id: number) {
  return await this.repository.findOne({ 
    where: { id },
    relations: ['relation1', 'relation2', 'relation3'] // 불필요한 관계까지 로드
  });
}
```

### 3.3 필요한 컬럼만 선택
```typescript
// Good - 필요한 컬럼만 선택
async findAll() {
  return await this.repository
    .createQueryBuilder('entity')
    .select([
      'entity.id',
      'entity.name',
      'entity.createdAt'
    ])
    .getMany();
}

// Bad - 모든 컬럼 조회
async findAll() {
  return await this.repository.find();
}
```

### 3.4 복잡한 조인 최적화
```typescript
// Good - 한 번의 쿼리로 필요한 데이터 조회
async findDashboardWithDetails(id: number) {
  return await this.dashboardRepository
    .createQueryBuilder('dashboard')
    .leftJoinAndSelect('dashboard.dashboardShare', 'share')
    .leftJoinAndSelect('dashboard.dashboardWidgets', 'dw')
    .leftJoinAndSelect('dw.widget', 'widget')
    .leftJoinAndSelect('widget.component', 'component')
    .select([
      'dashboard.id',
      'dashboard.title',
      'share.uuid',
      'widget.id',
      'widget.title',
      'component.type'
    ])
    .where('dashboard.id = :id', { id })
    .getOne();
}
```

## 4. 성능 측정 방법

### 4.1 쿼리 로깅 활성화
```typescript
// TypeORM 설정에서 로깅 활성화
{
  logging: ['query', 'error'],
  logger: 'advanced-console'
}
```

### 4.2 실행 시간 측정
```typescript
async findWithMetrics(id: number) {
  const startTime = Date.now();
  const result = await this.repository.findOne({ where: { id } });
  const executionTime = Date.now() - startTime;
  
  this.logger.debug(`Query execution time: ${executionTime}ms`);
  return result;
}
```

## 5. 체크리스트

### 엔티티 설계 시
- [ ] Eager loading 옵션 제거
- [ ] 양방향 관계 설정 확인
- [ ] 불필요한 cascade 옵션 제거

### 서비스 구현 시
- [ ] 필요한 관계만 명시적으로 로드
- [ ] Select 절로 필요한 컬럼만 조회
- [ ] 반복문 내 쿼리 실행 방지
- [ ] 대량 데이터 처리 시 pagination 적용

### 성능 검증
- [ ] 각 API의 쿼리 수 확인
- [ ] 응답 시간 측정
- [ ] 메모리 사용량 모니터링

## 6. 주의사항

### 6.1 Lazy Loading 사용 시
- 트랜잭션 범위 내에서만 작동
- 순환 참조 주의
- 직렬화 시 문제 발생 가능

### 6.2 QueryBuilder 사용 시
- 파라미터 바인딩으로 SQL Injection 방지
- 복잡한 쿼리는 Raw Query 고려
- 인덱스 활용 확인

## 7. 마이그레이션 가이드

### 기존 코드 마이그레이션 단계
1. 엔티티의 eager loading 제거
2. 서비스 메서드에서 필요한 관계 명시
3. Select 절 최적화
4. 성능 테스트 및 검증

### 예시: Dashboard 서비스 마이그레이션
```typescript
// Before
const dashboard = await this.dashboardRepository.findOne({ 
  where: { id } 
});
const widgets = await this.widgetRepository.find({ 
  where: { dashboardId: id } 
});

// After
const dashboard = await this.dashboardRepository
  .createQueryBuilder('dashboard')
  .leftJoinAndSelect('dashboard.dashboardWidgets', 'dw')
  .leftJoinAndSelect('dw.widget', 'widget')
  .where('dashboard.id = :id', { id })
  .getOne();
```

## 8. 결론
TypeORM 쿼리 최적화는 애플리케이션 성능 향상의 핵심입니다. 
이 가이드라인을 따라 불필요한 데이터 로딩을 방지하고, 
효율적인 쿼리를 작성하여 메모리 사용량과 응답 시간을 개선할 수 있습니다.