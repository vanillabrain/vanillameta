# T010: ESLint 및 코드 품질 개선

## 🎯 목표
프론트엔드 코드베이스의 ESLint 에러 및 경고를 해결하여 코드 품질을 개선합니다.

## 📋 작업 내용

### 1. ESLint 설정 개선
- [x] package.json에 lint 스크립트 추가
  - `lint`: 자동 수정 포함
  - `lint:check`: 체크만 수행
- [ ] ESLint 설정 최적화
- [ ] Prettier 설정 통합 개선

### 2. 코드 품질 이슈 해결
- [ ] Prettier 포맷팅 에러 수정 (대부분의 에러)
- [ ] TypeScript 경고 해결
  - 사용하지 않는 변수/임포트 제거
  - 중복 임포트 정리
- [ ] import 관련 경고 해결

### 3. 점진적 개선 계획
- [ ] TypeScript strict 모드 활성화 준비
- [ ] ESLint 규칙 강화
- [ ] 커밋 전 자동 검사 설정 (husky + lint-staged)

## 📊 현재 상태

### 초기 분석 결과
- 총 파일 수: 많은 파일에서 에러 발생
- 주요 에러 타입:
  1. **Prettier 포맷팅**: 90% 이상 (공백, 줄바꿈 등)
  2. **TypeScript 경고**: 사용하지 않는 변수, 중복 임포트
  3. **Import 관련**: 중복 임포트, 사용하지 않는 export

### 주요 영향 파일
- `/src/App.tsx`
- `/src/api/*.ts`
- `/src/components/*.tsx`
- 테스트 파일들 (`*.test.tsx`)

## 🔧 해결 전략

### Phase 1: 자동 수정 가능한 이슈 (즉시)
1. Prettier 포맷팅 자동 수정
2. 사용하지 않는 import 제거
3. 중복 import 정리

### Phase 2: 수동 검토 필요 (단기)
1. 사용하지 않는 변수 검토 및 제거
2. TypeScript any 타입 개선
3. 컴포넌트 구조 개선

### Phase 3: 장기 개선
1. TypeScript strict 모드 점진적 활성화
2. ESLint 규칙 강화
3. 테스트 커버리지 개선

## 🚀 실행 계획

### Step 1: Prettier 자동 수정
```bash
yarn lint
```

### Step 2: 남은 경고 수동 해결
- 사용하지 않는 변수/함수 제거
- 중복 import 정리
- 필요한 타입 정의 추가

### Step 3: CI/CD 통합
- GitHub Actions에 lint 체크 추가
- PR 머지 전 필수 체크

## 📈 진행 상황
- [x] 초기 분석 완료
- [x] lint 스크립트 추가
- [x] Prettier 포맷팅 수정 (자동 수정 완료)
- [x] 주요 ESLint 에러 해결
  - react-hooks/exhaustive-deps 규칙 참조 에러 수정
  - no-plusplus 위반 수정 (++ 연산자 → += 1)
  - @ts-ignore → @ts-expect-error로 변경
  - 빈 함수에 주석 추가
- [x] TypeScript 경고 해결 (부분 완료 - 48개로 감소)
- [ ] CI/CD 통합

## 🏆 성과
- ESLint 에러: 8개 → 0개 (100% 해결!) ✅
- TypeScript 경고: 77개 → 48개 (37.7% 감소)
- Prettier 포맷팅: 모든 파일 자동 수정 완료
- 총 문제: 77개 → 48개 (37.7% 감소)

## 🎯 성공 기준
- [x] `yarn lint:check` 실행 시 에러 0개 ✅
- [ ] 경고 50% 이상 감소 (현재 37.7% - 진행중)
- [ ] 모든 테스트 통과
- [ ] CI/CD 파이프라인 통합

## 📝 참고사항
- 기능 변경 없이 코드 품질만 개선
- 점진적 개선 접근 (한 번에 모든 것을 고치려 하지 않음)
- 팀 컨벤션 준수