import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, QueryRunner } from 'typeorm';
import { Knex, knex } from 'knex';
import { Database } from '../../database/entities/database.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

export interface QueryAnalysis {
  query: string;
  executionTime?: number;
  rowsExamined?: number;
  rowsReturned?: number;
  indexUsed?: boolean;
  scanType?: string;
  temporaryTable?: boolean;
  filesort?: boolean;
  cost?: number;
  warnings?: string[];
  optimizationSuggestions?: string[];
  explainPlan?: any;
}

export interface QueryOptimizationReport {
  totalQueries: number;
  slowQueries: number;
  fullTableScans: number;
  temporaryTableUsage: number;
  filesortUsage: number;
  averageExecutionTime: number;
  optimizationOpportunities: QueryAnalysis[];
}

@Injectable()
export class QueryAnalyzerService {
  private readonly logger = new Logger(QueryAnalyzerService.name);
  private readonly slowQueryThreshold = 1000; // 1초

  constructor(
    @InjectConnection() private connection: Connection,
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
  ) {}

  /**
   * 쿼리 실행 계획 분석
   */
  async analyzeQuery(query: string, databaseId?: number): Promise<QueryAnalysis> {
    const analysis: QueryAnalysis = {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    };

    try {
      if (databaseId) {
        // 외부 데이터베이스에 대한 분석
        return await this.analyzeExternalQuery(query, databaseId);
      }

      // 내부 MySQL 데이터베이스 분석
      const runner = this.connection.createQueryRunner();
      try {
        // EXPLAIN 실행
        const explainResult = await runner.query(`EXPLAIN ${query}`);
        analysis.explainPlan = explainResult;

        // EXPLAIN 결과 파싱
        this.parseExplainResult(explainResult, analysis);

        // EXPLAIN ANALYZE 실행 (MySQL 8.0.18+)
        try {
          const analyzeResult = await runner.query(`EXPLAIN ANALYZE ${query}`);
          this.parseExplainAnalyze(analyzeResult, analysis);
        } catch (e) {
          // EXPLAIN ANALYZE를 지원하지 않는 경우 무시
          this.logger.debug('EXPLAIN ANALYZE not supported');
        }

        // 최적화 제안 생성
        this.generateOptimizationSuggestions(analysis);

        return analysis;
      } finally {
        await runner.release();
      }
    } catch (error) {
      this.logger.error(`Query analysis failed: ${error.message}`, error.stack);
      analysis.warnings = [`Analysis failed: ${error.message}`];
      return analysis;
    }
  }

  /**
   * 외부 데이터베이스 쿼리 분석
   */
  private async analyzeExternalQuery(query: string, databaseId: number): Promise<QueryAnalysis> {
    const database = await this.databaseRepository.findOne({ where: { id: databaseId } });
    if (!database) {
      throw new Error(`Database ${databaseId} not found`);
    }

    const config = JSON.parse(database.connectionConfig);
    const knexInstance = knex(config);

    try {
      const analysis: QueryAnalysis = {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      };

      switch (database.engine) {
        case 'pg':
          return await this.analyzePostgresQuery(knexInstance, query, analysis);
        case 'mysql2':
          return await this.analyzeMySQLQuery(knexInstance, query, analysis);
        case 'mssql':
          return await this.analyzeSQLServerQuery(knexInstance, query, analysis);
        case 'oracledb':
          return await this.analyzeOracleQuery(knexInstance, query, analysis);
        default:
          analysis.warnings = [`Query analysis not supported for ${database.engine}`];
          return analysis;
      }
    } finally {
      await knexInstance.destroy();
    }
  }

