# VanillaMeta 테스트 유지보수 가이드

## 1. 개요

이 문서는 VanillaMeta 프로젝트의 테스트 코드를 건강하게 유지하고 지속적으로 개선하기 위한 가이드입니다.

## 2. 테스트 건강도 지표

### 핵심 메트릭

| 메트릭 | 목표 | 경고 수준 | 위험 수준 |
|--------|------|----------|----------|
| **테스트 실행 시간** | < 5분 | 5-10분 | > 10분 |
| **Flaky 테스트 비율** | 0% | 1-5% | > 5% |
| **테스트 커버리지** | > 85% | 80-85% | < 80% |
| **테스트 코드 중복도** | < 10% | 10-20% | > 20% |
| **평균 테스트 복잡도** | < 3 | 3-5 | > 5 |

### 모니터링 대시보드

```yaml
# 테스트 건강도 모니터링 스크립트
test-health:
  schedule: "0 9 * * MON" # 매주 월요일 오전 9시
  steps:
    - measure-execution-time
    - detect-flaky-tests
    - analyze-coverage-trends
    - check-test-duplication
    - calculate-complexity
```

## 3. 일상적인 유지보수

### 일일 점검 사항

- [ ] CI/CD 파이프라인 상태 확인
- [ ] 실패한 테스트 조사 및 수정
- [ ] 새로운 PR의 테스트 커버리지 확인

### 주간 점검 사항

- [ ] Flaky 테스트 식별 및 수정
- [ ] 테스트 실행 시간 분석
- [ ] 느린 테스트 최적화
- [ ] 테스트 코드 리뷰

### 월간 점검 사항

- [ ] 테스트 커버리지 트렌드 분석
- [ ] 테스트 인프라 업데이트
- [ ] 테스트 전략 재검토
- [ ] 팀 교육 필요사항 파악

## 4. Flaky 테스트 관리

### Flaky 테스트 식별

```typescript
// flaky-test-detector.js
class FlakyTestDetector {
  constructor(testResults, threshold = 0.95) {
    this.testResults = testResults;
    this.threshold = threshold;
  }
  
  detectFlaky() {
    const testRuns = this.groupByTest();
    const flakyTests = [];
    
    for (const [testName, runs] of Object.entries(testRuns)) {
      const successRate = runs.filter(r => r.passed).length / runs.length;
      
      if (successRate < this.threshold && successRate > 0) {
        flakyTests.push({
          name: testName,
          successRate,
          failures: runs.filter(r => !r.passed)
        });
      }
    }
    
    return flakyTests;
  }
}
```

### Flaky 테스트 수정 전략

1. **타이밍 의존성 제거**
```typescript
// ❌ Before - 타이밍에 의존
await sleep(1000);
expect(element).toBeVisible();

// ✅ After - 명시적 대기
await waitFor(() => {
  expect(element).toBeVisible();
}, { timeout: 5000 });
```

2. **순서 의존성 제거**
```typescript
// ❌ Before - 다른 테스트 결과에 의존
it('test 1', () => {
  globalState.value = 'test';
});

it('test 2', () => {
  expect(globalState.value).toBe('test'); // test 1에 의존
});

// ✅ After - 독립적인 테스트
it('test 2', () => {
  // 자체 설정
  globalState.value = 'test';
  expect(globalState.value).toBe('test');
});
```

3. **외부 의존성 안정화**
```typescript
// Mock 외부 서비스
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
});
```

## 5. 테스트 성능 최적화

### 느린 테스트 식별

```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-slow-test-reporter', {
      numTests: 10,
      warnOnSlowerThan: 300,
      color: true
    }]
  ]
};
```

### 최적화 전략

1. **병렬 실행**
```json
{
  "scripts": {
    "test:parallel": "jest --maxWorkers=4",
    "test:ci": "jest --maxWorkers=50%"
  }
}
```

2. **선택적 실행**
```bash
# 변경된 파일만 테스트
jest -o

# 특정 패턴만 테스트
jest --testNamePattern="UserService"

# 실패한 테스트만 재실행
jest --onlyFailures
```

