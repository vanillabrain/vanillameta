import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, User, Bot, Clock, MapPin, Tag, FileText, Link, Code } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
import { cn } from '@/lib/utils';

interface AuditLogDetailModalProps {
  log: AuditLog;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({ log, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const { toast } = useToast();

  // 관련 로그 조회
  const { data: relatedLogs, isLoading: isLoadingRelated } = useQuery({
    queryKey: ['related-logs', log.id],
    queryFn: () =>
      auditLogServiceV2.getRelatedLogs({
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
      toast({
        description: `${label || '내용'}이(가) 클립보드에 복사되었습니다`,
      });
    } catch (error) {
      toast({
        description: '복사에 실패했습니다',
        variant: 'destructive',
      });
    }
  };

  // User Agent 파싱
  const userAgentInfo = log.userAgent ? parseUserAgent(log.userAgent) : null;

  // 변경사항 비교
  const changes = log.oldValues && log.newValues ? compareChanges(log.oldValues, log.newValues) : null;

  // 탭 내용 렌더링
  const renderTabContent = (tabKey: string) => {
    switch (tabKey) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
              <div className="col-span-2 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">시간</div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatAbsoluteTime(log.createdAt)}</span>
                  <span className="text-muted-foreground">({formatRelativeTime(log.createdAt)})</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">액션</div>
                <div className="flex flex-col gap-1">
                  <Badge variant="default">{log.action}</Badge>
                  <div className="text-sm">{auditLogServiceV2.getActionDisplayName(log.action)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">레벨</div>
                <Badge
                  className={cn(
                    'text-white',
                    log.level === 'error' && 'bg-red-500',
                    log.level === 'warning' && 'bg-yellow-500',
                    log.level === 'info' && 'bg-blue-500',
                    log.level === 'debug' && 'bg-gray-500',
                  )}
                >
                  {log.level.toUpperCase()}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">사용자</div>
                {log.user ? (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={log.user.avatar} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{log.userName || log.user.name}</div>
                      <div className="text-sm text-muted-foreground">{log.userEmail || log.user.email}</div>
                    </div>
                  </div>
                ) : log.userId ? (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{log.userName || 'Unknown User'}</div>
                      <div className="text-sm text-muted-foreground">{log.userEmail || `ID: ${log.userId}`}</div>
                    </div>
                  </div>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Bot className="h-3 w-3" />
                    시스템
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">IP 주소</div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <code className="text-sm">{log.ipAddress || '-'}</code>
                  {log.ipAddress && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => copyToClipboard(log.ipAddress!, 'IP 주소')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">리소스</div>
                {log.resourceType ? (
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span className="text-sm">{auditLogServiceV2.getResourceTypeDisplayName(log.resourceType)}</span>
                    {log.resourceId && <code className="text-sm text-muted-foreground">#{log.resourceId}</code>}
                  </div>
                ) : (
                  <span className="text-sm">-</span>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">카테고리</div>
                <Badge variant="outline">{auditLogServiceV2.getCategoryDisplayName(log.category)}</Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">상태</div>
                <Badge
                  className={cn(
                    log.status === 'success' && 'bg-green-500 text-white',
                    log.status === 'failed' && 'bg-red-500 text-white',
                    log.status === 'pending' && 'bg-yellow-500 text-white',
                  )}
                >
                  {auditLogServiceV2.getStatusDisplayName(log.status)}
                </Badge>
              </div>

              {log.details && (
                <div className="col-span-2 space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">상세 설명</div>
                  <div className="text-sm">{log.details}</div>
                </div>
              )}

              {userAgentInfo && (
                <div className="col-span-2 space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">클라이언트 정보</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{userAgentInfo.browser}</Badge>
                    <Badge variant="secondary">{userAgentInfo.os}</Badge>
                    <Badge variant="secondary">{userAgentInfo.device}</Badge>
                    {log.userAgent && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1">
                              <FileText className="h-3 w-3" />
                              전체 보기
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{log.userAgent}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-6">
            {changes && changes.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-4">변경사항</h4>
                <div className="space-y-3">
                  {changes.map((change, index) => (
                    <div
                      key={index}
                      className={cn('border rounded-lg p-4', change.isChanged && 'border-orange-500 bg-orange-50')}
                    >
                      <div className="font-medium mb-2">{change.key}</div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="text-sm text-muted-foreground min-w-[3rem]">이전:</span>
                          <code className="text-sm bg-muted px-2 py-1 rounded">{JSON.stringify(change.oldValue)}</code>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-sm text-muted-foreground min-w-[3rem]">이후:</span>
                          <code className="text-sm bg-muted px-2 py-1 rounded">{JSON.stringify(change.newValue)}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold">메타데이터</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify(log.metadata, null, 2), '메타데이터')}
                  >
                    <Copy className="h-3 w-3 mr-1" />
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
              <div className="text-center py-8 text-muted-foreground">추가 상세 정보가 없습니다</div>
            )}
          </div>
        );

      case 'related':
        return (
          <div>
            {isLoadingRelated ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">관련 로그를 불러오는 중...</span>
              </div>
            ) : relatedLogs && relatedLogs.length > 0 ? (
              <div className="space-y-3">
                {relatedLogs.map((relatedLog, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Badge
                          className={cn(
                            'text-white mt-1',
                            relatedLog.level === 'error' && 'bg-red-500',
                            relatedLog.level === 'warning' && 'bg-yellow-500',
                            relatedLog.level === 'info' && 'bg-blue-500',
                            relatedLog.level === 'debug' && 'bg-gray-500',
                          )}
                        >
                          {relatedLog.level}
                        </Badge>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{auditLogServiceV2.getActionDisplayName(relatedLog.action)}</span>
                            <span className="text-sm text-muted-foreground">{formatRelativeTime(relatedLog.createdAt)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {relatedLog.resourceType && (
                              <span>
                                {auditLogServiceV2.getResourceTypeDisplayName(relatedLog.resourceType)}
                                {relatedLog.resourceId && `: ${relatedLog.resourceId}`}
                              </span>
                            )}
                            {relatedLog.details && <div className="mt-1">{relatedLog.details}</div>}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          // 관련 로그 상세 보기
                          onClose();
                          // TODO: 새 모달 열기 로직
                        }}
                      >
                        상세 보기
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">관련 로그가 없습니다</div>
            )}
          </div>
        );

      case 'raw':
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Raw 데이터</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(JSON.stringify(log, null, 2), 'Raw 데이터')}
              >
                <Copy className="h-3 w-3 mr-1" />
                복사
              </Button>
            </div>
            <ReactJson src={log} theme="rjv-default" collapsed={1} displayDataTypes={false} enableClipboard={true} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>감사 로그 상세</span>
            <Badge
              className={cn(
                'text-white',
                log.level === 'error' && 'bg-red-500',
                log.level === 'warning' && 'bg-yellow-500',
                log.level === 'info' && 'bg-blue-500',
                log.level === 'debug' && 'bg-gray-500',
              )}
            >
              {log.level.toUpperCase()}
            </Badge>
            <Badge
              className={cn(
                log.status === 'success' && 'bg-green-500 text-white',
                log.status === 'failed' && 'bg-red-500 text-white',
                log.status === 'pending' && 'bg-yellow-500 text-white',
              )}
            >
              {auditLogServiceV2.getStatusDisplayName(log.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              {LOG_DETAIL_TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOG_DETAIL_TABS.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="mt-4">
                {renderTabContent(tab.key)}
              </TabsContent>
            ))}
          </Tabs>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
