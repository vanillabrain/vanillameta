import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as v8 from 'v8';
import { performance } from 'perf_hooks';
import { CustomLoggerService } from '../logger/logger.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

interface MemoryMetrics {
  timestamp: Date;
  rss: number; // Resident Set Size
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  percentUsed: number;
  available: number;
  gcStats?: {
    totalHeapSize: number;
    totalHeapSizeExecutable: number;
    totalPhysicalSize: number;
    totalAvailableSize: number;
    usedHeapSize: number;
    heapSizeLimit: number;
    mallocedMemory: number;
    peakMallocedMemory: number;
    doesZapGarbage: boolean;
  };
}

@Injectable()
export class MemoryMonitorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MemoryMonitorMiddleware.name);
  private readonly MAX_MEMORY_MB = 3072; // Lambda 최대 메모리 (3GB)
  private readonly WARNING_THRESHOLD = 0.8; // 80% 경고 임계치
  private readonly CRITICAL_THRESHOLD = 0.9; // 90% 중단 임계치
  private lastGcTime = Date.now();
  private readonly GC_INTERVAL = 60000; // 1분마다 강제 GC

  constructor(
    private readonly customLogger: CustomLoggerService,
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
  ) {
    // 주기적 메모리 체크 시작
    this.startPeriodicMonitoring();
  }

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();
    const initialMemory = this.getMemoryMetrics();

    // 요청 시작 시 메모리 체크
    this.checkMemoryThreshold(initialMemory);

    // 응답 완료 후 메모리 사용량 측정
    res.on('finish', () => {
      const endTime = performance.now();
      const finalMemory = this.getMemoryMetrics();
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
      const executionTime = endTime - startTime;

      // 메모리 사용량 로깅
      this.customLogger.debug('Request memory usage', 'MemoryMonitor', {
        method: req.method,
        path: req.path,
        initialMemory: this.formatBytes(initialMemory.heapUsed),
        finalMemory: this.formatBytes(finalMemory.heapUsed),
        memoryDelta: this.formatBytes(memoryDelta),
        percentUsed: `${finalMemory.percentUsed.toFixed(1)}%`,
        executionTime: parseFloat(executionTime.toFixed(2)),
      });

      // 메모리 사용량이 크게 증가한 경우 경고
      if (memoryDelta > 50 * 1024 * 1024) {
        // 50MB 이상 증가
        this.customLogger.warn('Large memory allocation detected', 'MemoryMonitor', {
          path: req.path,
          memoryIncrease: this.formatBytes(memoryDelta),
          currentUsage: `${finalMemory.percentUsed.toFixed(1)}%`,
        });
      }

      // CloudWatch로 메트릭 전송 (비동기)
      this.sendMetricsToCloudWatch(finalMemory, req.path).catch(err => {
        this.logger.error('Failed to send metrics to CloudWatch:', err);
      });
    });

    next();
  }

  /**
   * 현재 메모리 메트릭 수집
   */
  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const totalMemory = this.MAX_MEMORY_MB * 1024 * 1024;

    return {
      timestamp: new Date(),
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      percentUsed: (memUsage.rss / totalMemory) * 100,
      available: totalMemory - memUsage.rss,
      gcStats: {
        totalHeapSize: heapStats.total_heap_size,
        totalHeapSizeExecutable: heapStats.total_heap_size_executable,
        totalPhysicalSize: heapStats.total_physical_size,
        totalAvailableSize: heapStats.total_available_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        mallocedMemory: heapStats.malloced_memory,
        peakMallocedMemory: heapStats.peak_malloced_memory,
        doesZapGarbage: heapStats.does_zap_garbage === 1,
      },
    };
  }

  /**
   * 메모리 임계치 확인 및 대응
   */
  private checkMemoryThreshold(metrics: MemoryMetrics): void {
    const percentUsed = metrics.percentUsed / 100;

    if (percentUsed >= this.CRITICAL_THRESHOLD) {
      // 중단 임계치 도달 - 새 요청 거부
      this.customLogger.error(
        `Critical memory threshold reached: ${metrics.percentUsed.toFixed(1)}%`,
        null,
        'MemoryMonitor',
        {
          percentUsed: `${metrics.percentUsed.toFixed(1)}%`,
          heapUsed: this.formatBytes(metrics.heapUsed),
          rss: this.formatBytes(metrics.rss),
        },
      );

      // 강제 가비지 컬렉션 시도
      this.forceGarbageCollection();

      throw new Error('서버 메모리가 부족합니다. 잠시 후 다시 시도해주세요.');
    } else if (percentUsed >= this.WARNING_THRESHOLD) {
      // 경고 임계치 도달
      this.customLogger.warn('Memory usage warning threshold reached', 'MemoryMonitor', {
        percentUsed: `${metrics.percentUsed.toFixed(1)}%`,
        heapUsed: this.formatBytes(metrics.heapUsed),
        recommendation: 'Consider optimizing queries or reducing data size',
      });

      // 선제적 가비지 컬렉션
      this.forceGarbageCollection();
    }
  }

  /**
   * 강제 가비지 컬렉션 실행
   */
  private forceGarbageCollection(): void {
    const now = Date.now();
    if (now - this.lastGcTime < 5000) {
      // 5초 내 중복 실행 방지
      return;
    }

    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = before - after;

      this.customLogger.info('Forced garbage collection', 'MemoryMonitor', {
        freedMemory: this.formatBytes(freed),
        heapBefore: this.formatBytes(before),
        heapAfter: this.formatBytes(after),
      });

      this.lastGcTime = now;
    } else {
      this.logger.warn('Garbage collection is not exposed. Run with --expose-gc flag.');
    }
  }

  /**
   * CloudWatch로 메트릭 전송
   */
  private async sendMetricsToCloudWatch(metrics: MemoryMetrics, path: string): Promise<void> {
    if (process.env.NODE_ENV === 'local') {
      return; // 로컬 환경에서는 CloudWatch 전송 스킵
    }

    try {
      // CloudWatchMetricsService를 통해 메트릭 전송
      await Promise.all([
        this.cloudWatchMetrics.putMetric(
          'MemoryUsedPercent',
          metrics.percentUsed,
          'Percent',
          [{ Name: 'Function', Value: 'backend-api' }],
        ),
        this.cloudWatchMetrics.putMetric(
          'HeapUsedMB',
          metrics.heapUsed / (1024 * 1024),
          'None',
          [{ Name: 'Function', Value: 'backend-api' }],
        ),
        this.cloudWatchMetrics.putMetric(
          'RSSMemoryMB',
          metrics.rss / (1024 * 1024),
          'None',
          [{ Name: 'Function', Value: 'backend-api' }],
        ),
      ]);
    } catch (error) {
      this.logger.error('CloudWatch metric upload failed:', error);
    }
  }

  /**
   * 주기적 메모리 모니터링
   */
  private startPeriodicMonitoring(): void {
    setInterval(() => {
      const metrics = this.getMemoryMetrics();

      // 메모리 상태 로깅
      this.customLogger.info('Periodic memory check', 'MemoryMonitor', {
        percentUsed: `${metrics.percentUsed.toFixed(1)}%`,
        heapUsed: this.formatBytes(metrics.heapUsed),
        rss: this.formatBytes(metrics.rss),
        available: this.formatBytes(metrics.available),
        gcStats: {
          heapSizeLimit: this.formatBytes(metrics.gcStats.heapSizeLimit),
          totalAvailableSize: this.formatBytes(metrics.gcStats.totalAvailableSize),
        },
      });

      // 임계치 확인
      this.checkMemoryThreshold(metrics);

      // 주기적 GC (메모리 사용률이 60% 이상일 때)
      if (metrics.percentUsed > 60 && Date.now() - this.lastGcTime > this.GC_INTERVAL) {
        this.forceGarbageCollection();
      }

      // CloudWatch 전송
      this.sendMetricsToCloudWatch(metrics, 'periodic').catch(err => {
        this.logger.error('Failed to send periodic metrics:', err);
      });
    }, 30000); // 30초마다 체크
  }

  /**
   * 바이트를 읽기 쉬운 형식으로 변환
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 메모리 프로파일링 스냅샷 생성
   */
  public createHeapSnapshot(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `/tmp/heapdump-${timestamp}.heapsnapshot`;

    try {
      const stream = v8.writeHeapSnapshot(filename);
      this.customLogger.info('Heap snapshot created', 'MemoryMonitor', { filename });
      return filename;
    } catch (error) {
      this.logger.error('Failed to create heap snapshot:', error);
      throw error;
    }
  }

  /**
   * 메모리 사용 통계 반환
   */
  public getMemoryStats(): MemoryMetrics {
    return this.getMemoryMetrics();
  }
}
