import React, { useState } from 'react';
import { adminUsersService } from '../../../api/adminUsersService';
import './BulkActionBar.css';

interface BulkActionBarProps {
  selectedCount: number;
  selectedUserIds: string[];
  onAction: () => void;
  onClear: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({ 
  selectedCount, 
  selectedUserIds,
  onAction, 
  onClear 
}) => {
  const [loading, setLoading] = useState(false);

  const handleBulkAction = async (action: string) => {
    if (selectedUserIds.length === 0) return;

    const confirmMessages = {
      activate: `${selectedCount}명의 사용자를 활성화하시겠습니까?`,
      deactivate: `${selectedCount}명의 사용자를 비활성화하시겠습니까?`,
      suspend: `${selectedCount}명의 사용자를 정지하시겠습니까?`,
      delete: `${selectedCount}명의 사용자를 삭제하시겠습니까? (복구 가능)`
    };

    if (!window.confirm(confirmMessages[action])) return;

    try {
      setLoading(true);
      await adminUsersService.bulkAction({
        action: action as 'activate' | 'deactivate' | 'suspend' | 'delete',
        userIds: selectedUserIds.map(id => parseInt(id))
      });
      onAction();
      onClear();
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('일괄 작업 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bulk-action-bar">
      <div className="bulk-info">
        <span className="bulk-count">{selectedCount}명</span>
        <span className="bulk-text">이 선택되었습니다</span>
      </div>

      <div className="bulk-actions">
        <button
          className="bulk-btn bulk-activate"
          onClick={() => handleBulkAction('activate')}
          disabled={loading}
        >
          ✅ 활성화
        </button>
        <button
          className="bulk-btn bulk-deactivate"
          onClick={() => handleBulkAction('deactivate')}
          disabled={loading}
        >
          ⏸️ 비활성화
        </button>
        <button
          className="bulk-btn bulk-suspend"
          onClick={() => handleBulkAction('suspend')}
          disabled={loading}
        >
          🚫 정지
        </button>
        <button
          className="bulk-btn bulk-delete"
          onClick={() => handleBulkAction('delete')}
          disabled={loading}
        >
          🗑️ 삭제
        </button>
        <button
          className="bulk-btn bulk-clear"
          onClick={onClear}
          disabled={loading}
        >
          ❌ 선택 해제
        </button>
      </div>
    </div>
  );
};

export default BulkActionBar;