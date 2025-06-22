# T06: 리소스 모니터링 및 최적화

## 📋 작업 개요
- **작업 ID**: T06_S05
- **작업명**: 리소스 모니터링 및 최적화
- **소요 시간**: 3일
- **담당 팀**: Backend Team & DevOps

## 🎯 작업 목표
대용량 데이터 처리 시스템의 리소스 사용량을 실시간으로 모니터링하고 최적화하는 시스템을 구축합니다.

## 📝 상세 작업 내용

### 1. 시스템 메트릭 수집

#### 1.1 메트릭 수집 서비스
```typescript
// src/modules/monitoring/services/metrics-collector.service.ts
import * as os from 'os';
import { performance } from 'perf_hooks';
import * as v8 from 'v8';

@Injectable()
export class MetricsCollectorService {
  private metrics: SystemMetrics[] = [];
  private readonly maxMetricsSize = 1000;
  
  @Cron('*/10 * * * * *') // 10초마다
  async collectSystemMetrics(): Promise<void> {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      cpu: await this.getCpuMetrics(),
      memory: this.getMemoryMetrics(),
      eventLoop: await this.getEventLoopMetrics(),
      gc: this.getGCMetrics(),
      process: this.getProcessMetrics()
    };
    
    this.metrics.push(metrics);
    
    // 메모리 관리를 위한 오래된 메트릭 제거
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize);
    }
    
    // CloudWatch로 전송
    await this.sendToCloudWatch(metrics);
  }
  
  private async getCpuMetrics(): Promise<CpuMetrics> {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    // CPU 사용률 계산
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    const totalTime = (endUsage.user + endUsage.system) / 1000;
    const cpuPercent = (totalTime / 100) * 100;
    
    return {
      usage: cpuPercent,
      loadAverage: {
        '1m': loadAverage[0],
        '5m': loadAverage[1],
        '15m': loadAverage[2]
      },
      cores: cpus.length
    };
  }
  
  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    const heapStats = v8.getHeapStatistics();
    
    return {
      process: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      system: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        percentUsed: ((totalMem - freeMem) / totalMem) * 100
      },
      heap: {
        totalHeapSize: heapStats.total_heap_size,
        totalHeapSizeExecutable: heapStats.total_heap_size_executable,
        totalPhysicalSize: heapStats.total_physical_size,
        totalAvailableSize: heapStats.total_available_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit
      }
    };
  }
  
  private async getEventLoopMetrics(): Promise<EventLoopMetrics> {
    const start = performance.now();
    
    // Event loop lag 측정
    const lagPromise = new Promise<number>(resolve => {
      const expectedDelay = 0;
      const startTime = Date.now();
      
      setImmediate(() => {
        const actualDelay = Date.now() - startTime;
        resolve(actualDelay - expectedDelay);
      });
    });
    
    const lag = await lagPromise;
    
    return {
      lag,
      utilization: performance.eventLoopUtilization ? 
        performance.eventLoopUtilization().utilization : 0
    };
  }
}
```

#### 1.2 쿼리 성능 추적
```typescript
// src/modules/monitoring/services/query-performance.service.ts
@Injectable()
export class QueryPerformanceService {
  private queryMetrics = new Map<string, QueryMetrics>();
  
  async trackQuery(queryId: string, metadata: QueryMetadata): Promise<void> {
    this.queryMetrics.set(queryId, {
      queryId,
      startTime: Date.now(),
      metadata,
      memoryBefore: process.memoryUsage()
    });
  }
  
  async completeQuery(
    queryId: string, 
    result: QueryResult
  ): Promise<QueryPerformanceMetrics> {
    const metrics = this.queryMetrics.get(queryId);
    if (!metrics) throw new Error(`No metrics found for query ${queryId}`);
    
    const endTime = Date.now();
    const memoryAfter = process.memoryUsage();
    
    const performanceMetrics: QueryPerformanceMetrics = {
      queryId,
      duration: endTime - metrics.startTime,
      rowsProcessed: result.rows.length,
      bytesProcessed: this.calculateBytes(result),
      memoryUsed: {
        rss: memoryAfter.rss - metrics.memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - metrics.memoryBefore.heapUsed
      },
      throughput: {
        rowsPerSecond: result.rows.length / ((endTime - metrics.startTime) / 1000),
        bytesPerSecond: this.calculateBytes(result) / ((endTime - metrics.startTime) / 1000)
      }
    };
    
    // 메트릭 저장
    await this.saveMetrics(performanceMetrics);
    
    // 메모리 정리
    this.queryMetrics.delete(queryId);
    
    return performanceMetrics;
  }
  
  async getQueryStats(period: string): Promise<QueryStatistics> {
    const stats = await this.metricsRepository.aggregate([
      {
        $match: {
          timestamp: { $gte: this.getPeriodStart(period) }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' },
          maxDuration: { $max: '$duration' },
          minDuration: { $min: '$duration' },
          totalQueries: { $sum: 1 },
          avgRowsProcessed: { $avg: '$rowsProcessed' },
          avgMemoryUsed: { $avg: '$memoryUsed.heapUsed' }
        }
      }
    ]);
    
    return stats[0];
  }
}
```

