import { Injectable } from '@nestjs/common';
import { QueryExecuteDto } from '../database/dto/query-execute.dto';
import { ConnectionService } from './connection.service';
import { MemoryOptimizedQueryUtil } from './memory-optimized-query.util';
import { MemoryMonitorService } from '../common/monitoring/memory-monitor.service';
import { Writable } from 'stream';
import { ResponseStatus } from '../common/enum/response-status.enum';

@Injectable()
export class MemoryOptimizedConnectionService {
  constructor(
    private readonly connectionService: ConnectionService,
    private readonly memoryMonitorService: MemoryMonitorService,
  ) {}

  /**
   * 대용량 쿼리를 메모리 효율적으로 실행
   */
  async executeMemoryOptimizedQuery(
    queryExecuteDto: QueryExecuteDto,
    userId?: string,
    options?: {
      chunkSize?: number;
      projection?: string[];
      aggregation?: {
        groupBy: string;
        aggregateFn: (group: any[]) => any;
      };
      sampling?: {
        sampleRate: number;
      };
      deduplication?: {
        keyField: string;
      };
    },
  ) {
    const knex = await this.connectionService.getKnex(queryExecuteDto.id);
    const startTime = Date.now();

    // 결과를 메모리에 누적하는 대신 스트림 처리
    const results: any[] = [];
    let fields: any[] = [];
    let rowCount = 0;
    let error: Error | null = null;

    // 결과를 수집하는 쓰기 스트림
    const resultStream = new Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        // 청크 단위로 결과 처리
        if (Array.isArray(chunk)) {
          results.push(...chunk);
          rowCount += chunk.length;
        } else if (chunk.data) {
          results.push(...chunk.data);
          rowCount += chunk.data.length;
        }

        // 메모리 제한 확인 (100,000 행 또는 500MB)
        if (results.length > 100000 || process.memoryUsage().heapUsed > 500 * 1024 * 1024) {
          callback(new Error('결과 집합이 너무 큽니다. 스트리밍 모드를 사용하세요.'));
        } else {
          callback();
        }
      },
    });

    try {
      // 쿼리 스트림 생성
      const queryStream = knex.raw(queryExecuteDto.query).stream();

      // 변환 파이프라인 구성
      const transforms = [];

      // 1. 청크 변환
      transforms.push(MemoryOptimizedQueryUtil.createChunkTransform(options?.chunkSize || 1000));

      // 2. 프로젝션 (필요한 필드만 선택)
      if (options?.projection && options.projection.length > 0) {
        transforms.push(MemoryOptimizedQueryUtil.createProjectionTransform(options.projection));
      }

      // 3. 중복 제거
      if (options?.deduplication) {
        transforms.push(
          MemoryOptimizedQueryUtil.createDeduplicationTransform(options.deduplication.keyField),
        );
      }

      // 4. 샘플링
      if (options?.sampling) {
        transforms.push(
          MemoryOptimizedQueryUtil.createSamplingTransform(options.sampling.sampleRate),
        );
      }

      // 5. 집계
      if (options?.aggregation) {
        transforms.push(
          MemoryOptimizedQueryUtil.createAggregateTransform(
            options.aggregation.groupBy,
            options.aggregation.aggregateFn,
          ),
        );
      }

      // 6. 메모리 모니터링
      transforms.push(
        MemoryOptimizedQueryUtil.createMemoryMonitorTransform(200), // 200MB 임계치
      );

      // 파이프라인 실행
      await MemoryOptimizedQueryUtil.createOptimizedPipeline(queryStream, transforms, resultStream);

      // 필드 정보 추출 (첫 번째 결과에서)
      if (results.length > 0) {
        const firstRow = results[0];
        fields = Object.keys(firstRow).map(field => ({
          columnName: field,
          columnType: this.detectFieldType(firstRow[field]),
        }));
      }

      const executionTime = Date.now() - startTime;

      return {
        status: ResponseStatus.SUCCESS,
        message: 'success',
        data: results,
        fields,
        metadata: {
          rowCount,
          executionTime,
          memoryUsed: this.formatBytes(process.memoryUsage().heapUsed),
          optimizations: {
            chunked: true,
            projected: !!options?.projection,
            sampled: !!options?.sampling,
            deduplicated: !!options?.deduplication,
            aggregated: !!options?.aggregation,
          },
        },
      };
    } catch (e) {
      const executionTime = Date.now() - startTime;
      error = e;

      return {
        status: ResponseStatus.ERROR,
        message: e.message || 'Query execution failed',
        metadata: {
          executionTime,
          memoryUsed: this.formatBytes(process.memoryUsage().heapUsed),
          error: e.stack,
        },
      };
    }
  }

  /**
   * 스트림 기반 집계 쿼리 실행
   */
  async executeStreamingAggregation(
    queryExecuteDto: QueryExecuteDto,
    aggregationConfig: {
      groupBy: string[];
      metrics: Array<{
        field: string;
        operation: 'sum' | 'avg' | 'count' | 'min' | 'max';
      }>;
      having?: any;
    },
    userId?: string,
  ) {
    // 집계 함수 생성
    const aggregateFn = (group: any[]) => {
      const result: any = {};

      aggregationConfig.metrics.forEach(metric => {
        const values = group.map(row => Number(row[metric.field]) || 0);

        switch (metric.operation) {
          case 'sum':
            result[`${metric.field}_sum`] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[`${metric.field}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'count':
            result[`${metric.field}_count`] = values.length;
            break;
          case 'min':
            result[`${metric.field}_min`] = Math.min(...values);
            break;
          case 'max':
            result[`${metric.field}_max`] = Math.max(...values);
            break;
        }
      });

      return result;
    };

    // 메모리 최적화된 쿼리 실행
    const result = await this.executeMemoryOptimizedQuery(queryExecuteDto, userId, {
      aggregation: {
        groupBy: aggregationConfig.groupBy[0], // 단일 그룹 기준
        aggregateFn,
      },
    });

    // HAVING 절 적용
    if (aggregationConfig.having && result.data) {
      result.data = result.data.filter(row => {
        // 간단한 having 조건 평가
        return Object.entries(aggregationConfig.having).every(([key, value]) => {
          return row[key] === value;
        });
      });
    }

    return result;
  }

  /**
   * 배치 처리를 위한 쿼리 실행
   */
  async executeBatchQuery(
    queryExecuteDto: QueryExecuteDto,
    batchConfig: {
      batchSize: number;
      processFn: (batch: any[]) => Promise<any>;
      onProgress?: (processed: number, total?: number) => void;
    },
    userId?: string,
  ) {
    const knex = await this.connectionService.getKnex(queryExecuteDto.id);
    const startTime = Date.now();
    let processedCount = 0;
    const results: any[] = [];

    try {
      // 쿼리 스트림 생성
      const queryStream = knex.raw(queryExecuteDto.query).stream();

      // 배치 처리 변환
      const batchTransform = MemoryOptimizedQueryUtil.createBatchTransform(
        batchConfig.batchSize,
        async batch => {
          const result = await batchConfig.processFn(batch);
          processedCount += batch.length;

          // 진행상황 콜백
          if (batchConfig.onProgress) {
            batchConfig.onProgress(processedCount);
          }

          return result;
        },
      );

      // 결과 수집 스트림
      const resultStream = new Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
          if (chunk) {
            results.push(chunk);
          }
          callback();
        },
      });

      // 파이프라인 실행
      await MemoryOptimizedQueryUtil.createOptimizedPipeline(
        queryStream,
        [MemoryOptimizedQueryUtil.createChunkTransform(batchConfig.batchSize), batchTransform],
        resultStream,
      );

      const executionTime = Date.now() - startTime;

      return {
        status: ResponseStatus.SUCCESS,
        message: 'Batch processing completed',
        data: results,
        metadata: {
          processedCount,
          batchSize: batchConfig.batchSize,
          executionTime,
          memoryUsed: this.formatBytes(process.memoryUsage().heapUsed),
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message || 'Batch processing failed',
        metadata: {
          processedCount,
          error: error.stack,
        },
      };
    }
  }

  /**
   * 필드 타입 감지
   */
  private detectFieldType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'decimal';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'datetime';
    if (typeof value === 'string') {
      // 날짜 형식 감지
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'datetime';
      // 숫자 형식 감지
      if (/^\d+$/.test(value)) return 'string-number';
      return 'string';
    }
    if (typeof value === 'object') return 'json';
    return 'unknown';
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
}
