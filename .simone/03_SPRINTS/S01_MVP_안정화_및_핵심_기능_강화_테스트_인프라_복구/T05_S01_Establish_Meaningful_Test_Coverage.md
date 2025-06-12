# T05_S01_Establish_Meaningful_Test_Coverage

## 🎯 작업 개요
현재 프로젝트의 의미 없는 "should be defined" 테스트들을 실제 비즈니스 로직을 검증하는 의미 있는 테스트로 교체하여 20% 이상의 의미 있는 테스트 커버리지를 달성합니다.

## 📋 작업 상세

### 현재 테스트 상황 분석
- **문제점**: 모든 서비스 테스트가 단순히 "should be defined" 검증만 수행
- **의존성 문제**: 대부분 테스트에서 모듈 의존성 주입 실패로 테스트 실행 불가
- **테스트 품질**: 비즈니스 로직 검증 없이 인스턴스 생성만 확인

### 핵심 비즈니스 로직 식별

#### 1. AuthService (인증 서비스)
**핵심 기능**:
- JWT 토큰 생성 및 검증
- 리프레시 토큰 관리
- 사용자 인증 검증

**테스트해야 할 시나리오**:
```typescript
// 성공 케이스
- generateAccessToken: 유효한 payload로 JWT 토큰 생성
- generateRefreshToken: 유효한 payload로 refresh 토큰 생성
- validateUser: 올바른 사용자 정보로 인증 성공
- verifyAccessToken: 유효한 토큰 검증 성공
- verifyRefreshToken: 유효한 리프레시 토큰 검증 성공

// 실패 케이스  
- validateUser: 잘못된 비밀번호로 인증 실패
- verifyAccessToken: 만료된 토큰으로 검증 실패 (HttpException 발생)
- verifyRefreshToken: 유효하지 않은 토큰으로 검증 실패

// 엣지 케이스
- setRefreshKey: 기존 토큰이 없을 때 새로 생성
- setRefreshKey: 기존 토큰이 있을 때 업데이트
- deleteRefreshToken: 토큰 삭제 후 빈 문자열로 설정
```

#### 2. DashboardService (대시보드 서비스)
**핵심 기능**:
- 대시보드 CRUD 작업
- 위젯과의 연관 관계 관리
- 사용자별 대시보드 권한 관리
- UUID 기반 공유 기능

**테스트해야 할 시나리오**:
```typescript
// 생성 테스트
- create: 유효한 사용자로 대시보드 생성 성공
- create: 존재하지 않는 사용자로 생성 실패 ("Bad Request")
- create: layout 정보와 함께 위젯 ID 추출 및 저장

// 조회 테스트
- findAll: 사용자의 모든 대시보드 조회
- findAll: 존재하지 않는 사용자로 조회 시 "not exist user"
- findOne: 존재하는 대시보드 조회 (위젯 리스트 포함)
- findOne: 존재하지 않는 대시보드 조회 시 에러 응답

// 수정 테스트
- update: 제목만 수정
- update: 레이아웃만 수정
- update: 제목과 레이아웃 모두 수정
- update: 존재하지 않는 대시보드 수정 시 "Not exist dashboard"

// 삭제 테스트
- remove: 대시보드 삭제 시 관련 데이터 모두 삭제 (dashboard_widget, user_mapping, dashboard_share)
- remove: 존재하지 않는 대시보드 삭제 시 에러 응답
```

#### 3. WidgetService (위젯 서비스)
**핵심 기능**:
- 위젯 생성/수정/삭제
- 데이터셋 타입별 처리 (TABLE vs DATASET)
- 차트 옵션 JSON 변환 관리

**테스트해야 할 시나리오**:
```typescript
// 생성 테스트
- create: TABLE 타입으로 위젯 생성 (tableQuery 자동 생성)
- create: DATASET 타입으로 위젯 생성
- create: TABLE 타입인데 tableName이 없을 때 에러
- create: 옵션 JSON 직렬화 확인

// 조회 테스트
- findAll: 모든 위젯을 컴포넌트 정보와 함께 조회
- findOne: 특정 위젯을 컴포넌트 정보와 함께 조회
- findOne: 존재하지 않는 위젯 조회 시 에러 응답

// 수정 테스트
- update: 위젯 옵션 수정
- update: 위젯 제목 수정
- update: 컴포넌트 ID 변경
- update: 존재하지 않는 위젯 수정 시 에러

// 삭제 테스트
- remove: TABLE 타입 위젯 삭제 시 tableQuery도 함께 삭제
- remove: DATASET 타입 위젯 삭제
- remove: 존재하지 않는 위젯 삭제 시 에러
```

## 🛠 기술적 구현 전략

### 1. 테스트 환경 설정 표준화

#### 공통 테스트 설정 패턴
```typescript
// 테스트 모듈 설정 예시
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AuthService,
    JwtService,
    {
      provide: getRepositoryToken(User),
      useClass: Repository,
    },
    {
      provide: getRepositoryToken(RefreshToken),
      useClass: Repository,
    },
  ],
}).compile();
```