### 2. 리소스 사용량 제한

#### 2.1 메모리 관리자
```typescript
// src/modules/monitoring/services/memory-manager.service.ts
@Injectable()
export class MemoryManagerService {
  private readonly memoryThreshold = 0.8; // 80%
  private readonly gcThreshold = 0.7; // 70%
  
  @Cron('*/30 * * * * *') // 30초마다
  async checkMemoryUsage(): Promise<void> {
    const memStats = v8.getHeapStatistics();
    const usageRatio = memStats.used_heap_size / memStats.heap_size_limit;
    
    if (usageRatio > this.memoryThreshold) {
      await this.handleHighMemoryUsage(usageRatio);
    } else if (usageRatio > this.gcThreshold) {
      // 수동 가비지 컬렉션 트리거
      if (global.gc) {
        global.gc();
        logger.info('Manual garbage collection triggered');
      }
    }
  }
  
  private async handleHighMemoryUsage(usageRatio: number): Promise<void> {
    logger.warn(`High memory usage detected: ${(usageRatio * 100).toFixed(2)}%`);
    
    // 1. 캐시 정리
    await this.cacheService.evictLRU(0.3); // 30% 캐시 제거
    
    // 2. 진행 중인 대용량 작업 일시 중지
    await this.jobQueue.pauseLargeJobs();
    
    // 3. 알림 발송
    await this.alertService.sendMemoryAlert({
      level: 'critical',
      usage: usageRatio,
      timestamp: new Date()
    });
    
    // 4. 강제 GC
    if (global.gc) {
      global.gc();
    }
    
    // 5. 메모리 덤프 (디버깅용)
    if (usageRatio > 0.95) {
      await this.createMemorySnapshot();
    }
  }
  
  private async createMemorySnapshot(): Promise<void> {
    const heapSnapshot = v8.writeHeapSnapshot();
    logger.info(`Heap snapshot created: ${heapSnapshot}`);
  }
}
```

#### 2.2 쿼리 타임아웃 관리
```typescript
// src/modules/monitoring/services/timeout-manager.service.ts
@Injectable()
export class TimeoutManagerService {
  private activeQueries = new Map<string, QueryTimeout>();
  
  async registerQuery(
    queryId: string,
    options: TimeoutOptions
  ): Promise<void> {
    const timeout = setTimeout(
      () => this.handleTimeout(queryId),
      options.timeout || 300000 // 기본 5분
    );
    
    this.activeQueries.set(queryId, {
      queryId,
      timeout,
      startTime: Date.now(),
      options
    });
  }
  
  async completeQuery(queryId: string): Promise<void> {
    const queryTimeout = this.activeQueries.get(queryId);
    if (queryTimeout) {
      clearTimeout(queryTimeout.timeout);
      this.activeQueries.delete(queryId);
    }
  }
  
  private async handleTimeout(queryId: string): Promise<void> {
    const queryInfo = this.activeQueries.get(queryId);
    if (!queryInfo) return;
    
    logger.warn(`Query timeout: ${queryId}`);
    
    // 1. 쿼리 취소
    await this.queryService.cancelQuery(queryId);
    
    // 2. 리소스 정리
    await this.resourceCleanup(queryId);
    
    // 3. 사용자 알림
    await this.notificationService.notifyQueryTimeout(queryId);
    
    // 4. 메트릭 기록
    await this.metricsService.recordTimeout(queryId, {
      duration: Date.now() - queryInfo.startTime,
      reason: 'timeout'
    });
    
    this.activeQueries.delete(queryId);
  }
}
```

