import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 백엔드 로그인 API 호출 (userId 기반 로그인으로 변환)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/login/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        userId: email, // 백엔드는 userId 필드를 사용
        password 
      }),
    });

    if (response.ok) {
      const loginData = await response.json();
      
      // 사용자 상세 정보 조회 (권한 정보 포함)
      const userResponse = await fetch(`${backendUrl}/user/userinfo`, {
        headers: {
          'Authorization': `Bearer ${loginData.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        
        // 권한 정보 조회
        const permissionsResponse = await fetch(`${backendUrl}/auth/me/permissions`, {
          headers: {
            'Authorization': `Bearer ${loginData.accessToken}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => ({ ok: false })); // 권한 API가 없을 경우 에러 방지

        const rolesResponse = await fetch(`${backendUrl}/auth/me/roles`, {
          headers: {
            'Authorization': `Bearer ${loginData.accessToken}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => ({ ok: false })); // 역할 API가 없을 경우 에러 방지

        const permissions = permissionsResponse.ok ? 
          await permissionsResponse.json() : [];
        const roles = rolesResponse.ok ? 
          await rolesResponse.json() : [];

        // 통합된 사용자 정보 구성
        const enhancedUserData = {
          id: userData.id,
          userId: userData.userId,
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          status: userData.status,
          roles: roles,
          permissions: permissions,
          lastLoginAt: userData.lastLoginAt,
        };

        const result = NextResponse.json(enhancedUserData);
        
        // 토큰을 httpOnly 쿠키로 설정
        result.cookies.set('auth-token', loginData.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 21600, // 6시간 (백엔드 액세스 토큰 만료시간과 동일)
        });

        // 리프레시 토큰 설정
        if (loginData.refreshToken) {
          result.cookies.set('refresh-token', loginData.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 43200, // 12시간 (백엔드 리프레시 토큰 만료시간과 동일)
          });
        }

        return result;
      } else {
        return NextResponse.json(
          { error: 'Failed to fetch user data' },
          { status: 500 }
        );
      }
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Login failed' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}