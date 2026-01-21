import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsService } from './events.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { EventSession } from './entities/event-session.entity';
import { PerformanceMetric } from './entities/performance-metric.entity';
import { CustomLoggerService } from '../common/logger/logger.service';
import { TrackEventDto } from './dto/track-event.dto';
import { TrackMetricDto } from './dto/track-metric.dto';
import { AnalyticsQueryDto, TimeRange } from './dto/analytics-query.dto';

describe('EventsService', () => {
  let service: EventsService;
  let analyticsEventRepo: Repository<AnalyticsEvent>;
  let eventSessionRepo: Repository<EventSession>;
  let performanceMetricRepo: Repository<PerformanceMetric>;
  let logger: CustomLoggerService;
  let nestLogger: any;

  const mockAnalyticsEventRepository = {
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPerformanceMetricRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: mockAnalyticsEventRepository,
        },
        {
          provide: getRepositoryToken(EventSession),
          useValue: mockEventSessionRepository,
        },
        {
          provide: getRepositoryToken(PerformanceMetric),
          useValue: mockPerformanceMetricRepository,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    analyticsEventRepo = module.get<Repository<AnalyticsEvent>>(getRepositoryToken(AnalyticsEvent));
    eventSessionRepo = module.get<Repository<EventSession>>(getRepositoryToken(EventSession));
    performanceMetricRepo = module.get<Repository<PerformanceMetric>>(getRepositoryToken(PerformanceMetric));
    logger = module.get<CustomLoggerService>(CustomLoggerService);
    
    // NestJS Logger mock 설정
    nestLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
    (service as any).logger = nestLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackEvents', () => {
    it('이벤트를 성공적으로 저장해야 함', async () => {
      const trackEventDto: TrackEventDto = {
        events: [
          {
            action: 'dashboard_created',
            category: 'Dashboard',
            label: 'test-dashboard',
            properties: {
              dashboardId: 'dash-123',
              userId: 'user-123',
              sessionId: 'session-123',
              correlationId: 'corr-123',
            },
          },
        ],
        sessionInfo: {
          sessionId: 'session-123',
          startTime: Date.now(),
          lastActivityTime: Date.now(),
          pageViews: 1,
          eventCount: 1,
        },
      };

      const mockEventEntity = { id: 'event-123' };
      mockAnalyticsEventRepository.create.mockReturnValue(mockEventEntity);
      mockAnalyticsEventRepository.save.mockResolvedValue([mockEventEntity]);

      mockEventSessionRepository.findOne.mockResolvedValue(null);
      mockEventSessionRepository.create.mockReturnValue({ sessionId: 'session-123' });
      mockEventSessionRepository.save.mockResolvedValue({ sessionId: 'session-123' });

      await service.trackEvents(trackEventDto, '192.168.1.100', 'Mozilla/5.0');

      expect(mockAnalyticsEventRepository.create).toHaveBeenCalled();
      expect(mockAnalyticsEventRepository.save).toHaveBeenCalled();
      expect(nestLogger.log).toHaveBeenCalledWith('Tracked 1 events');
    });

    it('IP를 올바르게 익명화해야 함', async () => {
      const trackEventDto: TrackEventDto = {
        events: [{
          action: 'test',
          category: 'test',
          properties: {},
        }],
      };

      mockAnalyticsEventRepository.create.mockImplementation((data) => data);
      mockAnalyticsEventRepository.save.mockResolvedValue([]);

      await service.trackEvents(trackEventDto, '192.168.1.100', 'Mozilla/5.0');

      expect(mockAnalyticsEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          anonymizedIp: '192.168.1.0', // 마지막 옥텟이 0으로 변경됨
        }),
      );
    });

    it('에러 발생 시에도 프론트엔드에 영향을 주지 않아야 함', async () => {
      const trackEventDto: TrackEventDto = {
        events: [{ action: 'test', category: 'test' }],
      };

      mockAnalyticsEventRepository.create.mockImplementation(() => {
        throw new Error('Database error');
      });

      // 에러가 발생해도 예외가 throw되지 않아야 함
      await expect(
        service.trackEvents(trackEventDto, '192.168.1.1', 'Mozilla/5.0'),
      ).resolves.not.toThrow();

      expect(nestLogger.error).toHaveBeenCalled();
    });
  });

  describe('trackMetrics', () => {
    it('성능 메트릭을 성공적으로 저장해야 함', async () => {
      const trackMetricDto: TrackMetricDto = {
        metrics: [
          {
            name: 'page_load',
            value: 1234.56,
            category: 'performance',
            tags: { page: '/dashboard' },
          },
        ],
      };

      const mockMetricEntity = { id: 'metric-123' };
      mockPerformanceMetricRepository.create.mockReturnValue(mockMetricEntity);
      mockPerformanceMetricRepository.save.mockResolvedValue([mockMetricEntity]);

      await service.trackMetrics(trackMetricDto, 'Mozilla/5.0');

      expect(mockPerformanceMetricRepository.create).toHaveBeenCalled();
      expect(mockPerformanceMetricRepository.save).toHaveBeenCalled();
      expect(nestLogger.log).toHaveBeenCalledWith('Tracked 1 performance metrics');
    });
  });

  describe('getAnalyticsSummary', () => {
    it('분석 요약 데이터를 반환해야 함', async () => {
      const query: AnalyticsQueryDto = {
        timeRange: TimeRange.LAST_7_DAYS,
      };

      // Mock count
      mockAnalyticsEventRepository.count.mockResolvedValue(1000);
      mockEventSessionRepository.count.mockResolvedValue(200);

      // Mock query builders
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '50', avg: '300' }),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockAnalyticsEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockEventSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getAnalyticsSummary(query);

      expect(result).toHaveProperty('totalEvents', 1000);
      expect(result).toHaveProperty('uniqueUsers', 50);
      expect(result).toHaveProperty('totalSessions', 200);
      expect(result).toHaveProperty('avgSessionDuration', 300);
      expect(result).toHaveProperty('topEvents');
      expect(result).toHaveProperty('eventsByCategory');
      expect(result).toHaveProperty('dateRange');
    });
  });

  describe('getEvents', () => {
    it('이벤트 목록을 반환해야 함', async () => {
      const query: AnalyticsQueryDto = {
        timeRange: TimeRange.LAST_24_HOURS,
        category: 'Dashboard',
        limit: 10,
        offset: 0,
      };

      const mockEvents = [
        {
          id: 'event-1',
          action: 'dashboard_created',
          category: 'Dashboard',
          createdAt: new Date(),
        },
      ];

      mockAnalyticsEventRepository.findAndCount.mockResolvedValue([mockEvents, 1]);

      const result = await service.getEvents(query);

      expect(result).toHaveProperty('events', mockEvents);
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('limit', 10);
      expect(result).toHaveProperty('offset', 0);
    });
  });

  describe('IP 익명화', () => {
    it('IPv4 주소의 마지막 옥텟을 0으로 변경해야 함', () => {
      const service = new EventsService(
        mockAnalyticsEventRepository as any,
        mockEventSessionRepository as any,
        mockPerformanceMetricRepository as any,
        mockLogger as any,
      );

      // private 메서드를 테스트하기 위한 우회 방법
      const anonymizeIp = (service as any).anonymizeIp.bind(service);

      expect(anonymizeIp('192.168.1.100')).toBe('192.168.1.0');
      expect(anonymizeIp('10.0.0.1')).toBe('10.0.0.0');
    });

    it('IPv6 주소의 마지막 부분을 익명화해야 함', () => {
      const service = new EventsService(
        mockAnalyticsEventRepository as any,
        mockEventSessionRepository as any,
        mockPerformanceMetricRepository as any,
        mockLogger as any,
      );

      const anonymizeIp = (service as any).anonymizeIp.bind(service);

      expect(anonymizeIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
        '2001:0db8:85a3:0000:0000:8a2e:0370:0',
      );
    });
  });

  describe('PII 제거', () => {
    it('민감한 정보를 제거해야 함', () => {
      const service = new EventsService(
        mockAnalyticsEventRepository as any,
        mockEventSessionRepository as any,
        mockPerformanceMetricRepository as any,
        mockLogger as any,
      );

      const sanitizeProperties = (service as any).sanitizeProperties.bind(service);

      const properties = {
        dashboardId: 'dash-123',
        email: 'user@example.com',
        phone: '123-456-7890',
        name: 'John Doe',
        address: '123 Main St',
        ssn: '123-45-6789',
        creditCard: '1234-5678-9012-3456',
      };

      const sanitized = sanitizeProperties(properties);

      expect(sanitized).toHaveProperty('dashboardId', 'dash-123');
      expect(sanitized).not.toHaveProperty('email');
      expect(sanitized).not.toHaveProperty('phone');
      expect(sanitized).not.toHaveProperty('name');
      expect(sanitized).not.toHaveProperty('address');
      expect(sanitized).not.toHaveProperty('ssn');
      expect(sanitized).not.toHaveProperty('creditCard');
    });
  });
});