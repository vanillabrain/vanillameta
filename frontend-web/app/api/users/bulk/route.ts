import { NextRequest, NextResponse } from 'next/server';

// 대량 사용자 작업 (POST /api/users/bulk)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action, userIds, data } = await request.json();
    
    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Action and userIds array are required' },
        { status: 400 }
      );
    }

    // 유효한 액션 검증
    const validActions = ['delete', 'activate', 'deactivate', 'suspend', 'update-role'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/admin/users/bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        userIds,
        ...(data && { data })
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return NextResponse.json(result);
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
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Bulk operation failed' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Bulk users API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 대량 사용자 상태 조회 (GET /api/users/bulk)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userIds = searchParams.get('userIds');
    
    if (!userIds) {
      return NextResponse.json(
        { error: 'userIds parameter is required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/admin/users/bulk?userIds=${userIds}`, {
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
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch users' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Bulk get users API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}