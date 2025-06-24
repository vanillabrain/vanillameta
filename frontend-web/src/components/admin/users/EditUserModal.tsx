import React, { useState, useEffect } from 'react';
import { adminUsersService } from '../../../api/adminUsersService';
import './UserModals.css';

interface EditUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  userId: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  department?: string;
  phone?: string;
}

interface UpdateUserForm {
  name: string;
  email: string;
  department?: string;
  phone?: string;
  roleIds?: number[];
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, user, onClose, onSuccess }) => {
  const [form, setForm] = useState<UpdateUserForm>({
    name: '',
    email: '',
    department: '',
    phone: '',
    roleIds: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        department: user.department || '',
        phone: user.phone || '',
        roleIds: [] // TODO: 역할 ID 매핑 필요
      });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await adminUsersService.updateUser(user.id, form);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setError(err.response?.data?.message || '사용자 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>사용자 정보 수정</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="error-alert">
                ❌ {error}
              </div>
            )}

            <div className="form-group">
              <label>사용자 ID</label>
              <input
                type="text"
                value={user.userId}
                disabled
                className="disabled-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">이메일 *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="user@example.com"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">이름 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="사용자 이름"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="department">부서</label>
              <input
                type="text"
                id="department"
                name="department"
                value={form.department}
                onChange={handleChange}
                placeholder="소속 부서"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">전화번호</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="010-0000-0000"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>현재 상태</label>
              <div className={`user-status status-${user.status}`}>
                {user.status === 'active' && '✅ 활성'}
                {user.status === 'inactive' && '⏸️ 비활성'}
                {user.status === 'pending' && '⏳ 승인 대기'}
                {user.status === 'suspended' && '🚫 정지'}
                {user.status === 'deleted' && '🗑️ 삭제됨'}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? '수정 중...' : '변경사항 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;