import React, { useState } from 'react';
import './UserStatusBadge.css';

interface UserStatusBadgeProps {
  status: string;
  userId: string;
  onStatusChange?: (userId: string, status: string) => void;
  editable?: boolean;
}

const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ status, userId, onStatusChange, editable = true }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const statusConfig = {
    active: { label: '활성', icon: '✅', color: 'success' },
    inactive: { label: '비활성', icon: '⏸️', color: 'warning' },
    pending: { label: '승인 대기', icon: '⏳', color: 'info' },
    suspended: { label: '정지', icon: '🚫', color: 'danger' },
    deleted: { label: '삭제됨', icon: '🗑️', color: 'muted' },
  };

  const currentStatus = statusConfig[status] || statusConfig.pending;

  const handleStatusClick = () => {
    if (editable && onStatusChange) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  const handleStatusSelect = (newStatus: string) => {
    if (onStatusChange) {
      onStatusChange(userId, newStatus);
    }
    setIsDropdownOpen(false);
  };

  return (
    <div className="status-badge-container">
      <div
        className={`status-badge status-${currentStatus.color} ${editable ? 'editable' : ''}`}
        onClick={handleStatusClick}
      >
        <span className="status-icon">{currentStatus.icon}</span>
        <span className="status-label">{currentStatus.label}</span>
        {editable && <span className="dropdown-arrow">▼</span>}
      </div>

      {isDropdownOpen && editable && (
        <div className="status-dropdown">
          {Object.entries(statusConfig).map(([key, config]) => (
            <div
              key={key}
              className={`status-option ${key === status ? 'selected' : ''}`}
              onClick={() => handleStatusSelect(key)}
            >
              <span className="status-icon">{config.icon}</span>
              <span className="status-label">{config.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserStatusBadge;
