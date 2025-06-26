# Next.js 14 Server/Client Component 분류

## Client Components ('use client' 적용)

### 페이지 컴포넌트
모든 페이지 컴포넌트는 기존 React 컴포넌트를 import하므로 Client Component로 분류:

- **Dashboard 페이지들**
  - `app/(protected)/dashboard/page.tsx`
  - `app/(protected)/dashboard/create/page.tsx`
  - `app/(protected)/dashboard/create/[createType]/page.tsx`
  - `app/(protected)/dashboard/[dashboardId]/page.tsx`
  - `app/(protected)/dashboard/modify/[dashboardId]/page.tsx`

- **Widget 페이지들**
  - `app/(protected)/widget/page.tsx`
  - `app/(protected)/widget/create/page.tsx`
  - `app/(protected)/widget/[widgetId]/page.tsx`
  - `app/(protected)/widget/modify/[widgetId]/page.tsx`

- **Data 페이지들**
  - `app/(protected)/data/page.tsx`
  - `app/(protected)/data/source/create/page.tsx`
  - `app/(protected)/data/source/modify/[sourceId]/page.tsx`
  - `app/(protected)/data/set/create/[sourceId]/page.tsx`
  - `app/(protected)/data/set/modify/[setId]/page.tsx`

- **Auth 페이지들**
  - `app/(auth)/login/page.tsx`
  - `app/(auth)/signup/page.tsx`

- **Admin 페이지들**
  - `app/admin/page.tsx`
  - `app/admin/users/page.tsx`
  - `app/admin/users/approval/page.tsx`
  - `app/admin/roles/page.tsx`
  - `app/admin/audit/page.tsx`

- **기타 페이지들**
  - `app/(public)/share/[dashboardUuid]/page.tsx`
  - `app/component-showcase/page.tsx`
  - `app/not-found.tsx`

### 레이아웃 컴포넌트
- `app/admin/layout.tsx` - 이미 'use client' 적용됨
- `app/error.tsx` - 이미 'use client' 적용됨
- `app/providers.tsx` - 이미 'use client' 적용됨

## Server Components

### 레이아웃 컴포넌트
- `app/layout.tsx` - Root Layout (메타데이터 및 전역 설정)
- `app/(protected)/layout.tsx` - 정적 레이아웃
- `app/(auth)/layout.tsx` - 정적 레이아웃
- `app/(public)/layout.tsx` - 정적 레이아웃
- `app/loading.tsx` - 정적 로딩 UI

### API Routes
- `app/api/health/route.ts` - Server-side API
- `app/api/auth/login/route.ts` - Server-side API
- `app/api/auth/logout/route.ts` - Server-side API

## 분류 기준

### Client Component로 분류된 이유:
1. **상태 관리**: React hooks 사용 (useState, useEffect 등)
2. **이벤트 핸들러**: 클릭, 폼 제출 등 브라우저 이벤트 처리
3. **기존 컴포넌트 import**: 기존 React 컴포넌트들이 Client 기능을 사용
4. **React Query**: 데이터 페칭 라이브러리 사용
5. **Context API**: 전역 상태 관리

### Server Component로 유지된 이유:
1. **정적 콘텐츠**: 메타데이터, 레이아웃 등
2. **SEO 최적화**: 서버에서 렌더링되어야 하는 콘텐츠
3. **API 처리**: 서버 사이드에서만 실행되는 코드

## 향후 최적화 방향

1. **정적 데이터 페칭**: 일부 페이지에서 Server Component로 초기 데이터 로드
2. **컴포넌트 분리**: 큰 Client Component를 작은 단위로 분리
3. **서버 액션**: 폼 처리를 Server Actions로 이전
4. **스트리밍**: Suspense를 활용한 점진적 렌더링

이러한 분류를 통해 Next.js 14의 성능 이점을 점진적으로 활용할 수 있습니다.