import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import './AdminLayout.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuthContext();

  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 관리자 권한이 없는 사용자는 메인 페이지로 리다이렉트
  // 현재는 임시로 모든 인증된 사용자에게 접근 허용
  // TODO: 실제 권한 체크 로직 구현
  const hasAdminPermission = true; // user?.role === 'admin' || user?.email?.includes('admin');

  if (!hasAdminPermission) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <AdminHeader />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
