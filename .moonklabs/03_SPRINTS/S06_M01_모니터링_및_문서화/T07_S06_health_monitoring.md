# T07_S06: 헬스체크 및 상태 모니터링

## 태스크 개요
- **ID**: T07_S06
- **제목**: 종합적인 헬스체크 엔드포인트 및 상태 모니터링 시스템 구축
- **우선순위**: Medium
- **예상 소요 시간**: 2일
- **담당**: 백엔드 개발자, DevOps 엔지니어

## 목표
시스템의 각 구성 요소 상태를 실시간으로 모니터링하고, 외부 모니터링 서비스와 통합 가능한 표준화된 헬스체크 엔드포인트를 구현합니다.

## 구현 범위

### 1. 헬스체크 엔드포인트 구조
```yaml
HealthCheckEndpoints:
  /health:
    description: "기본 헬스체크 - 서비스 가용성만 확인"
    response_time: "< 100ms"
    checks:
      - api_gateway
      - lambda_runtime
  
  /health/detailed:
    description: "상세 헬스체크 - 모든 의존성 확인"
    response_time: "< 3s"
    checks:
      - database_connectivity
      - cache_availability
      - storage_access
      - external_apis
  
  /health/dependencies:
    description: "외부 의존성 상태"
    checks:
      - database_services
      - third_party_apis
      - aws_services
  
  /health/metrics:
    description: "시스템 메트릭 정보"
    data:
      - response_times
      - error_rates
      - throughput
      - resource_usage
```

### 2. 헬스체크 구현
```typescript
// backend-api/src/health/health.controller.ts
import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { StorageHealthIndicator } from './indicators/storage.health';
import { CacheHealthIndicator } from './indicators/cache.health';
import { CustomHealthIndicator } from './indicators/custom.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: DatabaseHealthIndicator,
    private storage: StorageHealthIndicator,
    private cache: CacheHealthIndicator,
    private custom: CustomHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: '기본 헬스체크' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '서비스가 정상 작동 중',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00Z' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'production' },
      },
    },
  })
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('detailed')
  @ApiOperation({ summary: '상세 헬스체크' })
  @HealthCheck()
  async checkDetailed(): Promise<HealthCheckResult> {
    return this.health.check([
      // 데이터베이스 체크
      () => this.db.checkPrimaryDatabase('primary-db'),
      () => this.db.checkReadReplica('read-replica'),
      
      // 캐시 체크
      () => this.cache.checkRedis('redis-cache'),
      
      // 스토리지 체크
      () => this.storage.checkS3Access('s3-storage'),
      
      // 커스텀 체크
      () => this.custom.checkLambdaMemory('lambda-memory'),
      () => this.custom.checkAPIGatewayLatency('api-latency'),
    ]);
  }

  @Get('dependencies')
  @ApiOperation({ summary: '외부 의존성 상태' })
  async checkDependencies() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkAWSServices(),
      this.checkExternalAPIs(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      dependencies: {
        database: this.formatCheckResult(checks[0]),
        aws: this.formatCheckResult(checks[1]),
        external: this.formatCheckResult(checks[2]),
      },
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: '시스템 메트릭' })
  async getMetrics() {
    const [performance, resources, business] = await Promise.all([
      this.custom.getPerformanceMetrics(),
      this.custom.getResourceMetrics(),
      this.custom.getBusinessMetrics(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      metrics: {
        performance,
        resources,
        business,
      },
    };
  }

  private formatCheckResult(result: PromiseSettledResult<any>) {
    if (result.status === 'fulfilled') {
      return {
        status: 'healthy',
        ...result.value,
      };
    } else {
      return {
        status: 'unhealthy',
        error: result.reason.message,
      };
    }
  }
}
```

