import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface RequestMetrics {
  requestId: string;
  method: string;
  endpoint: string;
  url: string;
  statusCode: number;
  responseTime: number;
  memoryDelta?: {
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  activeRequests: number;
  timestamp: Date;
}

export interface ErrorMetrics extends Omit<RequestMetrics, 'statusCode'> {
  statusCode: number;
  error: string;
  errorStack?: string;
}

export interface PerformanceStats {
  endpoint: string;
  count: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  successRate: number;
  avgMemoryDelta: number;
  avgCpuUsage: number;
  lastUpdated: Date;
}

export interface PerformanceAlert {
  type: 'slow_response' | 'high_error_rate' | 'memory_leak' | 'high_cpu';
  severity: 'warning' | 'critical';
  endpoint?: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

/**
 * 성능 메트릭 수집 서비스
 * 
 * API 성능 데이터를 수집, 집계, 분석하는 서비스입니다.
 * Redis를 사용하여 실시간 메트릭을 저장하고 통계를 계산합니다.
 */
@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);
  private readonly METRICS_TTL = 86400; // 24시간
  private readonly STATS_TTL = 604800; // 7일
  private readonly SLIDING_WINDOW = 300; // 5분 슬라이딩 윈도우
  
  // 성능 임계값
  private readonly THRESHOLDS = {
    slowResponse: 1000, // 1초
    criticalSlowResponse: 3000, // 3초
    highErrorRate: 0.05, // 5%
    criticalErrorRate: 0.1, // 10%
    highMemoryDelta: 50 * 1024 * 1024, // 50MB
    highCpuUsage: 80, // 80%
  };

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeMetricsCleanup();
  }

  /**
   * 요청 메트릭 기록
   */
  async recordRequestMetrics(metrics: RequestMetrics): Promise<void> {
    try {
      const key = `metrics:request:${metrics.requestId}`;
      const endpointKey = `metrics:endpoint:${metrics.endpoint}`;
      const timeSeriesKey = `metrics:timeseries:${metrics.endpoint}:${this.getTimeWindow()}`;
      
      // 개별 요청 메트릭 저장
      await this.redis.setex(
        key,
        this.METRICS_TTL,
        JSON.stringify(metrics),
      );
      
      // 엔드포인트별 메트릭 추가
      await this.redis.zadd(
        endpointKey,
        Date.now(),
        metrics.requestId,
      );
      await this.redis.expire(endpointKey, this.METRICS_TTL);
      
      // 시계열 데이터 추가
      await this.redis.zadd(
        timeSeriesKey,
        metrics.responseTime,
        `${metrics.requestId}:${Date.now()}`,
      );
      await this.redis.expire(timeSeriesKey, this.SLIDING_WINDOW);
      
      // 실시간 통계 업데이트
      await this.updateEndpointStats(metrics);
      
      // 성능 알림 체크
      await this.checkPerformanceAlerts(metrics);
      
    } catch (error) {
      this.logger.error('Failed to record request metrics', error);
    }
  }

  /**
   * 에러 메트릭 기록
   */
  async recordErrorMetrics(metrics: ErrorMetrics): Promise<void> {
    try {
      const key = `metrics:error:${metrics.requestId}`;
      const endpointErrorKey = `metrics:endpoint:errors:${metrics.endpoint}`;
      
      // 에러 메트릭 저장
      await this.redis.setex(
        key,
        this.METRICS_TTL,
        JSON.stringify(metrics),
      );
      
      // 엔드포인트별 에러 카운트 증가
      await this.redis.hincrby(endpointErrorKey, metrics.statusCode.toString(), 1);
      await this.redis.expire(endpointErrorKey, this.METRICS_TTL);
      
      // 요청 메트릭으로도 기록
      await this.recordRequestMetrics(metrics as RequestMetrics);
      
    } catch (error) {
      this.logger.error('Failed to record error metrics', error);
    }
  }

  /**
   * 활성 요청 수 업데이트
   */
  async updateActiveRequests(count: number): Promise<void> {
    try {
      await this.redis.set('metrics:active:requests', count);
      
      // 시계열로 활성 요청 수 기록
      const key = `metrics:timeseries:active:${this.getTimeWindow()}`;
      await this.redis.zadd(key, Date.now(), `${count}:${Date.now()}`);
      await this.redis.expire(key, this.SLIDING_WINDOW);
      
    } catch (error) {
      this.logger.error('Failed to update active requests', error);
    }
  }

  /**
   * 엔드포인트별 통계 업데이트
   */
  private async updateEndpointStats(metrics: RequestMetrics): Promise<void> {
    const statsKey = `metrics:stats:${metrics.endpoint}`;
    
    // 기존 통계 가져오기
    const existingStats = await this.redis.get(statsKey);
    let stats: PerformanceStats;
    
    if (existingStats) {
      stats = JSON.parse(existingStats);
      
      // 통계 업데이트
      const newCount = stats.count + 1;
      stats.avgResponseTime = (stats.avgResponseTime * stats.count + metrics.responseTime) / newCount;
      stats.minResponseTime = Math.min(stats.minResponseTime, metrics.responseTime);
      stats.maxResponseTime = Math.max(stats.maxResponseTime, metrics.responseTime);
      stats.count = newCount;
      
      // 메모리 및 CPU 통계 업데이트
      if (metrics.memoryDelta) {
        stats.avgMemoryDelta = (stats.avgMemoryDelta * (stats.count - 1) + metrics.memoryDelta.heapUsed) / stats.count;
      }
      if (metrics.cpuUsage) {
        const cpuPercentage = (metrics.cpuUsage.user + metrics.cpuUsage.system) / 1000000 * 100;
        stats.avgCpuUsage = (stats.avgCpuUsage * (stats.count - 1) + cpuPercentage) / stats.count;
      }
      
    } else {
      // 새 통계 생성
      stats = {
        endpoint: metrics.endpoint,
        count: 1,
        avgResponseTime: metrics.responseTime,
        minResponseTime: metrics.responseTime,
        maxResponseTime: metrics.responseTime,
        p50ResponseTime: metrics.responseTime,
        p90ResponseTime: metrics.responseTime,
        p95ResponseTime: metrics.responseTime,
        p99ResponseTime: metrics.responseTime,
        errorRate: metrics.statusCode >= 400 ? 1 : 0,
        successRate: metrics.statusCode < 400 ? 1 : 0,
        avgMemoryDelta: metrics.memoryDelta?.heapUsed || 0,
        avgCpuUsage: metrics.cpuUsage ? (metrics.cpuUsage.user + metrics.cpuUsage.system) / 1000000 * 100 : 0,
        lastUpdated: new Date(),
      };
    }
    
    // 백분위수 계산을 위한 응답 시간 목록 업데이트
    await this.updatePercentiles(metrics.endpoint, metrics.responseTime);
    
    // 통계 저장
    stats.lastUpdated = new Date();
    await this.redis.setex(statsKey, this.STATS_TTL, JSON.stringify(stats));
  }

  /**
   * 백분위수 업데이트
   */
  private async updatePercentiles(endpoint: string, responseTime: number): Promise<void> {
    const percentilesKey = `metrics:percentiles:${endpoint}`;
    
    // 응답 시간을 정렬된 집합에 추가
    await this.redis.zadd(percentilesKey, responseTime, `${Date.now()}-${Math.random()}`);
    
    // 오래된 데이터 제거 (최근 1000개만 유지)
    const count = await this.redis.zcard(percentilesKey);
    if (count > 1000) {
      await this.redis.zremrangebyrank(percentilesKey, 0, count - 1001);
    }
    
    await this.redis.expire(percentilesKey, this.STATS_TTL);
  }

  /**
   * 성능 알림 체크
   */
  private async checkPerformanceAlerts(metrics: RequestMetrics): Promise<void> {
    const alerts: PerformanceAlert[] = [];
    
    // 느린 응답 체크
    if (metrics.responseTime > this.THRESHOLDS.criticalSlowResponse) {
      alerts.push({
        type: 'slow_response',
        severity: 'critical',
        endpoint: metrics.endpoint,
        message: `Critical slow response detected for ${metrics.endpoint}`,
        value: metrics.responseTime,
        threshold: this.THRESHOLDS.criticalSlowResponse,
        timestamp: new Date(),
      });
    } else if (metrics.responseTime > this.THRESHOLDS.slowResponse) {
      alerts.push({
        type: 'slow_response',
        severity: 'warning',
        endpoint: metrics.endpoint,
        message: `Slow response detected for ${metrics.endpoint}`,
        value: metrics.responseTime,
        threshold: this.THRESHOLDS.slowResponse,
        timestamp: new Date(),
      });
    }
    
    // 메모리 사용량 체크
    if (metrics.memoryDelta && metrics.memoryDelta.heapUsed > this.THRESHOLDS.highMemoryDelta) {
      alerts.push({
        type: 'memory_leak',
        severity: 'warning',
        endpoint: metrics.endpoint,
        message: `High memory usage detected for ${metrics.endpoint}`,
        value: metrics.memoryDelta.heapUsed,
        threshold: this.THRESHOLDS.highMemoryDelta,
        timestamp: new Date(),
      });
    }
    
    // CPU 사용률 체크
    if (metrics.cpuUsage) {
      const cpuPercentage = (metrics.cpuUsage.user + metrics.cpuUsage.system) / 1000000 * 100;
      if (cpuPercentage > this.THRESHOLDS.highCpuUsage) {
        alerts.push({
          type: 'high_cpu',
          severity: 'warning',
          message: 'High CPU usage detected',
          value: cpuPercentage,
          threshold: this.THRESHOLDS.highCpuUsage,
          timestamp: new Date(),
        });
      }
    }
    
    // 알림 발송
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  /**
   * 알림 발송
   */
  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    try {
      // 알림 저장
      const alertKey = `metrics:alerts:${Date.now()}-${Math.random()}`;
      await this.redis.setex(alertKey, this.METRICS_TTL, JSON.stringify(alert));
      
      // 이벤트 발송
      this.eventEmitter.emit('performance.alert', alert);
      
      // 로깅
      this.logger.warn('Performance alert', alert);
      
    } catch (error) {
      this.logger.error('Failed to send alert', error);
    }
  }

  /**
   * 엔드포인트별 성능 통계 조회
   */
  async getEndpointStats(endpoint: string): Promise<PerformanceStats | null> {
    try {
      const statsKey = `metrics:stats:${endpoint}`;
      const stats = await this.redis.get(statsKey);
      
      if (!stats) {
        return null;
      }
      
      const parsedStats = JSON.parse(stats);
      
      // 백분위수 계산
      const percentilesKey = `metrics:percentiles:${endpoint}`;
      const percentiles = await this.calculatePercentiles(percentilesKey);
      
      return {
        ...parsedStats,
        ...percentiles,
      };
      
    } catch (error) {
      this.logger.error('Failed to get endpoint stats', error);
      return null;
    }
  }

  /**
   * 전체 성능 통계 조회
   */
  async getOverallStats(): Promise<Record<string, PerformanceStats>> {
    try {
      const pattern = 'metrics:stats:*';
      const keys = await this.redis.keys(pattern);
      const stats: Record<string, PerformanceStats> = {};
      
      for (const key of keys) {
        const endpoint = key.replace('metrics:stats:', '');
        const endpointStats = await this.getEndpointStats(endpoint);
        if (endpointStats) {
          stats[endpoint] = endpointStats;
        }
      }
      
      return stats;
      
    } catch (error) {
      this.logger.error('Failed to get overall stats', error);
      return {};
    }
  }

  /**
   * 백분위수 계산
   */
  private async calculatePercentiles(key: string): Promise<{
    p50ResponseTime: number;
    p90ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  }> {
    try {
      const count = await this.redis.zcard(key);
      if (count === 0) {
        return { p50ResponseTime: 0, p90ResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0 };
      }
      
      const p50Index = Math.floor(count * 0.5);
      const p90Index = Math.floor(count * 0.9);
      const p95Index = Math.floor(count * 0.95);
      const p99Index = Math.floor(count * 0.99);
      
      const [p50, p90, p95, p99] = await Promise.all([
        this.redis.zrange(key, p50Index, p50Index, 'WITHSCORES'),
        this.redis.zrange(key, p90Index, p90Index, 'WITHSCORES'),
        this.redis.zrange(key, p95Index, p95Index, 'WITHSCORES'),
        this.redis.zrange(key, p99Index, p99Index, 'WITHSCORES'),
      ]);
      
      return {
        p50ResponseTime: p50[1] ? parseFloat(p50[1]) : 0,
        p90ResponseTime: p90[1] ? parseFloat(p90[1]) : 0,
        p95ResponseTime: p95[1] ? parseFloat(p95[1]) : 0,
        p99ResponseTime: p99[1] ? parseFloat(p99[1]) : 0,
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate percentiles', error);
      return { p50ResponseTime: 0, p90ResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0 };
    }
  }

  /**
   * 시간 윈도우 키 생성
   */
  private getTimeWindow(): string {
    const now = Date.now();
    const window = Math.floor(now / (this.SLIDING_WINDOW * 1000));
    return window.toString();
  }

  /**
   * 메트릭 정리 작업 초기화
   */
  private initializeMetricsCleanup(): void {
    // 5분마다 오래된 메트릭 정리
    setInterval(async () => {
      try {
        await this.cleanupOldMetrics();
      } catch (error) {
        this.logger.error('Failed to cleanup metrics', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 오래된 메트릭 정리
   */
  private async cleanupOldMetrics(): Promise<void> {
    const patterns = [
      'metrics:request:*',
      'metrics:error:*',
      'metrics:timeseries:*',
    ];
    
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // TTL이 설정되지 않은 키는 24시간 후 삭제
          await this.redis.expire(key, this.METRICS_TTL);
        }
      }
    }
  }
}