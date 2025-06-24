import React from 'react';
import { Table, Tag, Avatar, Button, Tooltip, Space } from 'antd';
import { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  UserOutlined,
  RobotOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { AuditLog, AuditLogLevel, AuditLogCategory } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import {
  formatRelativeTime,
  formatSimpleDate,
  getActionIcon,
  calculateLogImportance,
} from '../../../utils/auditLogHelpers';
import { TABLE_COLUMN_WIDTHS } from '../../../utils/constants/auditLogConstants';
import './AuditLogTable.css';

interface AuditLogTableProps {
  logs: AuditLog[];
  loading: boolean;
  onLogClick: (log: AuditLog) => void;
  onSortChange?: (sortBy: string, sortOrder: 'ASC' | 'DESC') => void;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  logs,
  loading,
  onLogClick,
  onSortChange,
  sortBy,
  sortOrder,
}) => {
  // 정렬 핸들러
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && onSortChange) {
      const order = sorter.order === 'ascend' ? 'ASC' : 'DESC';
      onSortChange(sorter.field, order);
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnsType<AuditLog> = [
    {
      key: 'timestamp',
      title: '시간',
      dataIndex: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.timestamp,
      fixed: 'left',
      render: (timestamp: string) => (
        <div className="timestamp-cell">
          <Tooltip title={formatSimpleDate(timestamp)}>
            <div className="date">{formatRelativeTime(timestamp)}</div>
            <div className="time">{new Date(timestamp).toLocaleTimeString('ko-KR')}</div>
          </Tooltip>
        </div>
      ),
      sorter: true,
      sortOrder: sortBy === 'createdAt' ? (sortOrder === 'ASC' ? 'ascend' : 'descend') : undefined,
    },
    {
      key: 'level',
      title: '레벨',
      dataIndex: 'level',
      width: TABLE_COLUMN_WIDTHS.level,
      render: (level: AuditLogLevel) => (
        <Tag color={auditLogServiceV2.getLevelColor(level)} className="level-tag">
          {level.toUpperCase()}
        </Tag>
      ),
      filters: Object.values(AuditLogLevel).map(level => ({
        text: level.toUpperCase(),
        value: level,
      })),
    },
    {
      key: 'action',
      title: '액션',
      dataIndex: 'action',
      width: TABLE_COLUMN_WIDTHS.action,
      render: (action: string, record: AuditLog) => {
        const importance = calculateLogImportance(record);
        return (
          <div className={`action-cell importance-${importance}`}>
            <span className="action-name">
              {auditLogServiceV2.getActionDisplayName(action)}
            </span>
            <Tooltip title={action}>
              <Tag size="small" className="action-tag">
                {action}
              </Tag>
            </Tooltip>
          </div>
        );
      },
      sorter: true,
      sortOrder: sortBy === 'action' ? (sortOrder === 'ASC' ? 'ascend' : 'descend') : undefined,
    },
    {
      key: 'user',
      title: '사용자',
      width: TABLE_COLUMN_WIDTHS.user,
      render: (_, log: AuditLog) => (
        <div className="user-cell">
          {log.user ? (
            <>
              <Avatar 
                size="small" 
                src={log.user.avatar} 
                icon={<UserOutlined />}
              />
              <div className="user-info">
                <div className="user-name">{log.userName || log.user.name}</div>
                <div className="user-email">{log.userEmail || log.user.email}</div>
              </div>
            </>
          ) : log.userId ? (
            <>
              <Avatar size="small" icon={<UserOutlined />} />
              <div className="user-info">
                <div className="user-name">{log.userName || 'Unknown'}</div>
                <div className="user-email">{log.userEmail || `ID: ${log.userId}`}</div>
              </div>
            </>
          ) : (
            <div className="system-user">
              <Avatar size="small" icon={<RobotOutlined />} />
              <span>시스템</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'resource',
      title: '리소스',
      width: TABLE_COLUMN_WIDTHS.resource,
      render: (_, log: AuditLog) => (
        <div className="resource-cell">
          {log.resourceType ? (
            <>
              <div className="resource-type">
                {auditLogServiceV2.getResourceTypeDisplayName(log.resourceType)}
              </div>
              {log.resourceId && (
                <Tooltip title={`ID: ${log.resourceId}`}>
                  <div className="resource-id">#{log.resourceId}</div>
                </Tooltip>
              )}
            </>
          ) : (
            <span className="no-resource">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      title: '카테고리',
      dataIndex: 'category',
      width: TABLE_COLUMN_WIDTHS.category,
      render: (category: AuditLogCategory) => (
        <Tag color={auditLogServiceV2.getCategoryColor(category)}>
          {auditLogServiceV2.getCategoryDisplayName(category)}
        </Tag>
      ),
      filters: Object.values(AuditLogCategory).map(category => ({
        text: auditLogServiceV2.getCategoryDisplayName(category),
        value: category,
      })),
    },
    {
      key: 'status',
      title: '상태',
      dataIndex: 'status',
      width: TABLE_COLUMN_WIDTHS.status,
      render: (status: string) => {
        const color = auditLogServiceV2.getStatusColor(status);
        return (
          <Tag color={color} style={{ borderColor: color }}>
            {auditLogServiceV2.getStatusDisplayName(status)}
          </Tag>
        );
      },
      filters: [
        { text: '성공', value: 'success' },
        { text: '오류', value: 'error' },
        { text: '경고', value: 'warning' },
        { text: '대기중', value: 'pending' },
      ],
    },
    {
      key: 'ipAddress',
      title: 'IP 주소',
      dataIndex: 'ipAddress',
      width: TABLE_COLUMN_WIDTHS.ipAddress,
      render: (ip: string) => (
        <Tooltip title={ip || '기록되지 않음'}>
          <code className="ip-address">{ip || '-'}</code>
        </Tooltip>
      ),
    },
    {
      key: 'details',
      title: '상세',
      dataIndex: 'details',
      ellipsis: {
        showTitle: false,
      },
      render: (details: string) => (
        details ? (
          <Tooltip placement="topLeft" title={details}>
            <span className="details-preview">{details}</span>
          </Tooltip>
        ) : (
          <span className="no-details">-</span>
        )
      ),
    },
    {
      key: 'actions',
      title: '작업',
      width: TABLE_COLUMN_WIDTHS.actions,
      fixed: 'right',
      render: (_, log: AuditLog) => (
        <Space size="small">
          <Tooltip title="상세 보기">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onLogClick(log)}
            />
          </Tooltip>
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <Tooltip title="메타데이터 있음">
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 행 클래스 이름 설정
  const getRowClassName = (record: AuditLog) => {
    const importance = calculateLogImportance(record);
    const classes = [`audit-log-row`, `level-${record.level}`, `importance-${importance}`];
    
    if (record.status === 'error' || record.level === AuditLogLevel.ERROR) {
      classes.push('error-row');
    }
    
    return classes.join(' ');
  };

  return (
    <Table
      columns={columns}
      dataSource={logs}
      loading={loading}
      rowKey="id"
      size="middle"
      scroll={{ x: 1500 }}
      className="audit-log-table"
      rowClassName={getRowClassName}
      onChange={handleTableChange}
      pagination={false}
      sticky
      onRow={(record) => ({
        onClick: () => onLogClick(record),
        style: { cursor: 'pointer' },
      })}
    />
  );
};