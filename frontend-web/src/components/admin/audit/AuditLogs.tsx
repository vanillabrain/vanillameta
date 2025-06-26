import React, { useState, useEffect } from 'react';
import { auditLogService, AuditLog, AuditLogStats, AvailableActions } from '../../../api/auditLogService';
import './AuditLogs.css';

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const AuditLogs: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [availableActions, setAvailableActions] = useState<AvailableActions | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 필터 상태
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    entityType: '',
    status: '',
    startDate: '',
    endDate: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC' as 'ASC' | 'DESC',
  });

  useEffect(() => {
    loadAuditLogs();
    loadStats();
    loadAvailableActions();
  }, [page, filters]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await auditLogService.getAuditLogs({
        page,
        limit: 20,
        ...filters,
      });

      setAuditLogs(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (err) {
      setError('감사 로그 목록을 불러오는데 실패했습니다.');
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await auditLogService.getAuditLogStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error loading audit log stats:', err);
    }
  };

  const loadAvailableActions = async () => {
    try {
      const actions = await auditLogService.getAvailableActions();
      setAvailableActions(actions);
    } catch (err) {
      console.error('Error loading available actions:', err);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    setPage(1); // 필터 변경 시 첫 페이지로 이동
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      action: '',
      entityType: '',
      status: '',
      startDate: '',
      endDate: '',
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    setPage(1);
  };

  const handleShowDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getTimeSince = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `${diffDays}일 전`;
    if (diffHours > 0) return `${diffHours}시간 전`;
    if (diffMinutes > 0) return `${diffMinutes}분 전`;
    return '방금 전';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return '📝';
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return '➕';
    if (action.includes('update')) return '✏️';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('login')) return '🔑';
    if (action.includes('logout')) return '🚪';
    if (action.includes('approve')) return '✅';
    if (action.includes('reject')) return '❌';
    return '📋';
  };

  if (loading && auditLogs.length === 0) {
    return (
      <div className="audit-logs-loading">
        <div className="loading-spinner">📋 감사 로그를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="audit-logs">
      <div className="audit-header">
        <h2>📋 감사 로그</h2>
        <p>시스템에서 발생한 모든 사용자 작업을 추적합니다.</p>
      </div>

      {error && (
        <div className="error-message">
          <span>❌ {error}</span>
          <button onClick={loadAuditLogs}>다시 시도</button>
        </div>
      )}

      {/* 통계 카드 */}
      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalLogs.toLocaleString()}</div>
              <div className="stat-label">전체 로그</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value">{stats.todayLogs.toLocaleString()}</div>
              <div className="stat-label">오늘 로그</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <div className="stat-value">{stats.weeklyLogs.toLocaleString()}</div>
              <div className="stat-label">주간 로그</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value">{stats.statusBreakdown.success.toLocaleString()}</div>
              <div className="stat-label">성공 로그</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-info">
              <div className="stat-value">{stats.statusBreakdown.error.toLocaleString()}</div>
              <div className="stat-label">오류 로그</div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 영역 */}
      <div className="audit-filters">
        <div className="filters-row">
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="작업, 사용자 이메일로 검색..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>

          <select
            className="filter-select"
            value={filters.action}
            onChange={e => handleFilterChange('action', e.target.value)}
          >
            <option value="">모든 작업</option>
            {availableActions?.actions.map(action => (
              <option key={action.value} value={action.value}>
                {auditLogService.getActionDisplayName(action.value)}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
          >
            <option value="">모든 상태</option>
            <option value="success">성공</option>
            <option value="error">오류</option>
            <option value="warning">경고</option>
          </select>
        </div>

        <div className="filters-row">
          <div className="date-filter">
            <label>시작일:</label>
            <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} />
          </div>
          <div className="date-filter">
            <label>종료일:</label>
            <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} />
          </div>

          <button onClick={handleClearFilters} className="clear-filters-btn">
            🗑️ 필터 초기화
          </button>
          <button onClick={loadAuditLogs} className="refresh-btn">
            🔄 새로고침
          </button>
        </div>
      </div>

      {auditLogs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>감사 로그가 없습니다</h3>
          <p>현재 조건에 맞는 감사 로그가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="audit-logs-list">
            {auditLogs.map(log => (
              <div key={log.id} className="audit-log-card">
                <div className="log-header">
                  <div className="log-action">
                    <span className="action-icon">{getActionIcon(log.action)}</span>
                    <span className="action-name">{auditLogService.getActionDisplayName(log.action)}</span>
                  </div>
                  <div className="log-status">
                    <span
                      className={`status-badge ${log.status}`}
                      style={{ backgroundColor: auditLogService.getStatusColor(log.status) }}
                    >
                      {getStatusIcon(log.status)} {auditLogService.getStatusDisplayName(log.status)}
                    </span>
                  </div>
                </div>

                <div className="log-content">
                  <div className="log-user">
                    <span className="user-icon">👤</span>
                    <span className="user-email">{log.userEmail || 'Unknown User'}</span>
                    {log.userId && <span className="user-id">(ID: {log.userId})</span>}
                  </div>

                  {log.details && <div className="log-details">{log.details}</div>}

                  {log.entityType && (
                    <div className="log-entity">
                      <span className="entity-type">{log.entityType}</span>
                      {log.entityId && <span className="entity-id">#{log.entityId}</span>}
                    </div>
                  )}
                </div>

                <div className="log-footer">
                  <div className="log-time">
                    <span className="time-relative">{getTimeSince(log.createdAt)}</span>
                    <span className="time-absolute">{formatDate(log.createdAt)}</span>
                  </div>

                  <button className="detail-btn" onClick={() => handleShowDetail(log)}>
                    🔍 상세보기
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

      {/* 상세 모달 */}
      {showDetailModal && selectedLog && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>🔍 감사 로그 상세 정보</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>로그 ID:</label>
                  <span>{selectedLog.id}</span>
                </div>
                <div className="detail-item">
                  <label>작업:</label>
                  <span>
                    {getActionIcon(selectedLog.action)} {auditLogService.getActionDisplayName(selectedLog.action)}
                  </span>
                </div>
                <div className="detail-item">
                  <label>상태:</label>
                  <span
                    className={`status-badge ${selectedLog.status}`}
                    style={{ backgroundColor: auditLogService.getStatusColor(selectedLog.status) }}
                  >
                    {getStatusIcon(selectedLog.status)} {auditLogService.getStatusDisplayName(selectedLog.status)}
                  </span>
                </div>
                <div className="detail-item">
                  <label>사용자:</label>
                  <span>
                    {selectedLog.userEmail} (ID: {selectedLog.userId})
                  </span>
                </div>
                <div className="detail-item">
                  <label>대상 엔티티:</label>
                  <span>
                    {selectedLog.entityType} #{selectedLog.entityId}
                  </span>
                </div>
                <div className="detail-item">
                  <label>발생 시간:</label>
                  <span>{formatDate(selectedLog.createdAt)}</span>
                </div>
                {selectedLog.ipAddress && (
                  <div className="detail-item">
                    <label>IP 주소:</label>
                    <span>{selectedLog.ipAddress}</span>
                  </div>
                )}
                {selectedLog.details && (
                  <div className="detail-item full-width">
                    <label>상세 설명:</label>
                    <div className="detail-text">{selectedLog.details}</div>
                  </div>
                )}
                {selectedLog.userAgent && (
                  <div className="detail-item full-width">
                    <label>User Agent:</label>
                    <div className="detail-text small">{selectedLog.userAgent}</div>
                  </div>
                )}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div className="detail-item full-width">
                    <label>메타데이터:</label>
                    <pre className="metadata-json">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDetailModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
