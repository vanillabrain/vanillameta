import React, { useState, useEffect } from 'react';
import { adminUsersService } from '../../../api/adminUsersService';
import UserTable from './UserTable';
import UserFilters from './UserFilters';
import './UserManagement.css';

interface User {
  id: string;
  userId: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface UserFilters {
  page: number;
  limit: number;
  search: string;
  status?: string;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

interface PaginatedResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 20,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminUsersService.getUsers(filters);
      setUsers(response);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({ 
      ...prev, 
      ...newFilters, 
      page: 1 // 필터 변경 시 첫 페이지로
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleRefresh = () => {
    loadUsers();
  };

  const handleUserStatusChange = async (userId: string, status: string) => {
    try {
      await adminUsersService.updateUserStatus(userId, status);
      loadUsers(); // 목록 새로고침
    } catch (error) {
      console.error('Failed to update user status:', error);
      // TODO: 에러 토스트 표시
    }
  };

  if (loading && !users) {
    return (
      <div className="user-management loading">
        <div className="loading-spinner">🔄 사용자 목록을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-management error">
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={handleRefresh} className="btn-retry">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h1>👥 사용자 관리</h1>
        <div className="header-actions">
          <button onClick={handleRefresh} className="btn-refresh" title="새로고침">
            🔄 새로고침
          </button>
          <button className="btn-primary" title="사용자 추가">
            ➕ 사용자 추가
          </button>
        </div>
      </div>

      <div className="user-management-stats">
        <div className="stat-item">
          <span className="stat-value">{users?.meta.total || 0}</span>
          <span className="stat-label">전체 사용자</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{selectedUsers.length}</span>
          <span className="stat-label">선택된 사용자</span>
        </div>
      </div>

      <UserFilters
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {selectedUsers.length > 0 && (
        <div className="bulk-actions">
          <span className="bulk-info">
            {selectedUsers.length}명이 선택되었습니다
          </span>
          <div className="bulk-buttons">
            <button className="btn-bulk btn-activate">활성화</button>
            <button className="btn-bulk btn-deactivate">비활성화</button>
            <button 
              className="btn-bulk btn-clear"
              onClick={() => setSelectedUsers([])}
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      <UserTable
        users={users?.data || []}
        loading={loading}
        selectedUsers={selectedUsers}
        onSelectionChange={setSelectedUsers}
        onUserStatusChange={handleUserStatusChange}
        onRefresh={loadUsers}
      />

      {users && users.meta.totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={users.meta.page <= 1}
            onClick={() => handlePageChange(users.meta.page - 1)}
          >
            ← 이전
          </button>
          
          <span className="pagination-info">
            {users.meta.page} / {users.meta.totalPages} 페이지
          </span>
          
          <button
            className="pagination-btn"
            disabled={users.meta.page >= users.meta.totalPages}
            onClick={() => handlePageChange(users.meta.page + 1)}
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
};

export default UserManagement;