import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseOptimizerFactory } from './database-optimizer-factory';

/**
 * 데이터베이스 성능 비교 서비스
 * 여러 데이터베이스 간 성능 비교 및 벤치마킹 도구
 */
@Injectable()
export class DatabasePerformanceComparatorService {
  private readonly logger = new Logger(DatabasePerformanceComparatorService.name);

  constructor(private readonly databaseOptimizerFactory: DatabaseOptimizerFactory) {}

  /**
   * 쿼리 성능 벤치마크
   * @param queries - 벤치마크할 쿼리들
   * @param databases - 비교할 데이터베이스들
   * @param iterations - 반복 횟수
   */
  async benchmarkQueries(
    queries: string[],
    databases: { knex: Knex; type: string; name: string }[],
    iterations = 3,
  ): Promise<any> {
    const results = [];

    for (const query of queries) {
      const queryResults = {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        databases: [],
      };

      for (const database of databases) {
        const dbResult = await this.benchmarkSingleQuery(
          database.knex,
          query,
          database.type,
          database.name,
          iterations,
        );
        queryResults.databases.push(dbResult);
      }

      results.push(queryResults);
    }

    // 결과 분석 및 권장사항 생성
    const analysis = this.analyzeBenchmarkResults(results);

    return {
      benchmark: results,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 데이터베이스별 연결 성능 테스트
   * @param databases - 테스트할 데이터베이스들
   */
  async testConnectionPerformance(
    databases: { knex: Knex; type: string; name: string }[],
  ): Promise<any> {
    const results = [];

    for (const database of databases) {
      const connectionResult = await this.testSingleConnectionPerformance(
        database.knex,
        database.type,
        database.name,
      );
      results.push(connectionResult);
    }

    return {
      connections: results,
      fastest: results.reduce((fastest, current) =>
        current.avgConnectionTime < fastest.avgConnectionTime ? current : fastest,
      ),
      slowest: results.reduce((slowest, current) =>
        current.avgConnectionTime > slowest.avgConnectionTime ? current : slowest,
      ),
    };
  }

  /**
   * 대용량 데이터 처리 성능 비교
   * @param databases - 비교할 데이터베이스들
   * @param dataSize - 테스트 데이터 크기
   */
  async compareBulkOperationPerformance(
    databases: { knex: Knex; type: string; name: string }[],
    dataSize = 10000,
  ): Promise<any> {
    const testData = this.generateTestData(dataSize);
    const results = [];

    for (const database of databases) {
      const bulkResult = await this.testBulkOperationPerformance(
        database.knex,
        database.type,
        database.name,
        testData,
      );
      results.push(bulkResult);
    }

    return {
      bulkOperations: results,
      dataSize,
      winner: this.determineBulkWinner(results),
      analysis: this.analyzeBulkResults(results),
    };
  }

  /**
   * 동시성 성능 테스트
   * @param databases - 테스트할 데이터베이스들
   * @param concurrency - 동시 연결 수
   */
  async testConcurrencyPerformance(
    databases: { knex: Knex; type: string; name: string }[],
    concurrency = 10,
  ): Promise<any> {
    const results = [];

    for (const database of databases) {
      const concurrencyResult = await this.testSingleConcurrencyPerformance(
        database.knex,
        database.type,
        database.name,
        concurrency,
      );
      results.push(concurrencyResult);
    }

    return {
      concurrency: results,
      concurrentConnections: concurrency,
      recommendations: this.generateConcurrencyRecommendations(results),
    };
  }

  /**
   * 복잡한 쿼리 성능 비교
   * @param databases - 비교할 데이터베이스들
   */
  async compareComplexQueryPerformance(
    databases: { knex: Knex; type: string; name: string }[],
  ): Promise<any> {
    const complexQueries = this.getComplexTestQueries();
    const results = [];

    for (const querySet of complexQueries) {
      const queryResult = {
        category: querySet.category,
        description: querySet.description,
        databases: [],
      };

      for (const database of databases) {
        try {
          const startTime = Date.now();
          await database.knex.raw(querySet.query);
          const executionTime = Date.now() - startTime;

          queryResult.databases.push({
            name: database.name,
            type: database.type,
            executionTime,
            success: true,
          });
        } catch (error) {
          queryResult.databases.push({
            name: database.name,
            type: database.type,
            executionTime: -1,
            success: false,
            error: error.message,
          });
        }
      }

      results.push(queryResult);
    }

    return {
      complexQueries: results,
      summary: this.summarizeComplexQueryResults(results),
    };
  }

  /**
   * 단일 쿼리 벤치마크
   */
  private async benchmarkSingleQuery(
    knex: Knex,
    query: string,
    databaseType: string,
    databaseName: string,
    iterations: number,
  ): Promise<any> {
    const times = [];
    let errorCount = 0;
    let totalRows = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        const result = await knex.raw(query);
        const executionTime = Date.now() - startTime;

        times.push(executionTime);
        totalRows += this.extractRowCount(result, databaseType);
      } catch (error) {
        errorCount++;
        this.logger.warn(`Query failed on ${databaseName}`, error.message);
      }
    }

    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : -1;
    const minTime = times.length > 0 ? Math.min(...times) : -1;
    const maxTime = times.length > 0 ? Math.max(...times) : -1;

    return {
      databaseName,
      databaseType,
      iterations,
      successfulRuns: times.length,
      errorCount,
      avgExecutionTime: avgTime,
      minExecutionTime: minTime,
      maxExecutionTime: maxTime,
      totalRowsProcessed: totalRows,
      performance: this.classifyPerformance(avgTime),
    };
  }

