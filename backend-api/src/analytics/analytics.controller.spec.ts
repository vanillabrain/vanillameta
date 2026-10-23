import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LegacyOperationsGuard } from '../auth/guards/legacy-operations.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CreateEventDto } from './dto/create-event.dto';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockAnalyticsService = {
    collectEvents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LegacyOperationsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('collectEvents', () => {
    it('should collect events successfully', async () => {
      const createEventDto: CreateEventDto = {
        events: [
          {
            category: 'dashboard',
            action: 'dashboard_created',
            label: 'test-dashboard',
            value: 1,
            metadata: { dashboardId: '123' },
          },
        ],
      };

      const req = {
        user: { userId: 'user123', accessKeyData: { id: 7, userId: 'user123', authVersion: 3 } },
        ip: '127.0.0.1',
      };
      const correlationId = 'correlation-123';
      const userAgent = 'Mozilla/5.0';

      await controller.collectEvents(createEventDto, correlationId, userAgent, req);

      expect(service.collectEvents).toHaveBeenCalledWith(createEventDto.events, {
        userId: 'user123',
        correlationId,
        userAgent,
        ipAddress: '127.0.0.1',
      });
    });

    it('should collect events without user authentication', async () => {
      const createEventDto: CreateEventDto = {
        events: [
          {
            category: 'user',
            action: 'user_login',
          },
        ],
      };

      const req = { ip: '127.0.0.1' };
      const correlationId = 'correlation-123';
      const userAgent = 'Mozilla/5.0';

      await controller.collectEvents(createEventDto, correlationId, userAgent, req);

      expect(service.collectEvents).toHaveBeenCalledWith(createEventDto.events, {
        userId: null,
        correlationId,
        userAgent,
        ipAddress: '127.0.0.1',
      });
    });
  });

  describe('collectBatchEvents', () => {
    it('should collect batch events from authenticated user', async () => {
      const createEventDto: CreateEventDto = {
        events: [
          {
            category: 'performance',
            action: 'api_response_time',
            value: 150,
          },
          {
            category: 'error',
            action: 'api_error',
            label: 'Database connection error',
          },
        ],
      };

      const user = {
        userId: 'user123',
        accessKeyData: { id: 7, userId: 'user123', authVersion: 3 },
      };
      const correlationId = 'correlation-456';

      await controller.collectBatchEvents(createEventDto, user, correlationId);

      expect(service.collectEvents).toHaveBeenCalledWith(createEventDto.events, {
        userId: 'user123',
        correlationId,
        userAgent: 'Server-Side',
        ipAddress: 'Internal',
      });
    });
  });
});
