import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  DatePicker,
  Radio,
  InputNumber,
  Checkbox,
  Select,
  Button,
  Alert,
  Divider,
  Space,
  Spin,
  message,
} from 'antd';
import {
  FileExcelOutlined,
  FileTextOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMutation } from 'react-query';
import {
  AuditLogFilters,
  ExportAuditLogsDto,
  AuditLogLevel,
  AuditLogCategory,
} from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import { formatFileSize } from '../../../utils/auditLogHelpers';
import {
  MAX_EXPORT_RECORDS,
  EXPORT_FORMAT_OPTIONS,
} from '../../../utils/constants/auditLogConstants';
import './ExportAuditLogsModal.css';

const { RangePicker } = DatePicker;

interface ExportAuditLogsModalProps {
  initialFilters: AuditLogFilters;
  onClose: () => void;
  onExport: (params: ExportAuditLogsDto) => void;
  loading: boolean;
}

export const ExportAuditLogsModal: React.FC<ExportAuditLogsModalProps> = ({
  initialFilters,
  onClose,
  onExport,
  loading,
}) => {
  const [form] = Form.useForm();
  const [estimatedSize, setEstimatedSize] = useState<number>(0);
  const [recordCount, setRecordCount] = useState<number>(0);

  // 내보내기 미리보기
  const previewMutation = useMutation({
    mutationFn: (values: any) => {
      const exportParams: ExportAuditLogsDto = {
        dateFrom: values.dateRange?.[0]?.toDate(),
        dateTo: values.dateRange?.[1]?.toDate(),
        format: values.format,
        limit: values.limit,
        includeDetails: values.includeDetails,
        includeSensitive: values.includeSensitive,
        actions: values.actions,
        levels: values.levels,
        categories: values.categories,
        userId: values.userId,
        resourceType: values.resourceType,
        resourceId: values.resourceId,
      };
      return auditLogServiceV2.getExportPreview(exportParams);
    },
    onSuccess: (preview) => {
      setEstimatedSize(preview.estimatedSize);
      setRecordCount(preview.recordCount);
    },
    onError: (error) => {
      console.error('Preview failed:', error);
      message.error('미리보기를 불러오는데 실패했습니다.');
    },
  });

  // 초기값 설정
  useEffect(() => {
    const initialValues = {
      dateRange: [
        initialFilters.dateFrom ? dayjs(initialFilters.dateFrom) : dayjs().subtract(7, 'days'),
        initialFilters.dateTo ? dayjs(initialFilters.dateTo) : dayjs(),
      ],
      format: 'csv',
      limit: 10000,
      includeDetails: true,
      includeSensitive: false,
      actions: [],
      levels: [],
      categories: [],
    };
    form.setFieldsValue(initialValues);
    // 초기 미리보기 로드
    previewMutation.mutate(initialValues);
  }, []);

  // 폼 값 변경시 미리보기 업데이트
  const handleFormChange = () => {
    const values = form.getFieldsValue();
    previewMutation.mutate(values);
  };

  // 내보내기 실행
  const handleExport = async () => {
    try {
      const values = await form.validateFields();
      const exportParams: ExportAuditLogsDto = {
        dateFrom: values.dateRange?.[0]?.toDate(),
        dateTo: values.dateRange?.[1]?.toDate(),
        format: values.format,
        limit: values.limit,
        includeDetails: values.includeDetails,
        includeSensitive: values.includeSensitive,
        actions: values.actions,
        levels: values.levels,
        categories: values.categories,
        userId: values.userId,
        resourceType: values.resourceType,
        resourceId: values.resourceId,
      };
      onExport(exportParams);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <DownloadOutlined />
          <span>감사 로그 내보내기</span>
        </Space>
      }
      open={true}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          취소
        </Button>,
        <Button
          key="export"
          type="primary"
          onClick={handleExport}
          loading={loading}
          icon={<DownloadOutlined />}
          disabled={recordCount === 0}
        >
          내보내기
        </Button>,
      ]}
      className="export-audit-logs-modal"
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        className="export-form"
      >
        {/* 기본 설정 섹션 */}
        <div className="form-section">
          <h4>기본 설정</h4>
          
          <Form.Item
            name="dateRange"
            label="내보낼 기간"
            rules={[{ required: true, message: '기간을 선택하세요' }]}
          >
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder={['시작일', '종료일']}
            />
          </Form.Item>

          <Form.Item
            name="format"
            label="파일 형식"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              {EXPORT_FORMAT_OPTIONS.map(option => (
                <Radio key={option.value} value={option.value} disabled={option.disabled}>
                  <Space>
                    {option.icon === 'FileExcelOutlined' && <FileExcelOutlined />}
                    {option.icon === 'FileTextOutlined' && <FileTextOutlined />}
                    {option.label}
                  </Space>
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="limit"
            label="최대 레코드 수"
            extra={`최대 ${MAX_EXPORT_RECORDS.toLocaleString()}개까지 내보낼 수 있습니다`}
          >
            <InputNumber
              min={1}
              max={MAX_EXPORT_RECORDS}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>

          <Space>
            <Form.Item name="includeDetails" valuePropName="checked">
              <Checkbox>상세 정보 포함</Checkbox>
            </Form.Item>

            <Form.Item name="includeSensitive" valuePropName="checked">
              <Checkbox>민감한 정보 포함</Checkbox>
            </Form.Item>
          </Space>
        </div>

        <Divider />

        {/* 필터 옵션 섹션 */}
        <div className="form-section">
          <h4>필터 옵션</h4>
          
          <Form.Item name="levels" label="포함할 레벨">
            <Checkbox.Group>
              {Object.values(AuditLogLevel).map(level => (
                <Checkbox key={level} value={level}>
                  <span style={{ color: auditLogServiceV2.getLevelColor(level) }}>
                    {level.toUpperCase()}
                  </span>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>

          <Form.Item name="categories" label="포함할 카테고리">
            <Select
              mode="multiple"
              placeholder="모든 카테고리 포함"
              allowClear
              style={{ width: '100%' }}
            >
              {Object.values(AuditLogCategory).map(category => (
                <Select.Option key={category} value={category}>
                  {auditLogServiceV2.getCategoryDisplayName(category)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="actions" label="포함할 액션">
            <Select
              mode="tags"
              placeholder="모든 액션 포함 (액션명 입력)"
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="userId" label="특정 사용자">
            <Input placeholder="사용자 ID (선택사항)" />
          </Form.Item>

          <Form.Item name="resourceType" label="리소스 타입">
            <Input placeholder="리소스 타입 (선택사항)" />
          </Form.Item>

          <Form.Item name="resourceId" label="리소스 ID">
            <Input placeholder="리소스 ID (선택사항)" />
          </Form.Item>
        </div>
      </Form>

      {/* 미리보기 정보 */}
      <div className="preview-section">
        {previewMutation.isLoading ? (
          <div className="preview-loading">
            <Spin tip="미리보기 계산 중..." />
          </div>
        ) : (
          <>
            {recordCount > 0 ? (
              <Alert
                message="내보내기 미리보기"
                description={
                  <Space direction="vertical">
                    <div>예상 레코드 수: {recordCount.toLocaleString()}개</div>
                    <div>예상 파일 크기: {formatFileSize(estimatedSize)}</div>
                  </Space>
                }
                type="info"
                icon={<InfoCircleOutlined />}
              />
            ) : (
              <Alert
                message="내보낼 로그가 없습니다"
                description="선택한 조건에 해당하는 감사 로그가 없습니다."
                type="warning"
              />
            )}

            {recordCount > MAX_EXPORT_RECORDS && (
              <Alert
                message={`레코드 수 제한 초과`}
                description={`최대 ${MAX_EXPORT_RECORDS.toLocaleString()}개까지만 내보낼 수 있습니다. 기간을 줄이거나 필터를 추가해주세요.`}
                type="error"
                style={{ marginTop: 8 }}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
};