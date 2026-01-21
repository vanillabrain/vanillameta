# T04: CI/CD 테스트 단계 복구

## 태스크 정보
- **태스크 ID**: T04_S11
- **스프린트**: S11 - 테스트 인프라 긴급 복구
- **우선순위**: 중간
- **예상 소요 시간**: 1일
- **담당자**: DevOps Engineer / Full Stack Developer

## 개요

현재 CI/CD 파이프라인의 테스트 단계가 올바르게 작동하지 않아 자동화된 테스트 실행이 불가능한 상태입니다. GitHub Actions 워크플로우를 수정하여 백엔드와 프론트엔드 테스트를 모두 포함하는 안정적인 CI/CD 파이프라인을 구축해야 합니다.

## 목표

1. GitHub Actions 워크플로우 수정
2. 테스트 실행 스크립트 검증
3. 테스트 리포트 설정
4. 병렬 테스트 실행 최적화

## 세부 작업 계획

### 1. 현재 CI/CD 상태 분석
- [ ] 기존 GitHub Actions 워크플로우 파일 검토
- [ ] 테스트 실패 원인 분석
- [ ] 의존성 설치 문제 확인
- [ ] 환경 변수 설정 점검

### 2. 워크플로우 파일 수정
- [ ] 백엔드 테스트 단계 구성
- [ ] 프론트엔드 테스트 단계 구성
- [ ] 테스트 병렬 실행 설정
- [ ] 캐시 최적화 설정

### 3. 테스트 환경 설정
- [ ] Node.js 버전 매트릭스 설정
- [ ] 환경 변수 암호화 및 설정
- [ ] 테스트 데이터베이스 설정
- [ ] 필요한 서비스 설정 (Redis 등)

### 4. 테스트 리포트 및 결과 관리
- [ ] 테스트 커버리지 리포트 생성
- [ ] 테스트 결과 아티팩트 저장
- [ ] 실패한 테스트에 대한 상세 로그
- [ ] PR 코멘트에 테스트 결과 표시

### 5. 성능 최적화
- [ ] 의존성 캐싱 설정
- [ ] 테스트 실행 시간 최적화
- [ ] 불필요한 단계 제거
- [ ] 조건부 실행 설정

## 기술적 세부사항

### 메인 워크플로우 파일
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [ develop, main ]
  pull_request:
    branches: [ develop, main ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.changes.outputs.backend }}
      frontend: ${{ steps.changes.outputs.frontend }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect changes
        uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            backend:
              - 'backend-api/**'
              - 'backend-api-libs-lambda-layer/**'
            frontend:
              - 'frontend-web/**'

  backend-test:
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    defaults:
      run:
        working-directory: ./backend-api
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'yarn'
          cache-dependency-path: backend-api/yarn.lock

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Type check
        run: yarn type-check

      - name: Lint
        run: yarn lint

      - name: Run tests
        run: yarn test:ci
        env:
          NODE_ENV: test
          DATABASE_URL: sqlite::memory:
          JWT_SECRET: test-secret
          REDIS_URL: redis://localhost:6379

      - name: Generate coverage report
        run: yarn test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./backend-api/coverage/lcov.info
          flags: backend
          name: backend-coverage

      - name: Build application
        run: yarn build:dev

  frontend-test:
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    defaults:
      run:
        working-directory: ./frontend-web
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: frontend-web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm run test:ci
        env:
          CI: true
          REACT_APP_API_URL: http://localhost:3001
          REACT_APP_ENV: test

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./frontend-web/coverage/lcov.info
          flags: frontend
          name: frontend-coverage

      - name: Build application
        run: npm run build
        env:
          REACT_APP_API_URL: ${{ secrets.REACT_APP_API_URL }}
          REACT_APP_ENV: production

  integration-test:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]
    if: always() && (needs.backend-test.result == 'success' || needs.backend-test.result == 'skipped') && (needs.frontend-test.result == 'success' || needs.frontend-test.result == 'skipped')
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vanillameta_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'yarn'
          cache-dependency-path: backend-api/yarn.lock

      - name: Install backend dependencies
        run: |
          cd backend-api
          yarn install --frozen-lockfile

      - name: Install frontend dependencies
        run: |
          cd frontend-web
          npm ci

      - name: Run integration tests
        run: |
          cd backend-api
          yarn test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vanillameta_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            backend-api/coverage/
            frontend-web/coverage/
            backend-api/test-results.xml
            frontend-web/test-results.xml

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  notify:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test, integration-test]
    if: always()
    steps:
      - name: Notify on success
        if: needs.backend-test.result == 'success' && needs.frontend-test.result == 'success' && needs.integration-test.result == 'success'
        run: echo "All tests passed successfully!"

      - name: Notify on failure
        if: failure()
        run: echo "Some tests failed. Please check the logs."
