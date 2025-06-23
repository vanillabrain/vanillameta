import React from 'react';
import './RecentActivity.css';

interface LogEntry {
  id: string;
  userEmail: string;
  action: string;
  createdAt: string;
}

interface RecentActivityProps {
  logs: LogEntry[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ logs }) => {
  const getActionIcon = (action: string): string => {
    switch (action.toLowerCase()) {
      case 'user_login':
      case 'login':
        return '🔐';
      case 'user_logout':
      case 'logout':
        return '🚪';
      case 'dashboard_create':
      case 'create_dashboard':
        return '➕';
      case 'dashboard_view':
      case 'view_dashboard':
        return '👁️';
      case 'widget_create':
      case 'create_widget':
        return '📊';
      case 'data_export':
      case 'export':
        return '📤';
      default:
        return '📝';
    }
  };

  const getActionText = (action: string): string => {
    switch (action.toLowerCase()) {
      case 'user_login':
      case 'login':
        return '로그인';
      case 'user_logout':
      case 'logout':
        return '로그아웃';
      case 'dashboard_create':
      case 'create_dashboard':
        return '대시보드 생성';
      case 'dashboard_view':
      case 'view_dashboard':
        return '대시보드 조회';
      case 'widget_create':
      case 'create_widget':
        return '위젯 생성';
      case 'data_export':
      case 'export':
        return '데이터 내보내기';
      default:
        return action;
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) {
        return '방금 전';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}분 전`;
      } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours}시간 전`;
      } else {
        return date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      return '시간 불명';
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="recent-activity">
        <div className="no-activity">
          <div className="no-activity-icon">📭</div>
          <p>최근 활동이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="recent-activity">
      <div className="activity-list">
        {logs.map((log) => (
          <div key={log.id} className="activity-item">
            <div className="activity-icon">
              {getActionIcon(log.action)}
            </div>
            <div className="activity-content">
              <div className="activity-main">
                <span className="user-email">{log.userEmail}</span>
                <span className="activity-action">{getActionText(log.action)}</span>
              </div>
              <div className="activity-time">
                {formatTime(log.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="activity-footer">
        <button className="btn-view-all">
          📋 전체 로그 보기
        </button>
      </div>
    </div>
  );
};

export default RecentActivity;