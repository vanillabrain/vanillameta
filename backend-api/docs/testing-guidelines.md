# VanillaMeta Backend API 테스트 가이드라인

## 개요

이 문서는 VanillaMeta 백엔드 API의 테스트 작성 및 실행에 대한 가이드라인을 제공합니다. 포괄적인 테스트 스위트를 통해 코드 품질을 보장하고 안정적인 개발 환경을 구축합니다.

## 테스트 구조

### 테스트 유형

1. **단위 테스트 (Unit Tests)**: `*.spec.ts`
   - 개별 서비스, 컨트롤러, 유틸리티 함수 테스트
   - 모킹을 통한 의존성 분리
   - 비즈니스 로직 검증

2. **E2E 테스트 (End-to-End Tests)**: `test/*.e2e-spec.ts`
   - 전체 애플리케이션 플로우 테스트
   - 실제 HTTP 요청/응답 검증
   - 사용자 시나리오 기반 테스트

3. **통합 테스트 (Integration Tests)**: `*.integration.spec.ts`
   - 여러 컴포넌트 간의 상호작용 테스트
   - 데이터베이스 연동 테스트
   - 외부 서비스 연동 테스트

## 테스트 실행 명령어

```bash
# 전체 단위 테스트 실행
yarn test

# 감시 모드로 테스트 실행
yarn test:watch

# 커버리지 포함 테스트 실행
yarn test:cov

# E2E 테스트 실행
yarn test:e2e

# 특정 모듈 테스트 실행
yarn test --testPathPattern="auth"
yarn test --testPathPattern="dashboard"
yarn test --testPathPattern="widget"

# 특정 서비스 테스트 실행
yarn test --testNamePattern="AuthService"
yarn test --testNamePattern="DashboardService"
```

## 테스트 작성 가이드라인

### 1. 단위 테스트 패턴

#### 기본 구조
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from './service-name.service';
import { Entity } from './entities/entity.entity';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';