### 3. 헬스 인디케이터 구현
```typescript
// backend-api/src/health/indicators/database.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { Connection } from 'typeorm';
import { InjectConnection } from '@nestjs/typeorm';
import { PrometheusService } from '../../monitoring/prometheus.service';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(
    @InjectConnection() private connection: Connection,
    private prometheusService: PrometheusService,
  ) {
    super();
  }

  async checkPrimaryDatabase(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      // 연결 상태 확인
      const isConnected = this.connection.isConnected;
      if (!isConnected) {
        throw new Error('Database connection lost');
      }

      // 간단한 쿼리 실행
      const result = await this.connection.query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;

      // 메트릭 기록
      this.prometheusService.recordHealthCheck('database', 'success', responseTime);

      // 추가 정보 수집
      const stats = await this.getDatabaseStats();

      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        connections: stats.connections,
        activeQueries: stats.activeQueries,
        replicationLag: stats.replicationLag,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.prometheusService.recordHealthCheck('database', 'failure', responseTime);

      return this.getStatus(key, false, {
        message: error.message,
        responseTime: `${responseTime}ms`,
      });
    }
  }

  async checkReadReplica(key: string): Promise<HealthIndicatorResult> {
    try {
      // Read replica 전용 연결 사용
      const replicaConnection = this.connection.driver.replica;
      if (!replicaConnection) {
        return this.getStatus(key, true, { message: 'No read replica configured' });
      }

      const result = await replicaConnection.query('SELECT 1 as health_check');
      const lag = await this.getReplicationLag();

      return this.getStatus(key, true, {
        replicationLag: `${lag}ms`,
        status: lag < 1000 ? 'healthy' : 'lagging',
      });
    } catch (error) {
      return this.getStatus(key, false, { message: error.message });
    }
  }

  private async getDatabaseStats() {
    const [connections, activeQueries, replicationLag] = await Promise.all([
      this.connection.query(`
        SELECT count(*) as total 
        FROM information_schema.processlist
      `),
      this.connection.query(`
        SELECT count(*) as active 
        FROM information_schema.processlist 
        WHERE command != 'Sleep'
      `),
      this.getReplicationLag(),
    ]);

    return {
      connections: connections[0].total,
      activeQueries: activeQueries[0].active,
      replicationLag,
    };
  }

  private async getReplicationLag(): Promise<number> {
    try {
      const result = await this.connection.query('SHOW SLAVE STATUS');
      return result[0]?.Seconds_Behind_Master || 0;
    } catch {
      return 0;
    }
  }
}

// backend-api/src/health/indicators/custom.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

@Injectable()
export class CustomHealthIndicator extends HealthIndicator {
  private cloudWatchClient: CloudWatchClient;

  constructor() {
    super();
    this.cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  }

  async checkLambdaMemory(key: string): Promise<HealthIndicatorResult> {
    const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const memoryLimit = parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '512');
    const memoryUsagePercent = (memoryUsed / memoryLimit) * 100;

    const isHealthy = memoryUsagePercent < 80;

    return this.getStatus(key, isHealthy, {
      used: `${memoryUsed.toFixed(2)} MB`,
      limit: `${memoryLimit} MB`,
      percentage: `${memoryUsagePercent.toFixed(2)}%`,
      status: isHealthy ? 'healthy' : 'warning',
    });
  }

  async checkAPIGatewayLatency(key: string): Promise<HealthIndicatorResult> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5분 전

      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/ApiGateway',
        MetricName: 'Latency',
        Dimensions: [
          {
            Name: 'ApiName',
            Value: 'vanillameta-api',
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Average', 'Maximum'],
      });

      const response = await this.cloudWatchClient.send(command);
      const latestDatapoint = response.Datapoints?.[0];

      if (!latestDatapoint) {
        return this.getStatus(key, true, { message: 'No recent data' });
      }

      const avgLatency = latestDatapoint.Average || 0;
      const maxLatency = latestDatapoint.Maximum || 0;
      const isHealthy = avgLatency < 1000 && maxLatency < 3000;

      return this.getStatus(key, isHealthy, {
        average: `${avgLatency.toFixed(0)}ms`,
        maximum: `${maxLatency.toFixed(0)}ms`,
        status: isHealthy ? 'healthy' : 'degraded',
      });
    } catch (error) {
      return this.getStatus(key, false, { message: error.message });
    }
  }

  async getPerformanceMetrics() {
    return {
      responseTime: {
        p50: await this.getMetricPercentile('ResponseTime', 50),
        p90: await this.getMetricPercentile('ResponseTime', 90),
        p99: await this.getMetricPercentile('ResponseTime', 99),
      },
      throughput: {
        requests_per_second: await this.getCurrentThroughput(),
        errors_per_minute: await this.getErrorRate(),
      },
      availability: {
        uptime_percentage: await this.getUptimePercentage(),
        last_downtime: await this.getLastDowntime(),
      },
    };
  }

  async getResourceMetrics() {
    return {
      compute: {
        lambda_invocations: await this.getLambdaInvocations(),
        lambda_concurrent_executions: await this.getConcurrentExecutions(),
        cold_start_percentage: await this.getColdStartPercentage(),
      },
      storage: {
        s3_storage_used: await this.getS3StorageUsed(),
        database_storage_used: await this.getDatabaseStorageUsed(),
        database_connections: await this.getDatabaseConnections(),
      },
      cost: {
        estimated_monthly_cost: await this.getEstimatedMonthlyCost(),
        cost_by_service: await this.getCostByService(),
      },
    };
  }

  async getBusinessMetrics() {
    return {
      users: {
        daily_active_users: await this.getDAU(),
        monthly_active_users: await this.getMAU(),
        new_users_today: await this.getNewUsersToday(),
      },
      usage: {
        dashboards_created_today: await this.getDashboardsCreatedToday(),
        queries_executed_today: await this.getQueriesExecutedToday(),
        data_processed_gb: await this.getDataProcessedToday(),
      },
    };
  }

  // Helper methods implementation...
  private async getMetricPercentile(metric: string, percentile: number): Promise<number> {
    // CloudWatch 또는 자체 메트릭 스토어에서 백분위 값 조회
    return 0; // Placeholder
  }

  private async getCurrentThroughput(): Promise<number> {
    // 현재 처리량 계산
    return 0; // Placeholder
  }

  // ... 기타 헬퍼 메서드들
}
```

