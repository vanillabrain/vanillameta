import { Injectable, Logger, Inject } from '@nestjs/common';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { QueryExecuteDto } from '../../database/dto/query-execute.dto';
import { ResponseStatus } from '../../common/enum/response-status.enum';
import { CacheStatisticsService } from './cache-statistics.service';

export interface QueryCacheResult {
  data: any;
  fields: any[];
  executionTime: number;
  cachedAt: Date;
  databaseEngine: string;
  queryHash: string;
}

export interface CacheMetadata {
  databaseId: number;
  databaseEngine: string;
  queryComplexity: string;
  resultSize: number;
  executionTime: number;
  userId?: string;
}

@Injectable()
export class QueryCacheService {
  private readonly logger = new Logger(QueryCacheService.name);

  // 캐시 설정
  private readonly cacheConfig = {
    // TTL 설정 (초 단위)
    defaultTTL: 300, // 5분
    complexQueryTTL: 1800, // 30분 (복잡한 쿼리는 더 오래 캐시)
    batchQueryTTL: 3600, // 1시간 (배치 쿼리는 가장 오래)

    // 결과 크기별 TTL 조정
    smallResultTTL: 600, // 10분 (작은 결과)
    largeResultTTL: 1800, // 30분 (큰 결과, 더 오래 캐시)

    // 캐시 키 설정
    keyPrefix: 'query_cache',
    metadataPrefix: 'query_meta',
    statisticsPrefix: 'cache_stats',

    // 결과 크기 임계값
    smallResultThreshold: 100, // 100행 미만
    largeResultThreshold: 10000, // 10,000행 이상

    // 최대 캐시 크기 (바이트)
    maxCacheSize: 10 * 1024 * 1024, // 10MB per item
  };

  constructor(
    @Inject('CACHE_MANAGER') private cacheManager: any,
    private readonly statisticsService: CacheStatisticsService,
  ) {}

  /**
   * 쿼리 결과 캐시에서 조회
   */
  async getCachedQuery(
    queryExecuteDto: QueryExecuteDto,
    userId?: string,
  ): Promise<QueryCacheResult | null> {
    try {
      const cacheKey = this.generateCacheKey(queryExecuteDto, userId);
      const cachedResult = await this.cacheManager.get(cacheKey);

      if (cachedResult) {
        // 캐시 히트 통계 기록
        await this.statisticsService.recordCacheHit(queryExecuteDto.id, cacheKey, userId);

        this.logger.debug('Cache hit', {
          databaseId: queryExecuteDto.id,
          cacheKey: cacheKey.substring(0, 20) + '...',
          cachedAt: cachedResult.cachedAt,
          userId,
        });

        return cachedResult;
      }

      // 캐시 미스 통계 기록
      await this.statisticsService.recordCacheMiss(queryExecuteDto.id, cacheKey, userId);

      this.logger.debug('Cache miss', {
        databaseId: queryExecuteDto.id,
        cacheKey: cacheKey.substring(0, 20) + '...',
        userId,
      });

      return null;
    } catch (error) {
      this.logger.error('Failed to get cached query', {
        databaseId: queryExecuteDto.id,
        error: error.message,
        userId,
      });
      return null;
    }
  }

