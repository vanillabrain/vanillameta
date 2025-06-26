import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    // 백엔드 로그아웃 API 호출 (토큰이 있는 경우)
    if (token) {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      try {
        await fetch(`${backendUrl}/login/signout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        // 백엔드 로그아웃 실패해도 프론트엔드에서는 쿠키 삭제 진행
      } catch (error) {
        console.error('Backend logout failed:', error);
      }
    }

    // 모든 인증 관련 쿠키 삭제
    const response = NextResponse.json({ success: true });
    
    // auth-token 쿠키 삭제
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
    });
    
    // refresh-token 쿠키 삭제
    response.cookies.set('refresh-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
    });
    
    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}