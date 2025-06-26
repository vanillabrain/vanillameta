# Next.js 14 마이그레이션 계획

## 현재 상태 분석

### 기존 아키텍처
- **빌드 도구**: Vite 6.3.5 (CRA에서 이미 마이그레이션 완료)
- **라우팅**: React Router v6
- **상태 관리**: Context API (Auth, Layout, Loading, Alert, Performance, Chart, Error)
- **데이터 페칭**: React Query v5
- **UI 라이브러리**: MUI v5 + shadcn/ui (마이그레이션 진행중)
- **스타일링**: Tailwind CSS v3
- **배포**: AWS S3 + CloudFront (Serverless Framework)

### Next.js 마이그레이션 이유
1. **SSR/SSG 필요성**: SEO 개선 및 초기 로딩 속도 향상
2. **API Routes**: BFF 패턴 구현 가능
3. **이미지 최적화**: Next/Image 컴포넌트 활용
4. **메타데이터 관리**: 동적 메타 태그 지원

## 마이그레이션 전략

### 1단계: 기본 설정 (완료)
- [x] Next.js 14 설치
- [x] 기본 app 디렉토리 구조 생성
- [x] next.config.js 설정
- [x] 환경 변수 설정 (.env.local)
- [x] TypeScript 설정 업데이트
- [x] 미들웨어 설정

### 2단계: 라우트 구조 마이그레이션
- [ ] React Router → App Router 매핑 테이블 작성 (완료)
- [ ] 레이아웃 컴포넌트 마이그레이션
  - [ ] RootLayout (app/layout.tsx)
  - [ ] ProtectedLayout (app/(protected)/layout.tsx)
  - [ ] AuthLayout (app/(auth)/layout.tsx)
  - [ ] AdminLayout (app/admin/layout.tsx)
  - [ ] PublicLayout (app/(public)/layout.tsx)

### 3단계: 페이지별 마이그레이션 (우선순위)
1. **인증 페이지** (공개 라우트)
   - [ ] 로그인 페이지
   - [ ] 회원가입 페이지
   
2. **대시보드** (핵심 기능)
   - [ ] 대시보드 목록
   - [ ] 대시보드 상세
   - [ ] 대시보드 생성/수정

3. **데이터 관리**
   - [ ] 데이터 소스 관리
   - [ ] 데이터셋 관리

4. **관리자 페이지**
   - [ ] 사용자 관리
   - [ ] 역할 관리
   - [ ] 감사 로그

### 4단계: 상태 관리 및 데이터 페칭
- [ ] Context Providers를 Client Component로 분리
- [ ] Server Components에서 데이터 페칭 로직 구현
- [ ] React Query와 Server Components 통합

### 5단계: API Routes 구현
- [ ] 기존 백엔드 API 프록시
- [ ] 인증 관련 API Routes
- [ ] 파일 업로드/다운로드 처리

### 6단계: 최적화
- [ ] 이미지 컴포넌트를 Next/Image로 교체
- [ ] 폰트 최적화 (next/font 활용)
- [ ] 번들 사이즈 최적화
- [ ] 정적 생성 가능한 페이지 식별

### 7단계: 배포 설정
- [ ] Vercel 배포 설정
- [ ] 또는 Docker 컨테이너화 + AWS ECS
- [ ] CI/CD 파이프라인 업데이트

## 주의사항

1. **점진적 마이그레이션**: Vite와 Next.js를 병행 운영하며 단계적 전환
2. **타입 안정성**: TypeScript 타입 체크 유지
3. **테스트**: 각 페이지 마이그레이션 후 E2E 테스트 수행
4. **성능 모니터링**: Web Vitals 지표 추적

## 다음 작업

1. 레이아웃 컴포넌트 마이그레이션 시작
2. 인증 관련 Context를 Client Component로 분리
3. 로그인/회원가입 페이지 구현