```

### 백엔드 테스트 스크립트 최적화
```json
// backend-api/package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --maxWorkers=2 --silent",
    "test:coverage": "jest --coverage --coverageReporters=text-lcov > coverage/lcov.info",
    "test:e2e": "jest --config jest-e2e.config.js --runInBand",
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext .ts,.tsx --fix"
  }
}
```

### 프론트엔드 테스트 스크립트 최적화
```json
// frontend-web/package.json
{
  "scripts": {
    "test": "react-scripts test",
    "test:ci": "react-scripts test --ci --coverage --watchAll=false --maxWorkers=2",
    "test:coverage": "react-scripts test --coverage --watchAll=false --coverageReporters=text-lcov > coverage/lcov.info",
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext .ts,.tsx --fix"
  },
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{js,jsx,ts,tsx}",
      "!src/**/*.d.ts",
      "!src/index.tsx",
      "!src/reportWebVitals.ts"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 50,
        "functions": 50,
        "lines": 50,
        "statements": 50
      }
    }
  }
}
```

### PR 테스트 결과 코멘트 워크플로우
```yaml
# .github/workflows/pr-comment.yml
name: PR Comment with Test Results

on:
  workflow_run:
    workflows: ["CI Pipeline"]
    types:
      - completed

jobs:
  comment:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.event == 'pull_request'
    steps:
      - name: Download test results
        uses: actions/github-script@v6
        with:
          script: |
            const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
              owner: context.repo.owner,
              repo: context.repo.repo,
              run_id: ${{ github.event.workflow_run.id }},
            });
            
            const testArtifact = artifacts.data.artifacts.find(artifact => 
              artifact.name === 'test-results'
            );
            
            if (testArtifact) {
              const download = await github.rest.actions.downloadArtifact({
                owner: context.repo.owner,
                repo: context.repo.repo,
                artifact_id: testArtifact.id,
                archive_format: 'zip',
              });
              
              require('fs').writeFileSync('test-results.zip', Buffer.from(download.data));
            }

      - name: Extract and parse results
        run: |
          unzip -q test-results.zip || true
          echo "TEST_SUMMARY<<EOF" >> $GITHUB_ENV
          echo "## 🧪 테스트 결과" >> $GITHUB_ENV
          echo "" >> $GITHUB_ENV
          
          # 백엔드 커버리지 정보 추가
          if [ -f "backend-api/coverage/coverage-summary.json" ]; then
            echo "### 백엔드 커버리지" >> $GITHUB_ENV
            cat backend-api/coverage/coverage-summary.json | jq -r '
              "- Lines: " + (.total.lines.pct | tostring) + "%\n" +
              "- Functions: " + (.total.functions.pct | tostring) + "%\n" +
              "- Branches: " + (.total.branches.pct | tostring) + "%"
            ' >> $GITHUB_ENV
          fi
          
          # 프론트엔드 커버리지 정보 추가
          if [ -f "frontend-web/coverage/coverage-summary.json" ]; then
            echo "### 프론트엔드 커버리지" >> $GITHUB_ENV
            cat frontend-web/coverage/coverage-summary.json | jq -r '
              "- Lines: " + (.total.lines.pct | tostring) + "%\n" +
              "- Functions: " + (.total.functions.pct | tostring) + "%\n" +
              "- Branches: " + (.total.branches.pct | tostring) + "%"
            ' >> $GITHUB_ENV
          fi
          
          echo "EOF" >> $GITHUB_ENV

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const prNumber = ${{ github.event.workflow_run.pull_requests[0].number }};
            
            if (prNumber) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: prNumber,
                body: process.env.TEST_SUMMARY
              });
            }
