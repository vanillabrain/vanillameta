import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from '../../connection/connection.service';
import { QueryExecuteDto } from '../../database/dto/query-execute.dto';
import { ChunkResult, FieldInfo } from '../dto/batch-response.dto';
import { FieldTypeUtil } from '../../utils/field-type.util';
import { ResponseStatus } from '../../common/enum/response-status.enum';

@Injectable()
export class ChunkProcessor {
  private readonly logger = new Logger(ChunkProcessor.name);

  constructor(private readonly connectionService: ConnectionService) {}

  /**
   * 단일 청크 처리
   */
  async processChunk(
    databaseId: number,
    baseQuery: string,
    chunkIndex: number,
    chunkSize: number,
    offset: number,
    parameters?: any[],
    timeoutMs = 25000,
  ): Promise<ChunkResult> {
    const startTime = Date.now();

    try {
      // 청크를 위한 LIMIT/OFFSET 쿼리 생성
      const chunkQuery = this.buildChunkQuery(baseQuery, chunkSize, offset);

      this.logger.debug('Processing chunk', {
        databaseId,
        chunkIndex,
        chunkSize,
        offset,
        query: chunkQuery.substring(0, 100) + '...',
      });

      // 타임아웃 설정
      const queryPromise = this.executeChunkQuery(databaseId, chunkQuery, parameters);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Chunk processing timeout')), timeoutMs);
      });

      const queryResult = (await Promise.race([queryPromise, timeoutPromise])) as any;

      if (queryResult.status === ResponseStatus.ERROR) {
        throw new Error(queryResult.message || 'Query execution failed');
      }

      const processingTime = Date.now() - startTime;
      const data = queryResult.datas || [];
      const fields = queryResult.fields || [];

      const result: ChunkResult = {
        chunkIndex,
        chunkSize,
        data,
        fields,
        processingTime,
        rowsReturned: data.length,
        startOffset: offset,
        endOffset: offset + data.length,
      };

      this.logger.debug('Chunk processed successfully', {
        databaseId,
        chunkIndex,
        rowsReturned: data.length,
        processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Chunk processing failed', {
        databaseId,
        chunkIndex,
        chunkSize,
        offset,
        processingTime,
        error: error.message,
      });

      throw new Error(`Chunk ${chunkIndex} failed: ${error.message}`);
    }
  }

  /**
   * 청크용 쿼리 생성 (LIMIT/OFFSET 추가)
   */
  private buildChunkQuery(baseQuery: string, chunkSize: number, offset: number): string {
    // 기본 쿼리에서 기존 LIMIT 제거
    let cleanQuery = baseQuery.trim();

    // 기존 LIMIT 절 제거 (대소문자 무관)
    cleanQuery = cleanQuery.replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?$/i, '');

    // 세미콜론 제거
    cleanQuery = cleanQuery.replace(/;$/, '');

    // 새로운 LIMIT/OFFSET 추가
    return `${cleanQuery} LIMIT ${chunkSize} OFFSET ${offset}`;
  }

  /**
   * 청크 쿼리 실행
   */
  private async executeChunkQuery(
    databaseId: number,
    query: string,
    parameters?: any[],
  ): Promise<any> {
    const queryExecuteDto = new QueryExecuteDto();
    queryExecuteDto.id = databaseId;
    queryExecuteDto.query = query;

    if (parameters && parameters.length > 0) {
      queryExecuteDto.parameters = parameters.map((value, index) => ({
        name: `param_${index}`,
        value,
        type: this.inferParameterType(value),
      }));
    }

    return await this.connectionService.executeQuery(queryExecuteDto);
  }

  /**
   * 매개변수 타입 추론
   */
  private inferParameterType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
  }

  /**
   * 총 레코드 수 계산 (COUNT 쿼리)
   */
  async calculateTotalRows(
    databaseId: number,
    baseQuery: string,
    parameters?: any[],
  ): Promise<number> {
    try {
      const countQuery = this.buildCountQuery(baseQuery);

      this.logger.debug('Calculating total rows', {
        databaseId,
        countQuery: countQuery.substring(0, 100) + '...',
      });

      const queryResult = await this.executeChunkQuery(databaseId, countQuery, parameters);

      if (queryResult.status === ResponseStatus.ERROR) {
        throw new Error(queryResult.message || 'Count query failed');
      }

      const totalRows = queryResult.datas?.[0]?.total_count || 0;

      this.logger.debug('Total rows calculated', {
        databaseId,
        totalRows,
      });

      return totalRows;
    } catch (error) {
      this.logger.error('Failed to calculate total rows', {
        databaseId,
        error: error.message,
      });

      // COUNT 실패 시 기본값 반환 (무한 배치 방지)
      return 100000; // 기본 최대값
    }
  }

  /**
   * COUNT 쿼리 생성
   */
  private buildCountQuery(baseQuery: string): string {
    let cleanQuery = baseQuery.trim();

    // ORDER BY, LIMIT, OFFSET 제거
    cleanQuery = cleanQuery.replace(/\s+ORDER\s+BY\s+[^;]*$/i, '');
    cleanQuery = cleanQuery.replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?$/i, '');
    cleanQuery = cleanQuery.replace(/;$/, '');

    // SELECT 절을 COUNT(*)로 변경
    const countQuery = cleanQuery.replace(
      /^SELECT\s+.*?\s+FROM/i,
      'SELECT COUNT(*) as total_count FROM',
    );

    return countQuery;
  }

  /**
   * 청크 크기 최적화
   */
  optimizeChunkSize(
    estimatedTotalRows: number,
    targetProcessingTime = 2000, // 2초 목표
    maxChunkSize = 50000,
    minChunkSize = 1000,
  ): number {
    // 총 처리 시간을 5초로 제한하고, 적절한 청크 크기 계산
    const maxChunks = 10; // 최대 10개 청크
    let optimalChunkSize = Math.ceil(estimatedTotalRows / maxChunks);

    // 범위 제한
    optimalChunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, optimalChunkSize));

    this.logger.debug('Optimized chunk size', {
      estimatedTotalRows,
      optimalChunkSize,
      estimatedChunks: Math.ceil(estimatedTotalRows / optimalChunkSize),
    });

    return optimalChunkSize;
  }

  /**
   * 메모리 사용량 추정
   */
  estimateMemoryUsage(chunkSize: number, fieldsCount: number): number {
    // 대략적인 메모리 사용량 계산 (MB 단위)
    // 각 필드당 평균 50바이트, 오버헤드 고려하여 2배
    const estimatedMB = (chunkSize * fieldsCount * 50 * 2) / (1024 * 1024);

    return Math.round(estimatedMB * 100) / 100; // 소수점 둘째 자리까지
  }

  /**
   * 데이터베이스별 최적화된 청크 크기 반환
   */
  getDatabaseOptimizedChunkSize(databaseEngine: string, defaultChunkSize: number): number {
    const optimizations = {
      mysql2: defaultChunkSize,
      pg: defaultChunkSize,
      bigquery: Math.min(defaultChunkSize, 10000), // BigQuery는 작은 청크 권장
      snowflake: Math.min(defaultChunkSize, 20000), // Snowflake도 작은 청크
      mssql: defaultChunkSize,
      oracledb: defaultChunkSize,
      sqlite3: Math.min(defaultChunkSize, 5000), // SQLite는 더 작은 청크
    };

    return optimizations[databaseEngine] || defaultChunkSize;
  }
}
