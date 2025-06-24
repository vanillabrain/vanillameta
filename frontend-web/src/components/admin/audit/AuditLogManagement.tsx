import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import {
  AuditLog,
  AuditLogFilters,
  ExportAuditLogsDto,
  AuditLogLevel,
  AuditLogCategory
} from '../../../types/audit';
import { AuditLogFilters as AuditLogFiltersComponent } from './AuditLogFilters';
import { AuditLogTable } from './AuditLogTable';
import { AuditLogDetailModal } from './AuditLogDetailModal';
import { ExportAuditLogsModal } from './ExportAuditLogsModal';
import { AuditLogStatsCards } from './AuditLogStatsCards';
import { DEFAULT_PAGE_SIZE, DEFAULT_DATE_RANGE_DAYS } from '../../../utils/constants/auditLogConstants';
import './AuditLogManagement.css';

export const AuditLogManagement: React.FC = () => {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    dateFrom: dayjs().subtract(DEFAULT_DATE_RANGE_DAYS, 'days').toDate(),
    dateTo: new Date(),
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  // 감사 로그 목록 조회
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditLogServiceV2.getAuditLogs(filters),
    keepPreviousData: true,
  });

  // 통계 조회
  const { data: stats } = useQuery({
    queryKey: ['audit-stats', filters.dateFrom, filters.dateTo],
    queryFn: () => auditLogServiceV2.getAuditLogStats({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
  });

  // 사용 가능한 액션 목록 조회
  const { data: availableActions } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () => auditLogServiceV2.getAvailableActions(),
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 사용 가능한 리소스 타입 목록 조회
  const { data: availableResourceTypes } = useQuery({
    queryKey: ['audit-resource-types'],
    queryFn: () => auditLogServiceV2.getAvailableResourceTypes(),
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 필터 변경 핸들러
  const handleFilterChange = (newFilters: Partial<AuditLogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  // 로그 클릭 핸들러
  const handleLogClick = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  // 내보내기 mutation
  const exportMutation = useMutation({
    mutationFn: (exportParams: ExportAuditLogsDto) =>
      auditLogServiceV2.exportAuditLogs(exportParams),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${dayjs().format('YYYY-MM-DD_HHmmss')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('감사 로그가 성공적으로 내보내졌습니다.');
    },
    onError: (error) => {
      console.error('Export failed:', error);
      message.error('감사 로그 내보내기에 실패했습니다.');
    },
  });

  // 페이지네이션 변경 핸들러
  const handlePaginationChange = (page: number, pageSize?: number) => {
    setFilters(prev => ({
      ...prev,
      page,
      limit: pageSize || prev.limit,
    }));
  };

  // 정렬 변경 핸들러
  const handleSortChange = (sortBy: string, sortOrder: 'ASC' | 'DESC') => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder,
    }));
  };

  return (
    <div className="audit-log-management">
      <div className="audit-header">
        <div className="audit-title">
          <h1>감사 로그</h1>
          <p className="audit-description">
            시스템에서 발생한 모든 활동을 추적하고 모니터링합니다.
          </p>
        </div>
        <div className="audit-actions">
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => setShowExportModal(true)}
            >
              내보내기
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              새로고침
            </Button>
          </Space>
        </div>
      </div>

      {stats && <AuditLogStatsCards stats={stats} />}

      <div className="audit-content">
        <AuditLogFiltersComponent
          filters={filters}
          onFilterChange={handleFilterChange}
          availableActions={availableActions}
          availableResourceTypes={availableResourceTypes}
        />

        <AuditLogTable
          logs={logs?.data || []}
          loading={isLoading}
          onLogClick={handleLogClick}
          onSortChange={handleSortChange}
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
        />

        {logs && logs.meta && (
          <div className="audit-pagination">
            <div className="pagination-info">
              총 {logs.meta.total.toLocaleString()}개의 로그 중{' '}
              {((filters.page! - 1) * filters.limit! + 1).toLocaleString()}-
              {Math.min(filters.page! * filters.limit!, logs.meta.total).toLocaleString()}개 표시
            </div>
            <antd.Pagination
              current={filters.page}
              total={logs.meta.total}
              pageSize={filters.limit}
              showSizeChanger
              pageSizeOptions={['10', '20', '50', '100']}
              onChange={handlePaginationChange}
              onShowSizeChange={handlePaginationChange}
              showQuickJumper
              showTotal={(total, range) =>
                `${range[0]}-${range[1]} / ${total}`
              }
            />
          </div>
        )}
      </div>

      {showDetailModal && selectedLog && (
        <AuditLogDetailModal
          log={selectedLog}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedLog(null);
          }}
        />
      )}

      {showExportModal && (
        <ExportAuditLogsModal
          initialFilters={filters}
          onClose={() => setShowExportModal(false)}
          onExport={(exportParams) => {
            exportMutation.mutate(exportParams);
            setShowExportModal(false);
          }}
          loading={exportMutation.isLoading}
        />
      )}
    </div>
  );
};