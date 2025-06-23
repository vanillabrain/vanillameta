import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudWatchIntegrationService } from './cloudwatch-integration.service';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { PerformanceAlert, PerformanceStats } from './performance-metrics.service';

// AWS SDK 모킹
jest.mock('@aws-sdk/client-cloudwatch');

describe('CloudWatchIntegrationService', () => {
  let service: CloudWatchIntegrationService;
  let configService: jest.Mocked<ConfigService>;
  let mockCloudWatchClient: jest.Mocked<CloudWatchClient>;

  beforeEach(async () => {
    // CloudWatchClient 모킹
    mockCloudWatchClient = {
      send: jest.fn().mockResolvedValue({}),
    } as any;

    (CloudWatchClient as jest.MockedClass<typeof CloudWatchClient>).mockImplementation(
      () => mockCloudWatchClient,
    );

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          AWS_REGION: 'ap-northeast-2',
          AWS_ACCESS_KEY_ID: 'test-access-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret-key',
          NODE_ENV: 'test',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudWatchIntegrationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CloudWatchIntegrationService>(CloudWatchIntegrationService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('초기화', () => {
    it('CloudWatch 클라이언트를 올바르게 초기화해야 함', () => {
      expect(CloudWatchClient).toHaveBeenCalledWith({
        region: 'ap-northeast-2',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('주기적으로 메트릭을 플러시해야 함', () => {
      jest.useFakeTimers({ legacyFakeTimers: true });
      const flushSpy = jest.spyOn(service as any, 'flushMetrics');
      
      service.onModuleInit();
      
      // 1분 후 플러시 확인
      jest.advanceTimersByTime(60000);
      
      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('putResponseTimeMetric', () => {
    it('응답 시간 메트릭을 버퍼에 추가해야 함', async () => {
      await service.putResponseTimeMetric('/api/dashboards/:id', 250, 200, 'GET');

      // 버퍼에 메트릭이 추가되었는지 확인
      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toMatchObject({
        MetricName: 'ResponseTime',
        Value: 250,
        Unit: 'Milliseconds',
        Dimensions: expect.arrayContaining([
          { Name: 'Endpoint', Value: '/api/dashboards/:id' },
          { Name: 'Method', Value: 'GET' },
          { Name: 'StatusCode', Value: '200' },
          { Name: 'Environment', Value: 'test' },
        ]),
      });
    });

    it('에러 응답에 대해 에러 카운트 메트릭도 추가해야 함', async () => {
      await service.putResponseTimeMetric('/api/users', 50, 500, 'POST');

      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(2);
      expect(buffer[1]).toMatchObject({
        MetricName: 'ErrorCount',
        Value: 1,
        Unit: 'Count',
      });
    });
  });

  describe('putActiveRequestsMetric', () => {
    it('활성 요청 수 메트릭을 버퍼에 추가해야 함', async () => {
      await service.putActiveRequestsMetric(10);

      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toMatchObject({
        MetricName: 'ActiveRequests',
        Value: 10,
        Unit: 'Count',
      });
    });
  });

  describe('putMemoryMetric', () => {
    it('메모리 메트릭을 MB 단위로 변환하여 추가해야 함', async () => {
      const heapUsed = 100 * 1024 * 1024; // 100MB
      const external = 20 * 1024 * 1024; // 20MB

      await service.putMemoryMetric(heapUsed, external);

      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(2);
      expect(buffer[0]).toMatchObject({
        MetricName: 'HeapUsedMemory',
        Value: 100,
        Unit: 'Megabytes',
      });
      expect(buffer[1]).toMatchObject({
        MetricName: 'ExternalMemory',
        Value: 20,
        Unit: 'Megabytes',
      });
    });
  });

  describe('putCPUMetric', () => {
    it('CPU 사용률 메트릭을 추가해야 함', async () => {
      await service.putCPUMetric(75.5);

      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toMatchObject({
        MetricName: 'CPUUtilization',
        Value: 75.5,
        Unit: 'Percent',
      });
    });
  });

  describe('putEndpointStats', () => {
    it('엔드포인트 통계 메트릭을 추가해야 함', async () => {
      const stats: PerformanceStats = {
        endpoint: '/api/dashboards/:id',
        count: 100,
        avgResponseTime: 250,
        minResponseTime: 50,
        maxResponseTime: 1000,
        p50ResponseTime: 200,
        p90ResponseTime: 450,
        p95ResponseTime: 600,
        p99ResponseTime: 900,
        errorRate: 0.02,
        successRate: 0.98,
        avgMemoryDelta: 1000000,
        avgCpuUsage: 15,
        lastUpdated: new Date(),
      };

      await service.putEndpointStats(stats);

      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(5);
      
      const metricNames = buffer.map((m: any) => m.MetricName);
      expect(metricNames).toContain('AverageResponseTime');
      expect(metricNames).toContain('P95ResponseTime');
      expect(metricNames).toContain('P99ResponseTime');
      expect(metricNames).toContain('ErrorRate');
      expect(metricNames).toContain('RequestCount');
    });
  });

  describe('handlePerformanceAlert', () => {
    it('성능 알림을 CloudWatch 메트릭으로 전송해야 함', async () => {
      const alert: PerformanceAlert = {
        type: 'slow_response',
        severity: 'critical',
        endpoint: '/api/dashboards/:id',
        message: 'Critical slow response',
        value: 3500,
        threshold: 3000,
        timestamp: new Date(),
      };

      await service.handlePerformanceAlert(alert);

      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toMatchObject({
        MetricName: 'PerformanceAlert',
        Value: 1,
        Unit: 'Count',
        Dimensions: expect.arrayContaining([
          { Name: 'AlertType', Value: 'slow_response' },
          { Name: 'Severity', Value: 'critical' },
          { Name: 'Endpoint', Value: '/api/dashboards/:id' },
        ]),
      });
    });

    it('critical 알림에 대해 즉시 플러시해야 함', async () => {
      const flushSpy = jest.spyOn(service as any, 'flushMetrics');
      
      const criticalAlert: PerformanceAlert = {
        type: 'high_error_rate',
        severity: 'critical',
        message: 'Critical error rate',
        value: 0.15,
        threshold: 0.1,
        timestamp: new Date(),
      };

      await service.handlePerformanceAlert(criticalAlert);

      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('버퍼 관리', () => {
    it('버퍼가 가득 차면 자동으로 플러시해야 함', async () => {
      const flushSpy = jest.spyOn(service as any, 'flushMetrics');
      
      // 버퍼 크기만큼 메트릭 추가 (BUFFER_SIZE = 20)
      for (let i = 0; i < 20; i++) {
        await service.putActiveRequestsMetric(i);
      }

      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('flushMetrics', () => {
    it('버퍼의 모든 메트릭을 CloudWatch로 전송해야 함', async () => {
      // 메트릭 추가
      await service.putResponseTimeMetric('/api/test', 100, 200, 'GET');
      await service.putActiveRequestsMetric(5);

      // 플러시 실행
      await (service as any).flushMetrics();

      expect(mockCloudWatchClient.send).toHaveBeenCalledWith(
        expect.any(PutMetricDataCommand),
      );

      const command = mockCloudWatchClient.send.mock.calls[0][0];
      expect(command.input).toMatchObject({
        Namespace: 'VanillaMeta/API',
        MetricData: expect.arrayContaining([
          expect.objectContaining({ MetricName: 'ResponseTime' }),
          expect.objectContaining({ MetricName: 'ActiveRequests' }),
        ]),
      });

      // 버퍼가 비워졌는지 확인
      expect((service as any).metricsBuffer).toHaveLength(0);
    });

    it('전송 실패 시 메트릭을 다시 버퍼에 추가해야 함', async () => {
      mockCloudWatchClient.send.mockRejectedValueOnce(new Error('Network error'));

      // 메트릭 추가
      await service.putResponseTimeMetric('/api/test', 100, 200, 'GET');

      // 플러시 실행
      await (service as any).flushMetrics();

      // 실패한 메트릭이 다시 버퍼에 있는지 확인
      expect((service as any).metricsBuffer.length).toBeGreaterThan(0);
    });

    it('빈 버퍼일 때는 아무 작업도 하지 않아야 함', async () => {
      await (service as any).flushMetrics();

      expect(mockCloudWatchClient.send).not.toHaveBeenCalled();
    });
  });

  describe('collectSystemMetrics', () => {
    it('시스템 메트릭을 수집하고 전송해야 함', async () => {
      const mockMemoryUsage = {
        rss: 200 * 1024 * 1024,
        heapTotal: 150 * 1024 * 1024,
        heapUsed: 100 * 1024 * 1024,
        external: 20 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      };

      const mockCpuUsage = {
        user: 500000,
        system: 200000,
      };

      jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);
      jest.spyOn(process, 'cpuUsage').mockReturnValue(mockCpuUsage);

      await service.collectSystemMetrics();

      const buffer = (service as any).metricsBuffer;
      expect(buffer).toHaveLength(3); // HeapUsed, External, CPU
      
      const metricNames = buffer.map((m: any) => m.MetricName);
      expect(metricNames).toContain('HeapUsedMemory');
      expect(metricNames).toContain('ExternalMemory');
      expect(metricNames).toContain('CPUUtilization');
    });
  });

  describe('getMetricDefinitions', () => {
    it('메트릭 정의 정보를 반환해야 함', () => {
      const definitions = service.getMetricDefinitions();

      expect(definitions).toHaveProperty('namespace', 'VanillaMeta/API');
      expect(definitions).toHaveProperty('metrics');
      expect(definitions).toHaveProperty('dashboards');
      
      expect(definitions.metrics).toBeInstanceOf(Array);
      expect(definitions.metrics.length).toBeGreaterThan(0);
      
      // 주요 메트릭 존재 확인
      const metricNames = definitions.metrics.map((m: any) => m.name);
      expect(metricNames).toContain('ResponseTime');
      expect(metricNames).toContain('ErrorCount');
      expect(metricNames).toContain('ActiveRequests');
      expect(metricNames).toContain('CPUUtilization');
    });
  });
});