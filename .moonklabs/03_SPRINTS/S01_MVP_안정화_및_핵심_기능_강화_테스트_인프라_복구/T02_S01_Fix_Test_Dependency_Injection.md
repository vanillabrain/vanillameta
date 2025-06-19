---
task_id: T02_S01
sprint_id: S01
task_name: Fix_Test_Dependency_Injection
status: completed
priority: high
last_updated: 2025-06-12T17:36:00Z
---

# T02_S01_Fix_Test_Dependency_Injection

## 📋 작업 개요
**Sprint**: S01_MVP_안정화_및_핵심_기능_강화_테스트_인프라_복구  
**타입**: Bug Fix  
**우선순위**: High  
**예상 소요시간**: 4-6 hours

## 🎯 작업 목표
모든 서비스 테스트 파일(*.service.spec.ts)의 의존성 주입 실패 문제를 해결하여 테스트 인프라를 정상화합니다.

## 📖 배경 및 문제 상황
현재 백엔드 API의 모든 서비스 테스트 파일이 의존성 주입 실패로 인해 실행되지 않습니다.

### 🔍 주요 문제점
1. **모듈 경로 문제**: `src/` 경로로 시작하는 import가 Jest에서 인식되지 않음
2. **의존성 모킹 누락**: Repository, Service 등의 의존성이 모킹되지 않음  
3. **TypeORM Repository 모킹 미구현**: `@InjectRepository` 데코레이터 의존성 처리 부족
4. **서비스 간 순환 의존성**: 일부 서비스가 서로를 참조하는 구조

### 🚨 현재 실패하는 테스트들
```bash
FAIL src/auth/auth.service.spec.ts
# Cannot find module 'src/user/entities/user.entity'

FAIL src/user/user.service.spec.ts  
# Cannot find module '../auth/auth.service.js'

FAIL src/dashboard/dashboard.service.spec.ts
# Cannot find module 'src/user/user.service'

FAIL src/dataset/dataset.service.spec.ts
# 의존성 주입 실패 (ConnectionService, Repository 모킹 필요)

FAIL src/widget/widget.service.spec.ts
# 의존성 주입 실패 (TableQueryService, Repository 모킹 필요)
```

## 🔧 기술적 분석

### 의존성 구조 분석
1. **AuthService** 의존성:
   - `JwtService` (NestJS)
   - `Repository<User>` (TypeORM)
   - `Repository<RefreshToken>` (TypeORM)

2. **UserService** 의존성:
   - `Repository<User>` (TypeORM)
   - `Repository<UserMapping>` (TypeORM)
   - `AuthService` (순환 의존성)

3. **DashboardService** 의존성:
   - `Repository<Dashboard>` (TypeORM)
   - `Repository<User>` (TypeORM)
   - `Repository<DashboardShare>` (TypeORM)
   - `Repository<UserMapping>` (TypeORM)
   - `DashboardWidgetService`
   - `UserService`
   - `AuthService`

4. **DatasetService** 의존성:
   - `Repository<Dataset>` (TypeORM)
   - `Repository<Widget>` (TypeORM)
   - `ConnectionService`

5. **WidgetService** 의존성:
   - `Repository<Widget>` (TypeORM)
   - `Repository<Component>` (TypeORM)
   - `TableQueryService`

### Jest 설정 문제
현재 Jest 설정에서 TypeScript 경로 매핑이 누락되어 있음:
```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "testTimeout": 20000,
    "rootDir": ".",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "testEnvironment": "node"
  }
}
```

## ✅ 작업 범위

### Phase 1: Jest 설정 수정
- [ ] `package.json`의 Jest 설정에 `moduleNameMapping` 추가
- [ ] TypeScript 경로 매핑 활성화 (`tsconfig-paths/register`)
- [ ] 기본 테스트 실행 환경 검증

### Phase 2: 의존성 모킹 패턴 정립
- [ ] TypeORM Repository 모킹 유틸리티 생성
- [ ] NestJS Service 모킹 패턴 정립
- [ ] 공통 테스트 헬퍼 함수 작성

### Phase 3: 개별 서비스 테스트 수정
- [ ] `AuthService` 테스트 수정
- [ ] `UserService` 테스트 수정 (순환 의존성 해결)
- [ ] `DashboardService` 테스트 수정
- [ ] `DatasetService` 테스트 수정
- [ ] `WidgetService` 테스트 수정
- [ ] 나머지 서비스 테스트 수정

### Phase 4: 검증 및 문서화
- [ ] 모든 서비스 테스트 실행 성공 확인
- [ ] 테스트 커버리지 확인
- [ ] 테스트 작성 가이드라인 문서화

