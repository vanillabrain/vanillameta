import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { AnalyticsEvent } from '../../analytics/entities/analytics-event.entity';
import { DashboardStatsDto, AuditLogSummaryDto } from './dto/dashboard-stats.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Dashboard)
    private readonly dashboardRepository: Repository<Dashboard>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsEventRepository: Repository<AnalyticsEvent>,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    try {
      const [
        totalUsers,
        pendingApprovals,
        todayLogins,
        activeSessions,
        totalDashboards,
        totalWidgets,
        recentLogs,
      ] = await Promise.all([
        this.getTotalUsersCount(),
        this.getPendingApprovalsCount(),
        this.getTodayLoginCount(),
        this.getActiveSessionCount(),
        this.getTotalDashboardsCount(),
        this.getTotalWidgetsCount(),
        this.getRecentAuditLogs(),
      ]);

      return {
        totalUsers,
        pendingApprovals,
        todayLogins,
        activeSessions,
        totalDashboards,
        totalWidgets,
        recentLogs,
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  private async getTotalUsersCount(): Promise<number> {
    try {
      return await this.userRepository.count();
    } catch (error) {
      console.error('Error getting total users count:', error);
      return 0;
    }
  }

  private async getPendingApprovalsCount(): Promise<number> {
    try {
      // 사용자 엔티티에 status나 deletedAt 필드가 없으므로 임시로 0 반환
      // 향후 승인 시스템 구현 시 적절한 필드로 수정 필요
      return 0;
    } catch (error) {
      console.error('Error getting pending approvals count:', error);
      return 0;
    }
  }

  private async getTodayLoginCount(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return await this.analyticsEventRepository.count({
        where: {
          action: 'login',
          createdAt: MoreThanOrEqual(today),
        },
      });
    } catch (error) {
      console.error('Error getting today login count:', error);
      return 0;
    }
  }

  private async getActiveSessionCount(): Promise<number> {
    try {
      // 임시로 총 사용자 수의 10%를 활성 세션으로 가정
      const totalUsers = await this.getTotalUsersCount();
      return Math.floor(totalUsers * 0.1);
    } catch (error) {
      console.error('Error getting active session count:', error);
      return 0;
    }
  }

  private async getTotalDashboardsCount(): Promise<number> {
    try {
      return await this.dashboardRepository.count();
    } catch (error) {
      console.error('Error getting total dashboards count:', error);
      return 0;
    }
  }

  private async getTotalWidgetsCount(): Promise<number> {
    try {
      return await this.widgetRepository.count();
    } catch (error) {
      console.error('Error getting total widgets count:', error);
      return 0;
    }
  }

  private async getRecentAuditLogs(): Promise<AuditLogSummaryDto[]> {
    try {
      const recentEvents = await this.analyticsEventRepository.find({
        order: { createdAt: 'DESC' },
        take: 5,
      });

      return recentEvents.map(event => ({
        id: event.id, // UUID 그대로 사용
        userEmail: event.userId ? `user_${event.userId}` : 'anonymous',
        action: event.action,
        createdAt: event.createdAt,
      }));
    } catch (error) {
      console.error('Error getting recent audit logs:', error);
      return [];
    }
  }
}