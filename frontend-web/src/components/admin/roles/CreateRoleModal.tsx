import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Steps, Button, Descriptions, Spin, message } from 'antd';
import { useMutation } from 'react-query';
import {
  adminRoleService,
  CreateRoleRequest,
  GroupedPermissions,
} from '../../../api/adminRoleService';
import PermissionTree from './PermissionTree';
import './CreateRoleModal.css';

interface CreateRoleModalProps {
  groupedPermissions?: GroupedPermissions;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  groupedPermissions,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // 역할 생성 뮤테이션
  const createRoleMutation = useMutation({
    mutationFn: (data: CreateRoleRequest) => adminRoleService.createRole(data),
    onSuccess: () => {
      message.success('새 역할이 생성되었습니다.');
      onSuccess();
    },
    onError: (error: any) => {
      message.error(error.message || '역할 생성에 실패했습니다.');
    },
  });

  // 폼 제출 핸들러
  const handleSubmit = () => {
    form.validateFields().then((values) => {
      createRoleMutation.mutate({
        ...values,
        permissionIds: selectedPermissions,
      });
    });
  };

  // 다음 단계로
  const handleNext = async () => {
    if (currentStep === 0) {
      try {
        await form.validateFields();
        setCurrentStep(currentStep + 1);
      } catch (error) {
        // 폼 검증 실패
      }
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  // 이전 단계로
  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const steps = [
    {
      title: '기본 정보',
      content: (
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="역할 ID"
            rules={[
              { required: true, message: '역할 ID를 입력하세요' },
              { pattern: /^[a-z_]+$/, message: '소문자와 언더스코어만 사용 가능합니다' },
            ]}
            extra="영문 소문자와 언더스코어(_)만 사용 가능합니다"
          >
            <Input placeholder="예: content_manager" />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="표시 이름"
            rules={[{ required: true, message: '표시 이름을 입력하세요' }]}
          >
            <Input placeholder="예: 콘텐츠 관리자" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
          >
            <Input.TextArea
              rows={3}
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
              placeholder="50"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      title: '권한 설정',
      content: groupedPermissions ? (
        <div className="permission-selection">
          <div className="permission-selection-header">
            <h4>역할에 할당할 권한을 선택하세요</h4>
            <div className="selection-summary">
              선택된 권한: {selectedPermissions.length}개
            </div>
          </div>
          <PermissionTree
            groupedPermissions={groupedPermissions}
            selectedPermissions={selectedPermissions}
            onPermissionChange={setSelectedPermissions}
          />
        </div>
      ) : (
        <div className="loading-container">
          <Spin />
        </div>
      ),
    },
    {
      title: '확인',
      content: (
        <div className="role-summary">
          <h4>생성할 역할 정보를 확인하세요</h4>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="역할 ID">
              {form.getFieldValue('name')}
            </Descriptions.Item>
            <Descriptions.Item label="표시 이름">
              {form.getFieldValue('displayName')}
            </Descriptions.Item>
            <Descriptions.Item label="설명">
              {form.getFieldValue('description') || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="권한 레벨">
              {form.getFieldValue('level')}
            </Descriptions.Item>
            <Descriptions.Item label="할당된 권한">
              {selectedPermissions.length}개
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="새 역할 생성"
      open={true}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          취소
        </Button>,
        currentStep > 0 && (
          <Button
            key="prev"
            onClick={handlePrev}
          >
            이전
          </Button>
        ),
        currentStep < steps.length - 1 ? (
          <Button
            key="next"
            type="primary"
            onClick={handleNext}
          >
            다음
          </Button>
        ) : (
          <Button
            key="submit"
            type="primary"
            loading={createRoleMutation.isLoading}
            onClick={handleSubmit}
          >
            생성
          </Button>
        ),
      ]}
    >
      <Steps
        current={currentStep}
        items={steps.map(step => ({ title: step.title }))}
        style={{ marginBottom: 24 }}
      />

      <div className="step-content">
        {steps[currentStep].content}
      </div>
    </Modal>
  );
};

export default CreateRoleModal;