  /**
   * 단일 연결 성능 테스트
   */
  private async testSingleConnectionPerformance(
    knex: Knex,
    databaseType: string,
    databaseName: string,
  ): Promise<any> {
    const connectionTimes = [];
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        await knex.raw('SELECT 1');
        const connectionTime = Date.now() - startTime;
        connectionTimes.push(connectionTime);
      } catch (error) {
        this.logger.warn(`Connection test failed on ${databaseName}`, error.message);
      }
    }

    const avgConnectionTime =
      connectionTimes.length > 0
        ? connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length
        : -1;

    return {
      databaseName,
      databaseType,
      avgConnectionTime,
      minConnectionTime: connectionTimes.length > 0 ? Math.min(...connectionTimes) : -1,
      maxConnectionTime: connectionTimes.length > 0 ? Math.max(...connectionTimes) : -1,
      successfulConnections: connectionTimes.length,
      connectionStability: this.calculateStability(connectionTimes),
    };
  }

  /**
   * 대용량 처리 성능 테스트
   */
  private async testBulkOperationPerformance(
    knex: Knex,
    databaseType: string,
    databaseName: string,
    testData: any[],
  ): Promise<any> {
    const tableName = `test_bulk_${Date.now()}`;

    try {
      // 테스트 테이블 생성
      await this.createTestTable(knex, tableName, databaseType);

      // Insert 성능 측정
      const insertStartTime = Date.now();
      const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);

      if (optimizer) {
        await optimizer.batchInsert(knex, tableName, testData);
      } else {
        const chunkSize = 1000;
        for (let i = 0; i < testData.length; i += chunkSize) {
          const chunk = testData.slice(i, i + chunkSize);
          await knex(tableName).insert(chunk);
        }
      }

      const insertTime = Date.now() - insertStartTime;

      // Select 성능 측정
      const selectStartTime = Date.now();
      const selectResult = await knex(tableName).select('*');
      const selectTime = Date.now() - selectStartTime;

      return {
        databaseName,
        databaseType,
        dataSize: testData.length,
        insertTime,
        selectTime,
        totalTime: insertTime + selectTime,
        rowsReturned: selectResult.length,
        throughput: Math.round((testData.length / insertTime) * 1000), // rows per second
      };
    } catch (error) {
      this.logger.error(`Bulk operation test failed on ${databaseName}`, error);
      return {
        databaseName,
        databaseType,
        dataSize: testData.length,
        error: error.message,
        insertTime: -1,
        selectTime: -1,
        totalTime: -1,
      };
    } finally {
      // 테스트 테이블 정리
      try {
        await knex.schema.dropTableIfExists(tableName);
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup test table ${tableName}`, cleanupError);
      }
    }
  }

  /**
   * 동시성 성능 테스트
   */
  private async testSingleConcurrencyPerformance(
    knex: Knex,
    databaseType: string,
    databaseName: string,
    concurrency: number,
  ): Promise<any> {
    const promises = [];
    const startTime = Date.now();

    // 동시 쿼리 실행
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        knex
          .raw('SELECT 1 as test_col')
          .then(() => ({ success: true }))
          .catch(error => ({ success: false, error: error.message })),
      );
    }

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return {
      databaseName,
      databaseType,
      concurrency,
      successCount,
      errorCount,
      totalTime,
      avgTimePerQuery: totalTime / concurrency,
      successRate: (successCount / concurrency) * 100,
      concurrencyEfficiency: this.calculateConcurrencyEfficiency(successCount, totalTime),
    };
  }

  /**
   * 복잡한 테스트 쿼리 생성
   */
  private getComplexTestQueries(): any[] {
    return [
      {
        category: 'Aggregation',
        description: 'Complex GROUP BY with multiple aggregations',
        query: `
          SELECT 
            COUNT(*) as record_count,
            AVG(CASE WHEN column1 > 0 THEN column1 ELSE NULL END) as avg_positive,
            SUM(column2) as total_sum,
            MAX(column3) as max_value
          FROM (
            SELECT 1 as column1, 2 as column2, 3 as column3
            UNION ALL
            SELECT 4 as column1, 5 as column2, 6 as column3
          ) subquery
          GROUP BY column1 % 2
        `,
      },
      {
        category: 'String Operations',
        description: 'String manipulation and pattern matching',
        query: `
          SELECT 
            UPPER('test string') as upper_case,
            LENGTH('performance test') as string_length,
            CASE 
              WHEN 'test' LIKE '%est%' THEN 'matched'
              ELSE 'not matched'
            END as pattern_match
        `,
      },
      {
        category: 'Date Operations',
        description: 'Date arithmetic and formatting',
        query: `
          SELECT 
            CURRENT_TIMESTAMP as current_time,
            DATE('2024-01-01') as formatted_date,
            EXTRACT(YEAR FROM CURRENT_TIMESTAMP) as current_year
        `,
      },
    ];
  }

  /**
   * 벤치마크 결과 분석
   */
  private analyzeBenchmarkResults(results: any[]): any {
    const analysis = {
      overall: {
        totalQueries: results.length,
        totalDatabases: results[0]?.databases?.length || 0,
      },
      fastest: {},
      slowest: {},
      mostReliable: {},
      recommendations: [],
    };

    // 가장 빠른 데이터베이스 찾기
    let fastestDb = null;
    let fastestTime = Infinity;

    // 가장 느린 데이터베이스 찾기
    let slowestDb = null;
    let slowestTime = 0;

    // 가장 안정적인 데이터베이스 찾기
    let mostReliableDb = null;
    let highestSuccessRate = 0;

    for (const queryResult of results) {
      for (const dbResult of queryResult.databases) {
        if (dbResult.avgExecutionTime > 0 && dbResult.avgExecutionTime < fastestTime) {
          fastestTime = dbResult.avgExecutionTime;
          fastestDb = dbResult;
        }

        if (dbResult.avgExecutionTime > slowestTime) {
          slowestTime = dbResult.avgExecutionTime;
          slowestDb = dbResult;
        }

        const successRate = (dbResult.successfulRuns / dbResult.iterations) * 100;
        if (successRate > highestSuccessRate) {
          highestSuccessRate = successRate;
          mostReliableDb = dbResult;
        }
      }
    }

    analysis.fastest = fastestDb;
    analysis.slowest = slowestDb;
    analysis.mostReliable = mostReliableDb;

    // 권장사항 생성
    if (fastestDb) {
      analysis.recommendations.push(
        `성능 최우선: ${fastestDb.databaseName} (${fastestDb.databaseType})을 사용하세요.`,
      );
    }

    if (mostReliableDb && mostReliableDb !== fastestDb) {
      analysis.recommendations.push(
        `안정성 최우선: ${mostReliableDb.databaseName} (${mostReliableDb.databaseType})을 고려하세요.`,
      );
    }

    return analysis;
  }

  /**
   * 성능 분류
   */
  private classifyPerformance(avgTime: number): string {
    if (avgTime < 0) return 'failed';
    if (avgTime < 100) return 'excellent';
    if (avgTime < 500) return 'good';
    if (avgTime < 1000) return 'average';
    if (avgTime < 5000) return 'slow';
    return 'very_slow';
  }

  /**
   * 안정성 계산
   */
  private calculateStability(times: number[]): number {
    if (times.length <= 1) return 0;

    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // 변동 계수 (CV) = 표준편차 / 평균
    const coefficientOfVariation = stdDev / mean;

    // 안정성 점수 (0-100, 낮은 CV가 높은 안정성)
    return Math.max(0, 100 - coefficientOfVariation * 100);
  }

  /**
   * 동시성 효율성 계산
   */
  private calculateConcurrencyEfficiency(successCount: number, totalTime: number): number {
    // 효율성 = 성공한 쿼리 수 / 총 시간 (초당 성공 쿼리 수)
    return (successCount / totalTime) * 1000;
  }

  /**
   * 테스트 데이터 생성
   */
  private generateTestData(size: number): any[] {
    const data = [];
    for (let i = 0; i < size; i++) {
      data.push({
        id: i + 1,
        name: `Test Record ${i + 1}`,
        value: Math.random() * 1000,
        created_at: new Date(),
      });
    }
    return data;
  }

  /**
   * 테스트 테이블 생성
   */
  private async createTestTable(knex: Knex, tableName: string, databaseType: string): Promise<void> {
    await knex.schema.createTable(tableName, table => {
      table.increments('id').primary();
      table.string('name', 255);
      table.decimal('value', 10, 2);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  /**
   * 행 수 추출
   */
  private extractRowCount(result: any, databaseType: string): number {
    try {
      switch (databaseType.toLowerCase()) {
        case 'mysql':
        case 'mysql2':
          return result[0]?.length || 0;
        case 'postgresql':
          return result.rows?.length || 0;
        case 'oracle':
        case 'sqlserver':
          return result?.length || 0;
        case 'bigquery':
        case 'snowflake':
          return Array.isArray(result) ? result.length : 0;
        default:
          return Array.isArray(result) ? result.length : 0;
      }
    } catch (error) {
      return 0;
    }
  }

  /**
   * 대용량 처리 결과 분석
   */
  private analyzeBulkResults(results: any[]): any {
    const validResults = results.filter(r => r.insertTime > 0);
    
    if (validResults.length === 0) {
      return { message: 'No valid results to analyze' };
    }

    const fastest = validResults.reduce((fastest, current) =>
      current.totalTime < fastest.totalTime ? current : fastest,
    );

    const highestThroughput = validResults.reduce((highest, current) =>
      current.throughput > highest.throughput ? current : highest,
    );

    return {
      fastest,
      highestThroughput,
      avgInsertTime: validResults.reduce((sum, r) => sum + r.insertTime, 0) / validResults.length,
      avgSelectTime: validResults.reduce((sum, r) => sum + r.selectTime, 0) / validResults.length,
    };
  }

  /**
   * 대용량 처리 우승자 결정
   */
  private determineBulkWinner(results: any[]): any {
    const validResults = results.filter(r => r.insertTime > 0);
    
    if (validResults.length === 0) {
      return null;
    }

    // 처리량(throughput) 기준으로 우승자 결정
    return validResults.reduce((winner, current) =>
      current.throughput > winner.throughput ? current : winner,
    );
  }

  /**
   * 동시성 권장사항 생성
   */
  private generateConcurrencyRecommendations(results: any[]): string[] {
    const recommendations = [];

    const bestPerformer = results.reduce((best, current) =>
      current.concurrencyEfficiency > best.concurrencyEfficiency ? current : best,
    );

    recommendations.push(
      `동시성 성능: ${bestPerformer.databaseName} (${bestPerformer.databaseType})이 가장 우수합니다.`,
    );

    const highErrorRateDb = results.find(r => r.successRate < 90);
    if (highErrorRateDb) {
      recommendations.push(
        `${highErrorRateDb.databaseName}에서 높은 오류율(${100 - highErrorRateDb.successRate}%)이 감지되었습니다. 연결 풀 설정을 확인하세요.`,
      );
    }

    return recommendations;
  }

  /**
   * 복잡한 쿼리 결과 요약
   */
  private summarizeComplexQueryResults(results: any[]): any {
    const summary = {
      totalCategories: results.length,
      databaseCompatibility: {},
      performanceByCategory: {},
    };

    // 데이터베이스별 호환성 계산
    const allDatabases = results[0]?.databases || [];
    for (const db of allDatabases) {
      const successCount = results.filter(r =>
        r.databases.find(d => d.name === db.name && d.success),
      ).length;
      summary.databaseCompatibility[db.name] = {
        successRate: (successCount / results.length) * 100,
        type: db.type,
      };
    }

    // 카테고리별 성능
    for (const result of results) {
      const categoryPerf = {
        fastest: null,
        slowest: null,
        avgTime: 0,
      };

      const successfulDbs = result.databases.filter(d => d.success);
      if (successfulDbs.length > 0) {
        categoryPerf.fastest = successfulDbs.reduce((fastest, current) =>
          current.executionTime < fastest.executionTime ? current : fastest,
        );
        categoryPerf.slowest = successfulDbs.reduce((slowest, current) =>
          current.executionTime > slowest.executionTime ? current : slowest,
        );
        categoryPerf.avgTime =
          successfulDbs.reduce((sum, db) => sum + db.executionTime, 0) / successfulDbs.length;
      }

      summary.performanceByCategory[result.category] = categoryPerf;
    }

    return summary;
  }
}