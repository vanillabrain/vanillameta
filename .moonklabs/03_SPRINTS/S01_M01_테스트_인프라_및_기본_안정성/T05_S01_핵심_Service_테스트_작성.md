---
task_id: T05_S01
sprint_sequence_id: S01
status: open
complexity: Medium
last_updated: 2025-06-23T14:00:00Z
---

# Task: 핵심 Service 테스트 작성

## Description
VanillaMeta의 핵심 비즈니스 로직을 담당하는 Service 클래스들에 대한 단위 테스트를 작성합니다. DashboardService, WidgetService, DatabaseService, AuthService 등 주요 서비스의 비즈니스 로직을 검증하는 테스트를 구현하여 코드 안정성을 확보합니다.

## Goal / Objectives
- 모든 핵심 Service 클래스에 단위 테스트 작성
- 비즈니스 로직의 정확성 검증
- 에러 상황에 대한 처리 로직 테스트
- Service 레벨 테스트 커버리지 70% 이상 달성

## Acceptance Criteria
- [ ] DashboardService 모든 주요 메서드 테스트 작성
- [ ] WidgetService 모든 주요 메서드 테스트 작성
- [ ] DatabaseService 연결 및 쿼리 로직 테스트 작성
- [ ] AuthService 인증/인가 로직 테스트 작성
- [ ] UserService 사용자 관리 로직 테스트 작성
- [ ] 각 Service별 에러 처리 테스트 포함
- [ ] Repository Mock을 활용한 격리된 테스트 구현

## Subtasks
- [ ] DashboardService 테스트 작성 (CRUD, 권한 검증)
- [ ] WidgetService 테스트 작성 (생성, 수정, 데이터 처리)
- [ ] DatabaseService 테스트 작성 (연결, 쿼리 실행)
- [ ] AuthService 테스트 작성 (로그인, 토큰 검증)
- [ ] UserService 테스트 작성 (사용자 관리)
- [ ] 각 Service별 에러 케이스 테스트 추가
- [ ] Test Coverage 리포트 확인

## 기술 가이드

### 테스트 대상 Service 클래스
- **DashboardService**: `/backend-api/src/dashboard/dashboard.service.ts`
- **WidgetService**: `/backend-api/src/widget/widget.service.ts`
- **DatabaseService**: `/backend-api/src/database/database.service.ts`
- **AuthService**: `/backend-api/src/auth/auth.service.ts`
- **UserService**: `/backend-api/src/user/user.service.ts`

### 기존 테스트 패턴 활용
```typescript
describe('DashboardService', () => {
  let service: DashboardService;
  let dashboardRepository: Repository<Dashboard>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Dashboard),
          useValue: mockDashboardRepository,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    dashboardRepository = module.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
  });

  describe('create', () => {
    it('should create a dashboard successfully', async () => {
      // Test implementation
    });
  });
});
```

### Mock 객체 활용
- Repository Mock: 데이터베이스 계층 분리
- External Service Mock: 외부 API 호출 Mock
- 파일 시스템 Mock: 파일 업로드/다운로드 Mock

### 테스트 시나리오
- **Happy Path**: 정상적인 비즈니스 플로우
- **Edge Cases**: 경계값 및 특수 상황
- **Error Cases**: 예외 상황 및 에러 처리

## 구현 노트

### 단계별 접근법
1. 각 Service 클래스의 주요 메서드 식별
2. Repository 및 의존성 Mock 설정
3. 정상 케이스 테스트 작성
4. 에러 케이스 테스트 추가
5. 테스트 커버리지 확인

### Service별 테스트 포인트
- **DashboardService**: 생성, 조회, 수정, 삭제, 권한 확인
- **WidgetService**: 위젯 생성, 데이터 매핑, 옵션 처리
- **DatabaseService**: 연결 테스트, 쿼리 실행, 스키마 조회
- **AuthService**: JWT 생성/검증, 패스워드 해싱, 토큰 갱신

### 성능 고려사항
- 테스트 실행 속도 최적화
- 필요한 부분만 Mock 처리
- 테스트 간 상태 격리 보장

## Output Log
*(This section is populated as work progresses on the task)*