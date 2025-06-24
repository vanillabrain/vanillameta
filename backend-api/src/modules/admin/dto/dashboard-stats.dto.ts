import { ApiProperty } from '@nestjs/swagger';

export class AuditLogSummaryDto {
  @ApiProperty({ description: '감사 로그 ID' })
  id: string;

  @ApiProperty({ description: '사용자 이메일' })
  userEmail: string;

  @ApiProperty({ description: '수행 동작' })
  action: string;

  @ApiProperty({ description: '생성 시간' })
  createdAt: Date;
}

export class DashboardStatsDto {
  @ApiProperty({ description: '전체 사용자 수' })
  totalUsers: number;

  @ApiProperty({ description: '승인 대기 중인 사용자 수' })
  pendingApprovals: number;

  @ApiProperty({ description: '오늘 로그인 수' })
  todayLogins: number;

  @ApiProperty({ description: '활성 세션 수' })
  activeSessions: number;

  @ApiProperty({ description: '전체 대시보드 수' })
  totalDashboards: number;

  @ApiProperty({ description: '전체 위젯 수' })
  totalWidgets: number;

  @ApiProperty({ description: '최근 감사 로그', type: [AuditLogSummaryDto] })
  recentLogs: AuditLogSummaryDto[];
}