import React from 'react';
import { Modal, Form, Input, InputNumber, message } from 'antd';
import { useMutation } from 'react-query';
import {
  adminRoleService,
  Role,
  CloneRoleRequest,
} from '../../../api/adminRoleService';
import './CloneRoleModal.css';

interface CloneRoleModalProps {
  sourceRole: Role;
  onClose: () => void;
  onSuccess: () => void;
}

const CloneRoleModal: React.FC<CloneRoleModalProps> = ({
  sourceRole,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();

  // 역할 복사 뮤테이션
  const cloneRoleMutation = useMutation({
    mutationFn: (data: CloneRoleRequest) => adminRoleService.cloneRole(sourceRole.id, data),
    onSuccess: () => {
      message.success('역할이 복사되었습니다.');
      onSuccess();
    },
    onError: (error: any) => {
      message.error(error.message || '역할 복사에 실패했습니다.');
    },
  });

  // 폼 제출 핸들러
  const handleSubmit = () => {
    form.validateFields().then((values) => {
      cloneRoleMutation.mutate(values);
    });
  };

  return (
    <Modal
      title={`역할 복사: ${sourceRole.displayName}`}
      open={true}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="복사"
      cancelText="취소"
      confirmLoading={cloneRoleMutation.isLoading}
      width={600}
    >
      <div className="clone-role-info">
        <p>
          <strong>{sourceRole.displayName}</strong> 역할을 기반으로 새로운 역할을 생성합니다.
          <br />
          원본 역할의 모든 권한이 새 역할에 복사됩니다.
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          level: sourceRole.level - 1,
        }}
      >
        <Form.Item
          name="name"
          label="새 역할 ID"
          rules={[
            { required: true, message: '역할 ID를 입력하세요' },
            { pattern: /^[a-z_]+$/, message: '소문자와 언더스코어만 사용 가능합니다' },
            {
              validator: async (_, value) => {
                if (value === sourceRole.name) {
                  throw new Error('원본과 동일한 ID는 사용할 수 없습니다');
                }
              },
            },
          ]}
          extra="영문 소문자와 언더스코어(_)만 사용 가능합니다"
        >
          <Input placeholder="예: content_manager_copy" />
        </Form.Item>

        <Form.Item
          name="displayName"
          label="새 역할 표시 이름"
          rules={[{ required: true, message: '표시 이름을 입력하세요' }]}
        >
          <Input placeholder="예: 콘텐츠 관리자 (복사본)" />
        </Form.Item>

        <Form.Item
          name="description"
          label="설명"
        >
          <Input.TextArea
            rows={3}
            placeholder="새 역할에 대한 설명을 입력하세요"
            defaultValue={`${sourceRole.description} (복사본)`}
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
      </Form>
    </Modal>
  );
};

export default CloneRoleModal;