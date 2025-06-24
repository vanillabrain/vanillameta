import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Tabs, Form, Input, InputNumber, Switch, Button, Tag, Statistic, Spin, Modal, message } from 'antd';
import { KeyOutlined, UserOutlined } from '@ant-design/icons';
import {
  adminRoleService,
  Role,
  RoleDetail,
  Permission,
  GroupedPermissions,
  UpdateRoleRequest,
  UpdateRolePermissionsRequest,
} from '../../../api/adminRoleService';
import PermissionTree from './PermissionTree';
import RoleUsersTab from './RoleUsersTab';
import './RoleDetailPanel.css';

interface RoleDetailPanelProps {
  role: Role;
  groupedPermissions?: GroupedPermissions;
  onRoleUpdate: () => void;
}

const RoleDetailPanel: React.FC<RoleDetailPanelProps> = ({
  role,
  groupedPermissions,
  onRoleUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<string>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 역할 상세 정보 조회
  const { data: roleDetail, isLoading } = useQuery({
    queryKey: ['role-detail', role.id],
    queryFn: () => adminRoleService.getRoleById(role.id),
    enabled: !!role.id,
  });

  // 역할 정보 업데이트 뮤테이션
  const updateRoleMutation = useMutation({
    mutationFn: (data: UpdateRoleRequest) => adminRoleService.updateRole(role.id, data),
    onSuccess: () => {
      message.success('역할 정보가 업데이트되었습니다.');
      setIsEditing(false);
      queryClient.invalidateQueries(['role-detail', role.id]);
      onRoleUpdate();
    },
    onError: (error: any) => {
      message.error(error.message || '역할 정보 업데이트에 실패했습니다.');
    },
  });

  // 권한 업데이트 뮤테이션
  const updatePermissionsMutation = useMutation({
    mutationFn: (permissionIds: string[]) =>
      adminRoleService.updateRolePermissions(role.id, { permissionIds }),
    onSuccess: () => {
      message.success('권한이 업데이트되었습니다.');
      queryClient.invalidateQueries(['role-detail', role.id]);
      onRoleUpdate();
    },
    onError: (error: any) => {
      message.error(error.message || '권한 업데이트에 실패했습니다.');
    },
  });

  // 폼 제출 핸들러
  const handleFormSubmit = (values: any) => {
    updateRoleMutation.mutate({
      displayName: values.displayName,
      description: values.description,
      level: values.level,
      isActive: values.isActive,
    });
  };

  // 권한 변경 핸들러
  const handlePermissionChange = (permissionIds: string[]) => {
    Modal.confirm({
      title: '권한 변경 확인',
      content: '이 역할의 권한을 변경하시겠습니까? 해당 역할을 가진 모든 사용자에게 즉시 적용됩니다.',
      okText: '변경',
      cancelText: '취소',
      onOk: () => updatePermissionsMutation.mutate(permissionIds),
    });
  };

  if (isLoading || !roleDetail) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'info',
      label: '기본 정보',
      children: (
        <div className="role-info-tab">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              displayName: roleDetail.displayName,
              description: roleDetail.description,
              level: roleDetail.level,
              isActive: roleDetail.isActive,
            }}
            onFinish={handleFormSubmit}
            disabled={!isEditing}
          >
            <Form.Item
              label="역할 ID"
            >
              <Input value={roleDetail.name} disabled />
            </Form.Item>

            <Form.Item
              name="displayName"
              label="표시 이름"
              rules={[{ required: true, message: '표시 이름을 입력하세요' }]}
            >
              <Input placeholder="역할 표시 이름" />
            </Form.Item>

            <Form.Item
              name="description"
              label="설명"
            >
              <Input.TextArea 
                rows={4} 
                placeholder="역할에 대한 설명을 입력하세요" 
              />
            </Form.Item>

            <Form.Item
              name="level"
              label="권한 레벨"
              rules={[{ required: true, message: '권한 레벨을 입력하세요' }]}
              extra="높을수록 상위 권한 (1-100)"
            >
              <InputNumber 
                min={1} 
                max={100} 
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="isActive"
              label="활성 상태"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            {roleDetail.isDefault && (
              <Form.Item>
                <Tag color="blue">기본 역할</Tag>
                <span style={{ marginLeft: 8, color: '#666' }}>
                  이 역할은 시스템 기본 역할이므로 일부 설정을 변경할 수 없습니다.
                </span>
              </Form.Item>
            )}

            {isEditing ? (
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={updateRoleMutation.isLoading}
                  style={{ marginRight: 8 }}
                >
                  저장
                </Button>
                <Button onClick={() => {
                  setIsEditing(false);
                  form.resetFields();
                }}>
                  취소
                </Button>
              </Form.Item>
            ) : (
              <Form.Item>
                <Button 
                  type="primary"
                  onClick={() => setIsEditing(true)}
                  disabled={roleDetail.name === 'super_admin'}
                >
                  수정
                </Button>
              </Form.Item>
            )}
          </Form>
        </div>
      ),
    },
    {
      key: 'permissions',
      label: '권한 설정',
      children: groupedPermissions ? (
        <div className="role-permissions-tab">
          <div className="permissions-header">
            <h4>역할에 할당된 권한을 설정합니다</h4>
            <p>권한 변경은 즉시 모든 사용자에게 적용됩니다.</p>
          </div>
          <PermissionTree
            groupedPermissions={groupedPermissions}
            selectedPermissions={roleDetail.permissions.map(p => p.id)}
            onPermissionChange={handlePermissionChange}
            loading={updatePermissionsMutation.isLoading}
            disabled={roleDetail.name === 'super_admin'}
          />
        </div>
      ) : (
        <Spin />
      ),
    },
    {
      key: 'users',
      label: `사용자 (${roleDetail.users?.length || 0})`,
      children: (
        <RoleUsersTab
          roleId={role.id}
          roleName={role.displayName}
          onUserUpdate={onRoleUpdate}
        />
      ),
    },
  ];

  return (
    <div className="role-detail-panel">
      <div className="role-header">
        <div className="role-basic-info">
          <h2>{roleDetail.displayName}</h2>
          <div className="role-badges">
            <Tag color={roleDetail.isActive ? 'green' : 'red'}>
              {roleDetail.isActive ? '활성' : '비활성'}
            </Tag>
            {roleDetail.isDefault && <Tag color="blue">기본 역할</Tag>}
          </div>
        </div>
        <div className="role-stats">
          <Statistic
            title="권한 수"
            value={roleDetail.permissions?.length || 0}
            prefix={<KeyOutlined />}
          />
          <Statistic
            title="사용자 수"
            value={roleDetail.users?.length || 0}
            prefix={<UserOutlined />}
          />
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="role-detail-tabs"
      />
    </div>
  );
};

export default RoleDetailPanel;