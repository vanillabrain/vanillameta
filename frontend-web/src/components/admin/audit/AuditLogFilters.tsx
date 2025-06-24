import React, { useState } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Collapse,
  Tag,
} from 'antd';
import {
  SearchOutlined,
  DownOutlined,
  UpOutlined,
  ClearOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { AuditLogFilters, AuditLogLevel, AuditLogCategory } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import { UserSelect } from '../users/UserSelect';
import { getDateRangePresets } from '../../../utils/auditLogHelpers';
import { QUICK_FILTER_PRESETS } from '../../../utils/constants/auditLogConstants';
import './AuditLogFilters.css';

const { RangePicker } = DatePicker;
const { Panel } = Collapse;

interface AuditLogFiltersProps {
  filters: AuditLogFilters;
  onFilterChange: (filters: Partial<AuditLogFilters>) => void;
  availableActions?: string[];
  availableResourceTypes?: string[];
}

export const AuditLogFilters: React.FC<AuditLogFiltersProps> = ({
  filters,
  onFilterChange,
  availableActions,
  availableResourceTypes,
}) => {
  const [form] = Form.useForm();
  const [isExpanded, setIsExpanded] = useState(false);

  // 날짜 범위 프리셋
  const dateRangePresets = getDateRangePresets();

  // 빠른 필터 적용
  const handleQuickFilter = (preset: typeof QUICK_FILTER_PRESETS[0]) => {
    onFilterChange(preset.filters);
    form.setFieldsValue(preset.filters);
  };

  // 날짜 범위 빠른 선택
  const handleQuickDateRange = (preset: string) => {
    const [from, to] = dateRangePresets[preset];
    onFilterChange({
      dateFrom: from.toDate(),
      dateTo: to.toDate(),
    });
    form.setFieldsValue({
      dateRange: [from, to],
    });
  };

  // 폼 값 변경 핸들러
  const handleFormChange = (changedValues: any, allValues: any) => {
    const newFilters: Partial<AuditLogFilters> = {};

    if (changedValues.dateRange) {
      newFilters.dateFrom = changedValues.dateRange[0]?.toDate();
      newFilters.dateTo = changedValues.dateRange[1]?.toDate();
    }

    if (changedValues.search !== undefined) {
      newFilters.search = changedValues.search;
    }

    if (changedValues.userId !== undefined) {
      newFilters.userId = changedValues.userId;
    }

    if (changedValues.action !== undefined) {
      newFilters.action = changedValues.action;
    }

    if (changedValues.resourceType !== undefined) {
      newFilters.resourceType = changedValues.resourceType;
    }

    if (changedValues.category !== undefined) {
      newFilters.category = changedValues.category;
    }

    if (changedValues.level !== undefined) {
      newFilters.level = changedValues.level;
    }

    if (changedValues.status !== undefined) {
      newFilters.status = changedValues.status;
    }

    onFilterChange(newFilters);
  };

  // 필터 초기화
  const clearFilters = () => {
    const defaultFilters: Partial<AuditLogFilters> = {
      search: undefined,
      userId: undefined,
      action: undefined,
      resourceType: undefined,
      category: undefined,
      level: undefined,
      status: undefined,
      dateFrom: dayjs().subtract(7, 'days').toDate(),
      dateTo: new Date(),
    };
    
    onFilterChange(defaultFilters);
    form.resetFields();
    form.setFieldsValue({
      dateRange: [dayjs().subtract(7, 'days'), dayjs()],
    });
  };

  // 활성화된 필터 개수 계산
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.userId) count++;
    if (filters.action) count++;
    if (filters.resourceType) count++;
    if (filters.category) count++;
    if (filters.level) count++;
    if (filters.status) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="audit-log-filters">
      {/* 빠른 필터 버튼 */}
      <div className="quick-filters">
        <Space wrap>
          <span className="quick-filter-label">빠른 필터:</span>
          {QUICK_FILTER_PRESETS.map((preset, index) => (
            <Button
              key={index}
              size="small"
              icon={<FilterOutlined />}
              onClick={() => handleQuickFilter(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* 날짜 범위 빠른 선택 */}
      <div className="date-range-presets">
        <Space wrap>
          <span className="date-preset-label">기간:</span>
          {Object.keys(dateRangePresets).map(preset => (
            <Button
              key={preset}
              size="small"
              type={
                filters.dateFrom &&
                filters.dateTo &&
                dayjs(filters.dateFrom).isSame(dateRangePresets[preset][0], 'day') &&
                dayjs(filters.dateTo).isSame(dateRangePresets[preset][1], 'day')
                  ? 'primary'
                  : 'default'
              }
              onClick={() => handleQuickDateRange(preset)}
            >
              {preset}
            </Button>
          ))}
        </Space>
      </div>

      {/* 기본 필터 */}
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        className="filter-form"
        initialValues={{
          dateRange: [dayjs(filters.dateFrom), dayjs(filters.dateTo)],
        }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item name="dateRange" label="기간">
              <RangePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                placeholder={['시작일', '종료일']}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item name="search" label="검색">
              <Input
                placeholder="액션, 사용자명, 상세 내용 검색"
                prefix={<SearchOutlined />}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item name="level" label="레벨">
              <Select
                placeholder="모든 레벨"
                allowClear
                style={{ width: '100%' }}
              >
                {Object.values(AuditLogLevel).map(level => (
                  <Select.Option key={level} value={level}>
                    <Tag color={auditLogServiceV2.getLevelColor(level)}>
                      {level.toUpperCase()}
                    </Tag>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item label="필터 옵션">
              <Space>
                <Button
                  type="link"
                  onClick={() => setIsExpanded(!isExpanded)}
                  icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                >
                  고급 필터 {activeFilterCount > 0 && `(${activeFilterCount})`}
                </Button>
                <Button
                  icon={<ClearOutlined />}
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                >
                  초기화
                </Button>
              </Space>
            </Form.Item>
          </Col>
        </Row>

        {/* 고급 필터 */}
        <Collapse activeKey={isExpanded ? ['advanced'] : []} ghost>
          <Panel header="" key="advanced" showArrow={false}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Form.Item name="userId" label="사용자">
                  <UserSelect
                    placeholder="사용자 선택"
                    allowClear
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Form.Item name="action" label="액션">
                  <Select
                    placeholder="액션 선택"
                    allowClear
                    showSearch
                    style={{ width: '100%' }}
                  >
                    {availableActions?.map(action => (
                      <Select.Option key={action} value={action}>
                        {auditLogServiceV2.getActionDisplayName(action)}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Form.Item name="resourceType" label="리소스 타입">
                  <Select
                    placeholder="리소스 타입 선택"
                    allowClear
                    style={{ width: '100%' }}
                  >
                    {availableResourceTypes?.map(type => (
                      <Select.Option key={type} value={type}>
                        {auditLogServiceV2.getResourceTypeDisplayName(type)}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Form.Item name="category" label="카테고리">
                  <Select
                    placeholder="카테고리 선택"
                    allowClear
                    style={{ width: '100%' }}
                  >
                    {Object.values(AuditLogCategory).map(category => (
                      <Select.Option key={category} value={category}>
                        <Tag color={auditLogServiceV2.getCategoryColor(category)}>
                          {auditLogServiceV2.getCategoryDisplayName(category)}
                        </Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Form.Item name="status" label="상태">
                  <Select
                    placeholder="상태 선택"
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="success">
                      <Tag color="success">성공</Tag>
                    </Select.Option>
                    <Select.Option value="error">
                      <Tag color="error">오류</Tag>
                    </Select.Option>
                    <Select.Option value="warning">
                      <Tag color="warning">경고</Tag>
                    </Select.Option>
                    <Select.Option value="pending">
                      <Tag color="processing">대기중</Tag>
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Form.Item name="resourceId" label="리소스 ID">
                  <Input
                    placeholder="리소스 ID 입력"
                    allowClear
                  />
                </Form.Item>
              </Col>
            </Row>
          </Panel>
        </Collapse>
      </Form>
    </div>
  );
};