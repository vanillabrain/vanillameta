import { NextRequest, NextResponse } from 'next/server';

// 역할 목록 조회 (GET /api/roles)
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
    const includePermissions = searchParams.get('includePermissions') === 'true';
    const isActive = searchParams.get('isActive');

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const queryParams = new URLSearchParams();
    if (includePermissions) {
      queryParams.append('includePermissions', 'true');
    }
    if (isActive) {
      queryParams.append('isActive', isActive);
    }

    const response = await fetch(`${backendUrl}/admin/roles?${queryParams}`, {
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
        { error: errorData.message || 'Failed to fetch roles' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Roles API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 역할 생성 (POST /api/roles)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const roleData = await request.json();
    
    // 필수 필드 검증
    const { name, displayName } = roleData;
    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/admin/roles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        displayName,
        description: roleData.description || '',
        level: roleData.level || 1,
        isActive: roleData.isActive !== false,
        isDefault: roleData.isDefault || false,
        permissions: roleData.permissions || [],
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
        { error: 'Role with this name already exists' },
        { status: 409 }
      );
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to create role' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Create role API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}