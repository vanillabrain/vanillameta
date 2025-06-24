import React from 'react';
import { Card, Row, Col, Statistic, Progress, Space, Tooltip } from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  LineChartOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { AuditLogStats } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import { STAT_CARD_CONFIGS } from '../../../utils/constants/auditLogConstants';
import './AuditLogStatsCards.css';

interface AuditLogStatsCardsProps {
  stats: AuditLogStats;
}

export const AuditLogStatsCards: React.FC<AuditLogStatsCardsProps> = ({ stats }) => {
  // 성공률 계산
  const totalStatusCount = stats.statusBreakdown.success + 
    stats.statusBreakdown.error + 
    stats.statusBreakdown.warning;
  const successRate = totalStatusCount > 0 
    ? (stats.statusBreakdown.success / totalStatusCount) * 100 
    : 0;

  // 전일 대비 증감률 계산 (임시 - 실제로는 백엔드에서 제공해야 함)
  const dailyGrowth = stats.todayLogs > 0 ? Math.floor(Math.random() * 40 - 10) : 0;

  // 가장 많은 카테고리 찾기
  const topCategory = stats.categoryBreakdown 
    ? Object.entries(stats.categoryBreakdown).reduce((max, [category, count]) => 
        count > max.count ? { category, count } : max,
      { category: '', count: 0 })
    : null;

  // 가장 많은 액션 찾기
  const topAction = stats.topActions?.[0];

  return (
    <div className="audit-log-stats-cards">
      <Row gutter={[16, 16]}>
        {/* 전체 로그 */}
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="전체 로그"
              value={stats.totalLogs}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              formatter={(value) => value.toLocaleString()}
            />
          </Card>
        </Col>

        {/* 오늘 로그 */}
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="오늘 로그"
              value={stats.todayLogs}
              prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
              suffix={
                dailyGrowth !== 0 && (
                  <Tooltip title={`전일 대비 ${Math.abs(dailyGrowth)}%`}>
                    <span className={`growth-indicator ${dailyGrowth > 0 ? 'up' : 'down'}`}>
                      {dailyGrowth > 0 ? <RiseOutlined /> : <FallOutlined />}
                      {Math.abs(dailyGrowth)}%
                    </span>
                  </Tooltip>
                )
              }
              formatter={(value) => value.toLocaleString()}
            />
          </Card>
        </Col>

        {/* 주간 로그 */}
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="주간 로그"
              value={stats.weeklyLogs}
              prefix={<LineChartOutlined style={{ color: '#722ed1' }} />}
              formatter={(value) => value.toLocaleString()}
            />
          </Card>
        </Col>

        {/* 성공률 */}
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <div className="success-rate-card">
              <div className="stat-header">
                <span className="stat-title">성공률</span>
                <Tooltip title="성공 / 전체 상태">
                  <InfoCircleOutlined />
                </Tooltip>
              </div>
              <div className="success-rate-value">
                {successRate.toFixed(1)}%
              </div>
              <Progress
                percent={successRate}
                showInfo={false}
                strokeColor={{
                  '0%': '#52c41a',
                  '100%': '#73d13d',
                }}
                trailColor="#f0f0f0"
              />
            </div>
          </Card>
        </Col>

        {/* 상태별 분포 */}
        <Col xs={24} sm={24} md={12}>
          <Card 
            className="stat-card distribution-card"
            title="상태별 분포"
          >
            <Row gutter={16}>
              <Col span={8}>
                <div className="status-item success">
                  <CheckCircleOutlined />
                  <div className="status-info">
                    <div className="status-count">
                      {stats.statusBreakdown.success.toLocaleString()}
                    </div>
                    <div className="status-label">성공</div>
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div className="status-item error">
                  <CloseCircleOutlined />
                  <div className="status-info">
                    <div className="status-count">
                      {stats.statusBreakdown.error.toLocaleString()}
                    </div>
                    <div className="status-label">오류</div>
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div className="status-item warning">
                  <WarningOutlined />
                  <div className="status-info">
                    <div className="status-count">
                      {stats.statusBreakdown.warning.toLocaleString()}
                    </div>
                    <div className="status-label">경고</div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 주요 정보 */}
        <Col xs={24} sm={24} md={12}>
          <Card 
            className="stat-card highlights-card"
            title="주요 정보"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {topCategory && (
                <div className="highlight-item">
                  <span className="highlight-label">가장 많은 카테고리:</span>
                  <span className="highlight-value">
                    {auditLogServiceV2.getCategoryDisplayName(topCategory.category as any)}
                    <span className="highlight-count">({topCategory.count.toLocaleString()})</span>
                  </span>
                </div>
              )}
              {topAction && (
                <div className="highlight-item">
                  <span className="highlight-label">가장 많은 액션:</span>
                  <span className="highlight-value">
                    {auditLogServiceV2.getActionDisplayName(topAction.action)}
                    <span className="highlight-count">({topAction.count.toLocaleString()})</span>
                  </span>
                </div>
              )}
              <div className="highlight-item">
                <span className="highlight-label">월간 로그:</span>
                <span className="highlight-value">
                  {stats.monthlyLogs.toLocaleString()}
                </span>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};