```

### 환경 설정 파일
```yaml
# .github/workflows/env-setup.yml
name: Environment Setup

on:
  workflow_call:
    inputs:
      node-version:
        required: true
        type: string
      cache-key:
        required: true
        type: string

jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'yarn'

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.npm
            ~/.yarn/cache
            node_modules
          key: ${{ inputs.cache-key }}-${{ hashFiles('**/package-lock.json', '**/yarn.lock') }}
          restore-keys: |
            ${{ inputs.cache-key }}-
```

## 성능 최적화 설정

### Jest 최적화 설정
```javascript
// backend-api/jest.config.js
module.exports = {
  // 병렬 실행 최적화
  maxWorkers: process.env.CI ? 2 : '50%',
  
  // 캐시 설정
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // 테스트 파일 감지 최적화
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],
  
  // 빠른 실패 설정
  bail: process.env.CI ? 1 : false,
  
  // 타임아웃 설정
  testTimeout: 10000,
  
  // 리포터 최적화
  reporters: process.env.CI 
    ? [['default', { silent: true }], 'jest-junit']
    : ['default'],
  
  // 커버리지 최적화
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.spec.ts'
  ],
  
  coverageReporters: process.env.CI 
    ? ['text', 'lcov', 'json-summary']
    : ['text', 'html']
};
```

## 검증 방법

1. **로컬 워크플로우 테스트**
   ```bash
   # act을 사용한 로컬 GitHub Actions 테스트
   act -j backend-test
   act -j frontend-test
   ```

2. **PR 생성으로 실제 검증**
   ```bash
   git checkout -b test/ci-pipeline
   git push origin test/ci-pipeline
   # PR 생성하여 워크플로우 실행 확인
   ```

3. **성능 측정**
   ```bash
   # 워크플로우 실행 시간 모니터링
   # 테스트 커버리지 확인
   ```

## 성공 기준

- [ ] 모든 테스트가 CI/CD에서 정상 실행됨
- [ ] 테스트 실행 시간이 10분 이내
- [ ] 테스트 커버리지 리포트가 정상 생성됨
- [ ] PR에 자동으로 테스트 결과가 코멘트됨
- [ ] 캐시 최적화로 의존성 설치 시간 단축

## 리스크 및 대응 방안

### 테스트 실행 시간 초과
- **리스크**: 복잡한 테스트로 인한 시간 초과
- **대응**: 병렬 실행 및 타임아웃 설정 최적화

### 의존성 설치 실패
- **리스크**: Node.js 버전 호환성 문제
- **대응**: 매트릭스 빌드로 다양한 버전 테스트

### 환경 변수 누락
- **리스크**: 테스트 환경 설정 오류
- **대응**: GitHub Secrets 및 환경 변수 체크리스트 작성

## 관련 파일

### 생성/수정할 파일
- `.github/workflows/ci.yml`
- `.github/workflows/pr-comment.yml`
- `.github/workflows/env-setup.yml`
- `backend-api/jest.config.js` (최적화)
- `frontend-web/package.json` (스크립트 수정)
- `backend-api/package.json` (스크립트 수정)

### 환경 설정
- GitHub Repository Secrets
- Codecov 설정
- Branch Protection Rules

## 다음 태스크 연결

이 태스크 완료 후:
- T01, T02, T03에서 구축한 테스트 인프라가 CI/CD에서 실행됨
- T05에서 작성한 핵심 모듈 테스트가 자동화됨
- 지속적 통합 환경에서 코드 품질 관리가 가능해짐