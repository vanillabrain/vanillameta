# T01_S12: TypeScript 설정 강화

## 태스크 정보
- **스프린트**: S12 - TypeScript 강화 및 코드 품질
- **태스크 ID**: T01_S12
- **우선순위**: 긴급
- **예상 소요시간**: 1-2일
- **담당자**: 백엔드/프론트엔드 개발팀

## 목표
TypeScript 컴파일러 설정을 강화하여 타입 안전성을 향상시키고, ESLint 규칙을 통해 코드 품질을 보장합니다.

## 작업 내용

### 1. tsconfig.json strict 옵션 단계적 활성화

#### 1.1 백엔드 tsconfig.json 업데이트
**파일**: `/workspace/vanillameta/backend-api/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### 1.2 프론트엔드 tsconfig.json 업데이트
**파일**: `/workspace/vanillameta/frontend-web/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 2. ESLint TypeScript 규칙 강화

#### 2.1 백엔드 ESLint 설정 업데이트
**파일**: `/workspace/vanillameta/backend-api/.eslintrc.js`

추가할 규칙들:
```javascript
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

#### 2.2 프론트엔드 ESLint 설정 업데이트
**파일**: `/workspace/vanillameta/frontend-web/.eslintrc.js`

동일한 TypeScript 규칙 적용 + React 관련 규칙 추가

### 3. 점진적 적용 전략

#### 3.1 단계적 strict 모드 활성화
1. **1단계**: `noImplicitAny` 활성화 및 수정
2. **2단계**: `strictNullChecks` 활성화 및 수정  
3. **3단계**: 나머지 strict 옵션들 활성화
4. **4단계**: 전체 strict 모드 활성화

#### 3.2 파일별 우선순위
1. **높은 우선순위**: 새로 작성되는 파일들
2. **중간 우선순위**: 핵심 비즈니스 로직 파일들
3. **낮은 우선순위**: 레거시 유틸리티 파일들

### 4. 컴파일 에러 해결 가이드

#### 4.1 자주 발생하는 에러 유형별 해결법

**any 타입 사용**
```typescript
// Before
function processData(data: any) { ... }

// After  
function processData(data: ProcessDataInput) { ... }
```

**null/undefined 체크**
```typescript
// Before
if (user.name) { ... }

// After
if (user?.name) { ... }
// 또는
if (user.name != null) { ... }
```

**타입 단언 제거**
```typescript
// Before
const element = document.getElementById('btn') as HTMLButtonElement;

// After
const element = document.getElementById('btn');
if (element instanceof HTMLButtonElement) { ... }
```

### 5. 자동화 도구 설정

#### 5.1 VS Code 설정
**파일**: `.vscode/settings.json`
```json
{
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.preferences.strictNullChecks": true,
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

#### 5.2 Pre-commit 훅 설정  
**파일**: `.husky/pre-commit`
```bash
#!/bin/sh
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```

## 검증 기준

### 성공 조건
- [ ] 백엔드/프론트엔드 모든 TypeScript 컴파일 에러 해결
- [ ] ESLint 에러 0개 달성
- [ ] CI/CD 파이프라인에서 타입 체크 통과
- [ ] 개발팀 전체가 새로운 설정에 적응

### 품질 메트릭
- **타입 안전성**: `any` 사용률 < 5%
- **코드 품질**: ESLint 에러 0개 유지
- **개발 경험**: 컴파일 시간 증가 < 20%

## 구현 순서

1. **환경 설정** (4시간)
   - tsconfig.json 업데이트
   - ESLint 규칙 설정
   - 개발 도구 설정

2. **컴파일 에러 수정** (1일)
   - 백엔드 타입 에러 수정
   - 프론트엔드 타입 에러 수정

3. **ESLint 에러 수정** (4시간)
   - 백엔드 린트 에러 수정
   - 프론트엔드 린트 에러 수정

4. **검증 및 테스트** (4시간)
   - 빌드 프로세스 검증
   - 자동화 도구 테스트

## 주의사항

- **점진적 적용**: 한 번에 모든 strict 옵션을 활성화하지 말고 단계적으로 적용
- **팀 소통**: 설정 변경사항을 팀원들에게 미리 공지
- **백업**: 기존 설정 파일들을 백업 후 작업 진행
- **테스트**: 설정 변경 후 반드시 전체 테스트 실행

## 연관 태스크
- **T02**: 백엔드 타입 정의 개선 (의존성: T01 완료 후 진행)
- **T03**: 프론트엔드 타입 정의 개선 (의존성: T01 완료 후 진행)
- **T05**: 타입 안전성 테스트 (의존성: T01 설정 활용)