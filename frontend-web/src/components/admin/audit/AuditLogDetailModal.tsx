import React, { useState } from 'react';
import {
  Modal,
  Tabs,
  Descriptions,
  Tag,
  Avatar,
  Button,
  List,
  Empty,
  Tooltip,
  Space,
  message,
  Spin,
} from 'antd';
import {
  CopyOutlined,
  UserOutlined,
  RobotOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TagOutlined,
  FileTextOutlined,
  LinkOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import ReactJson from 'react-json-view';
import { AuditLog } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import {
  formatAbsoluteTime,
  formatRelativeTime,
  formatJson,
  compareChanges,
  parseUserAgent,
} from '../../../utils/auditLogHelpers';
import { LOG_DETAIL_TABS } from '../../../utils/constants/auditLogConstants';
import './AuditLogDetailModal.css';

interface AuditLogDetailModalProps {
  log: AuditLog;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  log,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');

  // 관련 로그 조회
  const { data: relatedLogs, isLoading: isLoadingRelated } = useQuery({
    queryKey: ['related-logs', log.id],
    queryFn: () => auditLogServiceV2.getRelatedLogs({
      userId: log.userId,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      timeRange: '1h',
      exclude: log.id,
    }),
    enabled: !!(log.userId || log.resourceId),
  });

  // 클립보드 복사
  const copyToClipboard = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${label || '내용'}이(가) 클립보드에 복사되었습니다`);
    } catch (error) {
      message.error('복사에 실패했습니다');
    }
  };

  // User Agent 파싱
  const userAgentInfo = log.userAgent ? parseUserAgent(log.userAgent) : null;

  // 변경사항 비교
  const changes = (log.oldValues && log.newValues) 
    ? compareChanges(log.oldValues, log.newValues)
    : null;

  // 탭 내용 렌더링
  const renderTabContent = (tabKey: string) => {
    switch (tabKey) {
      case 'overview':
        return (
          <div className="log-overview">
            <Descriptions column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }} bordered>
              <Descriptions.Item label="시간" span={2}>
                <div className="timestamp-detail">
                  <ClockCircleOutlined /> {formatAbsoluteTime(log.createdAt)}
                  <span className="relative-time">({formatRelativeTime(log.createdAt)})</span>
                </div>
              </Descriptions.Item>
              
              <Descriptions.Item label="액션">
                <div className="action-detail">
                  <Tag color="blue">{log.action}</Tag>
                  <div>{auditLogServiceV2.getActionDisplayName(log.action)}</div>
                </div>
              </Descriptions.Item>
              
              <Descriptions.Item label="레벨">
                <Tag color={auditLogServiceV2.getLevelColor(log.level)}>
                  {log.level.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="사용자">
                {log.user ? (
                  <div className="user-detail">
                    <Avatar src={log.user.avatar} icon={<UserOutlined />} />
                    <div className="user-info">
                      <div>{log.userName || log.user.name}</div>
                      <div className="user-email">{log.userEmail || log.user.email}</div>
                    </div>
                  </div>
                ) : log.userId ? (
                  <div className="user-detail">
                    <Avatar icon={<UserOutlined />} />
                    <div className="user-info">
                      <div>{log.userName || 'Unknown User'}</div>
                      <div className="user-email">{log.userEmail || `ID: ${log.userId}`}</div>
                    </div>
                  </div>
                ) : (
                  <Tag icon={<RobotOutlined />}>시스템</Tag>
                )}
              </Descriptions.Item>
              
              <Descriptions.Item label="IP 주소">
                <Space>
                  <EnvironmentOutlined />
                  <code>{log.ipAddress || '-'}</code>
                  {log.ipAddress && (
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(log.ipAddress!, 'IP 주소')}
                    />
                  )}
                </Space>
              </Descriptions.Item>
              
              <Descriptions.Item label="리소스">
                {log.resourceType ? (
                  <div className="resource-detail">
                    <TagOutlined />
                    <span>{auditLogServiceV2.getResourceTypeDisplayName(log.resourceType)}</span>
                    {log.resourceId && (
                      <code className="resource-id">#{log.resourceId}</code>
                    )}
                  </div>
                ) : (
                  <span>-</span>
                )}
              </Descriptions.Item>
              
              <Descriptions.Item label="카테고리">
                <Tag color={auditLogServiceV2.getCategoryColor(log.category)}>
                  {auditLogServiceV2.getCategoryDisplayName(log.category)}
                </Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="상태">
                <Tag color={auditLogServiceV2.getStatusColor(log.status)}>
                  {auditLogServiceV2.getStatusDisplayName(log.status)}
                </Tag>
              </Descriptions.Item>
              
              {log.details && (
                <Descriptions.Item label="상세 설명" span={2}>
                  <div className="detail-text">{log.details}</div>
                </Descriptions.Item>
              )}
              
              {userAgentInfo && (
                <Descriptions.Item label="클라이언트 정보" span={2}>
                  <Space>
                    <Tag>{userAgentInfo.browser}</Tag>
                    <Tag>{userAgentInfo.os}</Tag>
                    <Tag>{userAgentInfo.device}</Tag>
                  </Space>
                  {log.userAgent && (
                    <Tooltip title={log.userAgent}>
                      <Button size="small" icon={<FileTextOutlined />}>
                        전체 보기
                      </Button>
                    </Tooltip>
                  )}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        );

      case 'details':
        return (
          <div className="log-details">
            {changes && changes.length > 0 && (
              <div className="changes-section">
                <h4>변경사항</h4>
                <List
                  dataSource={changes}
                  renderItem={(change) => (
                    <List.Item className={change.isChanged ? 'changed' : ''}>
                      <List.Item.Meta
                        title={change.key}
                        description={
                          <div className="change-values">
                            <div className="old-value">
                              <span className="label">이전:</span>
                              <code>{JSON.stringify(change.oldValue)}</code>
                            </div>
                            <div className="new-value">
                              <span className="label">이후:</span>
                              <code>{JSON.stringify(change.newValue)}</code>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="metadata-section">
                <div className="section-header">
                  <h4>메타데이터</h4>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(JSON.stringify(log.metadata, null, 2), '메타데이터')}
                  >
                    복사
                  </Button>
                </div>
                <ReactJson
                  src={log.metadata}
                  theme="rjv-default"
                  collapsed={1}
                  displayDataTypes={false}
                  enableClipboard={true}
                />
              </div>
            )}

            {!changes && !log.metadata && (
              <Empty description="추가 상세 정보가 없습니다" />
            )}
          </div>
        );

      case 'related':
        return (
          <div className="related-logs">
            {isLoadingRelated ? (
              <div className="loading-container">
                <Spin tip="관련 로그를 불러오는 중..." />
              </div>
            ) : relatedLogs && relatedLogs.length > 0 ? (
              <List
                dataSource={relatedLogs}
                renderItem={(relatedLog) => (
                  <List.Item
                    className="related-log-item"
                    actions={[
                      <Button
                        type="link"
                        onClick={() => {
                          // 관련 로그 상세 보기
                          onClose();
                          // TODO: 새 모달 열기 로직
                        }}
                      >
                        상세 보기
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Tag color={auditLogServiceV2.getLevelColor(relatedLog.level)}>
                          {relatedLog.level}
                        </Tag>
                      }
                      title={
                        <div className="related-log-title">
                          <span>{auditLogServiceV2.getActionDisplayName(relatedLog.action)}</span>
                          <span className="timestamp">
                            {formatRelativeTime(relatedLog.createdAt)}
                          </span>
                        </div>
                      }
                      description={
                        <div className="related-log-description">
                          {relatedLog.resourceType && (
                            <span>
                              {auditLogServiceV2.getResourceTypeDisplayName(relatedLog.resourceType)}
                              {relatedLog.resourceId && `: ${relatedLog.resourceId}`}
                            </span>
                          )}
                          {relatedLog.details && (
                            <div className="details">{relatedLog.details}</div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="관련 로그가 없습니다" />
            )}
          </div>
        );

      case 'raw':
        return (
          <div className="raw-data">
            <div className="section-header">
              <h4>Raw 데이터</h4>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(JSON.stringify(log, null, 2), 'Raw 데이터')}
              >
                복사
              </Button>
            </div>
            <ReactJson
              src={log}
              theme="rjv-default"
              collapsed={1}
              displayDataTypes={false}
              enableClipboard={true}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <div className="log-modal-title">
          <span>감사 로그 상세</span>
          <Tag color={auditLogServiceV2.getLevelColor(log.level)}>
            {log.level.toUpperCase()}
          </Tag>
          <Tag color={auditLogServiceV2.getStatusColor(log.status)}>
            {auditLogServiceV2.getStatusDisplayName(log.status)}
          </Tag>
        </div>
      }
      open={true}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>,
      ]}
      className="audit-log-detail-modal"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={LOG_DETAIL_TABS.map(tab => ({
          key: tab.key,
          label: (
            <span>
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              {tab.label}
            </span>
          ),
          children: renderTabContent(tab.key),
        }))}
      />
    </Modal>
  );
};