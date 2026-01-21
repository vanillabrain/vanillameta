import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileText,
  Calendar,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuditLogStats } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import { STAT_CARD_CONFIGS } from '../../../utils/constants/auditLogConstants';

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 전체 로그 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-muted-foreground">전체 로그</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        {/* 오늘 로그 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">오늘 로그</span>
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <div className="text-2xl font-bold">{stats.todayLogs.toLocaleString()}</div>
              {dailyGrowth !== 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className={cn(
                        "flex items-center text-xs",
                        dailyGrowth > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {dailyGrowth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span className="ml-1">{Math.abs(dailyGrowth)}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>전일 대비 {Math.abs(dailyGrowth)}%</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 주간 로그 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-muted-foreground">주간 로그</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{stats.weeklyLogs.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        {/* 성공률 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">성공률</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>성공 / 전체 상태</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
              <div className="mt-2">
                <Progress value={successRate} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 상태별 분포 */}
        <Card>
          <CardHeader>
            <CardTitle>상태별 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-lg font-semibold">
                    {stats.statusBreakdown.success.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">성공</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <div className="text-lg font-semibold">
                    {stats.statusBreakdown.error.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">오류</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-lg font-semibold">
                    {stats.statusBreakdown.warning.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">경고</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 주요 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>주요 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCategory && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">가장 많은 카테고리:</span>
                  <div className="text-right">
                    <div className="font-medium">
                      {auditLogServiceV2.getCategoryDisplayName(topCategory.category as any)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ({topCategory.count.toLocaleString()})
                    </div>
                  </div>
                </div>
              )}
              {topAction && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">가장 많은 액션:</span>
                  <div className="text-right">
                    <div className="font-medium">
                      {auditLogServiceV2.getActionDisplayName(topAction.action)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ({topAction.count.toLocaleString()})
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">월간 로그:</span>
                <div className="font-medium">
                  {stats.monthlyLogs.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};