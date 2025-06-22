# T01_S08: Admin 대시보드 UI 구축

## 태스크 개요
- **태스크 ID**: T01_S08
- **태스크 명**: Admin 대시보드 UI 구축
- **스프린트**: S08 - Admin 핵심 기능 (Phase 1)
- **예상 소요**: 3일
- **우선순위**: 높음

## 목표
관리자 전용 UI 및 레이아웃을 구축하여 시스템 관리자가 효율적으로 시스템을 관리할 수 있는 기반을 마련합니다.

## 상세 요구사항

### 1. Admin 전용 레이아웃 설계
- `/admin/*` 경로 전용 레이아웃 컴포넌트
- 일반 사용자 UI와 구별되는 디자인
- 관리자 권한이 없는 사용자 접근 차단

### 2. 네비게이션 메뉴 구성
```typescript
interface AdminMenuStructure {
  dashboard: '대시보드';
  users: {
    management: '사용자 관리';
    approval: '사용자 승인';
  };
  roles: '역할 관리';
  audit: '감사 로그';
  settings: '시스템 설정';
}
```

### 3. 대시보드 홈 화면 (통계 위젯)
- 전체 사용자 수
- 대기 중인 승인 요청 수
- 금일 로그인 수
- 활성 세션 수
- 최근 감사 로그 요약

### 4. 권한에 따른 메뉴 표시/숨김
- 역할별 메뉴 접근 권한 제어
- 동적 메뉴 렌더링

## 기술적 구현 가이드

### Frontend 구현 (React)

#### 1. Admin Layout 컴포넌트
```typescript
// src/components/admin/AdminLayout.tsx
interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  if (!hasPermission('admin.access')) {
    return <AccessDenied />;
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <AdminHeader />
        <main>{children}</main>
      </div>
    </div>
  );
};
```

#### 2. Admin 라우팅 설정
```typescript
// src/routes/AdminRoutes.tsx
export const AdminRoutes = () => (
  <Routes>
    <Route
      path="/admin/*"
      element={
        <ProtectedRoute requiredPermission="admin.access">
          <AdminLayout>
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="users/approval" element={<UserApproval />} />
              <Route path="roles" element={<RoleManagement />} />
              <Route path="audit" element={<AuditLogs />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      }
    />
  </Routes>
);
```

#### 3. Dashboard 위젯 컴포넌트
```typescript
// src/components/admin/dashboard/StatsWidget.tsx
interface StatsWidgetProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
}

export const StatsWidget: React.FC<StatsWidgetProps> = ({
  title,
  value,
  icon,
  change,
}) => (
  <div className="stats-widget">
    <div className="widget-header">
      <span className="widget-icon">{icon}</span>
      <h3>{title}</h3>
    </div>
    <div className="widget-value">{value}</div>
    {change && (
      <div className={`widget-change ${change.trend}`}>
        {change.trend === 'up' ? '↑' : '↓'} {change.value}%
      </div>
    )}
  </div>
);
```

#### 4. 권한 기반 네비게이션
```typescript
// src/components/admin/AdminSidebar.tsx
interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  permission: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    label: '대시보드',
    icon: <DashboardIcon />,
    path: '/admin',
    permission: 'admin.dashboard.view',
  },
  {
    key: 'users',
    label: '사용자 관리',
    icon: <UsersIcon />,
    path: '/admin/users',
    permission: 'admin.users.view',
    children: [
      {
        key: 'users-list',
        label: '사용자 목록',
        path: '/admin/users',
        permission: 'admin.users.view',
      },
      {
        key: 'users-approval',
        label: '승인 대기',
        path: '/admin/users/approval',
        permission: 'admin.users.approve',
      },
    ],
  },
  // ... 기타 메뉴 항목
];
```

### Backend API 구현 (NestJS)

#### 1. Admin 통계 API
```typescript
// src/modules/admin/admin.controller.ts
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @RequirePermissions('admin.dashboard.view')
  async getDashboardStats(): Promise<DashboardStatsDto> {
    return this.adminService.getDashboardStats();
  }
}

// src/modules/admin/dto/dashboard-stats.dto.ts
export class DashboardStatsDto {
  totalUsers: number;
  pendingApprovals: number;
  todayLogins: number;
  activeSessions: number;
  recentLogs: AuditLogSummaryDto[];
}
```

#### 2. Admin Service 구현
```typescript
// src/modules/admin/admin.service.ts
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const [
      totalUsers,
      pendingApprovals,
      todayLogins,
      activeSessions,
      recentLogs,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: UserStatus.PENDING } }),
      this.getTodayLoginCount(),
      this.getActiveSessionCount(),
      this.getRecentAuditLogs(),
    ]);

    return {
      totalUsers,
      pendingApprovals,
      todayLogins,
      activeSessions,
      recentLogs,
    };
  }

  private async getTodayLoginCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.auditLogRepository.count({
      where: {
        action: 'USER_LOGIN',
        createdAt: MoreThanOrEqual(today),
      },
    });
  }

  // ... 기타 헬퍼 메서드
}
```

## 파일 구조
```
frontend-web/src/
├── components/admin/
│   ├── AdminLayout.tsx
│   ├── AdminSidebar.tsx
│   ├── AdminHeader.tsx
│   └── dashboard/
│       ├── AdminDashboard.tsx
│       ├── StatsWidget.tsx
│       └── RecentActivity.tsx
├── routes/
│   └── AdminRoutes.tsx
├── hooks/
│   └── usePermissions.ts
└── styles/
    └── admin.scss

backend-api/src/modules/admin/
├── admin.controller.ts
├── admin.service.ts
├── admin.module.ts
└── dto/
    ├── dashboard-stats.dto.ts
    └── audit-log-summary.dto.ts
```

## 테스트 케이스

### Frontend 테스트
1. 관리자 권한이 없는 사용자 접근 차단
2. 권한별 메뉴 표시/숨김 동작
3. 대시보드 통계 데이터 표시
4. 반응형 레이아웃 동작

### Backend 테스트
1. 대시보드 통계 API 정확성
2. 권한 검증 미들웨어 동작
3. 통계 데이터 캐싱 동작
4. API 응답 시간 성능

## 완료 기준
- [ ] Admin 전용 레이아웃 구현 완료
- [ ] 권한 기반 네비게이션 동작
- [ ] 대시보드 통계 위젯 표시
- [ ] 권한 없는 사용자 접근 차단
- [ ] 반응형 디자인 적용
- [ ] Unit 테스트 커버리지 80% 이상

## 의존성
- 인증 시스템 (JWT)
- 권한 관리 시스템 (RBAC)
- UI 컴포넌트 라이브러리

## 위험 요소 및 대응방안
- **위험**: 기존 라우팅과의 충돌
  - **대응**: `/admin` 경로 네임스페이스 분리
- **위험**: 권한 체크 성능 저하
  - **대응**: 권한 캐싱 및 메모이제이션 적용

## 참고 자료
- 기존 UI/UX 가이드라인
- 관리자 페이지 디자인 시안
- 권한 관리 시스템 문서