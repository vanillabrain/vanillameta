import React from 'react';
import './UserTable.css';

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

interface UserTableProps {
  users: User[];
  loading: boolean;
  selectedUsers: string[];
  onSelectionChange: (userIds: string[]) => void;
  onUserStatusChange: (userId: string, status: string) => void;
  onRefresh: () => void;
}

const UserTable: React.FC<UserTableProps> = ({
  users,
  loading,
  selectedUsers,
  onSelectionChange,
  onUserStatusChange,
  onRefresh,
}) => {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(users.map(user => user.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedUsers, userId]);
    } else {
      onSelectionChange(selectedUsers.filter(id => id !== userId));
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '날짜 불명';
    }
  };

  const getStatusBadge = (status: string): React.ReactNode => {
    const statusConfig = {
      active: { label: '활성', color: '#28a745' },
      inactive: { label: '비활성', color: '#6c757d' },
      pending: { label: '대기', color: '#ffc107' },
      suspended: { label: '정지', color: '#dc3545' },
      deleted: { label: '삭제', color: '#343a40' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      color: '#6c757d'
    };

    return (
      <span 
        className="status-badge" 
        style={{ backgroundColor: config.color }}
      >
        {config.label}
      </span>
    );
  };

  const handleStatusChange = (userId: string, newStatus: string) => {
    if (window.confirm(`사용자 상태를 '${newStatus}'로 변경하시겠습니까?`)) {
      onUserStatusChange(userId, newStatus);
    }
  };

  if (loading) {
    return (
      <div className="user-table-loading">
        <div className="loading-spinner">🔄 로딩 중...</div>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="user-table-empty">
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>사용자가 없습니다</h3>
          <p>검색 조건을 변경하거나 새로운 사용자를 추가해보세요.</p>
          <button onClick={onRefresh} className="btn-refresh">
            새로고침
          </button>
        </div>
      </div>
    );
  }

  const allSelected = users.length > 0 && selectedUsers.length === users.length;
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  return (
    <div className="user-table-container">
      <table className="user-table">
        <thead>
          <tr>
            <th className="checkbox-column">
              <input
                type="checkbox"
                checked={allSelected}
                ref={input => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
            <th>사용자 정보</th>
            <th>역할</th>
            <th>상태</th>
            <th>최종 접속</th>
            <th>가입일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr 
              key={user.id} 
              className={selectedUsers.includes(user.id) ? 'selected' : ''}
            >
              <td className="checkbox-column">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.id)}
                  onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                />
              </td>
              <td className="user-info">
                <div className="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <div className="user-name">{user.name}</div>
                  <div className="user-email">{user.email}</div>
                  <div className="user-id">ID: {user.userId}</div>
                </div>
              </td>
              <td>
                <div className="roles">
                  {user.roles.map((role, index) => (
                    <span key={index} className="role-tag">
                      {role}
                    </span>
                  ))}
                </div>
              </td>
              <td>
                <div className="status-cell">
                  {getStatusBadge(user.status)}
                  <select
                    className="status-select"
                    value={user.status}
                    onChange={(e) => handleStatusChange(user.id, e.target.value)}
                  >
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                    <option value="pending">대기</option>
                    <option value="suspended">정지</option>
                  </select>
                </div>
              </td>
              <td>
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : '접속 기록 없음'}
              </td>
              <td>{formatDate(user.createdAt)}</td>
              <td>
                <div className="table-actions">
                  <button 
                    className="btn-action btn-view"
                    title="상세 보기"
                  >
                    👁️
                  </button>
                  <button 
                    className="btn-action btn-edit"
                    title="편집"
                  >
                    ✏️
                  </button>
                  <button 
                    className="btn-action btn-delete"
                    title="삭제"
                    onClick={() => handleStatusChange(user.id, 'deleted')}
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;