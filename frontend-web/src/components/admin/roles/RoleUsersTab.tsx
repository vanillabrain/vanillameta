import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Table, Button, Input, Modal, Select, DatePicker, message, Tag, Space } from 'antd';
import { UserAddOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import moment from 'moment';
import {
  adminRoleService,
  UserBasic,
  AssignUsersToRoleRequest,
} from '../../../api/adminRoleService';
import { adminUsersService } from '../../../api/adminUsersService';
import './RoleUsersTab.css';

interface RoleUsersTabProps {
  roleId: string;
  roleName: string;
  onUserUpdate: () => void;
}

const RoleUsersTab: React.FC<RoleUsersTabProps> = ({
  roleId,
  roleName,
  onUserUpdate,
}) => {
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<moment.Moment | null>(null);
  const queryClient = useQueryClient();

  // 역할 사용자 조회
  const { data: roleUsers, isLoading } = useQuery({
    queryKey: ['role-users', roleId, page, searchText],
    queryFn: () => adminRoleService.getRoleUsers(roleId, {
      page,
      limit: 10,
      search: searchText,
    }),
    keepPreviousData: true,
  });

  // 전체 사용자 조회 (할당 모달용)
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-role'],
    queryFn: () => adminUsersService.getUsers({ limit: 100 }),
    enabled: showAssignModal,
  });

  // 사용자 역할 할당 뮤테이션
  const assignUsersMutation = useMutation({
    mutationFn: (data: AssignUsersToRoleRequest) => 
      adminRoleService.assignUsersToRole(roleId, data),
    onSuccess: () => {
      message.success('사용자가 역할에 할당되었습니다.');
      queryClient.invalidateQueries(['role-users', roleId]);
      setShowAssignModal(false);
      setSelectedUserIds([]);
      setExpiresAt(null);
      onUserUpdate();
    },
    onError: (error: any) => {
      message.error(error.message || '사용자 할당에 실패했습니다.');
    },
  });

  // 사용자 제거 뮤테이션
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => 
      adminRoleService.removeUserFromRole(roleId, userId),
    onSuccess: () => {
      message.success('사용자가 역할에서 제거되었습니다.');
      queryClient.invalidateQueries(['role-users', roleId]);
      onUserUpdate();
    },
    onError: (error: any) => {
      message.error(error.message || '사용자 제거에 실패했습니다.');
    },
  });

  // 사용자 제거 핸들러
  const handleRemoveUser = (user: UserBasic) => {
    Modal.confirm({
      title: '사용자 제거',
      content: `${user.name}님을 "${roleName}" 역할에서 제거하시겠습니까?`,
      okText: '제거',
      okType: 'danger',
      cancelText: '취소',
      onOk: () => removeUserMutation.mutate(user.id),
    });
  };

  // 사용자 할당 핸들러
  const handleAssignUsers = () => {
    if (selectedUserIds.length === 0) {
      message.warning('할당할 사용자를 선택하세요.');
      return;
    }

    const assignData: AssignUsersToRoleRequest = {
      userIds: selectedUserIds,
      ...(expiresAt && { expiresAt: expiresAt.toISOString() }),
    };

    assignUsersMutation.mutate(assignData);
  };

  // 현재 역할을 가지지 않은 사용자 필터링
  const availableUsers = allUsers?.data.filter(user => 
    !roleUsers?.data.some(roleUser => roleUser.id === user.id.toString())
  ) || [];

  const columns: ColumnsType<UserBasic> = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '작업',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveUser(record)}
        >
          제거
        </Button>
      ),
    },
  ];

  return (
    <div className="role-users-tab">
      <div className="tab-header">
        <div className="search-section">
          <Input
            placeholder="사용자 이름 또는 이메일로 검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => setShowAssignModal(true)}
        >
          사용자 할당
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={roleUsers?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 10,
          total: roleUsers?.meta.total || 0,
          onChange: (newPage) => setPage(newPage),
          showSizeChanger: false,
          showTotal: (total) => `총 ${total}명`,
        }}
      />

      {/* 사용자 할당 모달 */}
      <Modal
        title={`"${roleName}" 역할에 사용자 할당`}
        open={showAssignModal}
        onCancel={() => {
          setShowAssignModal(false);
          setSelectedUserIds([]);
          setExpiresAt(null);
        }}
        onOk={handleAssignUsers}
        okText="할당"
        cancelText="취소"
        confirmLoading={assignUsersMutation.isLoading}
        width={600}
      >
        <div className="assign-users-form">
          <div className="form-item">
            <label>사용자 선택</label>
            <Select
              mode="multiple"
              placeholder="할당할 사용자를 선택하세요"
              value={selectedUserIds}
              onChange={setSelectedUserIds}
              style={{ width: '100%' }}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={availableUsers.map(user => ({
                label: `${user.name} (${user.email})`,
                value: user.id.toString(),
              }))}
            />
          </div>

          <div className="form-item">
            <label>만료일 (선택사항)</label>
            <DatePicker
              showTime
              placeholder="임시 역할의 경우 만료일을 설정하세요"
              value={expiresAt}
              onChange={setExpiresAt}
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < moment().startOf('day')}
            />
            {expiresAt && (
              <div style={{ marginTop: 8 }}>
                <Tag color="orange">
                  {expiresAt.format('YYYY-MM-DD HH:mm')}에 만료
                </Tag>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoleUsersTab;