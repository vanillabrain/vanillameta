'use client';

import { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// 권한 정보 인터페이스
interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  resource: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  level: number;
  permissions: Permission[];
}

interface User {
  id: number;
  userId: string | null;
  userEmail: string | null;
  name: string | null;
  avatar: string | null;
  status: 'active' | 'inactive' | 'pending' | 'suspended' | 'deleted';
  roles: Role[];
  permissions: Permission[];
  isAuthenticated: boolean;
  lastLoginAt: Date | null;
}

interface AuthContextType {
  user: User;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getUserInfo: () => Promise<void>;
  isLoading: boolean;
  // 권한 체크 메서드
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<User>({
    id: 0,
    userId: null,
    userEmail: null,
    name: null,
    avatar: null,
    status: 'inactive',
    roles: [],
    permissions: [],
    isAuthenticated: false,
    lastLoginAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // 초기 인증 상태 확인
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser({
          id: userData.id,
          userId: userData.userId,
          userEmail: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          status: userData.status,
          roles: userData.roles || [],
          permissions: userData.permissions || [],
          isAuthenticated: true,
          lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt) : null,
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser({
          id: userData.id,
          userId: userData.userId,
          userEmail: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          status: userData.status,
          roles: userData.roles || [],
          permissions: userData.permissions || [],
          isAuthenticated: true,
          lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt) : null,
        });
        router.push('/dashboard');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      setUser({
        id: 0,
        userId: null,
        userEmail: null,
        name: null,
        avatar: null,
        status: 'inactive',
        roles: [],
        permissions: [],
        isAuthenticated: false,
        lastLoginAt: null,
      });
      
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser({
          id: userData.id,
          userId: userData.userId,
          userEmail: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          status: userData.status,
          roles: userData.roles || [],
          permissions: userData.permissions || [],
          isAuthenticated: true,
          lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt) : null,
        });
      }
    } catch (error) {
      console.error('Get user info failed:', error);
    }
  };

  // 권한 체크 메서드들
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user.isAuthenticated) return false;
    
    // 와일드카드 권한 체크 (예: admin.*)
    const hasWildcard = user.permissions.some(p => {
      if (permission.includes('*')) {
        const pattern = permission.replace('*', '.*');
        return new RegExp(pattern).test(p.name);
      }
      return p.name === permission;
    });
    
    if (hasWildcard) return true;
    
    // 역할 기반 권한 체크
    return user.roles.some(role => 
      role.permissions.some(p => p.name === permission)
    );
  }, [user]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  }, [hasPermission]);

  const hasRole = useCallback((roleName: string): boolean => {
    if (!user.isAuthenticated) return false;
    return user.roles.some(role => role.name === roleName);
  }, [user]);

  const hasAnyRole = useCallback((roleNames: string[]): boolean => {
    return roleNames.some(roleName => hasRole(roleName));
  }, [hasRole]);

  const isAdmin = useCallback((): boolean => {
    return hasAnyRole(['admin', 'super_admin']);
  }, [hasAnyRole]);

  const isSuperAdmin = useCallback((): boolean => {
    return hasRole('super_admin');
  }, [hasRole]);

  const value: AuthContextType = {
    user,
    login,
    logout,
    getUserInfo,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    isAdmin,
    isSuperAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Backward compatibility
export const useAuthContext = useAuth;