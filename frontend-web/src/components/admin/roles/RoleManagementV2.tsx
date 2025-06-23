import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Modal, Button, Input, Form, Tabs, Tag, Tree, Badge, Statistic, Descriptions, Steps, message, Spin, Empty } from 'antd';
import { PlusOutlined, UserOutlined, KeyOutlined, TeamOutlined } from '@ant-design/icons';
import { 
  adminRoleService,
  Role,
  RoleWithStats,
  RoleDetail,
  Permission,
  GroupedPermissions,
  CreateRoleRequest,
  CloneRoleRequest,
  RoleDeletionImpact,
} from '../../../api/adminRoleService';
import RoleDetailPanel from './RoleDetailPanel';
import CreateRoleModal from './CreateRoleModal';
import CloneRoleModal from './CloneRoleModal';
import './RoleManagementV2.css';

const RoleManagementV2: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState<Role | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    isActive: undefined as boolean | undefined,
  });
  
  const queryClient = useQueryClient();

  // 역할 목록 조회
  const { data: roles, isLoading, refetch } = useQuery({
    queryKey: ['admin-roles', filters],
    queryFn: () => adminRoleService.getRoles(filters),
    keepPreviousData: true,
  });

  // 그룹화된 권한 조회
  const { data: groupedPermissions } = useQuery({
    queryKey: ['grouped-permissions'],
    queryFn: () => adminRoleService.getGroupedPermissions(),
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 역할 삭제 뮤테이션
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => adminRoleService.deleteRole(roleId),
    onSuccess: () => {
      message.success('역할이 삭제되었습니다.');
      queryClient.invalidateQueries(['admin-roles']);
      setSelectedRole(null);
    },
    onError: (error: any) => {
      message.error(error.message || '역할 삭제에 실패했습니다.');
    },
  });

  // 역할 삭제 핸들러
  const handleDeleteRole = async (role: Role) => {
    try {
      const impact = await adminRoleService.getRoleDeletionImpact(role.id);
      
      if (!impact.canDelete) {
        Modal.warning({
          title: '역할 삭제 불가',
          content: (
            <div>
              <p>이 역할은 삭제할 수 없습니다:</p>
              <ul>
                {impact.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          ),
        });
        return;
      }

      Modal.confirm({
        title: '역할 삭제 확인',
        content: `"${role.displayName}" 역할을 삭제하시겠습니까?`,
        okText: '삭제',
        okType: 'danger',
        cancelText: '취소',
        onOk: () => deleteRoleMutation.mutate(role.id),
      });
    } catch (error) {
      message.error('삭제 영향도 분석 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="role-management-v2">
      <div className="role-management-header">
        <div className="header-content">
          <h1>역할 관리</h1>
          <p>시스템 내 역할과 권한을 직관적으로 관리합니다.</p>
        </div>
        <div className="header-actions">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowCreateModal(true)}
          >
            새 역할 생성
          </Button>
        </div>
      </div>

      <div className="role-management-content">
        <div className="role-list-panel">
          <div className="role-filters">
            <Input.Search
              placeholder="역할 이름 또는 설명으로 검색"
              allowClear
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ width: '100%', marginBottom: 16 }}
            />
          </div>
          
          {isLoading ? (
            <div className="loading-container">
              <Spin size="large" />
            </div>
          ) : (
            <div className="role-list">
              {roles?.map((role) => (
                <div
                  key={role.id}
                  className={`role-card ${selectedRole?.id === role.id ? 'selected' : ''}`}
                  onClick={() => setSelectedRole(role)}
                >
                  <div className="role-card-header">
                    <div className="role-info">
                      <h3>{role.displayName}</h3>
                      <p className="role-name">{role.name}</p>
                    </div>
                    <div className="role-tags">
                      <Tag color={role.isActive ? 'green' : 'red'}>
                        {role.isActive ? '활성' : '비활성'}
                      </Tag>
                      {role.isDefault && <Tag color="blue">기본 역할</Tag>}
                    </div>
                  </div>
                  
                  <div className="role-stats">
                    <div className="stat-item">
                      <UserOutlined />
                      <span>{role.userCount || 0}명</span>
                    </div>
                    <div className="stat-item">
                      <KeyOutlined />
                      <span>{role.permissionCount || 0}개</span>
                    </div>
                  </div>
                  
                  <div className="role-description">
                    {role.description || '설명 없음'}
                  </div>
                  
                  <div className="role-actions">
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCloneModal(role);
                      }}
                    >
                      복사
                    </Button>
                    {!role.isDefault && (
                      <Button
                        size="small"
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role);
                        }}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="role-detail-panel">
          {selectedRole ? (
            <RoleDetailPanel
              role={selectedRole}
              groupedPermissions={groupedPermissions}
              onRoleUpdate={() => queryClient.invalidateQueries(['admin-roles'])}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="왼쪽 목록에서 역할을 선택하세요"
            />
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateRoleModal
          groupedPermissions={groupedPermissions}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries(['admin-roles']);
          }}
        />
      )}

      {showCloneModal && (
        <CloneRoleModal
          sourceRole={showCloneModal}
          onClose={() => setShowCloneModal(null)}
          onSuccess={() => {
            setShowCloneModal(null);
            queryClient.invalidateQueries(['admin-roles']);
          }}
        />
      )}
    </div>
  );
};

export default RoleManagementV2;