  /**
   * PostgreSQL 쿼리 분석
   */
  private async analyzePostgresQuery(
    knexInstance: Knex,
    query: string,
    analysis: QueryAnalysis,
  ): Promise<QueryAnalysis> {
    try {
      // EXPLAIN ANALYZE 실행
      const explainResult = await knexInstance.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      const plan = explainResult.rows[0]['QUERY PLAN'][0];

      analysis.explainPlan = plan;
      analysis.executionTime = plan['Execution Time'];
      analysis.cost = plan['Plan']['Total Cost'];
      analysis.rowsReturned = plan['Plan']['Actual Rows'];

      // 실행 계획 분석
      this.analyzePostgresPlan(plan['Plan'], analysis);

      // 최적화 제안 생성
      this.generateOptimizationSuggestions(analysis);

      return analysis;
    } catch (error) {
      this.logger.error(`PostgreSQL analysis failed: ${error.message}`);
      analysis.warnings = [`PostgreSQL analysis failed: ${error.message}`];
      return analysis;
    }
  }

  /**
   * MySQL 쿼리 분석 (외부 MySQL)
   */
  private async analyzeMySQLQuery(
    knexInstance: Knex,
    query: string,
    analysis: QueryAnalysis,
  ): Promise<QueryAnalysis> {
    try {
      // EXPLAIN 실행
      const explainResult = await knexInstance.raw(`EXPLAIN ${query}`);
      analysis.explainPlan = explainResult[0];

      // EXPLAIN 결과 파싱
      this.parseExplainResult(explainResult[0], analysis);

      // 최적화 제안 생성
      this.generateOptimizationSuggestions(analysis);

      return analysis;
    } catch (error) {
      this.logger.error(`MySQL analysis failed: ${error.message}`);
      analysis.warnings = [`MySQL analysis failed: ${error.message}`];
      return analysis;
    }
  }

  /**
   * SQL Server 쿼리 분석
   */
  private async analyzeSQLServerQuery(
    knexInstance: Knex,
    query: string,
    analysis: QueryAnalysis,
  ): Promise<QueryAnalysis> {
    try {
      // SET STATISTICS 활성화
      await knexInstance.raw('SET STATISTICS IO ON');
      await knexInstance.raw('SET STATISTICS TIME ON');

      // 쿼리 실행
      const startTime = Date.now();
      await knexInstance.raw(query);
      analysis.executionTime = Date.now() - startTime;

      // 실행 계획 가져오기
      const planResult = await knexInstance.raw(`
        SELECT query_plan 
        FROM sys.dm_exec_query_stats 
        CROSS APPLY sys.dm_exec_query_plan(plan_handle) 
        WHERE sql_handle = (
          SELECT TOP 1 sql_handle 
          FROM sys.dm_exec_query_stats 
          ORDER BY last_execution_time DESC
        )
      `);

      if (planResult.length > 0) {
        analysis.explainPlan = planResult[0].query_plan;
      }

      // 최적화 제안 생성
      this.generateOptimizationSuggestions(analysis);

      return analysis;
    } catch (error) {
      this.logger.error(`SQL Server analysis failed: ${error.message}`);
      analysis.warnings = [`SQL Server analysis failed: ${error.message}`];
      return analysis;
    } finally {
      await knexInstance.raw('SET STATISTICS IO OFF');
      await knexInstance.raw('SET STATISTICS TIME OFF');
    }
  }

  /**
   * Oracle 쿼리 분석
   */
  private async analyzeOracleQuery(
    knexInstance: Knex,
    query: string,
    analysis: QueryAnalysis,
  ): Promise<QueryAnalysis> {
    try {
      // EXPLAIN PLAN 실행
      const statementId = `STMT_${Date.now()}`;
      await knexInstance.raw(`EXPLAIN PLAN SET STATEMENT_ID = '${statementId}' FOR ${query}`);

      // 실행 계획 가져오기
      const planResult = await knexInstance.raw(`
        SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', '${statementId}', 'ALL'))
      `);

      analysis.explainPlan = planResult;

      // 비용 정보 추출
      const costInfo = await knexInstance.raw(`
        SELECT cost, cardinality, bytes 
        FROM PLAN_TABLE 
        WHERE statement_id = '${statementId}' 
        AND id = 0
      `);

      if (costInfo.length > 0) {
        analysis.cost = costInfo[0].COST;
        analysis.rowsExamined = costInfo[0].CARDINALITY;
      }

      // 최적화 제안 생성
      this.generateOptimizationSuggestions(analysis);

      return analysis;
    } catch (error) {
      this.logger.error(`Oracle analysis failed: ${error.message}`);
      analysis.warnings = [`Oracle analysis failed: ${error.message}`];
      return analysis;
    }
  }

