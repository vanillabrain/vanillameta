import { NextRequest, NextResponse } from 'next/server';

// 사용자 강제 로그아웃 (POST /api/users/[id]/force-logout)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/admin/users/${id}/force-logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else if (response.status === 401) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    } else if (response.status === 403) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    } else if (response.status === 404) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to force logout user' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Force logout API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}