## 🛠️ 구현 계획

### 1. Jest 설정 개선
```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "testTimeout": 20000,
    "rootDir": ".",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "moduleNameMapping": {
      "^src/(.*)$": "<rootDir>/src/$1"
    },
    "setupFilesAfterEnv": ["<rootDir>/test/jest.setup.ts"],
    "testEnvironment": "node"
  }
}
```

### 2. 공통 테스트 유틸리티 작성
파일: `test/utils/test-helpers.ts`
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export const createMockRepository = (): Partial<Repository<any>> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
    // ... 기타 필요한 메소드들
  }))
});

export const createTestingModule = async (
  service: any,
  providers: any[] = []
): Promise<TestingModule> => {
  return Test.createTestingModule({
    providers: [service, ...providers],
  }).compile();
};
```

### 3. AuthService 테스트 예시 구조
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entites/refresh_token.entity';
import { createMockRepository } from '../../test/utils/test-helpers';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let userRepository: any;
  let refreshTokenRepository: any;

  beforeEach(async () => {
    const mockUserRepository = createMockRepository();
    const mockRefreshTokenRepository = createMockRepository();
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    userRepository = module.get(getRepositoryToken(User));
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 추가 테스트 케이스들...
});
```

## 📁 관련 파일 경로

### 수정할 테스트 파일들
```
/workspace/vanillameta/backend-api/src/auth/auth.service.spec.ts
/workspace/vanillameta/backend-api/src/user/user.service.spec.ts
/workspace/vanillameta/backend-api/src/dashboard/dashboard.service.spec.ts
/workspace/vanillameta/backend-api/src/dataset/dataset.service.spec.ts
/workspace/vanillameta/backend-api/src/widget/widget.service.spec.ts
/workspace/vanillameta/backend-api/src/component/component.service.spec.ts
/workspace/vanillameta/backend-api/src/template/template.service.spec.ts
/workspace/vanillameta/backend-api/src/share-url/share-url.service.spec.ts
/workspace/vanillameta/backend-api/src/login/login.service.spec.ts
/workspace/vanillameta/backend-api/src/database/database.service.spec.ts
```

### 생성할 파일들
```
/workspace/vanillameta/backend-api/test/utils/test-helpers.ts
/workspace/vanillameta/backend-api/test/jest.setup.ts
```

### 수정할 설정 파일들
```
/workspace/vanillameta/backend-api/package.json (Jest 설정)
```

## 🧪 테스트 계획

### 1. 단위 테스트
각 서비스별로 다음을 검증:
- 서비스 인스턴스 생성 성공
- 주요 메소드 실행 가능
- 의존성 모킹 정상 동작

### 2. 통합 테스트 준비
- TestingModule 생성 성공
- 실제 비즈니스 로직 테스트 가능한 환경 구축

### 3. 회귀 테스트 방지
- 기존 기능 동작에 영향 없음 확인
- 모든 서비스 테스트 실행 성공

## 🚀 검증 기준

### Definition of Done
- [ ] 모든 `*.service.spec.ts` 파일이 오류 없이 실행됨
- [ ] `yarn test` 명령어로 전체 테스트 실행 성공
- [ ] 각 서비스 테스트에서 최소한 "should be defined" 테스트 통과
- [ ] 의존성 주입 관련 오류 메시지 모두 해결
- [ ] 테스트 커버리지 리포트 정상 생성

### 성공 기준
```bash
# 모든 서비스 테스트 성공 실행
yarn test --testPathPattern="service.spec.ts"

# 개별 서비스 테스트 성공 실행
yarn test --testPathPattern="auth.service.spec.ts"
yarn test --testPathPattern="user.service.spec.ts"
yarn test --testPathPattern="dashboard.service.spec.ts"
# ... 기타 모든 서비스
```

## 📚 참고 자료

### NestJS 테스팅 가이드
- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [TypeORM Testing with Jest](https://typeorm.io/testing)

### Jest 설정 참고
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Module Name Mapping](https://jestjs.io/docs/configuration#modulenamemapper-objectstring-string--arraystring)

### TypeScript 경로 매핑
- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)
- [tsconfig-paths with Jest](https://github.com/dividab/tsconfig-paths#jest)

## 🔄 후속 작업
- T03: Controller 테스트 수정 및 개선
- T04: E2E 테스트 인프라 구축
- T05: 테스트 커버리지 개선

## 📝 작업 노트
- 순환 의존성 문제는 모킹을 통해 해결
- 실제 서비스 로직 변경 없이 테스트만 수정
- 공통 헬퍼 함수로 코드 중복 최소화
- Jest 설정 변경 후 전체 테스트 재실행 필요