  /**
   * MySQL EXPLAIN 결과 파싱
   */
  private parseExplainResult(explainResult: any[], analysis: QueryAnalysis): void {
    if (!explainResult || explainResult.length === 0) return;

    const firstRow = explainResult[0];
    
    // 스캔 타입 분석
    analysis.scanType = firstRow.type;
    analysis.indexUsed = firstRow.key !== null;
    analysis.rowsExamined = firstRow.rows || 0;
    
    // Extra 필드 분석
    if (firstRow.Extra) {
      analysis.temporaryTable = firstRow.Extra.includes('Using temporary');
      analysis.filesort = firstRow.Extra.includes('Using filesort');
    }

    // 전체 테이블 스캔 감지
    if (firstRow.type === 'ALL') {
      if (!analysis.warnings) analysis.warnings = [];
      analysis.warnings.push('Full table scan detected');
    }
  }

  /**
   * MySQL EXPLAIN ANALYZE 결과 파싱
   */
  private parseExplainAnalyze(analyzeResult: any, analysis: QueryAnalysis): void {
    // MySQL 8.0.18+ EXPLAIN ANALYZE 결과 파싱
    if (typeof analyzeResult === 'string' && analyzeResult.includes('actual time=')) {
      const match = analyzeResult.match(/actual time=(\d+\.?\d*)/);
      if (match) {
        analysis.executionTime = parseFloat(match[1]);
      }
    }
  }

  /**
   * PostgreSQL 실행 계획 분석
   */
  private analyzePostgresPlan(plan: any, analysis: QueryAnalysis): void {
    // 스캔 타입 확인
    if (plan['Node Type']) {
      analysis.scanType = plan['Node Type'];
      
      if (plan['Node Type'] === 'Seq Scan') {
        if (!analysis.warnings) analysis.warnings = [];
        analysis.warnings.push('Sequential scan detected');
        analysis.indexUsed = false;
      } else if (plan['Node Type'].includes('Index')) {
        analysis.indexUsed = true;
      }
    }

    // 실제 행 수
    if (plan['Actual Rows']) {
      analysis.rowsReturned = plan['Actual Rows'];
    }

    // 임시 테이블 사용 확인
    if (plan['Node Type'] === 'Sort' || plan['Node Type'] === 'Hash') {
      analysis.temporaryTable = true;
    }

    // 하위 계획 재귀적 분석
    if (plan['Plans']) {
      for (const subPlan of plan['Plans']) {
        this.analyzePostgresPlan(subPlan, analysis);
      }
    }
  }

