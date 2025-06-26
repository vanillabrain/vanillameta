import React, { useState, useEffect } from 'react';
import { adminUsersService } from '../../../api/adminUsersService';
import './UserApproval.css';

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

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const UserApproval: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPendingUsers();
  }, [page, searchTerm]);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminUsersService.getPendingUsers({
        page,
        limit: 10,
        search: searchTerm,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      setUsers(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (err) {
      setError('승인 대기 사용자 목록을 불러오는데 실패했습니다.');
      console.error('Error loading pending users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (user: User) => {
    setSelectedUser(user);
    setApprovalReason('');
    setShowApprovalModal(true);
  };

  const handleReject = (user: User) => {
    setSelectedUser(user);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmApproval = async () => {
    if (!selectedUser) return;

    setProcessingUsers(prev => new Set(prev).add(selectedUser.id));

    try {
      await adminUsersService.approveUser(selectedUser.id, approvalReason);

      // 사용자 목록에서 제거 (승인 완료)
      setUsers(prev => prev.filter(user => user.id !== selectedUser.id));

      setShowApprovalModal(false);
      setSelectedUser(null);
      setApprovalReason('');
    } catch (err) {
      setError('사용자 승인에 실패했습니다.');
      console.error('Error approving user:', err);
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedUser.id);
        return newSet;
      });
    }
  };

  const confirmRejection = async () => {
    if (!selectedUser || !rejectReason.trim()) return;

    setProcessingUsers(prev => new Set(prev).add(selectedUser.id));

    try {
      await adminUsersService.rejectUser(selectedUser.id, rejectReason);

      // 사용자 목록에서 제거 (거부 완료)
      setUsers(prev => prev.filter(user => user.id !== selectedUser.id));

      setShowRejectModal(false);
      setSelectedUser(null);
      setRejectReason('');
    } catch (err) {
      setError('사용자 거부에 실패했습니다.');
      console.error('Error rejecting user:', err);
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedUser.id);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getTimeSince = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays > 0) return `${diffDays}일 전`;
    if (diffHours > 0) return `${diffHours}시간 전`;
    return '방금 전';
  };

  if (loading) {
    return (
      <div className="user-approval-loading">
        <div className="loading-spinner">⏳ 승인 대기 사용자 목록을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="user-approval">
      <div className="approval-header">
        <h2>⏳ 사용자 승인</h2>
        <p>새로 가입한 사용자들의 승인을 관리합니다.</p>
      </div>

      {error && (
        <div className="error-message">
          <span>❌ {error}</span>
          <button onClick={loadPendingUsers}>다시 시도</button>
        </div>
      )}

      <div className="approval-controls">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="이메일 또는 사용자 ID로 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        <button onClick={loadPendingUsers} className="refresh-btn">
          🔄 새로고침
        </button>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>승인 대기 중인 사용자가 없습니다</h3>
          <p>모든 사용자의 승인이 완료되었거나 새로 가입한 사용자가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="pending-users-list">
            {users.map(user => (
              <div key={user.id} className="pending-user-card">
                <div className="user-info-section">
                  <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                  <div className="user-details">
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-id">ID: {user.userId}</div>
                    <div className="join-time">
                      가입: {getTimeSince(user.createdAt)} ({formatDate(user.createdAt)})
                    </div>
                  </div>
                </div>

                <div className="user-actions">
                  <button
                    className="approve-btn"
                    onClick={() => handleApprove(user)}
                    disabled={processingUsers.has(user.id)}
                  >
                    {processingUsers.has(user.id) ? '처리 중...' : '✅ 승인'}
                  </button>
                  <button className="reject-btn" onClick={() => handleReject(user)} disabled={processingUsers.has(user.id)}>
                    {processingUsers.has(user.id) ? '처리 중...' : '❌ 거부'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="pagination-btn"
              >
                이전
              </button>
              <span className="pagination-info">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {/* 승인 모달 */}
      {showApprovalModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>✅ 사용자 승인</h3>
              <button className="modal-close" onClick={() => setShowApprovalModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{selectedUser.email}</strong> 사용자를 승인하시겠습니까?
              </p>
              <div className="form-group">
                <label htmlFor="approval-reason">승인 사유 (선택사항):</label>
                <textarea
                  id="approval-reason"
                  value={approvalReason}
                  onChange={e => setApprovalReason(e.target.value)}
                  placeholder="승인 사유를 입력하세요..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowApprovalModal(false)}>
                취소
              </button>
              <button className="btn-confirm approve-confirm" onClick={confirmApproval}>
                승인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 거부 모달 */}
      {showRejectModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>❌ 사용자 거부</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{selectedUser.email}</strong> 사용자를 거부하시겠습니까?
              </p>
              <div className="form-group">
                <label htmlFor="reject-reason">거부 사유 (필수):</label>
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="거부 사유를 입력하세요..."
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowRejectModal(false)}>
                취소
              </button>
              <button className="btn-confirm reject-confirm" onClick={confirmRejection} disabled={!rejectReason.trim()}>
                거부하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserApproval;
