import { NextRequest, NextResponse } from 'next/server';

// 사용자 목록 조회 (GET /api/users)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // URL 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const role = searchParams.get('role') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // 쿼리 스트링 구성
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...(search && { search }),
      ...(status && { status }),
      ...(role && { role }),
      sortBy,
      sortOrder,
    });

    const response = await fetch(`${backendUrl}/admin/users?${queryParams}`, {
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
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 사용자 생성 (POST /api/users)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userData = await request.json();
    
    // 필수 필드 검증
    const { email, password, name, roles } = userData;
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
        userId: email, // 백엔드에서 userId를 email로 사용
        roles: roles || [],
        status: userData.status || 'active',
        phone: userData.phone || '',
        department: userData.department || '',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: 201 });
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
    } else if (response.status === 409) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to create user' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Create user API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}