### 4. 상태 페이지 구현
```typescript
// frontend-web/src/pages/StatusPage.tsx
import React, { useState, useEffect } from 'react';
import { StatusIndicator } from '../components/StatusIndicator';
import { MetricCard } from '../components/MetricCard';
import { IncidentHistory } from '../components/IncidentHistory';
import { useHealthCheck } from '../hooks/useHealthCheck';

export function StatusPage() {
  const { health, metrics, incidents, isLoading } = useHealthCheck();
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  return (
    <div className="status-page">
      <header className="status-header">
        <h1>VanillaMeta System Status</h1>
        <div className="overall-status">
          <StatusIndicator 
            status={health?.overall || 'unknown'} 
            size="large" 
          />
          <span className="status-text">
            {getStatusMessage(health?.overall)}
          </span>
        </div>
        <p className="last-updated">
          Last updated: {new Date().toLocaleString()}
        </p>
      </header>

      <section className="services-status">
        <h2>Service Status</h2>
        <div className="service-grid">
          {Object.entries(health?.services || {}).map(([service, status]) => (
            <ServiceStatusCard
              key={service}
              name={service}
              status={status}
              metrics={metrics?.[service]}
            />
          ))}
        </div>
      </section>

      <section className="system-metrics">
        <h2>System Metrics</h2>
        <TimeRangeSelector
          selected={selectedTimeRange}
          onChange={setSelectedTimeRange}
        />
        <div className="metrics-grid">
          <MetricCard
            title="API Response Time"
            value={metrics?.api?.responseTime?.p90 || 0}
            unit="ms"
            trend={metrics?.api?.responseTime?.trend}
            sparkline={metrics?.api?.responseTime?.history}
          />
          <MetricCard
            title="Error Rate"
            value={metrics?.api?.errorRate || 0}
            unit="%"
            trend={metrics?.api?.errorRate?.trend}
            threshold={{ warning: 1, critical: 5 }}
          />
          <MetricCard
            title="Active Users"
            value={metrics?.users?.active || 0}
            unit=""
            trend={metrics?.users?.trend}
          />
          <MetricCard
            title="Uptime"
            value={metrics?.availability?.uptime || 99.9}
            unit="%"
            format="percentage"
          />
        </div>
      </section>

      <section className="incidents">
        <h2>Recent Incidents</h2>
        <IncidentHistory 
          incidents={incidents} 
          timeRange={selectedTimeRange}
        />
      </section>

      <section className="subscribe">
        <h2>Get Updates</h2>
        <SubscribeForm />
      </section>
    </div>
  );
}

function ServiceStatusCard({ name, status, metrics }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`service-card ${status.state}`}>
      <div className="service-header" onClick={() => setExpanded(!expanded)}>
        <StatusIndicator status={status.state} />
        <h3>{formatServiceName(name)}</h3>
        <span className="response-time">{status.responseTime}ms</span>
      </div>
      
      {expanded && (
        <div className="service-details">
          <p>Last checked: {new Date(status.lastCheck).toLocaleString()}</p>
          {status.message && <p className="status-message">{status.message}</p>}
          
          {metrics && (
            <div className="service-metrics">
              <div className="metric">
                <span>Availability</span>
                <span>{metrics.availability}%</span>
              </div>
              <div className="metric">
                <span>Avg Response</span>
                <span>{metrics.avgResponse}ms</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 5. 외부 모니터링 통합
```typescript
// backend-api/src/health/monitoring-integration.service.ts
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class MonitoringIntegrationService {
  private readonly integrations = [
    {
      name: 'UptimeRobot',
      url: process.env.UPTIME_ROBOT_WEBHOOK,
      enabled: !!process.env.UPTIME_ROBOT_WEBHOOK,
    },
    {
      name: 'PagerDuty',
      url: process.env.PAGERDUTY_WEBHOOK,
      enabled: !!process.env.PAGERDUTY_WEBHOOK,
    },
    {
      name: 'Datadog',
      url: process.env.DATADOG_WEBHOOK,
      enabled: !!process.env.DATADOG_WEBHOOK,
    },
  ];

  @Interval(60000) // 1분마다
  async reportHealthStatus() {
    const healthStatus = await this.collectHealthStatus();
    
    for (const integration of this.integrations) {
      if (integration.enabled) {
        await this.sendToIntegration(integration, healthStatus);
      }
    }
  }

  private async collectHealthStatus() {
    // 내부 헬스체크 호출
    const response = await axios.get('http://localhost:3000/health/detailed');
    
    return {
      timestamp: new Date().toISOString(),
      status: this.determineOverallStatus(response.data),
      services: this.formatServicesStatus(response.data),
      metrics: await this.collectMetrics(),
    };
  }

  private async sendToIntegration(integration: any, status: any) {
    try {
      await axios.post(integration.url, {
        service: 'VanillaMeta',
        status: status.status,
        timestamp: status.timestamp,
        details: status.services,
        metrics: status.metrics,
      });
    } catch (error) {
      console.error(`Failed to send status to ${integration.name}:`, error);
    }
  }

  private determineOverallStatus(healthData: any): string {
    const checks = healthData.details || {};
    const failures = Object.values(checks).filter((check: any) => 
      check.status !== 'up'
    ).length;

    if (failures === 0) return 'operational';
    if (failures <= 2) return 'degraded';
    return 'outage';
  }

  private formatServicesStatus(healthData: any) {
    const services = {};
    
    Object.entries(healthData.details || {}).forEach(([key, value]: [string, any]) => {
      services[key] = {
        status: value.status === 'up' ? 'operational' : 'down',
        responseTime: value.responseTime,
        lastCheck: new Date().toISOString(),
        details: value,
      };
    });

    return services;
  }

  private async collectMetrics() {
    // CloudWatch 또는 내부 메트릭 수집
    return {
      cpu: await this.getCPUUsage(),
      memory: await this.getMemoryUsage(),
      requests: await this.getRequestMetrics(),
      errors: await this.getErrorMetrics(),
    };
  }

  // Helper methods...
  private async getCPUUsage(): Promise<number> {
    // CPU 사용률 조회 로직
    return 0; // Placeholder
  }

  private async getMemoryUsage(): Promise<number> {
    // 메모리 사용률 조회 로직
    return 0; // Placeholder
  }

  private async getRequestMetrics() {
    // 요청 관련 메트릭 조회
    return {
      total: 0,
      success: 0,
      failed: 0,
    };
  }

  private async getErrorMetrics() {
    // 오류 관련 메트릭 조회
    return {
      rate: 0,
      count: 0,
    };
  }
}
```

### 6. 헬스체크 테스트
```typescript
// backend-api/test/health.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return basic health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('version');
          expect(res.body).toHaveProperty('environment');
        });
    });

    it('should respond quickly (< 100ms)', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get('/health');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });
  });

  describe('/health/detailed (GET)', () => {
    it('should return detailed health status', () => {
      return request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
          expect(res.body).toHaveProperty('details');
        });
    });

    it('should check all dependencies', () => {
      return request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200)
        .expect((res) => {
          const details = res.body.details;
          expect(details).toHaveProperty('primary-db');
          expect(details).toHaveProperty('redis-cache');
          expect(details).toHaveProperty('s3-storage');
        });
    });
  });

  describe('/health/metrics (GET)', () => {
    it('should return system metrics', () => {
      return request(app.getHttpServer())
        .get('/health/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body.metrics).toHaveProperty('performance');
          expect(res.body.metrics).toHaveProperty('resources');
          expect(res.body.metrics).toHaveProperty('business');
        });
    });
  });
});
```

## 검증 항목

### 기능 검증
- [ ] 모든 헬스체크 엔드포인트 정상 작동
- [ ] 의존성 체크 정확도
- [ ] 메트릭 수집 정확성
- [ ] 장애 감지 신속성

### 성능 검증
- [ ] 기본 헬스체크 응답 시간 < 100ms
- [ ] 상세 헬스체크 응답 시간 < 3초
- [ ] 외부 모니터링 통합 지연 < 1분

### 통합 검증
- [ ] CloudWatch 통합 작동
- [ ] 외부 모니터링 서비스 연동
- [ ] 상태 페이지 실시간 업데이트

## 산출물
1. 헬스체크 API 엔드포인트
2. 상태 모니터링 대시보드
3. 공개 상태 페이지
4. 모니터링 통합 어댑터
5. 헬스체크 테스트 스위트

## 참고 자료
- [Health Check API Pattern](https://microservices.io/patterns/observability/health-check-api.html)
- [AWS ELB Health Checks](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html)
- [Terminus Health Checks](https://docs.nestjs.com/recipes/terminus)