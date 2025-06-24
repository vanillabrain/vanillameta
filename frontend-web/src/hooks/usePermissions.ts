import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { userAtom } from '@/store';

export interface UserPermissions {
  roles: string[];
  permissions: string[];
}

export const usePermissions = () => {
  const user = useRecoilValue(userAtom);
  const [permissions, setPermissions] = useState<UserPermissions>({
    roles: [],
    permissions: [],
  });

  useEffect(() => {
    if (user) {
      // JWT 토큰에서 권한 정보 추출 (실제 구현에 맞게 수정 필요)
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          // JWT 디코딩 (실제로는 jwt-decode 라이브러리 사용 권장)
          const payload = JSON.parse(atob(token.split('.')[1]));
          setPermissions({
            roles: payload.roles || [],
            permissions: payload.permissions || [],
          });
        } catch (error) {
          console.error('Failed to decode token:', error);
        }
      }
    } else {
      setPermissions({ roles: [], permissions: [] });
    }
  }, [user]);

  /**
   * 사용자가 특정 권한을 가지고 있는지 확인
   * @param permission 확인할 권한 (예: 'admin.users.view')
   * @returns 권한 보유 여부
   */
  const hasPermission = (permission: string): boolean => {
    // Super admin은 모든 권한 보유
    if (permissions.roles.includes('super_admin')) {
      return true;
    }

    // 직접 권한 확인
    if (permissions.permissions.includes(permission)) {
      return true;
    }

    // 와일드카드 권한 확인 (예: admin.* 는 admin.users.view 포함)
    const wildcardPermissions = permissions.permissions.filter(p => p.endsWith('*'));
    for (const wildcardPerm of wildcardPermissions) {
      const prefix = wildcardPerm.slice(0, -1); // Remove *
      if (permission.startsWith(prefix)) {
        return true;
      }
    }

    return false;
  };

  /**
   * 사용자가 특정 권한 중 하나라도 가지고 있는지 확인
   * @param permissions 확인할 권한 배열
   * @returns 권한 중 하나라도 보유하고 있으면 true
   */
  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  /**
   * 사용자가 모든 권한을 가지고 있는지 확인
   * @param permissions 확인할 권한 배열
   * @returns 모든 권한을 보유하고 있으면 true
   */
  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  /**
   * 사용자가 특정 역할을 가지고 있는지 확인
   * @param role 확인할 역할 (예: 'admin')
   * @returns 역할 보유 여부
   */
  const hasRole = (role: string): boolean => {
    return permissions.roles.includes(role);
  };

  /**
   * 사용자가 특정 역할 중 하나라도 가지고 있는지 확인
   * @param roles 확인할 역할 배열
   * @returns 역할 중 하나라도 보유하고 있으면 true
   */
  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  /**
   * 권한 기반으로 컴포넌트 표시 여부 결정
   * @param permission 필요한 권한
   * @param children 표시할 컴포넌트
   * @param fallback 권한이 없을 때 표시할 컴포넌트
   */
  const can = (permission: string, children: React.ReactNode, fallback?: React.ReactNode) => {
    return hasPermission(permission) ? children : (fallback || null);
  };

  /**
   * 권한 정보 새로고침
   */
  const refreshPermissions = async () => {
    // API를 통해 최신 권한 정보를 가져오는 로직 구현
    // 예: const response = await api.get('/auth/permissions');
    // setPermissions(response.data);
  };

  return {
    permissions: permissions.permissions,
    roles: permissions.roles,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    can,
    refreshPermissions,
    isAdmin: hasAnyRole(['super_admin', 'admin']),
    isManager: hasAnyRole(['super_admin', 'admin', 'manager']),
    isSuperAdmin: hasRole('super_admin'),
  };
};