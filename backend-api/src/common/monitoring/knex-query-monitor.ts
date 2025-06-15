import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { CustomLoggerService } from '../logger/logger.service';
import { SlowQueryMonitorService } from './slow-query-monitor.service';
import { QueryAnalyzerService } from './query-analyzer.service';

export interface KnexQueryEvent {
  __queryStartTime?: number;
  sql: string;
  bindings?: any[];
  method?: string;
  options?: any;
  timeout?: boolean;
}

@Injectable()
export class KnexQueryMonitor {
  private readonly logger = new Logger(KnexQueryMonitor.name);

  constructor(
    private readonly customLogger: CustomLoggerService,
    private readonly slowQueryMonitorService: SlowQueryMonitorService,
    private readonly queryAnalyzerService: QueryAnalyzerService,
  ) {}

  /**
   * Knex 인스턴스에 쿼리 모니터링 연결
   */
  attachToKnex(knex: Knex, databaseId?: number, databaseEngine?: string): void {
    // 쿼리 시작 이벤트
    knex.on('query', (query: KnexQueryEvent) => {
      query.__queryStartTime = Date.now();

      this.customLogger.debug('Knex query started', 'KnexQueryMonitor', {
        sql: this.sanitizeQuery(query.sql),
        method: query.method,
        databaseId,
        databaseEngine,
      });
    });

    // 쿼리 완료 이벤트
    knex.on('query-response', async (response: any, query: KnexQueryEvent) => {
      const duration = Date.now() - (query.__queryStartTime || 0);

      this.customLogger.log('Knex query completed', 'KnexQueryMonitor', {
        sql: this.sanitizeQuery(query.sql),
        duration,
        method: query.method,
        resultCount: Array.isArray(response) ? response.length : 1,
        databaseId,
        databaseEngine,
      });

      // 슬로우 쿼리 임계값 체크 (기본 1초)
      const slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000');

      if (duration > slowQueryThreshold) {
        this.customLogger.warn('Slow Knex query detected', 'KnexQueryMonitor', {
          sql: this.sanitizeQuery(query.sql),
          bindings: this.sanitizeBindings(query.bindings),
          duration,
          threshold: slowQueryThreshold,
          method: query.method,
          databaseId,
          databaseEngine,
        });

        // 쿼리 분석 및 슬로우 쿼리 로깅
        try {
          const analysis = await this.queryAnalyzerService.analyzeQuery(
            query.sql,
            databaseId,
          );
          // Add execution time to the analysis result
          if (analysis && duration) {
            analysis.executionTime = duration;
          }

          await this.slowQueryMonitorService.logSlowQuery(analysis, {
            databaseId,
            databaseEngine,
            userId: this.getCurrentUserId(),
            requestPath: this.getCurrentRequestPath(),
            httpMethod: this.getCurrentHttpMethod(),
            clientIp: this.getCurrentClientIp(),
            userAgent: this.getCurrentUserAgent(),
            requestId: this.getCurrentRequestId(),
            parameters: query.bindings,
          });
        } catch (error) {
          this.logger.error('Failed to analyze slow Knex query', error.stack);
        }
      }
    });

    // 쿼리 에러 이벤트
    knex.on('query-error', (error: Error, query: KnexQueryEvent) => {
      const duration = Date.now() - (query.__queryStartTime || 0);

      this.customLogger.error('Knex query error', error.stack, 'KnexQueryMonitor', {
        sql: this.sanitizeQuery(query.sql),
        bindings: this.sanitizeBindings(query.bindings),
        duration,
        method: query.method,
        errorMessage: error.message,
        databaseId,
        databaseEngine,
      });
    });

    this.logger.log(
      `Knex query monitoring attached for database ${databaseId} (${databaseEngine})`,
    );
  }

  /**
   * 여러 Knex 인스턴스에 모니터링 연결
   */
  attachToMultipleKnex(
    knexInstances: Array<{
      knex: Knex;
      databaseId: number;
      databaseEngine: string;
    }>,
  ): void {
    knexInstances.forEach(({ knex, databaseId, databaseEngine }) => {
      this.attachToKnex(knex, databaseId, databaseEngine);
    });
  }

  /**
   * 쿼리 정리 (민감한 정보 제거)
   */
  private sanitizeQuery(sql: string): string {
    if (!sql) return '';

    // 긴 쿼리는 잘라내기
    const maxLength = 500;
    if (sql.length > maxLength) {
      return sql.substring(0, maxLength) + '...';
    }

    return sql.replace(/\s+/g, ' ').trim();
  }

  /**
   * 바인딩 파라미터 정리 (민감한 정보 마스킹)
   */
  private sanitizeBindings(bindings?: any[]): any[] {
    if (!bindings || !Array.isArray(bindings)) return [];

    return bindings.map((binding, index) => {
      // 비밀번호나 토큰 같은 민감한 정보 마스킹
      if (typeof binding === 'string') {
        // 길이가 긴 문자열은 부분적으로 마스킹
        if (binding.length > 20) {
          return `${binding.substring(0, 5)}***${binding.substring(binding.length - 5)}`;
        }
        // 패스워드 필드로 보이는 경우 완전 마스킹
        if (
          binding.toLowerCase().includes('password') ||
          binding.toLowerCase().includes('token') ||
          binding.toLowerCase().includes('secret')
        ) {
          return '***MASKED***';
        }
      }

      return binding;
    });
  }

  /**
   * 현재 사용자 ID 추출 (요청 컨텍스트에서)
   */
  private getCurrentUserId(): string | undefined {
    // TODO: 요청 컨텍스트에서 사용자 ID 추출
    return undefined;
  }

  /**
   * 현재 요청 경로 추출
   */
  private getCurrentRequestPath(): string | undefined {
    // TODO: 요청 컨텍스트에서 경로 추출
    return undefined;
  }

  /**
   * 현재 HTTP 메서드 추출
   */
  private getCurrentHttpMethod(): string | undefined {
    // TODO: 요청 컨텍스트에서 HTTP 메서드 추출
    return undefined;
  }

  /**
   * 현재 클라이언트 IP 추출
   */
  private getCurrentClientIp(): string | undefined {
    // TODO: 요청 컨텍스트에서 클라이언트 IP 추출
    return undefined;
  }

  /**
   * 현재 User Agent 추출
   */
  private getCurrentUserAgent(): string | undefined {
    // TODO: 요청 컨텍스트에서 User Agent 추출
    return undefined;
  }

  /**
   * 현재 요청 ID 추출
   */
  private getCurrentRequestId(): string | undefined {
    // TODO: 요청 컨텍스트에서 요청 ID 추출 (correlation ID 등)
    return undefined;
  }

  /**
   * 쿼리 통계 수집 시작
   */
  startStatisticsCollection(): void {
    this.logger.log('Knex query statistics collection started');
    // TODO: 주기적인 통계 수집 구현
  }

  /**
   * 쿼리 통계 수집 중지
   */
  stopStatisticsCollection(): void {
    this.logger.log('Knex query statistics collection stopped');
    // TODO: 통계 수집 중지 구현
  }
}
