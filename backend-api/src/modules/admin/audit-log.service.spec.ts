import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { AuditLogService } from './audit-log.service';
import { AuditLog, AuditLogLevel, AuditLogCategory } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/audit-log.dto';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: Repository<AuditLog>;
  let mockRequest: any;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    mockRequest = {
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
        {
          provide: REQUEST,
          useValue: mockRequest,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('비동기로 감사 로그를 생성해야 함', async () => {
      const logData: CreateAuditLogDto = {
        action: 'USER_LOGIN',
        userId: '123',
        userEmail: 'test@example.com',
        details: { message: 'User logged in' },
      };

      await service.log(logData);

      // setImmediate를 실행하기 위해 대기
      await new Promise(resolve => setImmediate(resolve));

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_LOGIN',
          userId: '123',
          userEmail: 'test@example.com',
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
          level: AuditLogLevel.INFO,
          category: AuditLogCategory.GENERAL,
        }),
      );
    });
  });

  describe('createAuditLog', () => {
    it('동기적으로 감사 로그를 생성하고 저장해야 함', async () => {
      const logData: CreateAuditLogDto = {
        action: 'USER_CREATED',
        resourceType: 'User',
        resourceId: '456',
        userId: '123',
        userEmail: 'admin@example.com',
        details: { message: 'New user created' },
      };

      const mockAuditLog = { id: '1', ...logData };
      mockRepository.create.mockReturnValue(mockAuditLog);
      mockRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.createAuditLog(logData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...logData,
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
        }),
      );
      expect(mockRepository.save).toHaveBeenCalledWith(mockAuditLog);
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('getLogs', () => {
    it('필터링된 감사 로그 목록을 반환해야 함', async () => {
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            { 
              id: '1', 
              action: 'LOGIN_SUCCESS',
              userId: '123',
              userEmail: 'test@example.com',
              createdAt: new Date(),
            },
          ],
          1,
        ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });
  });

  describe('getLogStatistics', () => {
    it('감사 로그 통계를 반환해야 함', async () => {
      const dateRange = {
        from: new Date('2023-01-01'),
        to: new Date('2023-01-31'),
      };

      // Mock 메서드들
      jest.spyOn(service as any, 'getTotalLogsCount').mockResolvedValue(100);
      jest.spyOn(service as any, 'getLoginAttemptsCount').mockResolvedValue(50);
      jest.spyOn(service as any, 'getFailedLoginsCount').mockResolvedValue(5);
      jest.spyOn(service as any, 'getUserActionsCount').mockResolvedValue(80);
      jest.spyOn(service as any, 'getSystemActionsCount').mockResolvedValue(20);
      jest.spyOn(service as any, 'getCategoryStatistics').mockResolvedValue({
        authentication: 50,
        user_management: 30,
        general: 20,
      });
      jest.spyOn(service as any, 'getLevelStatistics').mockResolvedValue({
        info: 90,
        warn: 8,
        error: 2,
      });
      jest.spyOn(service as any, 'getHourlyStatistics').mockResolvedValue([
        { hour: 9, count: 20 },
        { hour: 14, count: 30 },
      ]);

      const result = await service.getLogStatistics(dateRange);

      expect(result.totalLogs).toBe(100);
      expect(result.loginAttempts).toBe(50);
      expect(result.failedLogins).toBe(5);
      expect(result.userActions).toBe(80);
      expect(result.systemActions).toBe(20);
      expect(result.categoryBreakdown).toHaveProperty('authentication', 50);
      expect(result.levelBreakdown).toHaveProperty('info', 90);
      expect(result.hourlyActivity).toHaveLength(2);
    });
  });

  describe('cleanupOldLogs', () => {
    it('오래된 로그를 삭제해야 함', async () => {
      const retentionDays = 30;
      mockRepository.delete.mockResolvedValue({ affected: 150 });

      const result = await service.cleanupOldLogs(retentionDays);

      expect(mockRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          isSensitive: false,
        }),
      );
      expect(result).toBe(150);
    });
  });

  describe('exportLogs', () => {
    it('CSV 형식으로 로그를 내보내야 함', async () => {
      const mockLogs = [
        {
          id: '1',
          action: 'LOGIN_SUCCESS',
          userName: 'Test User',
          userEmail: 'test@example.com',
          ipAddress: '192.168.1.1',
          resourceType: 'Auth',
          resourceId: null,
          level: AuditLogLevel.INFO,
          category: AuditLogCategory.AUTHENTICATION,
          details: { message: 'Login successful' },
          createdAt: new Date('2023-01-01T10:00:00Z'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.exportLogs({ format: 'csv' });

      expect(Buffer.isBuffer(result)).toBe(true);
      const csv = result.toString();
      expect(csv).toContain('Timestamp');
      expect(csv).toContain('Action');
      expect(csv).toContain('LOGIN_SUCCESS');
    });
  });
});