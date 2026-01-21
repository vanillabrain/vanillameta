import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In, LessThan } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuditLog, AuditLogLevel, AuditLogCategory } from './entities/audit-log.entity';
import { 
  CreateAuditLogDto, 
  GetAuditLogsQueryDto, 
  AuditLogResponseDto,
  AuditLogDetailDto,
  AuditLogStatsDto,
  ExportAuditLogsDto,
  GetAuditStatsQueryDto,
  AUDIT_ACTIONS 
} from './dto/audit-log.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @Inject(REQUEST)
    private request: Request,
  ) {}

  /**
   * 감사 로그 생성 (비동기)
   */
  async log(logData: CreateAuditLogDto): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        ...logData,
        ipAddress: logData.ipAddress || this.extractClientIp(),
        userAgent: logData.userAgent || this.request?.headers?.['user-agent'],
        level: logData.level || AuditLogLevel.INFO,
        category: logData.category || AuditLogCategory.GENERAL,
        isSystem: logData.isSystem || false,
        isSensitive: logData.isSensitive || false,
        createdAt: new Date(),
      });

      // 비동기로 저장하여 메인 로직에 영향 없음
      setImmediate(() => this.saveLog(auditLog));
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // 감사 로그 실패가 메인 로직에 영향을 주면 안됨
    }
  }

  /**
   * 감사 로그 저장 (동기)
   */
  async createAuditLog(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...createAuditLogDto,
      ipAddress: createAuditLogDto.ipAddress || this.extractClientIp(),
      userAgent: createAuditLogDto.userAgent || this.request?.headers?.['user-agent'],
      level: createAuditLogDto.level || AuditLogLevel.INFO,
      category: createAuditLogDto.category || AuditLogCategory.GENERAL,
      isSystem: createAuditLogDto.isSystem || false,
      isSensitive: createAuditLogDto.isSensitive || false,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  private async saveLog(auditLog: AuditLog): Promise<void> {
    try {
      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      console.error('Failed to save audit log:', error);
      // TODO: 실패한 로그를 다른 저장소나 큐에 보관
    }
  }

  /**
   * 감사 로그 목록 조회
   */
  async getLogs(query: GetAuditLogsQueryDto): Promise<PaginatedResponseDto<AuditLogResponseDto>> {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        action,
        userId,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = query;

      const qb = this.auditLogRepository
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.user', 'user');

      // 검색 기능
      if (search) {
        qb.where(
          '(log.action ILIKE :search OR log.userName ILIKE :search OR log.details::text ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 필터링
      if (action) {
        qb.andWhere('log.action = :action', { action });
      }

      if (query.resourceType) {
        qb.andWhere('log.resourceType = :resourceType', { resourceType: query.resourceType });
      }

      if (query.resourceId) {
        qb.andWhere('log.resourceId = :resourceId', { resourceId: query.resourceId });
      }

      if (userId) {
        qb.andWhere('log.userId = :userId', { userId });
      }

      if (query.category) {
        qb.andWhere('log.category = :category', { category: query.category });
      }

      if (query.level) {
        qb.andWhere('log.level = :level', { level: query.level });
      }

      if (query.ipAddress) {
        qb.andWhere('log.ipAddress = :ipAddress', { ipAddress: query.ipAddress });
      }

      // 날짜 범위 필터
      if (startDate) {
        qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(startDate) });
      }

      if (endDate) {
        qb.andWhere('log.createdAt <= :endDate', { endDate: new Date(endDate) });
      }

      // 정렬
      qb.orderBy(`log.${sortBy}`, sortOrder);

      // 페이지네이션
      const [logs, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        data: logs.map(log => this.mapToAuditLogResponseDto(log)),
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
  async getLogById(id: string): Promise<AuditLogDetailDto> {
    const log = await this.auditLogRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!log) {
      throw new NotFoundException('감사 로그를 찾을 수 없습니다');
    }

    return this.mapToAuditLogDetailDto(log);
  }

  /**
   * 감사 로그 통계 조회
   */
  async getLogStatistics(
    dateRange: { from: Date; to: Date },
  ): Promise<AuditLogStatsDto> {
    const [
      totalLogs,
      loginAttempts,
      failedLogins,
      userActions,
      systemActions,
      categoryStats,
      levelStats,
      hourlyStats,
    ] = await Promise.all([
      this.getTotalLogsCount(dateRange),
      this.getLoginAttemptsCount(dateRange),
      this.getFailedLoginsCount(dateRange),
      this.getUserActionsCount(dateRange),
      this.getSystemActionsCount(dateRange),
      this.getCategoryStatistics(dateRange),
      this.getLevelStatistics(dateRange),
      this.getHourlyStatistics(dateRange),
    ]);

    return {
      totalLogs,
      loginAttempts,
      failedLogins,
      userActions,
      systemActions,
      categoryBreakdown: categoryStats,
      levelBreakdown: levelStats,
      hourlyActivity: hourlyStats,
    };
  }

  /**
   * 감사 로그 내보내기
   */
  async exportLogs(query: ExportAuditLogsDto): Promise<Buffer> {
    const logs = await this.auditLogRepository.find({
      where: this.buildExportWhereCondition(query),
      order: { createdAt: 'DESC' },
      take: query.maxRecords || 10000,
      relations: ['user'],
    });

    if (query.format === 'json') {
      return Buffer.from(JSON.stringify(logs, null, 2), 'utf-8');
    }

    return this.generateCsvBuffer(logs);
  }

  /**
   * 오래된 로그 정리
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(cutoffDate),
      isSensitive: false, // 민감한 로그는 별도 처리
    });

    return result.affected || 0;
  }

  /**
   * 사용 가능한 액션 목록 조회
   */
  async getAvailableActions(): Promise<string[]> {
    return Object.values(AUDIT_ACTIONS);
  }

  /**
   * 사용 가능한 리소스 타입 조회
   */
  async getAvailableResourceTypes(): Promise<string[]> {
    const result = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.resourceType', 'resourceType')
      .where('log.resourceType IS NOT NULL')
      .getRawMany();

    return result.map(r => r.resourceType).filter(Boolean);
  }

  /**
   * Private Helper Methods
   */
  private extractClientIp(): string {
    if (!this.request) return 'unknown';
    
    const forwarded = this.request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.toString().split(',')[0].trim();
    }
    return this.request.socket?.remoteAddress || 'unknown';
  }

  private async getTotalLogsCount(dateRange: { from: Date; to: Date }): Promise<number> {
    return this.auditLogRepository.count({
      where: {
        createdAt: Between(dateRange.from, dateRange.to),
      },
    });
  }

  private async getLoginAttemptsCount(dateRange: { from: Date; to: Date }): Promise<number> {
    return this.auditLogRepository.count({
      where: {
        action: In(['LOGIN_SUCCESS', 'LOGIN_FAILED']),
        createdAt: Between(dateRange.from, dateRange.to),
      },
    });
  }

  private async getFailedLoginsCount(dateRange: { from: Date; to: Date }): Promise<number> {
    return this.auditLogRepository.count({
      where: {
        action: 'LOGIN_FAILED',
        createdAt: Between(dateRange.from, dateRange.to),
      },
    });
  }

  private async getUserActionsCount(dateRange: { from: Date; to: Date }): Promise<number> {
    return this.auditLogRepository.count({
      where: {
        isSystem: false,
        createdAt: Between(dateRange.from, dateRange.to),
      },
    });
  }

  private async getSystemActionsCount(dateRange: { from: Date; to: Date }): Promise<number> {
    return this.auditLogRepository.count({
      where: {
        isSystem: true,
        createdAt: Between(dateRange.from, dateRange.to),
      },
    });
  }

  private async getCategoryStatistics(dateRange: { from: Date; to: Date }): Promise<Record<string, number>> {
    const results = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt BETWEEN :from AND :to', { from: dateRange.from, to: dateRange.to })
      .groupBy('log.category')
      .getRawMany();

    return results.reduce((acc, { category, count }) => {
      acc[category] = parseInt(count);
      return acc;
    }, {});
  }

  private async getLevelStatistics(dateRange: { from: Date; to: Date }): Promise<Record<string, number>> {
    const results = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt BETWEEN :from AND :to', { from: dateRange.from, to: dateRange.to })
      .groupBy('log.level')
      .getRawMany();

    return results.reduce((acc, { level, count }) => {
      acc[level] = parseInt(count);
      return acc;
    }, {});
  }

  private async getHourlyStatistics(dateRange: { from: Date; to: Date }): Promise<Array<{ hour: number; count: number }>> {
    const results = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('EXTRACT(HOUR FROM log.createdAt)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt BETWEEN :from AND :to', { from: dateRange.from, to: dateRange.to })
      .groupBy('hour')
      .orderBy('hour')
      .getRawMany();

    return results.map(({ hour, count }) => ({
      hour: parseInt(hour),
      count: parseInt(count),
    }));
  }

  private buildExportWhereCondition(query: ExportAuditLogsDto): any {
    const where: any = {};

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.category) where.category = query.category;
    if (query.level) where.level = query.level;
    if (query.ipAddress) where.ipAddress = query.ipAddress;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt = { ...where.createdAt, $gte: new Date(query.startDate) };
      if (query.endDate) where.createdAt = { ...where.createdAt, $lte: new Date(query.endDate) };
    }

    return where;
  }

  private generateCsvBuffer(logs: AuditLog[]): Buffer {
    const csvData = [
      // CSV 헤더
      [
        'Timestamp',
        'Action',
        'User',
        'Email',
        'IP Address',
        'Resource Type',
        'Resource ID',
        'Level',
        'Category',
        'Details',
      ],
      // 데이터 행들
      ...logs.map(log => [
        log.createdAt.toISOString(),
        log.action,
        log.userName || 'System',
        log.userEmail || '',
        log.ipAddress || '',
        log.resourceType || '',
        log.resourceId || '',
        log.level,
        log.category,
        JSON.stringify(log.details),
      ]),
    ];

    const csvContent = csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    return Buffer.from(csvContent, 'utf-8');
  }

  private mapToAuditLogResponseDto(auditLog: AuditLog): AuditLogResponseDto {
    return {
      id: auditLog.id,
      action: auditLog.action,
      resourceType: auditLog.resourceType || '',
      resourceId: auditLog.resourceId || '',
      userId: auditLog.userId || '',
      userName: auditLog.userName || '',
      userEmail: auditLog.userEmail || '',
      details: auditLog.details || {},
      oldValues: auditLog.oldValues,
      newValues: auditLog.newValues,
      ipAddress: auditLog.ipAddress || '',
      userAgent: auditLog.userAgent || '',
      level: auditLog.level,
      category: auditLog.category,
      isSystem: auditLog.isSystem,
      isSensitive: auditLog.isSensitive,
      createdAt: auditLog.createdAt,
    };
  }

  private mapToAuditLogDetailDto(auditLog: AuditLog): AuditLogDetailDto {
    const dto = this.mapToAuditLogResponseDto(auditLog) as AuditLogDetailDto;
    
    if (auditLog.user) {
      dto.user = {
        id: auditLog.user.id.toString(),
        name: auditLog.user.name,
        email: auditLog.user.email,
      };
    }
    
    return dto;
  }
}