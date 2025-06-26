import { NextRequest, NextResponse } from 'next/server';

// 비밀번호 재설정 확인 (POST /api/users/password-reset/confirm)
export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();
    
    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    // 비밀번호 강도 검증
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        token, 
        newPassword 
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else if (response.status === 400) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    } else if (response.status === 404) {
      return NextResponse.json(
        { error: 'Reset token not found or expired' },
        { status: 404 }
      );
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to reset password' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Password reset confirm API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}