# CRACO에서 Vite로 마이그레이션 가이드

## 개요
이 프로젝트는 Create React App(CRACO)에서 Vite로 마이그레이션되었습니다.

## 주요 변경사항

### 1. 빌드 도구
- **이전**: CRACO (Create React App Configuration Override)
- **현재**: Vite 4.4.0

### 2. 스크립트 명령어
```bash
# 개발 서버 실행
npm run dev          # 또는 npm start
npm run start:local  # 로컬 환경
npm run start:dev    # 개발 환경

# 빌드
npm run build        # 프로덕션 빌드
npm run build:dev    # 개발 빌드

# 미리보기
npm run preview      # 빌드된 결과물 미리보기
```

### 3. 환경 변수
- **이전**: `REACT_APP_` 접두사 사용
- **현재**: `VITE_` 접두사 사용

```env
# .env.local 예시
VITE_API_URL=http://localhost:4000
VITE_MODE=local
```

코드에서 사용:
```typescript
// 이전
process.env.REACT_APP_API_URL

// 현재
import.meta.env.VITE_API_URL

// 호환성을 위한 헬퍼 함수 제공
import { getApiUrl, getAppMode } from '@/helpers/envHelper';
```

### 4. 프로젝트 구조
- `index.html`이 public 폴더에서 프로젝트 루트로 이동
- `vite.config.ts` 파일 추가
- `tsconfig.node.json` 파일 추가

### 5. 성능 개선
- 더 빠른 개발 서버 시작 시간
- HMR(Hot Module Replacement) 성능 향상
- 더 작은 번들 크기
- ESM 기반 개발 환경

### 6. 주의사항

#### TypeScript 설정
- `moduleResolution`이 `bundler`로 변경됨
- `target`이 `ES2020`으로 업그레이드됨

#### 정적 자산
- public 폴더의 자산들은 `/`로 직접 접근
- `%PUBLIC_URL%`을 `/`로 변경

#### 코드 분할
- 동적 import는 Vite에서 자동으로 코드 분할됨
- `webpackChunkName` 주석은 무시됨 (Vite는 자동으로 청크 이름 생성)

## 문제 해결

### 1. 모듈을 찾을 수 없음
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 2. 환경 변수가 작동하지 않음
- `.env` 파일의 변수가 `VITE_` 접두사로 시작하는지 확인
- 개발 서버를 재시작

### 3. 빌드 오류
```bash
# TypeScript 오류 확인
npm run build
```

## 추가 최적화 옵션

### 1. 번들 분석
```bash
npm run analyze
```

### 2. 레거시 브라우저 지원
필요한 경우 `@vitejs/plugin-legacy` 플러그인 추가 가능

## 참고 자료
- [Vite 공식 문서](https://vitejs.dev/)
- [Vite 마이그레이션 가이드](https://vitejs.dev/guide/migration.html)