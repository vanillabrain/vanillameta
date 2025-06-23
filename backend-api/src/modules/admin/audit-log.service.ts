import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { 
  CreateAuditLogDto, 
  GetAuditLogsQueryDto, 
  AuditLogResponseDto,
  AUDIT_ACTIONS 
} from './dto/audit-log.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * 감사 로그 생성
   */
  async createAuditLog(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        ...createAuditLogDto,
        status: createAuditLogDto.status || 'success',
      });

      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }

  /**
   * 감사 로그 목록 조회
   */
  async getAuditLogs(query: GetAuditLogsQueryDto) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        action,
        entityType,
        userId,
        status,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = query;

      const qb = this.auditLogRepository.createQueryBuilder('audit_log');

      // 검색 기능
      if (search) {
        qb.where('(audit_log.action LIKE :search OR audit_log.details LIKE :search OR audit_log.userEmail LIKE :search)', {
          search: `%${search}%`
        });
      }

      // 필터링
      if (action) {
        qb.andWhere('audit_log.action = :action', { action });
      }

      if (entityType) {
        qb.andWhere('audit_log.entityType = :entityType', { entityType });
      }

      if (userId) {
        qb.andWhere('audit_log.userId = :userId', { userId });
      }

      if (status) {
        qb.andWhere('audit_log.status = :status', { status });
      }

      // 날짜 범위 필터
      if (startDate && endDate) {
        qb.andWhere('audit_log.createdAt BETWEEN :startDate AND :endDate', {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        });
      } else if (startDate) {
        qb.andWhere('audit_log.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      } else if (endDate) {
        qb.andWhere('audit_log.createdAt <= :endDate', {
          endDate: new Date(endDate),
        });
      }

      // 정렬
      qb.orderBy(`audit_log.${sortBy}`, sortOrder);

      // 페이지네이션
      const offset = (page - 1) * limit;
      qb.skip(offset).take(limit);

      const [auditLogs, total] = await qb.getManyAndCount();

      return {
        data: auditLogs.map(log => this.mapToAuditLogResponseDto(log)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw error;
    }
  }

  /**
   * 특정 감사 로그 조회
   */
  async getAuditLogById(id: number): Promise<AuditLogResponseDto> {
    try {
      const auditLog = await this.auditLogRepository.findOne({
        where: { id }
      });

      if (!auditLog) {
        throw new Error('감사 로그를 찾을 수 없습니다.');
      }

      return this.mapToAuditLogResponseDto(auditLog);
    } catch (error) {
      console.error('Error getting audit log by id:', error);
      throw error;
    }
  }

  /**
   * 감사 로그 통계 조회
   */
  async getAuditLogStats() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const [
        totalLogs,
        todayLogs,
        weeklyLogs,
        monthlyLogs,
        errorLogs,
        successLogs,
        warningLogs
      ] = await Promise.all([
        this.auditLogRepository.count(),
        this.auditLogRepository.count({
          where: {
            createdAt: Between(new Date(today.toDateString()), new Date())
          }
        }),
        this.auditLogRepository.count({
          where: {
            createdAt: Between(lastWeek, new Date())
          }
        }),
        this.auditLogRepository.count({
          where: {
            createdAt: Between(lastMonth, new Date())
          }
        }),
        this.auditLogRepository.count({
          where: { status: 'error' }
        }),
        this.auditLogRepository.count({
          where: { status: 'success' }
        }),
        this.auditLogRepository.count({
          where: { status: 'warning' }
        })
      ]);

      return {
        totalLogs,
        todayLogs,
        weeklyLogs,
        monthlyLogs,
        statusBreakdown: {
          success: successLogs,
          error: errorLogs,
          warning: warningLogs,
        },
      };
    } catch (error) {
      console.error('Error getting audit log stats:', error);
      return {
        totalLogs: 0,
        todayLogs: 0,
        weeklyLogs: 0,
        monthlyLogs: 0,
        statusBreakdown: {
          success: 0,
          error: 0,
          warning: 0,
        },
      };
    }
  }

  /**
   * 사용자별 감사 로그 조회
   */
  async getUserAuditLogs(userId: string, limit: number = 50) {
    try {
      const auditLogs = await this.auditLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return auditLogs.map(log => this.mapToAuditLogResponseDto(log));
    } catch (error) {
      console.error('Error getting user audit logs:', error);
      throw error;
    }
  }

  /**
   * 감사 로그 생성 헬퍼 메서드들
   */
  async logUserAction(action: string, userId: string, userEmail: string, details?: string, metadata?: Record<string, any>) {
    return this.createAuditLog({
      action,
      entityType: 'user',
      entityId: userId,
      userId,
      userEmail,
      details,
      metadata,
    });
  }

  async logRoleAction(action: string, roleId: string, userId: string, userEmail: string, details?: string) {
    return this.createAuditLog({
      action,
      entityType: 'role',
      entityId: roleId,
      userId,
      userEmail,
      details,
    });
  }

  async logDashboardAction(action: string, dashboardId: string, userId: string, userEmail: string, details?: string) {
    return this.createAuditLog({
      action,
      entityType: 'dashboard',
      entityId: dashboardId,
      userId,
      userEmail,
      details,
    });
  }

  async logSystemAction(action: string, userId: string, userEmail: string, details?: string, metadata?: Record<string, any>) {
    return this.createAuditLog({
      action,
      entityType: 'system',
      userId,
      userEmail,
      details,
      metadata,
    });
  }

  /**
   * 사용 가능한 액션 목록 조회
   */
  async getAvailableActions() {
    return {
      actions: Object.entries(AUDIT_ACTIONS).map(([key, value]) => ({
        key,
        value,
        category: this.getCategoryFromAction(value),
      })),
      categories: {
        user: '사용자 관리',
        role: '역할 관리',
        dashboard: '대시보드 관리',
        widget: '위젯 관리',
        system: '시스템 관리',
        admin: '관리자 작업',
      }
    };
  }

  private getCategoryFromAction(action: string): string {
    if (action.startsWith('user_')) return 'user';
    if (action.startsWith('role_')) return 'role';
    if (action.startsWith('dashboard_')) return 'dashboard';
    if (action.startsWith('widget_')) return 'widget';
    if (action.startsWith('system_')) return 'system';
    if (action.startsWith('admin_')) return 'admin';
    return 'other';
  }

  private mapToAuditLogResponseDto(auditLog: AuditLog): AuditLogResponseDto {
    return {
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType || '',
      entityId: auditLog.entityId || '',
      userId: auditLog.userId || '',
      userEmail: auditLog.userEmail || '',
      details: auditLog.details || '',
      metadata: auditLog.metadata || {},
      ipAddress: auditLog.ipAddress || '',
      userAgent: auditLog.userAgent || '',
      status: auditLog.status,
      createdAt: auditLog.createdAt,
    };
  }
}