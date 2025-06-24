import React, { useState, useEffect } from 'react';
import { adminUsersService } from '../../../api/adminUsersService';
import './UserModals.css';

interface UserDetailModalProps {
  isOpen: boolean;
  userId: string | null;
  onClose: () => void;
}

interface UserDetail {
  id: string;
  userId: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  department?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  emailVerifiedAt?: string;
  deletedAt?: string;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ isOpen, userId, onClose }) => {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails();
    }
  }, [isOpen, userId]);

  const loadUserDetails = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await adminUsersService.getUserById(userId);
      setUser(response);
    } catch (err) {
      console.error('Failed to load user details:', err);
      setError('사용자 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>사용자 상세 정보</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              🔄 정보를 불러오는 중...
            </div>
          )}

          {error && (
            <div className="error-alert">
              ❌ {error}
            </div>
          )}

          {user && !loading && (
            <div className="user-detail-content">
              <div className="detail-section">
                <h3>기본 정보</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>사용자 ID</label>
                    <span>{user.userId}</span>
                  </div>
                  <div className="detail-item">
                    <label>이름</label>
                    <span>{user.name}</span>
                  </div>
                  <div className="detail-item">
                    <label>이메일</label>
                    <span>{user.email}</span>
                  </div>
                  <div className="detail-item">
                    <label>상태</label>
                    <span className={`user-status status-${user.status}`}>
                      {user.status === 'active' && '✅ 활성'}
                      {user.status === 'inactive' && '⏸️ 비활성'}
                      {user.status === 'pending' && '⏳ 승인 대기'}
                      {user.status === 'suspended' && '🚫 정지'}
                      {user.status === 'deleted' && '🗑️ 삭제됨'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>추가 정보</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>부서</label>
                    <span>{user.department || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <label>전화번호</label>
                    <span>{user.phone || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <label>역할</label>
                    <span>
                      {user.roles.length > 0 ? user.roles.join(', ') : '역할 없음'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>계정 활동</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>가입일</label>
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <label>최종 수정일</label>
                    <span>{formatDate(user.updatedAt)}</span>
                  </div>
                  <div className="detail-item">
                    <label>마지막 로그인</label>
                    <span>{user.lastLoginAt ? formatDate(user.lastLoginAt) : '로그인 기록 없음'}</span>
                  </div>
                  <div className="detail-item">
                    <label>이메일 인증</label>
                    <span>
                      {user.emailVerifiedAt 
                        ? `✅ ${formatDate(user.emailVerifiedAt)}` 
                        : '❌ 미인증'}
                    </span>
                  </div>
                  {user.deletedAt && (
                    <div className="detail-item">
                      <label>삭제일</label>
                      <span className="text-danger">{formatDate(user.deletedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>최근 활동 로그</h3>
                <div className="activity-placeholder">
                  <p>📋 활동 로그는 감사 로그 시스템 구현 후 표시됩니다.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;