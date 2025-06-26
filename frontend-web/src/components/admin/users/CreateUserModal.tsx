import React, { useState } from 'react';
import { adminUsersService } from '../../../api/adminUsersService';
import './UserModals.css';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateUserForm {
  userId: string;
  email: string;
  name: string;
  department?: string;
  phone?: string;
  roleIds?: number[];
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState<CreateUserForm>({
    userId: '',
    email: '',
    name: '',
    department: '',
    phone: '',
    roleIds: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await adminUsersService.createUser(form);
      onSuccess();
      onClose();
      // 폼 초기화
      setForm({
        userId: '',
        email: '',
        name: '',
        department: '',
        phone: '',
        roleIds: [],
      });
    } catch (err: any) {
      console.error('Failed to create user:', err);
      setError(err.response?.data?.message || '사용자 생성에 실패했습니다.');
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
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>새 사용자 추가</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-alert">❌ {error}</div>}

            <div className="form-group">
              <label htmlFor="userId">사용자 ID *</label>
              <input
                type="text"
                id="userId"
                name="userId"
                value={form.userId}
                onChange={handleChange}
                required
                placeholder="사용자 고유 ID"
                disabled={loading}
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

            <div className="form-info">
              <p>📧 임시 비밀번호가 사용자 이메일로 전송됩니다.</p>
              <p>👤 사용자는 첫 로그인 시 비밀번호를 변경해야 합니다.</p>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              취소
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '생성 중...' : '사용자 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;