3. **테스트 분할**
```typescript
// 큰 테스트 스위트 분할
describe('UserService - Creation', () => {
  // 사용자 생성 관련 테스트
});

describe('UserService - Updates', () => {
  // 사용자 업데이트 관련 테스트
});

describe('UserService - Queries', () => {
  // 조회 관련 테스트
});
```

## 6. 테스트 리팩토링

### 중복 제거

```typescript
// Before - 중복된 설정
describe('WidgetService', () => {
  it('test 1', () => {
    const widget = { id: 1, name: 'Test', type: 'chart' };
    const repository = createMockRepository();
    repository.findOne.mockResolvedValue(widget);
    // 테스트 로직
  });
  
  it('test 2', () => {
    const widget = { id: 1, name: 'Test', type: 'chart' };
    const repository = createMockRepository();
    repository.findOne.mockResolvedValue(widget);
    // 다른 테스트 로직
  });
});

// After - 공통 설정 추출
describe('WidgetService', () => {
  let widget: Widget;
  let repository: MockRepository;
  
  beforeEach(() => {
    widget = createTestWidget();
    repository = createMockRepository();
    repository.findOne.mockResolvedValue(widget);
  });
  
  it('test 1', () => {
    // 테스트 로직만
  });
  
  it('test 2', () => {
    // 테스트 로직만
  });
});
```

### 테스트 유틸리티 개선

```typescript
// test/utils/test-helpers.ts
export class TestDataBuilder {
  static user(overrides?: Partial<User>): User {
    return {
      id: faker.datatype.uuid(),
      email: faker.internet.email(),
      name: faker.name.fullName(),
      createdAt: new Date(),
      ...overrides
    };
  }
  
  static dashboard(overrides?: Partial<Dashboard>): Dashboard {
    return {
      id: faker.datatype.number(),
      title: faker.lorem.words(3),
      userId: faker.datatype.uuid(),
      layout: [],
      ...overrides
    };
  }
}

// 사용 예
const testUser = TestDataBuilder.user({ name: 'John Doe' });
const testDashboard = TestDataBuilder.dashboard({ userId: testUser.id });
```

## 7. 테스트 문서화

### 테스트 계획 문서

```markdown
## 기능: 사용자 인증
### 테스트 시나리오
1. **정상 로그인**
   - 입력: 유효한 이메일과 비밀번호
   - 예상 결과: JWT 토큰 반환
   
2. **잘못된 비밀번호**
   - 입력: 유효한 이메일, 잘못된 비밀번호
   - 예상 결과: 401 Unauthorized
   
3. **존재하지 않는 사용자**
   - 입력: 미등록 이메일
   - 예상 결과: 401 Unauthorized
```

### 테스트 코드 주석

```typescript
describe('AuthenticationService', () => {
  /**
   * 인증 서비스의 핵심 기능을 테스트합니다.
   * 
   * 테스트 범위:
   * - 사용자 로그인
   * - 토큰 생성 및 검증
   * - 리프레시 토큰 로직
   * 
   * 제외 사항:
   * - 소셜 로그인 (별도 테스트 파일)
   * - 2FA 인증 (별도 테스트 파일)
   */
  
  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      // Given: 유효한 사용자 정보가 DB에 존재
      // When: 올바른 인증 정보로 로그인 시도
      // Then: access token과 refresh token 반환
    });
  });
});
```

## 8. 테스트 데이터 관리

### 시드 데이터 관리

```typescript
// test/seeds/test-data-seeder.ts
export class TestDataSeeder {
  async seed(connection: Connection) {
    await this.clearDatabase(connection);
    await this.seedUsers(connection);
    await this.seedDashboards(connection);
    await this.seedWidgets(connection);
  }
  
  private async clearDatabase(connection: Connection) {
    const entities = connection.entityMetadatas;
    
    for (const entity of entities) {
      const repository = connection.getRepository(entity.name);
      await repository.query(`DELETE FROM ${entity.tableName}`);
    }
  }
  
  private async seedUsers(connection: Connection) {
    const users = [
      { email: 'admin@test.com', role: 'admin' },
      { email: 'user@test.com', role: 'user' },
    ];
    
    await connection.getRepository(User).save(users);
  }
}
```