describe('ServiceName', () => {
  let service: ServiceName;
  let repository: any;

  const mockEntity = {
    id: 1,
    name: 'Test Entity',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: getRepositoryTokenFor(Entity),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
    repository = module.get(getRepositoryTokenFor(Entity));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('businessMethod', () => {
    it('should handle success case', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(mockEntity);
      
      // Act
      const result = await service.businessMethod(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
      expect(repository.findOne).toHaveBeenCalledWith(expectedParams);
    });

    it('should handle error case', async () => {
      // Arrange
      repository.findOne.mockRejectedValue(new Error('Database error'));
      
      // Act & Assert
      await expect(service.businessMethod(input)).rejects.toThrow('Database error');
    });
  });
});
```

#### 모킹 패턴

1. **TypeORM Repository 모킹**
```typescript
const mockRepository = createMockRepository<Entity>();
```

2. **외부 서비스 모킹**
```typescript
const mockExternalService = createMockService(['method1', 'method2']);
```

3. **환경 변수 모킹**
```typescript
beforeEach(() => {
  process.env.ACCESS_SECRET = 'test-secret';
  process.env.NODE_ENV = 'test';
});
```

### 2. E2E 테스트 패턴

#### 기본 구조
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Feature Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/endpoint (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/endpoint')
      .send(testData)
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('expectedProperty');
      });
  });
});
```

#### 인증이 필요한 엔드포인트 테스트
```typescript
let authToken: string;

beforeAll(async () => {
  // 로그인하여 토큰 획득
  const loginResponse = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ userId: 'testuser', password: 'testpass' })
    .expect(201);

  authToken = loginResponse.body.accessToken;
});

it('should access protected endpoint', () => {
  return request(app.getHttpServer())
    .get('/api/protected')
    .set('Authorization', `Bearer ${authToken}`)
    .expect(200);
});
```

### 3. 테스트 데이터 관리

#### 테스트 헬퍼 사용
```typescript
import {
  mockUser,
  mockDashboard,
  mockWidget,
  createMockRepository,
  createMockService,
} from '../../test/test-helpers';
```

#### 테스트별 데이터 정리
```typescript
beforeEach(async () => {
  // 테스트 데이터 정리
  await repository.delete({});
});

afterAll(async () => {
  // 전체 테스트 데이터 정리
  await repository.delete({});
});
```

### 4. 커버리지 목표

- **Line Coverage**: 80% 이상
- **Branch Coverage**: 75% 이상  
- **Function Coverage**: 90% 이상
- **Statement Coverage**: 85% 이상

### 5. 테스트 케이스 분류

#### 핵심 테스트 케이스
1. **성공 케이스**: 정상적인 입력에 대한 예상 결과
2. **실패 케이스**: 잘못된 입력에 대한 에러 처리
3. **경계값 케이스**: 최대/최소 값, 빈 값 등
4. **예외 케이스**: 네트워크 오류, 데이터베이스 오류 등

#### 보안 테스트 케이스
1. **SQL Injection 방지**
2. **XSS 방지**
3. **권한 검증**
4. **입력 검증**

#### 성능 테스트 케이스
1. **대용량 데이터 처리**
2. **동시 요청 처리**
3. **메모리 사용량**
4. **응답 시간**

## 테스트 Best Practices

### 1. 테스트 작성 원칙

1. **독립성**: 각 테스트는 다른 테스트에 의존하지 않아야 함
2. **반복 가능성**: 동일한 결과를 보장해야 함
3. **빠른 실행**: 5분 이내에 모든 테스트가 완료되어야 함
4. **명확성**: 테스트 이름과 구조가 명확해야 함

### 2. 테스트 네이밍

```typescript
// 좋은 예
describe('AuthService', () => {
  describe('validateUser', () => {
    it('should return user without password when credentials are valid', () => {});
    it('should return undefined when user not found', () => {});
    it('should return undefined when password is incorrect', () => {});
  });
});

// 나쁜 예
describe('AuthService', () => {
  it('test1', () => {});
  it('should work', () => {});
});
```

### 3. Arrange-Act-Assert 패턴

```typescript
it('should create user successfully', async () => {
  // Arrange - 테스트 데이터 준비
  const createUserDto = { name: 'John', email: 'john@example.com' };
  repository.save.mockResolvedValue({ id: 1, ...createUserDto });

  // Act - 테스트 대상 실행
  const result = await service.createUser(createUserDto);

  // Assert - 결과 검증
  expect(result.id).toBe(1);
  expect(result.name).toBe('John');
  expect(repository.save).toHaveBeenCalledWith(createUserDto);
});
```

### 4. 에러 케이스 테스트

```typescript
it('should throw error when user not found', async () => {
  repository.findOne.mockResolvedValue(null);

  await expect(service.findUser(999)).rejects.toThrow('User not found');
});
```

### 5. 비동기 테스트

```typescript
// Promise 기반
it('should handle async operation', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});

// Callback 기반 (피해야 할 패턴)
it('should handle callback', (done) => {
  service.callbackMethod((err, result) => {
    expect(err).toBeNull();
    expect(result).toBeDefined();
    done();
  });
});
```

## 개선된 테스트 인프라

### 1. 테스트 헬퍼 유틸리티

#### `/test/test-helpers.ts`
- `createMockRepository<T>()`: TypeORM Repository 모킹
- `createMockJwtService()`: JWT 서비스 모킹
- `createMockService<T>(methods)`: 일반 서비스 모킹
- `createTestProviders()`: 테스트 모듈 provider 자동 설정

#### 공통 Mock 데이터
- `mockUser`: 테스트 사용자 데이터
- `mockDashboard`: 테스트 대시보드 데이터
- `mockWidget`: 테스트 위젯 데이터
- `mockDatabase`: 테스트 데이터베이스 데이터

### 2. 강화된 서비스 테스트

#### AuthService
- JWT 토큰 생성/검증 로직
- 리프레시 토큰 관리
- 사용자 인증/인가 플로우
- 보안 테스트 (토큰 변조 방지 등)

#### DashboardService  
- CRUD 작업 및 권한 검증
- 레이아웃 데이터 처리
- 공유 기능 연동
- N+1 쿼리 방지 검증

#### ConnectionService
- 다중 데이터베이스 연결 관리
- Knex.js 연결 풀 최적화
- 연결 테스트 및 검증
- 보안 SQL 검증

#### WidgetService
- 차트 설정 및 데이터 바인딩
- 50+ 차트 타입 지원 로직
- 테이블/데이터셋 위젯 처리

### 3. 포괄적인 E2E 테스트

#### 인증 플로우 (`auth-flow.e2e-spec.ts`)
- 로그인/로그아웃/토큰 갱신
- 보호된 라우트 접근 제어
- 보안 테스트 (SQL Injection, Rate Limiting)

#### 대시보드 관리 (`dashboard-flow.e2e-spec.ts`)
- 대시보드 CRUD 작업
- 공유 기능 테스트
- 권한 기반 접근 제어

#### 위젯 생성 (`widget-flow.e2e-spec.ts`)
- 차트/테이블 위젯 생성
- 복잡한 옵션 설정 처리
- 데이터 시각화 플로우

## CI/CD 통합

### Jest 설정

#### `jest.config.js` (단위 테스트)
```javascript
module.exports = {
  displayName: 'Unit Tests',
  testMatch: ['**/*.spec.ts'],
  modulePathMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 90,
      lines: 80,
      statements: 85,
    },
  },
};
```

#### `test/jest-e2e.json` (E2E 테스트)
```json
{
  "displayName": "E2E Tests",
  "testMatch": ["**/*.e2e-spec.ts"],
  "timeout": 30000
}
```

### 테스트 실행 스크립트

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:all": "yarn test && yarn test:e2e"
  }
}
```

## 트러블슈팅

### 일반적인 문제들

1. **테스트 간 의존성**
   - 각 테스트 전에 Mock 초기화: `jest.clearAllMocks()`
   - 테스트 데이터 정리: `beforeEach`/`afterEach` 사용

2. **비동기 테스트 타임아웃**
   - Jest 타임아웃 설정: `jest.setTimeout(30000)`
   - Promise 체이닝 대신 async/await 사용

3. **모킹 문제**
   - 올바른 모킹 헬퍼 사용
   - 의존성 주입 토큰 확인

4. **E2E 테스트 실패**
   - 애플리케이션 초기화 확인
   - 테스트 데이터베이스 상태 확인
   - 포트 충돌 문제 해결

### 성능 최적화

1. **병렬 테스트 실행**
   ```bash
   jest --maxWorkers=4
   ```

2. **테스트 파일 분할**
   - 큰 테스트 파일을 작은 단위로 분할
   - 관련된 테스트끼리 그룹화

3. **불필요한 테스트 제외**
   ```bash
   jest --testPathIgnorePatterns=integration
   ```

## 결론

이 가이드라인을 따라 작성된 포괄적인 테스트 스위트는:

- **80% 이상의 코드 커버리지** 달성
- **안정적인 CI/CD 파이프라인** 구축
- **빠른 피드백 루프** (5분 이내 테스트 완료)
- **높은 코드 품질** 보장
- **리그레션 방지** 및 안전한 리팩토링 지원

지속적인 테스트 작성과 개선을 통해 VanillaMeta의 안정성과 품질을 보장할 수 있습니다.