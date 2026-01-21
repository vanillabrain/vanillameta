import React, { useState, useEffect } from 'react';
import StatsWidget from './StatsWidget';
import RecentActivity from './RecentActivity';
import { adminService } from '../../../api/adminService';
import './AdminDashboard.css';

interface DashboardStats {
  totalUsers: number;
  pendingApprovals: number;
  todayLogins: number;
  activeSessions: number;
  totalDashboards: number;
  totalWidgets: number;
  recentLogs: Array<{
    id: string;
    userEmail: string;
    action: string;
    createdAt: string;
  }>;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError('대시보드 통계를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardStats();
  };

  if (loading) {
    return (
      <div className="admin-dashboard loading">
        <div className="loading-spinner">🔄 데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard error">
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={handleRefresh} className="btn-retry">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="admin-dashboard error">
        <div className="error-message">
          <p>📊 통계 데이터가 없습니다.</p>
          <button onClick={handleRefresh} className="btn-retry">
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h2>시스템 개요</h2>
        <button onClick={handleRefresh} className="btn-refresh" title="새로고침">
          🔄 새로고침
        </button>
      </div>

      <div className="stats-grid">
        <StatsWidget
          title="전체 사용자"
          value={stats.totalUsers}
          icon="👥"
          color="#3498db"
          subtitle={`${stats.pendingApprovals}명 승인 대기`}
        />
        
        <StatsWidget
          title="오늘 로그인"
          value={stats.todayLogins}
          icon="🔐"
          color="#2ecc71"
          subtitle={`${stats.activeSessions}명 활성 세션`}
        />
        
        <StatsWidget
          title="대시보드"
          value={stats.totalDashboards}
          icon="📊"
          color="#e74c3c"
          subtitle="생성된 대시보드"
        />
        
        <StatsWidget
          title="위젯"
          value={stats.totalWidgets}
          icon="📈"
          color="#f39c12"
          subtitle="생성된 위젯"
        />
      </div>

      <div className="dashboard-content">
        <div className="content-section">
          <h3>최근 활동</h3>
          <RecentActivity logs={stats.recentLogs} />
        </div>
        
        <div className="content-section">
          <h3>빠른 작업</h3>
          <div className="quick-actions">
            <button className="quick-action-btn">
              👤 사용자 관리
            </button>
            <button className="quick-action-btn">
              ⏳ 승인 대기 확인
            </button>
            <button className="quick-action-btn">
              📋 감사 로그 보기
            </button>
            <button className="quick-action-btn">
              ⚙️ 시스템 설정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;