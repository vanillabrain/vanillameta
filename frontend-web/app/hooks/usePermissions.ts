'use client';

import { useAuth } from '@/app/contexts/AuthContext';

export const usePermissions = () => {
  const { 
    user, 
    hasPermission, 
    hasAnyPermission, 
    hasRole, 
    hasAnyRole, 
    isAdmin, 
    isSuperAdmin 
  } = useAuth();

  // 권한 체크 헬퍼 함수들
  const can = (permission: string): boolean => {
    return hasPermission(permission);
  };

  const canAny = (permissions: string[]): boolean => {
    return hasAnyPermission(permissions);
  };

  const canAll = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  // 모듈별 권한 체크
  const canManageUsers = (): boolean => {
    return hasAnyPermission(['admin.users.manage', 'admin.users.*', 'admin.*']);
  };

  const canCreateUsers = (): boolean => {
    return hasAnyPermission(['admin.users.create', 'admin.users.manage', 'admin.users.*', 'admin.*']);
  };

  const canEditUsers = (): boolean => {
    return hasAnyPermission(['admin.users.update', 'admin.users.manage', 'admin.users.*', 'admin.*']);
  };

  const canDeleteUsers = (): boolean => {
    return hasAnyPermission(['admin.users.delete', 'admin.users.manage', 'admin.users.*', 'admin.*']);
  };

  const canViewUsers = (): boolean => {
    return hasAnyPermission(['admin.users.read', 'admin.users.view', 'admin.users.*', 'admin.*']);
  };

  const canManageRoles = (): boolean => {
    return hasAnyPermission(['admin.roles.manage', 'admin.roles.*', 'admin.*']);
  };

  const canViewDashboard = (): boolean => {
    return hasAnyPermission(['dashboard.view', 'dashboard.*']);
  };

  const canViewAnalytics = (): boolean => {
    return hasAnyPermission(['analytics.view', 'analytics.*']);
  };

  const canManageSystem = (): boolean => {
    return hasAnyPermission(['system.manage', 'system.*', 'admin.*']) || isSuperAdmin();
  };

  // 사용자 상태 체크
  const isActiveUser = (): boolean => {
    return user.status === 'active';
  };

  const isUserSuspended = (): boolean => {
    return user.status === 'suspended';
  };

  const isUserPending = (): boolean => {
    return user.status === 'pending';
  };

  // 역할별 편의 함수
  const isManager = (): boolean => {
    return hasRole('manager');
  };

  const isEditor = (): boolean => {
    return hasRole('editor');
  };

  const isViewer = (): boolean => {
    return hasRole('viewer');
  };

  // 사용자 정보 관련
  const getCurrentUser = () => {
    return user;
  };

  const getUserRoles = () => {
    return user.roles;
  };

  const getUserPermissions = () => {
    return user.permissions;
  };

  const hasHigherRole = (targetRole: string): boolean => {
    const roleHierarchy = {
      'super_admin': 5,
      'admin': 4,
      'manager': 3,
      'editor': 2,
      'viewer': 1,
    };

    const userMaxLevel = Math.max(...user.roles.map(role => role.level || roleHierarchy[role.name as keyof typeof roleHierarchy] || 0));
    const targetLevel = roleHierarchy[targetRole as keyof typeof roleHierarchy] || 0;

    return userMaxLevel > targetLevel;
  };

  return {
    // 기본 권한 체크
    can,
    canAny,
    canAll,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    isAdmin,
    isSuperAdmin,

    // 모듈별 권한 체크
    canManageUsers,
    canCreateUsers,
    canEditUsers,
    canDeleteUsers,
    canViewUsers,
    canManageRoles,
    canViewDashboard,
    canViewAnalytics,
    canManageSystem,

    // 사용자 상태 체크
    isActiveUser,
    isUserSuspended,
    isUserPending,

    // 역할 체크
    isManager,
    isEditor,
    isViewer,

    // 사용자 정보
    getCurrentUser,
    getUserRoles,
    getUserPermissions,
    hasHigherRole,

    // 사용자 객체 (호환성)
    user,
  };
};