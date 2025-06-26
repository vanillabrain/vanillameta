import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 보호된 라우트 정의
const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/analytics',
  '/data',
  '/widget',
  '/settings',
  '/profile',
];

// 관리자 전용 라우트
const adminRoutes = [
  '/admin',
];

// 공개 라우트 (인증이 필요하지 않은 페이지)
const publicRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // API 라우트는 건너뛰기
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 정적 파일은 건너뛰기
  if (pathname.startsWith('/_next/') || 
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/images/') ||
      pathname.startsWith('/static/') ||
      pathname.includes('.')) {
    return NextResponse.next();
  }

  // 공유 대시보드는 공개 접근 허용
  if (pathname.startsWith('/share/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  // 공개 라우트는 토큰 체크 없이 통과
  if (isPublicRoute && pathname !== '/') {
    // 이미 로그인한 사용자가 로그인 페이지에 접근하려는 경우 대시보드로 리다이렉트
    if (token && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // 보호된 라우트에 토큰 없이 접근하는 경우
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 토큰이 있는 경우 유효성 검증
  if (token && isProtectedRoute) {
    try {
      // 토큰 유효성 검증을 위해 백엔드 API 호출
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/user/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // 토큰이 유효하지 않은 경우 로그인 페이지로 리다이렉트
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        
        // 쿠키 삭제
        const redirectResponse = NextResponse.redirect(loginUrl);
        redirectResponse.cookies.set('auth-token', '', { maxAge: 0 });
        redirectResponse.cookies.set('refresh-token', '', { maxAge: 0 });
        
        return redirectResponse;
      }

      const userData = await response.json();

      // 관리자 라우트에 대한 권한 체크
      if (isAdminRoute) {
        // 권한 정보 조회 시도 (실패해도 기본 역할로 체크)
        let hasAdminAccess = false;
        
        try {
          const rolesResponse = await fetch(`${backendUrl}/auth/me/roles`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (rolesResponse.ok) {
            const roles = await rolesResponse.json();
            hasAdminAccess = roles.some((role: any) => 
              ['admin', 'super_admin'].includes(role.name)
            );
          }
        } catch (error) {
          // 권한 API 실패 시 사용자 상태로 체크
          hasAdminAccess = userData.status === 'active';
        }

        if (!hasAdminAccess) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      // 사용자 상태 체크
      if (userData.status !== 'active') {
        if (userData.status === 'suspended') {
          return NextResponse.redirect(new URL('/suspended', request.url));
        } else if (userData.status === 'pending') {
          return NextResponse.redirect(new URL('/pending-approval', request.url));
        } else {
          const loginUrl = new URL('/login', request.url);
          const redirectResponse = NextResponse.redirect(loginUrl);
          redirectResponse.cookies.set('auth-token', '', { maxAge: 0 });
          redirectResponse.cookies.set('refresh-token', '', { maxAge: 0 });
          return redirectResponse;
        }
      }

    } catch (error) {
      console.error('Middleware auth check failed:', error);
      // 백엔드 연결 실패 시 로그인 페이지로 리다이렉트
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 홈페이지(/) 접근 시 로그인 여부에 따라 리다이렉트
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

// 미들웨어가 실행될 경로 설정
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};