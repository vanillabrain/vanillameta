import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Eye,
  User,
  Bot,
  Info,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuditLog, AuditLogLevel, AuditLogCategory } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import {
  formatRelativeTime,
  formatSimpleDate,
  calculateLogImportance,
} from '../../../utils/auditLogHelpers';

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
  const handleSort = (field: string) => {
    if (onSortChange) {
      const newOrder = sortBy === field && sortOrder === 'ASC' ? 'DESC' : 'ASC';
      onSortChange(field, newOrder);
    }
  };

  // 중요도별 행 스타일
  const getRowClassName = (record: AuditLog) => {
    const importance = calculateLogImportance(record);
    return cn(
      "cursor-pointer hover:bg-muted/50 transition-colors",
      record.level === 'error' && "bg-red-50 hover:bg-red-100",
      record.level === 'warning' && "bg-yellow-50 hover:bg-yellow-100",
      importance === 'high' && "border-l-4 border-l-red-500",
      importance === 'medium' && "border-l-4 border-l-yellow-500"
    );
  };

  // 정렬 아이콘 렌더링
  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'ASC' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  // 개별 셀 렌더 함수들
  const renderTimestamp = (timestamp: string) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="space-y-1">
            <div className="text-sm">{formatRelativeTime(timestamp)}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(timestamp).toLocaleTimeString('ko-KR')}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatSimpleDate(timestamp)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderLevel = (level: AuditLogLevel) => (
    <Badge className={cn(
      'text-white',
      level === 'error' && 'bg-red-500',
      level === 'warning' && 'bg-yellow-500',
      level === 'info' && 'bg-blue-500',
      level === 'debug' && 'bg-gray-500'
    )}>
      {level.toUpperCase()}
    </Badge>
  );

  const renderAction = (action: string) => (
    <div className="space-y-1">
      <div className="font-medium text-sm">
        {auditLogServiceV2.getActionDisplayName(action)}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-xs">
              {action}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{action}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  const renderUser = (log: AuditLog) => (
    <div className="flex items-center space-x-2">
      {log.user ? (
        <>
          <Avatar className="h-8 w-8">
            <AvatarImage src={log.user.avatar} />
            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium">{log.userName || log.user.name}</div>
            <div className="text-xs text-muted-foreground">{log.userEmail || log.user.email}</div>
          </div>
        </>
      ) : log.userId ? (
        <>
          <Avatar className="h-8 w-8">
            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium">{log.userName || 'Unknown'}</div>
            <div className="text-xs text-muted-foreground">{log.userEmail || `ID: ${log.userId}`}</div>
          </div>
        </>
      ) : (
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <span className="text-sm">시스템</span>
        </div>
      )}
    </div>
  );

  const renderResource = (log: AuditLog) => (
    <div>
      {log.resourceType ? (
        <>
          <div className="text-sm font-medium">
            {auditLogServiceV2.getResourceTypeDisplayName(log.resourceType)}
          </div>
          {log.resourceId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="text-xs text-muted-foreground">#{log.resourceId}</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>ID: {log.resourceId}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
    </div>
  );

  const renderCategory = (category: AuditLogCategory) => (
    <Badge variant="outline">
      {auditLogServiceV2.getCategoryDisplayName(category)}
    </Badge>
  );

  const renderStatus = (status: string) => (
    <Badge className={cn(
      status === 'success' && 'bg-green-500 text-white',
      status === 'error' && 'bg-red-500 text-white',
      status === 'warning' && 'bg-yellow-500 text-white',
      status === 'pending' && 'bg-blue-500 text-white'
    )}>
      {auditLogServiceV2.getStatusDisplayName(status)}
    </Badge>
  );

  const renderIpAddress = (ip: string) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <code className="text-sm bg-muted px-1 py-0.5 rounded">
            {ip || '-'}
          </code>
        </TooltipTrigger>
        <TooltipContent>
          <p>{ip || '기록되지 않음'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderDetails = (details: string) => (
    details ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span className="text-sm truncate max-w-48 block">{details}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p>{details}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      <span className="text-muted-foreground">-</span>
    )
  );

  const renderActions = (log: AuditLog) => (
    <div className="flex items-center space-x-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLogClick(log)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>상세 보기</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-blue-500" />
            </TooltipTrigger>
            <TooltipContent>
              <p>메타데이터 있음</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        로그가 없습니다
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('createdAt')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                시간
                {renderSortIcon('createdAt')}
              </Button>
            </TableHead>
            <TableHead className="w-[80px]">레벨</TableHead>
            <TableHead className="w-[150px]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('action')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                액션
                {renderSortIcon('action')}
              </Button>
            </TableHead>
            <TableHead className="w-[180px]">사용자</TableHead>
            <TableHead className="w-[140px]">리소스</TableHead>
            <TableHead className="w-[100px]">카테고리</TableHead>
            <TableHead className="w-[80px]">상태</TableHead>
            <TableHead className="w-[120px]">IP 주소</TableHead>
            <TableHead>상세</TableHead>
            <TableHead className="w-[100px]">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow
              key={log.id}
              className={getRowClassName(log)}
              onClick={() => onLogClick(log)}
            >
              <TableCell>{renderTimestamp(log.createdAt)}</TableCell>
              <TableCell>{renderLevel(log.level)}</TableCell>
              <TableCell>{renderAction(log.action)}</TableCell>
              <TableCell>{renderUser(log)}</TableCell>
              <TableCell>{renderResource(log)}</TableCell>
              <TableCell>{renderCategory(log.category)}</TableCell>
              <TableCell>{renderStatus(log.status)}</TableCell>
              <TableCell>{renderIpAddress(log.ipAddress)}</TableCell>
              <TableCell>{renderDetails(log.details)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {renderActions(log)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};