  /**
   * 쿼리 결과를 캐시에 저장
   */
  async setCachedQuery(
    queryExecuteDto: QueryExecuteDto,
    resultData: {
      status: ResponseStatus;
      message: string;
      datas: any[];
      fields: any[];
    },
    executionTime: number,
    databaseEngine: string,
    userId?: string,
  ): Promise<void> {
    try {
      // 실패한 쿼리는 캐시하지 않음
      if (resultData.status !== ResponseStatus.SUCCESS) {
        return;
      }

      const cacheKey = this.generateCacheKey(queryExecuteDto, userId);
      const resultSize = this.calculateResultSize(resultData);

      // 너무 큰 결과는 캐시하지 않음
      if (resultSize > this.cacheConfig.maxCacheSize) {
        this.logger.warn('Result too large to cache', {
          databaseId: queryExecuteDto.id,
          resultSize,
          maxSize: this.cacheConfig.maxCacheSize,
          userId,
        });
        return;
      }

      const queryComplexity = this.analyzeQueryComplexity(queryExecuteDto.query);
      const ttl = this.calculateTTL(queryComplexity, resultData.datas.length, executionTime);

      const cacheResult: QueryCacheResult = {
        data: resultData.datas,
        fields: resultData.fields,
        executionTime,
        cachedAt: new Date(),
        databaseEngine,
        queryHash: this.generateQueryHash(queryExecuteDto.query),
      };

      const metadata: CacheMetadata = {
        databaseId: queryExecuteDto.id,
        databaseEngine,
        queryComplexity,
        resultSize,
        executionTime,
        userId,
      };

      // 캐시 저장 (병렬로 실행)
      await Promise.all([
        this.cacheManager.set(cacheKey, cacheResult, ttl * 1000), // TTL을 밀리초로 변환
        this.cacheManager.set(
          `${this.cacheConfig.metadataPrefix}:${cacheKey}`,
          metadata,
          ttl * 1000,
        ),
      ]);

      // 통계 기록
      await this.statisticsService.recordCacheSet(
        queryExecuteDto.id,
        cacheKey,
        resultSize,
        ttl,
        userId,
      );

      this.logger.debug('Query result cached', {
        databaseId: queryExecuteDto.id,
        cacheKey: cacheKey.substring(0, 20) + '...',
        resultSize,
        ttl,
        complexity: queryComplexity,
        userId,
      });
    } catch (error) {
      this.logger.error('Failed to cache query result', {
        databaseId: queryExecuteDto.id,
        error: error.message,
        userId,
      });
      // 캐시 실패는 서비스 흐름을 중단하지 않음
    }
  }

  /**
   * 특정 데이터베이스의 모든 캐시 무효화
   */
  async invalidateDatabaseCache(databaseId: number): Promise<void> {
    try {
      // 실제 구현에서는 Redis SCAN을 사용하여 패턴 매칭
      // 여기서는 간단한 구현으로 전체 캐시 삭제
      await this.cacheManager.reset();

      this.logger.log('Database cache invalidated', { databaseId });
    } catch (error) {
      this.logger.error('Failed to invalidate database cache', {
        databaseId,
        error: error.message,
      });
    }
  }

  /**
   * 캐시 키 패턴으로 무효화
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      // Redis SCAN 사용한 패턴 기반 삭제
      // 간단한 구현에서는 메타데이터 기반으로 처리
      await this.cacheManager.reset();

      this.logger.log('Cache invalidated by pattern', { pattern });
    } catch (error) {
      this.logger.error('Failed to invalidate cache by pattern', {
        pattern,
        error: error.message,
      });
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStatistics(): Promise<{
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    totalSets: number;
    averageExecutionTime: number;
    cacheEfficiency: number;
  }> {
    return await this.statisticsService.getCacheStatistics();
  }

  /**
   * 캐시 메모리 사용량 조회
   */
  async getCacheMemoryInfo(): Promise<{
    usedMemory: number;
    totalKeys: number;
    averageKeySize: number;
  }> {
    try {
      // 구현 세부사항은 Redis info 명령어 사용
      return {
        usedMemory: 0, // Redis info에서 가져올 수 있음
        totalKeys: 0,
        averageKeySize: 0,
      };
    } catch (error) {
      this.logger.error('Failed to get cache memory info', error);
      return {
        usedMemory: 0,
        totalKeys: 0,
        averageKeySize: 0,
      };
    }
  }

  // Private helper methods

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(queryExecuteDto: QueryExecuteDto, userId?: string): string {
    const queryHash = this.generateQueryHash(queryExecuteDto.query);
    const parametersHash = queryExecuteDto.parameters
      ? this.generateParametersHash(queryExecuteDto.parameters)
      : 'no_params';

    // 사용자별 캐시 분리 (보안 및 권한 고려)
    const userSegment = userId ? `user_${this.hashString(userId)}` : 'anonymous';

    return `${this.cacheConfig.keyPrefix}:db_${queryExecuteDto.id}:${userSegment}:${queryHash}:${parametersHash}`;
  }