### 테스트 데이터 정리

```typescript
// 자동 정리 설정
afterEach(async () => {
  await cleanupTestData();
});

async function cleanupTestData() {
  // 트랜잭션 롤백
  if (queryRunner?.isTransactionActive) {
    await queryRunner.rollbackTransaction();
  }
  
  // 생성된 파일 삭제
  if (testFiles.length > 0) {
    await Promise.all(testFiles.map(file => fs.unlink(file)));
  }
  
  // Mock 초기화
  jest.clearAllMocks();
}
```

## 9. CI/CD 통합

### GitHub Actions 설정

```yaml
name: Test Maintenance

on:
  schedule:
    - cron: '0 2 * * *' # 매일 새벽 2시
  workflow_dispatch:

jobs:
  test-health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: yarn install --frozen-lockfile
        
      - name: Run test health checks
        run: |
          yarn test:health
          yarn test:flaky-detection
          yarn test:performance-analysis
          
      - name: Generate report
        run: yarn test:generate-report
        
      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: test-health-report
          path: test-reports/
          
      - name: Notify if issues found
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Test Health Check Failed',
              body: 'Automated test health check found issues. Check the artifacts for details.'
            })
```

## 10. 테스트 교육 및 문화

### 팀 교육 프로그램

1. **신규 팀원 온보딩**
   - 테스트 철학 소개
   - 테스트 작성 실습
   - 코드 리뷰 참여

2. **정기 워크샵**
   - 월 1회 테스트 베스트 프랙티스 공유
   - 새로운 테스트 도구/기법 소개
   - 테스트 안티패턴 리뷰

3. **페어 프로그래밍**
   - 복잡한 테스트 작성 시 페어 프로그래밍
   - 지식 공유 및 코드 품질 향상

### 테스트 문화 구축

```markdown
## 테스트 주도 개발 원칙

1. **Red-Green-Refactor**
   - Red: 실패하는 테스트 작성
   - Green: 테스트 통과하는 최소 코드
   - Refactor: 코드 개선

2. **테스트 우선**
   - 기능 구현 전 테스트 작성
   - 버그 수정 전 재현 테스트 작성

3. **지속적 개선**
   - 테스트 코드도 프로덕션 코드처럼 관리
   - 정기적인 리팩토링
```

## 11. 문제 해결 플레이북

### 일반적인 문제와 해결책

| 문제 | 증상 | 해결책 |
|------|------|--------|
| **메모리 누수** | 테스트 실행 중 메모리 증가 | Mock 정리, 이벤트 리스너 제거 |
| **타임아웃** | 테스트가 간헐적으로 타임아웃 | 비동기 처리 개선, 타임아웃 증가 |
| **의존성 충돌** | 특정 순서로만 테스트 통과 | 테스트 격리, beforeEach 활용 |
| **느린 실행** | 전체 테스트 시간 증가 | 병렬화, 불필요한 설정 제거 |

### 디버깅 도구

```json
{
  "scripts": {
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:verbose": "jest --verbose --detectOpenHandles",
    "test:leak": "jest --logHeapUsage --detectLeaks"
  }
}
```

## 12. 미래 개선 계획

### 단기 (3개월)
- [ ] 테스트 실행 시간 50% 단축
- [ ] Flaky 테스트 제로화
- [ ] 테스트 자동 생성 도구 도입

### 중기 (6개월)
- [ ] 시각적 회귀 테스트 구축
- [ ] 성능 회귀 자동 감지
- [ ] 테스트 영향 분석 도구 도입

### 장기 (12개월)
- [ ] AI 기반 테스트 케이스 생성
- [ ] 자가 치유 테스트 시스템
- [ ] 예측적 테스트 실패 분석

---

**문의**: qa-team@vanillameta.com  
**최종 업데이트**: 2025-01-21