  /**
   * 최적화 제안 생성
   */
  private generateOptimizationSuggestions(analysis: QueryAnalysis): void {
    analysis.optimizationSuggestions = [];

    // 전체 테이블 스캔
    if (analysis.scanType === 'ALL' || analysis.scanType === 'Seq Scan') {
      analysis.optimizationSuggestions.push(
        'Consider adding an index on the WHERE clause columns to avoid full table scan',
      );
    }

    // 인덱스 미사용
    if (!analysis.indexUsed && analysis.rowsExamined > 1000) {
      analysis.optimizationSuggestions.push(
        'Query is not using any index. Consider adding appropriate indexes',
      );
    }

    // 임시 테이블 사용
    if (analysis.temporaryTable) {
      analysis.optimizationSuggestions.push(
        'Query uses temporary table. Consider optimizing GROUP BY/ORDER BY clauses',
      );
    }

    // 파일 정렬 사용
    if (analysis.filesort) {
      analysis.optimizationSuggestions.push(
        'Query uses filesort. Consider adding index on ORDER BY columns',
      );
    }

    // 느린 쿼리
    if (analysis.executionTime && analysis.executionTime > this.slowQueryThreshold) {
      analysis.optimizationSuggestions.push(
        `Query execution time (${analysis.executionTime}ms) exceeds threshold (${this.slowQueryThreshold}ms)`,
      );
    }

    // 많은 행 검사
    if (analysis.rowsExamined && analysis.rowsReturned) {
      const ratio = analysis.rowsExamined / analysis.rowsReturned;
      if (ratio > 100) {
        analysis.optimizationSuggestions.push(
          `Query examines ${ratio.toFixed(0)}x more rows than it returns. Consider more selective WHERE conditions`,
        );
      }
    }
  }

  /**
   * 여러 쿼리에 대한 종합 분석 보고서 생성
   */
  async generateOptimizationReport(queries: string[]): Promise<QueryOptimizationReport> {
    const report: QueryOptimizationReport = {
      totalQueries: queries.length,
      slowQueries: 0,
      fullTableScans: 0,
      temporaryTableUsage: 0,
      filesortUsage: 0,
      averageExecutionTime: 0,
      optimizationOpportunities: [],
    };

    let totalExecutionTime = 0;

    for (const query of queries) {
      try {
        const analysis = await this.analyzeQuery(query);
        
        // 통계 수집
        if (analysis.executionTime) {
          totalExecutionTime += analysis.executionTime;
          if (analysis.executionTime > this.slowQueryThreshold) {
            report.slowQueries++;
          }
        }

        if (analysis.scanType === 'ALL' || analysis.scanType === 'Seq Scan') {
          report.fullTableScans++;
        }

        if (analysis.temporaryTable) {
          report.temporaryTableUsage++;
        }

        if (analysis.filesort) {
          report.filesortUsage++;
        }

        // 최적화 기회가 있는 쿼리 추가
        if (
          analysis.optimizationSuggestions &&
          analysis.optimizationSuggestions.length > 0
        ) {
          report.optimizationOpportunities.push(analysis);
        }
      } catch (error) {
        this.logger.error(`Failed to analyze query: ${error.message}`);
      }
    }

    report.averageExecutionTime = totalExecutionTime / queries.length;

    return report;
  }

  /**
   * 쿼리 실행 시간 측정 및 로깅
   */
  async measureQueryPerformance(
    query: string,
    params: any[] = [],
    databaseId?: number,
  ): Promise<QueryAnalysis> {
    const startTime = Date.now();
    const analysis: QueryAnalysis = {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    };

    try {
      if (databaseId) {
        // 외부 데이터베이스 처리는 ConnectionService를 통해 수행
        analysis.warnings = ['External database performance measurement not implemented'];
      } else {
        // 내부 데이터베이스
        const runner = this.connection.createQueryRunner();
        try {
          await runner.query(query, params);
        } finally {
          await runner.release();
        }
      }

      analysis.executionTime = Date.now() - startTime;

      // 느린 쿼리 로깅
      if (analysis.executionTime > this.slowQueryThreshold) {
        this.logger.warn({
          message: 'Slow query detected',
          query: analysis.query,
          executionTime: analysis.executionTime,
          threshold: this.slowQueryThreshold,
        });
      }

      return analysis;
    } catch (error) {
      analysis.executionTime = Date.now() - startTime;
      analysis.warnings = [`Query execution failed: ${error.message}`];
      
      this.logger.error({
        message: 'Query execution failed',
        query: analysis.query,
        error: error.message,
        executionTime: analysis.executionTime,
      });

      return analysis;
    }
  }
}