# Next.js 14 상태 관리 시스템 마이그레이션

## 마이그레이션 완료된 Context들

### 1. AuthContext (`app/contexts/AuthContext.tsx`)
**변경사항:**
- TypeScript 타입 정의 추가
- Next.js Router (`useRouter`) 사용
- API Routes를 통한 인증 처리
- 토큰 기반 인증에서 쿠키 기반 인증으로 전환

**새로운 기능:**
- `login()`: 로그인 처리 및 자동 리다이렉트
- `logout()`: 로그아웃 처리 및 쿠키 삭제
- `getUserInfo()`: 사용자 정보 조회
- `isLoading`: 로딩 상태 관리

### 2. LayoutContext (`app/contexts/LayoutContext.tsx`)
**변경사항:**
- TypeScript 인터페이스 정의
- 'use client' 지시문 추가
- React 18 호환성 개선

**기능:**
- `fixed`: 레이아웃 고정 상태
- `fixLayout()`: 레이아웃 고정 토글
- `footerBg`: 푸터 배경색 관리
- `changeFooterBg()`: 푸터 배경색 변경

### 3. LoadingContext (`app/contexts/LoadingContext.tsx`)
**변경사항:**
- shadcn/ui Spinner 컴포넌트 사용
- Tailwind CSS 기반 스타일링
- 전역 로딩 오버레이 구현

**기능:**
- `loading`: 로딩 상태
- `showLoading()`: 로딩 표시
- `hideLoading()`: 로딩 숨김

### 4. AlertContext (`app/contexts/AlertContext.tsx`)
**변경사항:**
- react-alert에서 자체 구현으로 전환
- shadcn/ui Alert 컴포넌트 사용
- Toast 스타일의 알림 시스템

**새로운 기능:**
- `success()`: 성공 알림
- `error()`: 오류 알림
- `warning()`: 경고 알림
- `info()`: 정보 알림
- 자동 제거 (5초 후)

## Provider 계층 구조

```tsx
// app/providers.tsx
<QueryClientProvider>
  <AuthProvider>
    <AlertProvider>
      <LoadingProvider>
        <LayoutProvider>
          {children}
        </LayoutProvider>
      </LoadingProvider>
    </AlertProvider>
  </AuthProvider>
</QueryClientProvider>
```

## 새로운 API Routes

### 인증 관련 API
- `POST /api/auth/login` - 로그인 처리
- `POST /api/auth/logout` - 로그아웃 처리
- `GET /api/auth/me` - 현재 사용자 정보 조회

### 기타 API
- `GET /api/health` - 헬스체크

## 사용법 변경사항

### AuthContext 사용법
```tsx
// 기존 방식
const { userState, getUserState } = useAuthContext();

// 새로운 방식
const { user, login, logout, getUserInfo, isLoading } = useAuth();

// 로그인
await login(email, password);

// 로그아웃
await logout();
```

### AlertContext 사용법
```tsx
// 새로운 방식
const { success, error, warning, info } = useAlert();

// 알림 표시
success('저장되었습니다');
error('오류가 발생했습니다');
warning('주의가 필요합니다');
info('정보를 확인하세요');
```

## 마이그레이션되지 않은 Context들

아직 마이그레이션이 필요한 Context들:
1. `ChartContext` - 차트 관련 상태 관리
2. `ErrorContext` - 전역 에러 처리
3. `PerformanceContext` - 성능 모니터링

이들은 추후 필요에 따라 마이그레이션할 예정입니다.

## 호환성 유지

기존 코드와의 호환성을 위해:
- 기존 Context export 유지 (`export { AuthContext }`)
- 기존 hook 이름 유지 (`useAuthContext`)
- 점진적 마이그레이션 지원

## Next.js 14 최적화 사항

1. **Client Component 최적화**: 모든 Context는 'use client' 지시문 사용
2. **TypeScript 강화**: 엄격한 타입 정의로 런타임 오류 방지
3. **성능 최적화**: `useCallback`, `useMemo` 활용
4. **메모리 관리**: 적절한 cleanup 로직 구현

이 마이그레이션을 통해 Next.js 14의 성능 이점을 활용하면서 기존 기능을 완전히 보존했습니다.