  /**
   * 쿼리 해시 생성 (파라미터와 공백 정규화)
   */
  private generateQueryHash(query: string): string {
    // 쿼리 정규화: 공백 제거, 소문자 변환, 리터럴 값 치환
    const normalizedQuery = query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\d+/g, '?') // 숫자를 ?로 치환
      .replace(/'[^']*'/g, '?') // 문자열을 ?로 치환
      .replace(/"[^"]*"/g, '?') // 큰따옴표 문자열을 ?로 치환
      .trim();

    return this.hashString(normalizedQuery);
  }

  /**
   * 파라미터 해시 생성
   */
  private generateParametersHash(parameters: any[]): string {
    const paramString = parameters.map(param => `${param.type}:${param.value}`).join('|');

    return this.hashString(paramString);
  }

  /**
   * 문자열 해시 생성
   */
  private hashString(input: string): string {
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * 쿼리 복잡도 분석
   */
  private analyzeQueryComplexity(query: string): string {
    const normalizedQuery = query.toLowerCase();
    let complexityScore = 0;

    // JOIN 개수
    const joinCount = (normalizedQuery.match(/\s+join\s+/g) || []).length;
    complexityScore += joinCount * 2;

    // 서브쿼리 개수
    const subqueryCount = (normalizedQuery.match(/\(/g) || []).length;
    complexityScore += subqueryCount * 1.5;

    // 집계 함수
    const aggregationCount = (normalizedQuery.match(/\b(count|sum|avg|max|min)\s*\(/g) || [])
      .length;
    complexityScore += aggregationCount;

    // 윈도우 함수
    const windowFunctionCount = (normalizedQuery.match(/\bover\s*\(/g) || []).length;
    complexityScore += windowFunctionCount * 3;

    // WITH 절
    const cteCount = (normalizedQuery.match(/\bwith\s+/g) || []).length;
    complexityScore += cteCount * 2;

    // 배치 패턴 감지
    const batchPatterns = [
      /\blimit\s+\d{3,}/i, // LIMIT 100+
      /\boffset\s+\d{2,}/i, // OFFSET 10+
      /\binsert\s+into\s+.*\s+select/i,
      /\bbulk\s+insert/i,
      /\bload\s+data/i,
      /\bcopy\s+from/i,
      /\bmerge\s+into/i,
    ];

    const isBatch = batchPatterns.some(pattern => pattern.test(normalizedQuery));

    if (isBatch) return 'BATCH';
    if (complexityScore <= 2) return 'SIMPLE';
    if (complexityScore <= 8) return 'MEDIUM';
    return 'COMPLEX';
  }

  /**
   * TTL 계산 (복잡도, 결과 크기, 실행 시간 기반)
   */
  private calculateTTL(complexity: string, resultCount: number, executionTime: number): number {
    let baseTTL = this.cacheConfig.defaultTTL;

    // 복잡도별 TTL
    switch (complexity) {
      case 'SIMPLE':
        baseTTL = this.cacheConfig.defaultTTL;
        break;
      case 'MEDIUM':
        baseTTL = this.cacheConfig.complexQueryTTL;
        break;
      case 'COMPLEX':
        baseTTL = this.cacheConfig.complexQueryTTL;
        break;
      case 'BATCH':
        baseTTL = this.cacheConfig.batchQueryTTL;
        break;
    }

    // 결과 크기별 조정
    if (resultCount < this.cacheConfig.smallResultThreshold) {
      baseTTL = Math.min(baseTTL, this.cacheConfig.smallResultTTL);
    } else if (resultCount > this.cacheConfig.largeResultThreshold) {
      baseTTL = Math.max(baseTTL, this.cacheConfig.largeResultTTL);
    }

    // 실행 시간별 조정 (오래 걸린 쿼리일수록 더 오래 캐시)
    if (executionTime > 10000) {
      // 10초 이상
      baseTTL *= 1.5;
    } else if (executionTime > 5000) {
      // 5초 이상
      baseTTL *= 1.2;
    }

    return Math.round(baseTTL);
  }

  /**
   * 결과 크기 계산 (대략적)
   */
  private calculateResultSize(resultData: any): number {
    try {
      return JSON.stringify(resultData).length;
    } catch {
      return 0;
    }
  }
}
