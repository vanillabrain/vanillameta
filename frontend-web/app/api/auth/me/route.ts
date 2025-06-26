import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 인증 토큰 확인
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    try {
      // 사용자 기본 정보 조회
      const userResponse = await fetch(`${backendUrl}/user/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        // 토큰이 만료된 경우 리프레시 시도
        const refreshToken = request.cookies.get('refresh-token')?.value;
        if (refreshToken) {
          const refreshResponse = await fetch(`${backendUrl}/user/get-access-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            
            // 새 토큰으로 다시 사용자 정보 조회
            const retryUserResponse = await fetch(`${backendUrl}/user/userinfo`, {
              headers: {
                'Authorization': `Bearer ${refreshData.accessToken}`,
                'Content-Type': 'application/json',
              },
            });

            if (retryUserResponse.ok) {
              const userData = await retryUserResponse.json();
              
              // 권한 정보 조회
              const [permissionsResponse, rolesResponse] = await Promise.allSettled([
                fetch(`${backendUrl}/auth/me/permissions`, {
                  headers: {
                    'Authorization': `Bearer ${refreshData.accessToken}`,
                    'Content-Type': 'application/json',
                  },
                }),
                fetch(`${backendUrl}/auth/me/roles`, {
                  headers: {
                    'Authorization': `Bearer ${refreshData.accessToken}`,
                    'Content-Type': 'application/json',
                  },
                })
              ]);

              const permissions = permissionsResponse.status === 'fulfilled' && permissionsResponse.value.ok ?
                await permissionsResponse.value.json() : [];
              const roles = rolesResponse.status === 'fulfilled' && rolesResponse.value.ok ?
                await rolesResponse.value.json() : [];

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

              // 새 토큰을 쿠키에 설정
              const result = NextResponse.json(enhancedUserData);
              result.cookies.set('auth-token', refreshData.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 21600, // 6시간
              });

              return result;
            }
          }
        }

        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }

      const userData = await userResponse.json();
      
      // 권한 정보 조회
      const [permissionsResponse, rolesResponse] = await Promise.allSettled([
        fetch(`${backendUrl}/auth/me/permissions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${backendUrl}/auth/me/roles`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      const permissions = permissionsResponse.status === 'fulfilled' && permissionsResponse.value.ok ?
        await permissionsResponse.value.json() : [];
      const roles = rolesResponse.status === 'fulfilled' && rolesResponse.value.ok ?
        await rolesResponse.value.json() : [];

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

      return NextResponse.json(enhancedUserData);
      
    } catch (fetchError) {
      console.error('Backend API error:', fetchError);
      return NextResponse.json(
        { error: 'Backend service unavailable' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Auth me API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}