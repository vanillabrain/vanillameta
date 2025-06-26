'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean; // true: 모든 권한 필요, false: 하나의 권한만 필요 (기본값)
  fallback?: ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

export const PermissionGuard = ({
  children,
  permission,
  permissions = [],
  role,
  roles = [],
  requireAll = false,
  fallback = null,
  adminOnly = false,
  superAdminOnly = false,
}: PermissionGuardProps) => {
  const { user, hasPermission, hasAnyPermission, hasRole, hasAnyRole, isAdmin, isSuperAdmin } = useAuth();

  // 인증되지 않은 사용자
  if (!user.isAuthenticated) {
    return <>{fallback}</>;
  }

  // 슈퍼 관리자 전용 체크
  if (superAdminOnly && !isSuperAdmin()) {
    return <>{fallback}</>;
  }

  // 관리자 전용 체크
  if (adminOnly && !isAdmin()) {
    return <>{fallback}</>;
  }

  // 단일 권한 체크
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // 다중 권한 체크
  if (permissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? permissions.every(p => hasPermission(p))
      : hasAnyPermission(permissions);

    if (!hasRequiredPermissions) {
      return <>{fallback}</>;
    }
  }

  // 단일 역할 체크
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  // 다중 역할 체크
  if (roles.length > 0) {
    const hasRequiredRoles = requireAll
      ? roles.every(r => hasRole(r))
      : hasAnyRole(roles);

    if (!hasRequiredRoles) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

// 편의 컴포넌트들
export const AdminOnly = ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
  <PermissionGuard adminOnly fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const SuperAdminOnly = ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
  <PermissionGuard superAdminOnly fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const RoleGuard = ({ 
  children, 
  roles, 
  requireAll = false, 
  fallback 
}: { 
  children: ReactNode; 
  roles: string[]; 
  requireAll?: boolean; 
  fallback?: ReactNode;
}) => (
  <PermissionGuard roles={roles} requireAll={requireAll} fallback={fallback}>
    {children}
  </PermissionGuard>
);