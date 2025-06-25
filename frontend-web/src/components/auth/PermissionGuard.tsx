import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Box, Typography } from '@mui/material';
import { Button } from '@/components/ui/mui-button-compat';
import { Lock } from 'lucide-react';

interface PermissionGuardProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * 권한 기반 접근 제어 컴포넌트
 * 
 * @example
 * // 단일 권한 확인
 * <PermissionGuard permission="admin.users.view">
 *   <UserManagement />
 * </PermissionGuard>
 * 
 * @example
 * // 여러 권한 중 하나라도 있으면 허용
 * <PermissionGuard permissions={["admin.users.view", "admin.users.edit"]}>
 *   <UserForm />
 * </PermissionGuard>
 * 
 * @example
 * // 모든 권한이 있어야 허용
 * <PermissionGuard permissions={["admin.users.view", "admin.users.edit"]} requireAll>
 *   <UserAdvancedSettings />
 * </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  permissions = [],
  requireAll = false,
  children,
  fallback,
  redirectTo,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // 권한 확인
  let hasAccess = false;
  
  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  } else {
    // 권한이 지정되지 않은 경우 접근 허용
    hasAccess = true;
  }

  // 접근 권한이 없는 경우
  if (!hasAccess) {
    // 리다이렉트 경로가 지정된 경우
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // 커스텀 fallback이 제공된 경우
    if (fallback) {
      return <>{fallback}</>;
    }

    // 기본 접근 거부 화면
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          textAlign: 'center',
          p: 4,
        }}
      >
        <Lock size={64} style={{ marginBottom: '24px', color: '#9e9e9e' }} />
        <Typography variant="h5" gutterBottom>
          접근 권한이 없습니다
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          이 페이지에 접근하려면 추가 권한이 필요합니다.
        </Typography>
        <Button variant="contained" onClick={() => window.history.back()}>
          돌아가기
        </Button>
      </Box>
    );
  }

  // 접근 권한이 있는 경우
  return <>{children}</>;
};

/**
 * 역할 기반 접근 제어 컴포넌트
 */
interface RoleGuardProps {
  role?: string;
  roles?: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  role,
  roles = [],
  requireAll = false,
  children,
  fallback,
  redirectTo,
}) => {
  const { hasRole, hasAnyRole, roles: userRoles } = usePermissions();

  let hasAccess = false;
  
  if (role) {
    hasAccess = hasRole(role);
  } else if (roles.length > 0) {
    hasAccess = requireAll 
      ? roles.every(r => hasRole(r))
      : hasAnyRole(roles);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          textAlign: 'center',
          p: 4,
        }}
      >
        <Lock size={64} style={{ marginBottom: '24px', color: '#9e9e9e' }} />
        <Typography variant="h5" gutterBottom>
          접근 권한이 없습니다
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          필요한 역할: {role || roles.join(', ')}
        </Typography>
        <Button variant="contained" onClick={() => window.history.back()}>
          돌아가기
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
};