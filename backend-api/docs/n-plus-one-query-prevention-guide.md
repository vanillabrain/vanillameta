# N+1 Query Prevention Guide

## 개요

N+1 쿼리 문제는 ORM을 사용할 때 자주 발생하는 성능 문제입니다. 하나의 메인 쿼리와 N개의 추가 쿼리가 실행되어 데이터베이스 부하가 증가하고 응답 시간이 느려집니다.

## N+1 쿼리 문제란?

예를 들어, 10개의 대시보드를 조회하고 각 대시보드의 위젯을 가져온다고 가정해봅시다:

```typescript
// 잘못된 예시 - N+1 쿼리 발생
const dashboards = await dashboardRepository.find(); // 1번 쿼리
for (const dashboard of dashboards) {
  const widgets = await widgetRepository.find({ 
    where: { dashboardId: dashboard.id } 
  }); // N번 쿼리 (대시보드 개수만큼)
}
// 총 11번의 쿼리 실행 (1 + 10)
```

## TypeORM에서 N+1 쿼리 방지 방법

### 1. Relations 옵션 사용

```typescript
// 좋은 예시 - 한 번의 쿼리로 처리
const dashboards = await dashboardRepository.find({
  relations: ['widgets'], // JOIN 쿼리 사용
});
```

### 2. QueryBuilder를 사용한 Join

```typescript
// 좋은 예시 - QueryBuilder로 명시적 Join
const dashboards = await dashboardRepository
  .createQueryBuilder('dashboard')
  .leftJoinAndSelect('dashboard.widgets', 'widget')
  .where('dashboard.userId = :userId', { userId })
  .getMany();
```

### 3. IN 조건을 사용한 일괄 조회

```typescript
// 좋은 예시 - IN 조건으로 한 번에 조회
const dashboardIds = [1, 2, 3, 4, 5];
const dashboards = await dashboardRepository
  .createQueryBuilder('dashboard')
  .where('dashboard.id IN (:...ids)', { ids: dashboardIds })
  .getMany();
```

## 실제 적용 사례

### Dashboard 서비스 개선 전후

#### 개선 전 (N+1 쿼리 발생)
```typescript
async findAll(userId: number) {
  const findUser = await this.userService.findDashboardId(userId);
  const findId = findUser.map(el => el['dashboardId']);
  
  const find_all = [];
  // N+1 쿼리 발생!
  for (let i = 0; findId.length > i; i++) {
    find_all.push(
      await this.dashboardRepository.findOne({
        where: { id: findId[i] }
      })
    );
  }
  return { status: ResponseStatus.SUCCESS, data: find_all };
}
```

#### 개선 후 (단일 쿼리)
```typescript
async findAll(userId: number) {
  const findUser = await this.userService.findDashboardId(userId);
  const findId = findUser.map(el => el['dashboardId']);
  
  // 한 번의 쿼리로 모든 대시보드 조회
  const find_all = await this.dashboardRepository
    .createQueryBuilder('dashboard')
    .where('dashboard.id IN (:...ids)', { ids: findId })
    .orderBy('dashboard.updatedAt', 'DESC')
    .addOrderBy('dashboard.title', 'ASC')
    .getMany();
    
  return { status: ResponseStatus.SUCCESS, data: find_all };
}
```

## 개발 시 체크리스트

1. **반복문 내 쿼리 확인**: for/while 루프 안에서 데이터베이스 쿼리를 실행하고 있지 않은지 확인
2. **연관 데이터 로딩 전략**: 필요한 연관 데이터는 미리 Join으로 가져오기
3. **쿼리 로깅 활성화**: 개발 환경에서 TypeORM 로깅을 활성화하여 실행되는 쿼리 수 모니터링
4. **적절한 인덱스 사용**: Join이나 Where 조건에 사용되는 컬럼에 인덱스 설정

## 성능 테스트

N+1 쿼리 문제가 해결되었는지 확인하는 테스트 작성 예시:

```typescript
describe('N+1 Query Prevention', () => {
  it('should fetch all dashboards in one query', async () => {
    let queryCount = 0;
    
    // 쿼리 실행 횟수 카운트
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockImplementation(() => {
        queryCount++;
        return Promise.resolve(mockDashboards);
      })
    };
    
    await service.findAll(userId);
    
    // 쿼리가 한 번만 실행되었는지 확인
    expect(queryCount).toBe(1);
  });
});
```

## 모니터링

### TypeORM 쿼리 로깅 설정

```typescript
// ormconfig.ts
const config: TypeOrmModuleOptions = {
  // ... 기타 설정
  logging: true, // 모든 쿼리 로깅
  // 또는 특정 쿼리만 로깅
  logging: ['query', 'error', 'warn'],
};
```

### 쿼리 실행 시간 모니터링

```typescript
// 커스텀 로거를 사용한 쿼리 시간 측정
const startTime = Date.now();
const result = await repository.find({ relations: ['widgets'] });
const executionTime = Date.now() - startTime;
logger.debug(`Query execution time: ${executionTime}ms`);
```

## 주의사항

1. **과도한 Eager Loading 피하기**: 모든 관계를 eager로 설정하면 불필요한 데이터까지 로드될 수 있음
2. **Select 필드 최적화**: 필요한 필드만 선택하여 데이터 전송량 최소화
3. **페이지네이션 고려**: 대량의 데이터를 조회할 때는 적절한 페이지네이션 적용
4. **캐싱 전략**: 자주 조회되고 변경이 적은 데이터는 캐싱 고려

## 결론

N+1 쿼리 문제는 ORM 사용 시 흔히 발생하는 문제이지만, 적절한 로딩 전략과 쿼리 최적화를 통해 쉽게 해결할 수 있습니다. 개발 초기부터 이러한 패턴을 인지하고 예방하는 것이 중요합니다.