#### Mock 패턴 표준화
```typescript
// Repository Mock 예시
const mockUserRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

// Service Mock 예시  
const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};
```

### 2. 우선순위별 테스트 구현 계획

#### Phase 1: 핵심 서비스 (주요 비즈니스 로직)
1. **AuthService** - 인증/인가 핵심 로직
2. **DashboardService** - 대시보드 CRUD 및 권한 관리
3. **WidgetService** - 위젯 생성/관리 로직

#### Phase 2: 지원 서비스 (부가 기능)
4. **UserService** - 사용자 관리
5. **ComponentService** - 차트 컴포넌트 관리
6. **DatabaseService** - DB 연결 관리

#### Phase 3: 유틸리티 및 헬퍼
7. **TableQueryService** - 테이블 쿼리 생성
8. **ConnectionService** - 외부 DB 연결

### 3. 테스트 커버리지 목표

#### 정량적 목표
- **전체 커버리지**: 20% 이상
- **핵심 서비스 커버리지**: 50% 이상 (AuthService, DashboardService, WidgetService)
- **의미 있는 테스트 비율**: 80% 이상 (단순 정의 확인 테스트 제외)

#### 정성적 목표
- 모든 핵심 비즈니스 로직에 대한 성공/실패 케이스 테스트
- 엣지 케이스와 에러 처리 로직 검증
- 외부 의존성(DB, JWT) 모킹을 통한 격리된 단위 테스트

## 🔧 구현 가이드라인

### 1. 테스트 파일 구조
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(async () => {
    // 테스트 모듈 설정
  });

  describe('methodName', () => {
    describe('성공 케이스', () => {
      it('should return expected result when valid input provided', () => {
        // 테스트 구현
      });
    });

    describe('실패 케이스', () => {
      it('should throw error when invalid input provided', () => {
        // 에러 테스트 구현
      });
    });

    describe('엣지 케이스', () => {
      it('should handle edge case properly', () => {
        // 엣지 케이스 테스트
      });
    });
  });
});
```

### 2. Mock 데이터 관리
```typescript
// test/fixtures/auth.fixtures.ts
export const mockUser = {
  id: 1,
  userId: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
};

export const mockJwtPayload = {
  userId: 'testuser',
  email: 'test@example.com',
  id: 1,
};
```

### 3. 테스트 유틸리티
```typescript
// test/utils/test-helpers.ts
export const createMockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),  
  find: jest.fn(),
});

export const createTestModule = async (providers: any[]) => {
  return Test.createTestingModule({
    providers,
  }).compile();
};
```

## ✅ 완료 기준

### 1. 테스트 실행 성공
- [x] 모든 테스트가 오류 없이 실행됨
- [ ] 의존성 주입 문제 해결됨
- [ ] Jest 설정 최적화 완료

### 2. 커버리지 달성
- [ ] 전체 테스트 커버리지 20% 이상
- [ ] AuthService 테스트 커버리지 60% 이상
- [ ] DashboardService 테스트 커버리지 50% 이상  
- [ ] WidgetService 테스트 커버리지 50% 이상

### 3. 테스트 품질
- [ ] "should be defined" 테스트 50% 이상 교체
- [ ] 모든 핵심 비즈니스 로직에 대한 테스트 존재
- [ ] 성공/실패/엣지 케이스 시나리오 커버

### 4. 유지보수성
- [ ] 테스트 코드 문서화 완료
- [ ] Mock 패턴 표준화 적용
- [ ] 테스트 유틸리티 공통화

## 📈 기대 효과

### 1. 코드 품질 향상
- 버그 조기 발견 및 예방
- 리팩토링 시 안정성 확보
- 코드 변경에 대한 신뢰성 증대

### 2. 개발 생산성 증대
- 수동 테스트 시간 단축
- 회귀 테스트 자동화
- 코드 리뷰 품질 향상

### 3. 유지보수성 개선
- 비즈니스 로직 문서화 효과
- 새로운 개발자 온보딩 도움
- 레거시 코드 이해도 증진

## 🚨 주의사항

### 1. 성능 고려사항
- 테스트 실행 시간 최적화 필요
- 대용량 데이터 테스트 시 메모리 사용량 모니터링
- 병렬 테스트 실행 시 DB 충돌 방지

### 2. 환경 격리
- 테스트용 환경 변수 분리
- 프로덕션 데이터와 격리
- 외부 API 호출 모킹 필수

### 3. 테스트 안정성
- 시간 의존적 테스트 회피
- 랜덤 데이터 사용 시 시드 고정
- 비동기 작업 적절한 대기 처리

---

**다음 작업**: T06_S01_API_Response_Standardization
**연관 작업**: T01_S01_Test_Infrastructure_Recovery, T02_S01_Critical_Bug_Resolution
**예상 소요 시간**: 8-12시간
**담당자**: Backend Developer
**우선순위**: High