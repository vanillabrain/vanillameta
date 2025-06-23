import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CacheMetrics {
  hitRate: number;           // 캐시 히트율
  missRate: number;          // 캐시 미스율
  evictionRate: number;      // 캐시 제거율
  memoryUsage: number;       // 메모리 사용률
  keyCount: number;          // 전체 키 개수
  avgResponseTime: number;   // 평균 응답 시간
  errorRate: number;         // 에러율
}

@Injectable()
export class CacheMetricsService {
  private readonly logger = new Logger(CacheMetricsService.name);
  
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    responseTimes: [] as number[],
  };

  // 5분마다 메트릭 리셋
  private readonly METRICS_WINDOW = 5 * 60 * 1000;
  private lastResetTime = Date.now();

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // 주기적으로 메트릭 리셋
    setInterval(() => this.resetMetrics(), this.METRICS_WINDOW);
  }

  /**
   * 캐시 히트 기록
   */
  async recordCacheHit(key: string, responseTime: number): Promise<void> {
    this.metrics.hits++;
    this.metrics.responseTimes.push(responseTime);

    // 이벤트 발행
    this.eventEmitter.emit('cache.hit', {
      key,
      responseTime,
      timestamp: new Date(),
    });

    // Redis에 메트릭 저장 (선택적)
    await this.updateRedisMetrics('hit', key);
  }

  /**
   * 캐시 미스 기록
   */
  async recordCacheMiss(key: string): Promise<void> {
    this.metrics.misses++;

    // 이벤트 발행
    this.eventEmitter.emit('cache.miss', {
      key,
      timestamp: new Date(),
    });

    await this.updateRedisMetrics('miss', key);
  }

  /**
   * 캐시 에러 기록
   */
  async recordCacheError(key: string): Promise<void> {
    this.metrics.errors++;

    // 이벤트 발행
    this.eventEmitter.emit('cache.error', {
      key,
      timestamp: new Date(),
    });

    await this.updateRedisMetrics('error', key);
  }

  /**
   * 현재 메트릭 조회
   */
  async getMetrics(): Promise<CacheMetrics> {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    // Redis 정보 조회
    const info = await this.redis.info('memory');
    const keyCount = await this.redis.dbsize();

    return {
      hitRate,
      missRate: 100 - hitRate,
      evictionRate: await this.getEvictionRate(),
      memoryUsage: this.parseMemoryUsage(info),
      keyCount,
      avgResponseTime: this.calculateAvgResponseTime(),
      errorRate: total > 0 ? (this.metrics.errors / total) * 100 : 0,
    };
  }

  /**
   * 메트릭 요약 정보 조회
   */
  async getMetricsSummary(): Promise<any> {
    const metrics = await this.getMetrics();
    const uptime = Date.now() - this.lastResetTime;

    return {
      metrics,
      period: {
        start: new Date(this.lastResetTime),
        end: new Date(),
        durationMs: uptime,
      },
      totals: {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        errors: this.metrics.errors,
        requests: this.metrics.hits + this.metrics.misses,
      },
    };
  }

  /**
   * 캐시 키 패턴별 통계
   */
  async getKeyPatternStats(): Promise<Map<string, number>> {
    const patterns = new Map<string, number>();
    
    // Redis SCAN을 사용하여 키 패턴 분석
    const stream = this.redis.scanStream({
      match: '*',
      count: 100,
    });

    return new Promise((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        keys.forEach(key => {
          const pattern = this.extractKeyPattern(key);
          patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
        });
      });

      stream.on('end', () => resolve(patterns));
      stream.on('error', reject);
    });
  }

  /**
   * Redis 메트릭 업데이트
   */
  private async updateRedisMetrics(
    type: 'hit' | 'miss' | 'error',
    key: string,
  ): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const metricKey = `metrics:${date}:${type}`;
      
      // 일별 카운터 증가
      await this.redis.incr(metricKey);
      
      // 24시간 후 자동 만료
      await this.redis.expire(metricKey, 86400);

      // 키 패턴별 통계
      const pattern = this.extractKeyPattern(key);
      await this.redis.hincrby(`metrics:patterns:${date}`, pattern, 1);
    } catch (error) {
      this.logger.error(`Failed to update Redis metrics: ${error.message}`);
    }
  }

  /**
   * 평균 응답 시간 계산
   */
  private calculateAvgResponseTime(): number {
    if (this.metrics.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.metrics.responseTimes.length);
  }

  /**
   * 제거율 계산
   */
  private async getEvictionRate(): Promise<number> {
    try {
      const info = await this.redis.info('stats');
      const lines = info.split('\r\n');
      
      for (const line of lines) {
        if (line.startsWith('evicted_keys:')) {
          const evicted = parseInt(line.split(':')[1], 10);
          const total = await this.redis.dbsize();
          return total > 0 ? (evicted / total) * 100 : 0;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get eviction rate: ${error.message}`);
    }
    
    return 0;
  }

  /**
   * 메모리 사용률 파싱
   */
  private parseMemoryUsage(info: string): number {
    try {
      const lines = info.split('\r\n');
      let usedMemory = 0;
      let maxMemory = 0;

      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          usedMemory = parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('maxmemory:')) {
          maxMemory = parseInt(line.split(':')[1], 10);
        }
      }

      if (maxMemory > 0) {
        return (usedMemory / maxMemory) * 100;
      }
    } catch (error) {
      this.logger.error(`Failed to parse memory usage: ${error.message}`);
    }

    return 0;
  }

  /**
   * 키 패턴 추출
   */
  private extractKeyPattern(key: string): string {
    const parts = key.split(':');
    
    if (parts.length >= 2) {
      // 첫 두 부분을 패턴으로 사용 (예: dashboard:metadata)
      return `${parts[0]}:${parts[1]}`;
    }
    
    return parts[0] || 'unknown';
  }

  /**
   * 메트릭 리셋
   */
  private resetMetrics(): void {
    // 응답 시간 배열은 최근 1000개만 유지
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
    }

    this.lastResetTime = Date.now();
    
    this.logger.debug('Cache metrics window reset');
  }

  /**
   * 메트릭 익스포트 (Prometheus 형식)
   */
  async exportPrometheusMetrics(): Promise<string> {
    const metrics = await this.getMetrics();
    
    return `
# HELP cache_hit_rate Cache hit rate percentage
# TYPE cache_hit_rate gauge
cache_hit_rate ${metrics.hitRate}

# HELP cache_miss_rate Cache miss rate percentage
# TYPE cache_miss_rate gauge
cache_miss_rate ${metrics.missRate}

# HELP cache_error_rate Cache error rate percentage
# TYPE cache_error_rate gauge
cache_error_rate ${metrics.errorRate}

# HELP cache_avg_response_time Average cache response time in milliseconds
# TYPE cache_avg_response_time gauge
cache_avg_response_time ${metrics.avgResponseTime}

# HELP cache_key_count Total number of cached keys
# TYPE cache_key_count gauge
cache_key_count ${metrics.keyCount}

# HELP cache_memory_usage Memory usage percentage
# TYPE cache_memory_usage gauge
cache_memory_usage ${metrics.memoryUsage}
    `.trim();
  }
}