### 3. 자동 스케일링

#### 3.1 리소스 스케일러
```typescript
// src/modules/monitoring/services/auto-scaler.service.ts
@Injectable()
export class AutoScalerService {
  private readonly scaleUpThreshold = 0.8;
  private readonly scaleDownThreshold = 0.3;
  private scalingInProgress = false;
  
  @Cron('*/60 * * * * *') // 1분마다
  async checkScalingNeeds(): Promise<void> {
    if (this.scalingInProgress) return;
    
    const metrics = await this.getAverageMetrics(5); // 5분 평균
    
    if (this.shouldScaleUp(metrics)) {
      await this.scaleUp();
    } else if (this.shouldScaleDown(metrics)) {
      await this.scaleDown();
    }
  }
  
  private shouldScaleUp(metrics: AverageMetrics): boolean {
    return (
      metrics.cpuUsage > this.scaleUpThreshold ||
      metrics.memoryUsage > this.scaleUpThreshold ||
      metrics.queueLength > 100 ||
      metrics.avgResponseTime > 5000 // 5초
    );
  }
  
  private shouldScaleDown(metrics: AverageMetrics): boolean {
    return (
      metrics.cpuUsage < this.scaleDownThreshold &&
      metrics.memoryUsage < this.scaleDownThreshold &&
      metrics.queueLength < 10 &&
      metrics.avgResponseTime < 1000 // 1초
    );
  }
  
  private async scaleUp(): Promise<void> {
    this.scalingInProgress = true;
    
    try {
      // 1. Worker 프로세스 추가
      const currentWorkers = cluster.workers ? Object.keys(cluster.workers).length : 1;
      const maxWorkers = os.cpus().length;
      
      if (currentWorkers < maxWorkers) {
        cluster.fork();
        logger.info(`Scaled up to ${currentWorkers + 1} workers`);
      }
      
      // 2. 동적 리소스 할당
      await this.adjustResourceLimits('up');
      
      // 3. 캐시 크기 증가
      await this.cacheService.expandCache();
      
    } finally {
      this.scalingInProgress = false;
    }
  }
  
  private async scaleDown(): Promise<void> {
    this.scalingInProgress = true;
    
    try {
      // 1. Worker 프로세스 감소
      const workers = Object.values(cluster.workers || {});
      if (workers.length > 1) {
        const workerToKill = workers[workers.length - 1];
        workerToKill.kill();
        logger.info(`Scaled down to ${workers.length - 1} workers`);
      }
      
      // 2. 리소스 제한 조정
      await this.adjustResourceLimits('down');
      
      // 3. 캐시 크기 축소
      await this.cacheService.shrinkCache();
      
    } finally {
      this.scalingInProgress = false;
    }
  }
}
```

### 4. 성능 대시보드

#### 4.1 메트릭 API
```typescript
// src/modules/monitoring/controllers/metrics.controller.ts
@Controller('api/v1/metrics')
export class MetricsController {
  @Get('system')
  async getSystemMetrics(
    @Query('period') period: string = '1h'
  ): Promise<SystemMetricsResponse> {
    const metrics = await this.metricsService.getSystemMetrics(period);
    
    return {
      cpu: {
        current: metrics.cpu.usage,
        average: metrics.cpu.average,
        peak: metrics.cpu.peak,
        history: metrics.cpu.history
      },
      memory: {
        current: metrics.memory.percentUsed,
        average: metrics.memory.average,
        peak: metrics.memory.peak,
        breakdown: {
          heap: metrics.memory.heapUsed,
          rss: metrics.memory.rss,
          external: metrics.memory.external
        }
      },
      eventLoop: {
        lag: metrics.eventLoop.lag,
        utilization: metrics.eventLoop.utilization
      },
      queries: {
        active: metrics.queries.active,
        completed: metrics.queries.completed,
        failed: metrics.queries.failed,
        avgDuration: metrics.queries.avgDuration
      }
    };
  }
  
  @Get('queries/:queryId')
  async getQueryMetrics(
    @Param('queryId') queryId: string
  ): Promise<QueryPerformanceMetrics> {
    return this.queryPerformanceService.getMetrics(queryId);
  }
  
  @Get('alerts')
  async getAlerts(
    @Query('severity') severity?: AlertSeverity
  ): Promise<Alert[]> {
    return this.alertService.getActiveAlerts(severity);
  }
}
```

