import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { GetAuditLogsQueryDto, GetAuditStatsQueryDto, ExportAuditLogsDto } from './dto/audit-log.dto';
import { AuditLogLevel, AuditLogCategory } from './entities/audit-log.entity';
import { Response } from 'express';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: AuditLogService;

  const mockAuditLogService = {
    getLogs: jest.fn(),
    getLogById: jest.fn(),
    getLogStatistics: jest.fn(),
    exportLogs: jest.fn(),
    getAvailableActions: jest.fn(),
    getAvailableResourceTypes: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogs', () => {
    it('감사 로그 목록을 반환해야 함', async () => {
      const query: GetAuditLogsQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };

      const mockResponse = {
        data: [
          {
            id: '1',
            action: 'LOGIN_SUCCESS',
            resourceType: 'Auth',
            resourceId: '',
            userId: '123',
            userName: 'Test User',
            userEmail: 'test@example.com',
            details: {},
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent',
            level: AuditLogLevel.INFO,
            category: AuditLogCategory.AUTHENTICATION,
            isSystem: false,
            isSensitive: false,
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockAuditLogService.getLogs.mockResolvedValue(mockResponse);

      const result = await controller.getLogs(query);

      expect(service.getLogs).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getLogById', () => {
    it('특정 감사 로그 상세 정보를 반환해야 함', async () => {
      const logId = '123';
      const mockLog = {
        id: logId,
        action: 'USER_CREATED',
        resourceType: 'User',
        resourceId: '456',
        userId: '789',
        userName: 'Admin',
        userEmail: 'admin@example.com',
        details: { message: 'User created' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        level: AuditLogLevel.INFO,
        category: AuditLogCategory.USER_MANAGEMENT,
        isSystem: false,
        isSensitive: false,
        createdAt: new Date(),
        user: {
          id: '789',
          name: 'Admin',
          email: 'admin@example.com',
        },
      };

      mockAuditLogService.getLogById.mockResolvedValue(mockLog);

      const result = await controller.getLogById(logId);

      expect(service.getLogById).toHaveBeenCalledWith(logId);
      expect(result).toEqual(mockLog);
    });
  });

  describe('getStatistics', () => {
    it('감사 로그 통계를 반환해야 함', async () => {
      const query: GetAuditStatsQueryDto = {
        dateFrom: '2023-01-01',
        dateTo: '2023-01-31',
      };

      const mockStats = {
        totalLogs: 1000,
        loginAttempts: 250,
        failedLogins: 10,
        userActions: 800,
        systemActions: 200,
        categoryBreakdown: {
          authentication: 250,
          user_management: 300,
          role_management: 150,
          data_access: 200,
          system_config: 100,
        },
        levelBreakdown: {
          info: 900,
          warn: 80,
          error: 20,
        },
        hourlyActivity: [
          { hour: 9, count: 150 },
          { hour: 14, count: 200 },
          { hour: 17, count: 180 },
        ],
      };

      mockAuditLogService.getLogStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics(query);

      expect(service.getLogStatistics).toHaveBeenCalledWith({
        from: new Date(query.dateFrom),
        to: new Date(query.dateTo),
      });
      expect(result).toEqual(mockStats);
    });

    it('날짜가 제공되지 않으면 기본값을 사용해야 함', async () => {
      const query: GetAuditStatsQueryDto = {};

      await controller.getStatistics(query);

      expect(service.getLogStatistics).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(Date),
          to: expect.any(Date),
        }),
      );
    });
  });

  describe('exportLogs', () => {
    it('CSV 형식으로 로그를 내보내야 함', async () => {
      const query: ExportAuditLogsDto = {
        format: 'csv',
        maxRecords: 1000,
      };

      const mockCsvBuffer = Buffer.from('Timestamp,Action,User\n2023-01-01,LOGIN_SUCCESS,test@example.com');
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockAuditLogService.exportLogs.mockResolvedValue(mockCsvBuffer);

      await controller.exportLogs(query, mockResponse);

      expect(service.exportLogs).toHaveBeenCalledWith(query);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename=audit-logs-'),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockCsvBuffer);
    });

    it('JSON 형식으로 로그를 내보내야 함', async () => {
      const query: ExportAuditLogsDto = {
        format: 'json',
        maxRecords: 500,
      };

      const mockJsonBuffer = Buffer.from(JSON.stringify([{ id: '1', action: 'LOGIN_SUCCESS' }]));
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockAuditLogService.exportLogs.mockResolvedValue(mockJsonBuffer);

      await controller.exportLogs(query, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.json'),
      );
    });
  });

  describe('getAvailableActions', () => {
    it('사용 가능한 액션 목록을 반환해야 함', async () => {
      const mockActions = [
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DELETED',
      ];

      mockAuditLogService.getAvailableActions.mockResolvedValue(mockActions);

      const result = await controller.getAvailableActions();

      expect(service.getAvailableActions).toHaveBeenCalled();
      expect(result).toEqual(mockActions);
    });
  });

  describe('getAvailableResourceTypes', () => {
    it('사용 가능한 리소스 타입 목록을 반환해야 함', async () => {
      const mockResourceTypes = ['User', 'Role', 'Dashboard', 'Widget', 'DataSource'];

      mockAuditLogService.getAvailableResourceTypes.mockResolvedValue(mockResourceTypes);

      const result = await controller.getAvailableResourceTypes();

      expect(service.getAvailableResourceTypes).toHaveBeenCalled();
      expect(result).toEqual(mockResourceTypes);
    });
  });
});