import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';
import './AdminHeader.css';

const AdminHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToMain = () => {
    navigate('/');
  };

  return (
    <header className="admin-header">
      <div className="header-left">
        <h1 className="page-title">관리자 대시보드</h1>
        <div className="breadcrumb">
          <span>Home</span>
          <span className="separator">/</span>
          <span>Admin</span>
        </div>
      </div>
      
      <div className="header-right">
        <button 
          className="btn-secondary"
          onClick={handleBackToMain}
          title="메인 사이트로 돌아가기"
        >
          🏠 메인으로
        </button>
        
        <div className="user-info">
          <div className="user-avatar">
            👤
          </div>
          <div className="user-details">
            <span className="user-name">{user?.email || 'Admin'}</span>
            <span className="user-role">관리자</span>
          </div>
        </div>
        
        <button 
          className="btn-logout"
          onClick={handleLogout}
          title="로그아웃"
        >
          🚪 로그아웃
        </button>
      </div>
    </header>
  );
};

export default AdminHeader;