#### 4.2 실시간 모니터링 WebSocket
```typescript
// src/modules/monitoring/gateways/metrics.gateway.ts
@WebSocketGateway({
  namespace: 'metrics',
  cors: true
})
export class MetricsGateway {
  @WebSocketServer()
  server: Server;
  
  private metricsInterval: NodeJS.Timer;
  
  afterInit() {
    // 실시간 메트릭 브로드캐스팅
    this.metricsInterval = setInterval(async () => {
      const metrics = await this.metricsService.getCurrentMetrics();
      this.server.emit('metrics:update', metrics);
    }, 1000); // 1초마다
  }
  
  @SubscribeMessage('subscribe:query')
  async handleQuerySubscription(
    @MessageBody() queryId: string,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    // 특정 쿼리 메트릭 구독
    const room = `query:${queryId}`;
    client.join(room);
    
    // 쿼리 진행 상황 전송
    const interval = setInterval(async () => {
      const progress = await this.queryService.getProgress(queryId);
      
      if (progress.status === 'completed' || progress.status === 'failed') {
        clearInterval(interval);
        client.leave(room);
      }
      
      this.server.to(room).emit('query:progress', progress);
    }, 500);
  }
}
```

### 5. 알림 시스템

#### 5.1 알림 서비스
```typescript
// src/modules/monitoring/services/alert.service.ts
@Injectable()
export class AlertService {
  private alerts: Alert[] = [];
  
  async createAlert(config: AlertConfig): Promise<void> {
    const alert: Alert = {
      id: uuidv4(),
      severity: config.severity,
      type: config.type,
      message: config.message,
      metadata: config.metadata,
      timestamp: new Date(),
      status: 'active'
    };
    
    this.alerts.push(alert);
    
    // 알림 채널별 전송
    await Promise.all([
      this.sendSlackAlert(alert),
      this.sendEmailAlert(alert),
      this.sendDashboardAlert(alert)
    ]);
    
    // 자동 해결 체크
    if (config.autoResolve) {
      this.scheduleAutoResolve(alert.id, config.autoResolveAfter);
    }
  }
  
  private async sendSlackAlert(alert: Alert): Promise<void> {
    if (alert.severity !== 'info') {
      await this.slackClient.send({
        channel: '#alerts',
        text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
        attachments: [{
          color: this.getSeverityColor(alert.severity),
          fields: Object.entries(alert.metadata || {}).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          }))
        }]
      });
    }
  }
}
```

## 🔧 기술 스택
- Node.js 내장 모듈 (os, v8, perf_hooks)
- AWS CloudWatch
- Prometheus/Grafana
- WebSocket (Socket.io)
- PM2 (프로세스 관리)

## ✅ 완료 조건
- [ ] 시스템 메트릭 실시간 수집
- [ ] 쿼리 성능 추적 및 분석
- [ ] 메모리 사용량 자동 관리
- [ ] 쿼리 타임아웃 관리
- [ ] 자동 스케일링 구현
- [ ] 성능 모니터링 대시보드
- [ ] 알림 시스템 구축
- [ ] 리소스 사용량 제한

## 📊 성능 목표
- 메트릭 수집 오버헤드: < 1% CPU
- 메모리 사용량 임계값: 2GB
- 알림 지연 시간: < 10초
- 자동 스케일링 반응 시간: < 1분

## 🧪 테스트 계획
1. 단위 테스트
   - 메트릭 수집 로직
   - 임계값 계산
   - 알림 조건

2. 통합 테스트
   - 전체 모니터링 플로우
   - 자동 스케일링
   - 알림 전송

3. 부하 테스트
   - 고부하 상황 시뮬레이션
   - 메모리 누수 감지
   - 스케일링 동작 검증

## 📚 참고 자료
- [Node.js Performance Monitoring](https://nodejs.org/api/perf_hooks.html)
- [V8 Heap Statistics](https://nodejs.org/api/v8.html)
- [CloudWatch Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)