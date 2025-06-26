import React, { useState, useEffect } from 'react';
import { adminRoleService, Role, RoleWithStats, CreateRoleRequest, UpdateRoleRequest, Permission, GroupedPermissions } from '../../../api/adminRoleService';
import './RoleManagement.css';

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<RoleWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithStats | null>(null);
  const [availablePermissions, setAvailablePermissions] = useState<GroupedPermissions | null>(null);
  const [formData, setFormData] = useState<CreateRoleRequest>({
    name: '',
    displayName: '',
    description: '',
    permissionIds: [],
    isActive: true,
  });

  useEffect(() => {
    loadRoles();
    loadAvailablePermissions();
  }, [page, searchTerm]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await adminRoleService.getRoles({
        page,
        limit: 10,
        search: searchTerm,
        sortBy: 'createdAt',
        sortOrder: 'DESC'
      });

      // response는 RoleWithStats[] 타입
      setRoles(response);
      // 페이지네이션 정보는 별도로 처리 필요
      setTotalPages(Math.ceil(response.length / 10));
    } catch (err) {
      setError('역할 목록을 불러오는데 실패했습니다.');
      console.error('Error loading roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePermissions = async () => {
    try {
      const permissions = await adminRoleService.getGroupedPermissions();
      setAvailablePermissions(permissions);
    } catch (err) {
      console.error('Error loading permissions:', err);
    }
  };

  const handleCreateRole = async () => {
    try {
      await adminRoleService.createRole(formData);
      await loadRoles();
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError('역할 생성에 실패했습니다.');
      console.error('Error creating role:', err);
    }
  };

  const handleEditRole = async () => {
    if (!selectedRole) return;

    try {
      const updateData: UpdateRoleRequest = {
        displayName: formData.displayName,
        description: formData.description,
        permissionIds: formData.permissionIds,
        isActive: formData.isActive,
      };

      await adminRoleService.updateRole(selectedRole.id, updateData);
      await loadRoles();
      setShowEditModal(false);
      setSelectedRole(null);
      resetForm();
    } catch (err) {
      setError('역할 정보 수정에 실패했습니다.');
      console.error('Error updating role:', err);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    try {
      await adminRoleService.deleteRole(selectedRole.id);
      await loadRoles();
      setShowDeleteModal(false);
      setSelectedRole(null);
    } catch (err) {
      setError('역할 삭제에 실패했습니다.');
      console.error('Error deleting role:', err);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (role: RoleWithStats) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      permissionIds: role.permissions,
      isActive: role.isActive,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (role: RoleWithStats) => {
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      permissionIds: [],
      isActive: true,
    });
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds?.includes(permission)
        ? prev.permissionIds.filter(p => p !== permission)
        : [...(prev.permissionIds || []), permission]
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getPermissionsByCategory = () => {
    if (!availablePermissions) return {};
    
    // availablePermissions는 이미 GroupedPermissions 타입 (Record<string, Record<string, Permission[]>>)
    return availablePermissions;
  };

  if (loading) {
    return (
      <div className="role-management-loading">
        <div className="loading-spinner">🔄 역할 목록을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="role-management">
      <div className="role-header">
        <h2>🔐 역할 관리</h2>
        <p>시스템의 역할과 권한을 관리합니다.</p>
      </div>

      {error && (
        <div className="error-message">
          <span>❌ {error}</span>
          <button onClick={loadRoles}>다시 시도</button>
        </div>
      )}

      <div className="role-controls">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="역할 이름 또는 설명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        <button onClick={openCreateModal} className="create-btn">
          ➕ 새 역할 생성
        </button>
        <button onClick={loadRoles} className="refresh-btn">
          🔄 새로고침
        </button>
      </div>

      {roles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <h3>역할이 없습니다</h3>
          <p>새로운 역할을 생성하여 시작하세요.</p>
          <button onClick={openCreateModal} className="empty-create-btn">
            첫 번째 역할 만들기
          </button>
        </div>
      ) : (
        <>
          <div className="roles-list">
            {roles.map((role) => (
              <div key={role.id} className="role-card">
                <div className="role-info">
                  <div className="role-header-info">
                    <h3 className="role-name">{role.displayName}</h3>
                    <div className="role-badges">
                      {role.isDefault && (
                        <span className="system-badge">기본 역할</span>
                      )}
                      <span className={`status-badge ${role.isActive ? 'active' : 'inactive'}`}>
                        {role.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                  </div>
                  <div className="role-details">
                    <div className="role-id">ID: {role.name}</div>
                    <div className="role-description">{role.description || '설명 없음'}</div>
                    <div className="role-permissions">
                      권한: {role.permissions.length}개
                      {role.permissions.length > 0 && (
                        <div className="permission-tags">
                          {role.permissions.slice(0, 3).map(permission => (
                            <span key={permission} className="permission-tag">
                              {permission.split(':')[1] || permission}
                            </span>
                          ))}
                          {role.permissions.length > 3 && (
                            <span className="permission-tag more">
                              +{role.permissions.length - 3}개
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="role-dates">
                      생성: {formatDate(role.createdAt)} | 수정: {formatDate(role.updatedAt)}
                    </div>
                  </div>
                </div>
                
                <div className="role-actions">
                  <button
                    className="edit-btn"
                    onClick={() => openEditModal(role)}
                  >
                    ✏️ 수정
                  </button>
                  {!role.isDefault && (
                    <button
                      className="delete-btn"
                      onClick={() => openDeleteModal(role)}
                    >
                      🗑️ 삭제
                    </button>
                  )}
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

      {/* 역할 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>➕ 새 역할 생성</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>역할 이름 (고유) *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="role_name (영문, 숫자, 밑줄만 가능)"
                />
              </div>
              <div className="form-group">
                <label>표시 이름</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="사용자에게 표시될 이름"
                />
              </div>
              <div className="form-group">
                <label>설명</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="역할에 대한 설명"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  활성 상태
                </label>
              </div>
              <div className="form-group permissions-group">
                <label>권한 설정</label>
                {availablePermissions && (
                  <div className="permissions-container">
                    {Object.entries(getPermissionsByCategory()).map(([module, resources]) => (
                      <div key={module} className="permission-category">
                        <h4>{module}</h4>
                        {Object.entries(resources).map(([resource, permissions]) => (
                          <div key={resource} className="permission-resource">
                            <h5>{resource}</h5>
                            <div className="permission-list">
                              {permissions.map(permission => (
                                <label key={permission.id} className="permission-item">
                                  <input
                                    type="checkbox"
                                    checked={formData.permissionIds?.includes(permission.id) || false}
                                    onChange={() => handlePermissionToggle(permission.id)}
                                  />
                                  <span className="permission-name">
                                    {permission.displayName} - {permission.description}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => setShowCreateModal(false)}
              >
                취소
              </button>
              <button 
                className="btn-confirm create-confirm" 
                onClick={handleCreateRole}
                disabled={!formData.name}
              >
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 역할 수정 모달 */}
      {showEditModal && selectedRole && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>✏️ 역할 수정</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>역할 이름</label>
                <input
                  type="text"
                  value={selectedRole.name}
                  disabled
                  className="disabled-input"
                />
                <small>역할 이름은 수정할 수 없습니다.</small>
              </div>
              <div className="form-group">
                <label>표시 이름</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="사용자에게 표시될 이름"
                />
              </div>
              <div className="form-group">
                <label>설명</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="역할에 대한 설명"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    disabled={selectedRole.isDefault}
                  />
                  활성 상태
                  {selectedRole.isDefault && <small> (시스템 역할은 비활성화할 수 없습니다)</small>}
                </label>
              </div>
              <div className="form-group permissions-group">
                <label>권한 설정</label>
                {availablePermissions && (
                  <div className="permissions-container">
                    {Object.entries(getPermissionsByCategory()).map(([module, resources]) => (
                      <div key={module} className="permission-category">
                        <h4>{module}</h4>
                        {Object.entries(resources).map(([resource, permissions]) => (
                          <div key={resource} className="permission-resource">
                            <h5>{resource}</h5>
                            <div className="permission-list">
                              {permissions.map(permission => (
                                <label key={permission.id} className="permission-item">
                                  <input
                                    type="checkbox"
                                    checked={formData.permissionIds?.includes(permission.id) || false}
                                    onChange={() => handlePermissionToggle(permission.id)}
                                  />
                                  <span className="permission-name">
                                    {permission.displayName} - {permission.description}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => setShowEditModal(false)}
              >
                취소
              </button>
              <button 
                className="btn-confirm edit-confirm" 
                onClick={handleEditRole}
              >
                수정하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 역할 삭제 모달 */}
      {showDeleteModal && selectedRole && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>🗑️ 역할 삭제</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowDeleteModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p><strong>{selectedRole.displayName}</strong> 역할을 정말 삭제하시겠습니까?</p>
              <p className="warning-text">⚠️ 이 작업은 되돌릴 수 없습니다.</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => setShowDeleteModal(false)}
              >
                취소
              </button>
              <button 
                className="btn-confirm delete-confirm" 
                onClick={handleDeleteRole}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;