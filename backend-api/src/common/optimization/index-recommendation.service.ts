import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import {
  DatabaseSpecificOptimizationService,
  IndexRecommendation,
} from './database-specific-optimization.service';
import { CustomLoggerService } from '../logger/logger.service';

export interface TableAnalysis {
  tableName: string;
  rowCount: number;
  columnStats: ColumnStats[];
  indexStats: IndexStats[];
  queryPatterns: QueryPattern[];
}

export interface ColumnStats {
  columnName: string;
  dataType: string;
  nullCount: number;
  distinctCount: number;
  cardinality: number;
  averageLength?: number;
  minValue?: any;
  maxValue?: any;
  isInPrimaryKey: boolean;
  isInForeignKey: boolean;
  queryUsage: {
    whereClauseUsage: number;
    joinUsage: number;
    orderByUsage: number;
    groupByUsage: number;
  };
}

export interface IndexStats {
  indexName: string;
  columns: string[];
  indexType: string;
  isUnique: boolean;
  size: number;
  usageCount: number;
  lastUsed?: Date;
  effectiveness: number; // 0-100 효율성 점수
}

export interface QueryPattern {
  query: string;
  frequency: number;
  averageExecutionTime: number;
  tablesUsed: string[];
  whereColumns: string[];
  joinColumns: string[];
  orderByColumns: string[];
  groupByColumns: string[];
}

export interface IndexRecommendationReport {
  tableName: string;
  currentIndexes: IndexStats[];
  recommendations: EnhancedIndexRecommendation[];
  redundantIndexes: string[];
  missingIndexes: EnhancedIndexRecommendation[];
  performanceImpact: {
    estimatedQuerySpeedup: number;
    estimatedSpaceCost: number;
    maintenanceOverhead: number;
  };
}

export interface EnhancedIndexRecommendation extends IndexRecommendation {
  impact: {
    affectedQueries: number;
    speedupFactor: number;
    spaceCost: number;
    maintenanceCost: number;
  };
  implementation: {
    sql: string;
    estimatedCreationTime: number;
    prerequisites?: string[];
    warnings?: string[];
  };
  alternatives?: Array<{
    description: string;
    sql: string;
    tradeoffs: string[];
  }>;
}

@Injectable()
export class IndexRecommendationService {
  private readonly logger = new Logger(IndexRecommendationService.name);

  constructor(
    private readonly optimizationService: DatabaseSpecificOptimizationService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  /**
   * 테이블 분석 및 인덱스 추천
   */
  async analyzeAndRecommend(
    knexInstance: Knex,
    engine: string,
    tableName: string,
    queryPatterns: string[],
  ): Promise<IndexRecommendationReport> {
    try {
      // 테이블 분석 수행
      const tableAnalysis = await this.analyzeTable(knexInstance, engine, tableName, queryPatterns);

      // 기본 인덱스 추천 생성
      const basicRecommendations = await this.optimizationService.generateIndexRecommendations(
        engine,
        tableAnalysis,
        queryPatterns,
      );

      // 향상된 인덱스 추천으로 변환
      const enhancedRecommendations = await this.enhanceRecommendations(
        basicRecommendations,
        tableAnalysis,
        engine,
      );

      // 중복 인덱스 탐지
      const redundantIndexes = this.detectRedundantIndexes(tableAnalysis.indexStats);

      // 누락된 인덱스 탐지
      const missingIndexes = await this.detectMissingIndexes(tableAnalysis, queryPatterns, engine);

      // 성능 영향 계산
      const performanceImpact = this.calculatePerformanceImpact(
        enhancedRecommendations,
        tableAnalysis,
      );

      const report: IndexRecommendationReport = {
        tableName,
        currentIndexes: tableAnalysis.indexStats,
        recommendations: enhancedRecommendations,
        redundantIndexes,
        missingIndexes,
        performanceImpact,
      };

      this.customLogger.log('Index analysis completed', 'IndexRecommendationService', {
        tableName,
        engine,
        recommendationsCount: enhancedRecommendations.length,
        redundantIndexesCount: redundantIndexes.length,
        missingIndexesCount: missingIndexes.length,
      });

      return report;
    } catch (error) {
      this.logger.error(`Failed to analyze table ${tableName}`, error.stack);
      throw error;
    }
  }

  /**
   * 테이블 상세 분석
   */
  private async analyzeTable(
    knexInstance: Knex,
    engine: string,
    tableName: string,
    queryPatterns: string[],
  ): Promise<TableAnalysis> {
    const tableAnalysis: TableAnalysis = {
      tableName,
      rowCount: 0,
      columnStats: [],
      indexStats: [],
      queryPatterns: this.parseQueryPatterns(queryPatterns),
    };

    try {
      // 행 수 조회
      tableAnalysis.rowCount = await this.getRowCount(knexInstance, engine, tableName);

      // 컬럼 통계 수집
      tableAnalysis.columnStats = await this.getColumnStats(knexInstance, engine, tableName);

      // 인덱스 통계 수집
      tableAnalysis.indexStats = await this.getIndexStats(knexInstance, engine, tableName);

      // 쿼리 패턴에서 컬럼 사용량 분석
      this.analyzeColumnUsage(tableAnalysis, queryPatterns);
    } catch (error) {
      this.logger.error(`Failed to analyze table ${tableName}`, error.stack);
    }

    return tableAnalysis;
  }

  /**
   * 행 수 조회
   */
  private async getRowCount(
    knexInstance: Knex,
    engine: string,
    tableName: string,
  ): Promise<number> {
    try {
      const result = await knexInstance(tableName).count('* as count').first();
      return parseInt(result?.count as string) || 0;
    } catch (error) {
      this.logger.warn(`Failed to get row count for ${tableName}: ${error.message}`);
      return 0;
    }
  }

  /**
   * 컬럼 통계 수집
   */
  private async getColumnStats(
    knexInstance: Knex,
    engine: string,
    tableName: string,
  ): Promise<ColumnStats[]> {
    const columnStats: ColumnStats[] = [];

    try {
      // 데이터베이스별 컬럼 정보 조회
      const columns = await this.getTableColumns(knexInstance, engine, tableName);

      for (const column of columns) {
        try {
          const stats: ColumnStats = {
            columnName: column.columnName,
            dataType: column.dataType,
            nullCount: 0,
            distinctCount: 0,
            cardinality: 0,
            isInPrimaryKey: column.isPrimaryKey || false,
            isInForeignKey: column.isForeignKey || false,
            queryUsage: {
              whereClauseUsage: 0,
              joinUsage: 0,
              orderByUsage: 0,
              groupByUsage: 0,
            },
          };

          // NULL 개수 조회
          const nullCountResult = await knexInstance(tableName)
            .whereNull(column.columnName)
            .count('* as nullCount')
            .first();
          stats.nullCount = parseInt(nullCountResult?.nullCount as string) || 0;

          // DISTINCT 개수 조회
          const distinctCountResult = await knexInstance(tableName)
            .countDistinct(`${column.columnName} as distinctCount`)
            .first();
          stats.distinctCount = parseInt(distinctCountResult?.distinctCount as string) || 0;

          // 카디널리티 계산
          const totalRows = await this.getRowCount(knexInstance, engine, tableName);
          stats.cardinality = totalRows > 0 ? stats.distinctCount / totalRows : 0;

          // 문자열 컬럼의 경우 평균 길이 계산
          if (this.isStringColumn(stats.dataType)) {
            try {
              const avgLengthResult = await knexInstance(tableName)
                .avg(knexInstance.raw(`LENGTH(${column.columnName}) as avgLength`))
                .first();
              stats.averageLength = parseFloat(avgLengthResult?.avgLength as string) || 0;
            } catch {
              // LENGTH 함수를 지원하지 않는 경우 무시
            }
          }

          columnStats.push(stats);
        } catch (error) {
          this.logger.warn(`Failed to get stats for column ${column.columnName}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get column stats for ${tableName}`, error.stack);
    }

    return columnStats;
  }

  /**
   * 테이블 컬럼 정보 조회 (데이터베이스별)
   */
  private async getTableColumns(
    knexInstance: Knex,
    engine: string,
    tableName: string,
  ): Promise<
    Array<{ columnName: string; dataType: string; isPrimaryKey?: boolean; isForeignKey?: boolean }>
  > {
    const columns = [];

    try {
      switch (engine) {
        case 'pg':
          const pgResult = await knexInstance.raw(
            `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default,
              CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
              CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
            FROM information_schema.columns c
            LEFT JOIN (
              SELECT kcu.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
              WHERE tc.table_name = ? AND tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.column_name = pk.column_name
            LEFT JOIN (
              SELECT kcu.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
              WHERE tc.table_name = ? AND tc.constraint_type = 'FOREIGN KEY'
            ) fk ON c.column_name = fk.column_name
            WHERE c.table_name = ?
          `,
            [tableName, tableName, tableName],
          );

          for (const row of pgResult.rows) {
            columns.push({
              columnName: row.column_name,
              dataType: row.data_type,
              isPrimaryKey: row.is_primary_key,
              isForeignKey: row.is_foreign_key,
            });
          }
          break;

        case 'mysql2':
          const mysqlResult = await knexInstance.raw(
            `
            SELECT 
              COLUMN_NAME as column_name,
              DATA_TYPE as data_type,
              COLUMN_KEY as column_key,
              IS_NULLABLE as is_nullable
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          `,
            [tableName],
          );

          for (const row of mysqlResult[0]) {
            columns.push({
              columnName: row.column_name,
              dataType: row.data_type,
              isPrimaryKey: row.column_key === 'PRI',
              isForeignKey: row.column_key === 'MUL',
            });
          }
          break;

        case 'mssql':
          const sqlServerResult = await knexInstance.raw(
            `
            SELECT 
              c.COLUMN_NAME as column_name,
              c.DATA_TYPE as data_type,
              CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary_key,
              CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_foreign_key
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
              SELECT kcu.COLUMN_NAME
              FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
              JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
              WHERE tc.TABLE_NAME = ? AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
            LEFT JOIN (
              SELECT kcu.COLUMN_NAME
              FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
              JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
              WHERE tc.TABLE_NAME = ? AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
            ) fk ON c.COLUMN_NAME = fk.COLUMN_NAME
            WHERE c.TABLE_NAME = ?
          `,
            [tableName, tableName, tableName],
          );

          for (const row of sqlServerResult) {
            columns.push({
              columnName: row.column_name,
              dataType: row.data_type,
              isPrimaryKey: row.is_primary_key === 1,
              isForeignKey: row.is_foreign_key === 1,
            });
          }
          break;

        default:
          // 기본적인 컬럼 정보만 조회
          const defaultResult = await knexInstance.raw(
            `
            SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = ?
          `,
            [tableName],
          );

          const rows = Array.isArray(defaultResult)
            ? defaultResult[0] || defaultResult
            : defaultResult.rows || [];
          for (const row of rows) {
            columns.push({
              columnName: row.column_name,
              dataType: row.data_type,
            });
          }
      }
    } catch (error) {
      this.logger.warn(`Failed to get table columns for ${tableName}: ${error.message}`);
    }

    return columns;
  }

  /**
   * 인덱스 통계 수집
   */
  private async getIndexStats(
    knexInstance: Knex,
    engine: string,
    tableName: string,
  ): Promise<IndexStats[]> {
    const indexStats: IndexStats[] = [];

    try {
      switch (engine) {
        case 'pg':
          const pgIndexResult = await knexInstance.raw(
            `
            SELECT 
              i.indexname as index_name,
              i.indexdef as index_definition,
              s.idx_scan as usage_count,
              pg_total_relation_size(i.indexname::regclass) as index_size
            FROM pg_indexes i
            LEFT JOIN pg_stat_user_indexes s ON i.indexname = s.indexname
            WHERE i.tablename = ?
          `,
            [tableName],
          );

          for (const row of pgIndexResult.rows) {
            const columns = this.parseIndexDefinition(row.index_definition, 'pg');
            indexStats.push({
              indexName: row.index_name,
              columns,
              indexType: this.detectIndexType(row.index_definition, 'pg'),
              isUnique: row.index_definition.toLowerCase().includes('unique'),
              size: parseInt(row.index_size) || 0,
              usageCount: parseInt(row.usage_count) || 0,
              effectiveness: this.calculateIndexEffectiveness(
                parseInt(row.usage_count) || 0,
                parseInt(row.index_size) || 0,
              ),
            });
          }
          break;

        case 'mysql2':
          const mysqlIndexResult = await knexInstance.raw(`
            SHOW INDEX FROM ${tableName}
          `);

          const indexMap = new Map<string, IndexStats>();
          for (const row of mysqlIndexResult[0]) {
            const indexName = row.Key_name;
            if (!indexMap.has(indexName)) {
              indexMap.set(indexName, {
                indexName,
                columns: [],
                indexType: row.Index_type || 'BTREE',
                isUnique: row.Non_unique === 0,
                size: 0,
                usageCount: 0,
                effectiveness: 0,
              });
            }
            indexMap.get(indexName)!.columns.push(row.Column_name);
          }
          indexStats.push(...Array.from(indexMap.values()));
          break;

        case 'mssql':
          const sqlServerIndexResult = await knexInstance.raw(
            `
            SELECT 
              i.name as index_name,
              i.type_desc as index_type,
              i.is_unique,
              SUM(ps.used_page_count) * 8 as size_kb,
              us.user_seeks + us.user_scans + us.user_lookups as usage_count
            FROM sys.indexes i
            LEFT JOIN sys.dm_db_index_usage_stats us ON i.object_id = us.object_id AND i.index_id = us.index_id
            LEFT JOIN sys.dm_db_partition_stats ps ON i.object_id = ps.object_id AND i.index_id = ps.index_id
            WHERE i.object_id = OBJECT_ID(?)
            GROUP BY i.name, i.type_desc, i.is_unique, us.user_seeks, us.user_scans, us.user_lookups
          `,
            [tableName],
          );

          for (const row of sqlServerIndexResult) {
            indexStats.push({
              indexName: row.index_name,
              columns: [], // SQL Server에서는 별도 쿼리 필요
              indexType: row.index_type,
              isUnique: row.is_unique,
              size: parseInt(row.size_kb) * 1024 || 0,
              usageCount: parseInt(row.usage_count) || 0,
              effectiveness: this.calculateIndexEffectiveness(
                parseInt(row.usage_count) || 0,
                parseInt(row.size_kb) * 1024 || 0,
              ),
            });
          }
          break;
      }
    } catch (error) {
      this.logger.warn(`Failed to get index stats for ${tableName}: ${error.message}`);
    }

    return indexStats;
  }

  /**
   * 문자열 컬럼 여부 확인
   */
  private isStringColumn(dataType: string): boolean {
    const stringTypes = ['varchar', 'char', 'text', 'string', 'nvarchar', 'nchar', 'ntext'];
    return stringTypes.some(type => dataType.toLowerCase().includes(type));
  }

  /**
   * 인덱스 정의에서 컬럼 추출
   */
  private parseIndexDefinition(indexDef: string, engine: string): string[] {
    const columns: string[] = [];

    try {
      // PostgreSQL 인덱스 정의 파싱
      if (engine === 'pg') {
        const match = indexDef.match(/\((.*?)\)/);
        if (match) {
          const columnsPart = match[1];
          columns.push(...columnsPart.split(',').map(col => col.trim().replace(/"/g, '')));
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse index definition: ${indexDef}`);
    }

    return columns;
  }

  /**
   * 인덱스 타입 감지
   */
  private detectIndexType(indexDef: string, engine: string): string {
    const lowerDef = indexDef.toLowerCase();

    if (lowerDef.includes('gin')) return 'gin';
    if (lowerDef.includes('gist')) return 'gist';
    if (lowerDef.includes('hash')) return 'hash';
    if (lowerDef.includes('columnstore')) return 'columnstore';

    return 'btree'; // 기본값
  }

  /**
   * 인덱스 효율성 계산
   */
  private calculateIndexEffectiveness(usageCount: number, size: number): number {
    if (size === 0) return 0;

    // 사용 빈도 대비 크기 비율로 효율성 계산
    const usagePerKB = usageCount / (size / 1024);
    return Math.min(100, usagePerKB * 10); // 0-100 범위로 정규화
  }

  /**
   * 쿼리 패턴 파싱
   */
  private parseQueryPatterns(queries: string[]): QueryPattern[] {
    const patterns: QueryPattern[] = [];

    for (const query of queries) {
      const pattern: QueryPattern = {
        query: query.substring(0, 200),
        frequency: 1,
        averageExecutionTime: 0,
        tablesUsed: this.extractTablesFromQuery(query),
        whereColumns: this.extractWhereColumns(query),
        joinColumns: this.extractJoinColumns(query),
        orderByColumns: this.extractOrderByColumns(query),
        groupByColumns: this.extractGroupByColumns(query),
      };

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * 쿼리에서 테이블명 추출
   */
  private extractTablesFromQuery(query: string): string[] {
    const tables: string[] = [];
    const fromMatch = query.match(/FROM\s+(\w+)/gi);
    const joinMatch = query.match(/JOIN\s+(\w+)/gi);

    if (fromMatch) {
      tables.push(...fromMatch.map(match => match.split(/\s+/)[1]));
    }

    if (joinMatch) {
      tables.push(...joinMatch.map(match => match.split(/\s+/)[1]));
    }

    return [...new Set(tables)]; // 중복 제거
  }

  /**
   * WHERE 절 컬럼 추출
   */
  private extractWhereColumns(query: string): string[] {
    const columns: string[] = [];
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/i);

    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g);
      if (columnMatches) {
        columns.push(...columnMatches.map(match => match.replace(/\s*[=<>!].*/, '')));
      }
    }

    return [...new Set(columns)];
  }

  /**
   * JOIN 컬럼 추출
   */
  private extractJoinColumns(query: string): string[] {
    const columns: string[] = [];
    const joinMatches = query.match(/JOIN\s+\w+\s+ON\s+(\w+\.\w+)\s*=\s*(\w+\.\w+)/gi);

    if (joinMatches) {
      for (const match of joinMatches) {
        const onMatch = match.match(/ON\s+(\w+\.\w+)\s*=\s*(\w+\.\w+)/i);
        if (onMatch) {
          columns.push(onMatch[1].split('.')[1], onMatch[2].split('.')[1]);
        }
      }
    }

    return [...new Set(columns)];
  }

  /**
   * ORDER BY 컬럼 추출
   */
  private extractOrderByColumns(query: string): string[] {
    const columns: string[] = [];
    const orderByMatch = query.match(/ORDER\s+BY\s+([\w\s,]+)(?:\s+LIMIT|$)/i);

    if (orderByMatch) {
      const orderByClause = orderByMatch[1];
      const columnMatches = orderByClause.split(',').map(col => col.trim().split(/\s+/)[0]);
      columns.push(...columnMatches);
    }

    return [...new Set(columns)];
  }

  /**
   * GROUP BY 컬럼 추출
   */
  private extractGroupByColumns(query: string): string[] {
    const columns: string[] = [];
    const groupByMatch = query.match(/GROUP\s+BY\s+([\w\s,]+)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);

    if (groupByMatch) {
      const groupByClause = groupByMatch[1];
      const columnMatches = groupByClause.split(',').map(col => col.trim());
      columns.push(...columnMatches);
    }

    return [...new Set(columns)];
  }

  /**
   * 컬럼 사용량 분석
   */
  private analyzeColumnUsage(tableAnalysis: TableAnalysis, queryPatterns: string[]): void {
    for (const columnStat of tableAnalysis.columnStats) {
      const columnName = columnStat.columnName;

      for (const query of queryPatterns) {
        if (this.extractWhereColumns(query).includes(columnName)) {
          columnStat.queryUsage.whereClauseUsage++;
        }
        if (this.extractJoinColumns(query).includes(columnName)) {
          columnStat.queryUsage.joinUsage++;
        }
        if (this.extractOrderByColumns(query).includes(columnName)) {
          columnStat.queryUsage.orderByUsage++;
        }
        if (this.extractGroupByColumns(query).includes(columnName)) {
          columnStat.queryUsage.groupByUsage++;
        }
      }
    }
  }

  /**
   * 기본 추천을 향상된 추천으로 변환
   */
  private async enhanceRecommendations(
    basicRecommendations: IndexRecommendation[],
    tableAnalysis: TableAnalysis,
    engine: string,
  ): Promise<EnhancedIndexRecommendation[]> {
    const enhanced: EnhancedIndexRecommendation[] = [];

    for (const recommendation of basicRecommendations) {
      const enhancedRec: EnhancedIndexRecommendation = {
        ...recommendation,
        impact: this.calculateIndexImpact(recommendation, tableAnalysis),
        implementation: this.generateImplementationPlan(recommendation, engine),
        alternatives: this.generateAlternatives(recommendation, engine),
      };

      enhanced.push(enhancedRec);
    }

    return enhanced;
  }

  /**
   * 인덱스 영향도 계산
   */
  private calculateIndexImpact(
    recommendation: IndexRecommendation,
    tableAnalysis: TableAnalysis,
  ): {
    affectedQueries: number;
    speedupFactor: number;
    spaceCost: number;
    maintenanceCost: number;
  } {
    let affectedQueries = 0;

    // 영향받는 쿼리 수 계산
    for (const pattern of tableAnalysis.queryPatterns) {
      const isAffected = recommendation.columns.some(
        col =>
          pattern.whereColumns.includes(col) ||
          pattern.joinColumns.includes(col) ||
          pattern.orderByColumns.includes(col),
      );
      if (isAffected) affectedQueries++;
    }

    // 속도 향상 요인 (카디널리티 기반)
    let averageCardinality = 0;
    for (const col of recommendation.columns) {
      const colStat = tableAnalysis.columnStats.find(cs => cs.columnName === col);
      if (colStat) {
        averageCardinality += colStat.cardinality;
      }
    }
    averageCardinality /= recommendation.columns.length;

    const speedupFactor = Math.max(1, Math.min(10, 1 / (averageCardinality || 0.1)));

    // 공간 비용 추정 (행 수와 컬럼 수 기반)
    const spaceCost = tableAnalysis.rowCount * recommendation.columns.length * 8; // 바이트 단위

    // 유지보수 비용 (DML 빈도 기반)
    const maintenanceCost = affectedQueries * 0.1; // 영향받는 쿼리 수의 10%

    return {
      affectedQueries,
      speedupFactor,
      spaceCost,
      maintenanceCost,
    };
  }

  /**
   * 구현 계획 생성
   */
  private generateImplementationPlan(
    recommendation: IndexRecommendation,
    engine: string,
  ): {
    sql: string;
    estimatedCreationTime: number;
    prerequisites?: string[];
    warnings?: string[];
  } {
    const sql = this.generateCreateIndexSQL(recommendation, engine);
    const estimatedCreationTime = this.estimateCreationTime(recommendation);
    const prerequisites: string[] = [];
    const warnings: string[] = [];

    // 데이터베이스별 특별 고려사항
    switch (engine) {
      case 'pg':
        if (recommendation.indexType === 'gin') {
          prerequisites.push('Ensure adequate maintenance_work_mem setting');
          warnings.push('GIN indexes require more maintenance overhead');
        }
        break;
      case 'mysql2':
        warnings.push('Index creation may lock the table');
        if (recommendation.columns.length > 16) {
          warnings.push('MySQL has a 16-column limit for composite indexes');
        }
        break;
      case 'mssql':
        if (recommendation.indexType === 'columnstore') {
          prerequisites.push('Table must have at least 1 million rows for optimal performance');
        }
        break;
    }

    return {
      sql,
      estimatedCreationTime,
      prerequisites,
      warnings,
    };
  }

  /**
   * CREATE INDEX SQL 생성
   */
  private generateCreateIndexSQL(recommendation: IndexRecommendation, engine: string): string {
    const indexName = `idx_${recommendation.tableName}_${recommendation.columns.join('_')}`;
    const uniqueClause = recommendation.priority === 'high' ? '' : ''; // UNIQUE는 별도 로직 필요
    const columnsClause = recommendation.columns.join(', ');

    switch (engine) {
      case 'pg':
        if (recommendation.indexType === 'gin') {
          return `CREATE INDEX ${indexName} ON ${recommendation.tableName} USING GIN (${columnsClause});`;
        } else if (recommendation.indexType === 'gist') {
          return `CREATE INDEX ${indexName} ON ${recommendation.tableName} USING GIST (${columnsClause});`;
        }
        return `CREATE INDEX ${indexName} ON ${recommendation.tableName} (${columnsClause});`;

      case 'mysql2':
        return `CREATE INDEX ${indexName} ON ${recommendation.tableName} (${columnsClause});`;

      case 'mssql':
        if (recommendation.indexType === 'columnstore') {
          return `CREATE COLUMNSTORE INDEX ${indexName} ON ${recommendation.tableName};`;
        }
        return `CREATE INDEX ${indexName} ON ${recommendation.tableName} (${columnsClause});`;

      case 'oracledb':
        return `CREATE INDEX ${indexName} ON ${recommendation.tableName} (${columnsClause});`;

      default:
        return `CREATE INDEX ${indexName} ON ${recommendation.tableName} (${columnsClause});`;
    }
  }

  /**
   * 인덱스 생성 시간 추정
   */
  private estimateCreationTime(recommendation: IndexRecommendation): number {
    // 기본적인 추정 (분 단위)
    const baseTime = 1; // 1분
    const columnsMultiplier = recommendation.columns.length * 0.5;
    const priorityMultiplier = recommendation.priority === 'high' ? 2 : 1;

    return Math.max(1, baseTime + columnsMultiplier * priorityMultiplier);
  }

  /**
   * 대안 솔루션 생성
   */
  private generateAlternatives(
    recommendation: IndexRecommendation,
    engine: string,
  ): Array<{
    description: string;
    sql: string;
    tradeoffs: string[];
  }> {
    const alternatives = [];

    // 복합 인덱스의 경우 단일 컬럼 인덱스 대안 제안
    if (recommendation.columns.length > 1) {
      for (const column of recommendation.columns) {
        alternatives.push({
          description: `Single column index on ${column}`,
          sql: this.generateCreateIndexSQL({ ...recommendation, columns: [column] }, engine),
          tradeoffs: [
            'Lower space usage',
            'Faster creation time',
            'Less query optimization coverage',
          ],
        });
      }
    }

    // PostgreSQL의 경우 부분 인덱스 제안
    if (engine === 'pg' && recommendation.columns.length === 1) {
      alternatives.push({
        description: `Partial index with WHERE clause`,
        sql: `CREATE INDEX idx_${recommendation.tableName}_${recommendation.columns[0]}_partial ON ${recommendation.tableName} (${recommendation.columns[0]}) WHERE ${recommendation.columns[0]} IS NOT NULL;`,
        tradeoffs: ['Smaller index size', 'Faster maintenance', 'Limited applicability'],
      });
    }

    return alternatives;
  }

  /**
   * 중복 인덱스 탐지
   */
  private detectRedundantIndexes(indexStats: IndexStats[]): string[] {
    const redundant: string[] = [];

    for (let i = 0; i < indexStats.length; i++) {
      for (let j = i + 1; j < indexStats.length; j++) {
        const index1 = indexStats[i];
        const index2 = indexStats[j];

        // 동일한 컬럼 구성 확인
        if (this.arraysEqual(index1.columns, index2.columns)) {
          // 사용량이 낮은 인덱스를 중복으로 마킹
          if (index1.usageCount < index2.usageCount) {
            redundant.push(index1.indexName);
          } else {
            redundant.push(index2.indexName);
          }
        }

        // 포함 관계 확인 (한 인덱스가 다른 인덱스의 부분집합)
        if (this.isSubset(index1.columns, index2.columns)) {
          redundant.push(index1.indexName);
        } else if (this.isSubset(index2.columns, index1.columns)) {
          redundant.push(index2.indexName);
        }
      }
    }

    return [...new Set(redundant)];
  }

  /**
   * 누락된 인덱스 탐지
   */
  private async detectMissingIndexes(
    tableAnalysis: TableAnalysis,
    queryPatterns: string[],
    engine: string,
  ): Promise<EnhancedIndexRecommendation[]> {
    const missing: EnhancedIndexRecommendation[] = [];

    // 자주 사용되지만 인덱스가 없는 컬럼 찾기
    for (const columnStat of tableAnalysis.columnStats) {
      const totalUsage =
        columnStat.queryUsage.whereClauseUsage +
        columnStat.queryUsage.joinUsage +
        columnStat.queryUsage.orderByUsage;

      if (totalUsage >= 2) {
        // 2번 이상 사용되는 컬럼
        const hasIndex = tableAnalysis.indexStats.some(idx =>
          idx.columns.includes(columnStat.columnName),
        );

        if (!hasIndex) {
          const recommendation: EnhancedIndexRecommendation = {
            tableName: tableAnalysis.tableName,
            columns: [columnStat.columnName],
            indexType: 'btree',
            reason: `Column used in ${totalUsage} queries but has no index`,
            priority: totalUsage >= 5 ? 'high' : 'medium',
            estimatedImpact: Math.min(80, totalUsage * 10),
            impact: this.calculateIndexImpact(
              {
                tableName: tableAnalysis.tableName,
                columns: [columnStat.columnName],
                indexType: 'btree',
                reason: '',
                priority: 'medium',
                estimatedImpact: 0,
              },
              tableAnalysis,
            ),
            implementation: this.generateImplementationPlan(
              {
                tableName: tableAnalysis.tableName,
                columns: [columnStat.columnName],
                indexType: 'btree',
                reason: '',
                priority: 'medium',
                estimatedImpact: 0,
              },
              engine,
            ),
          };

          missing.push(recommendation);
        }
      }
    }

    return missing;
  }

  /**
   * 성능 영향 계산
   */
  private calculatePerformanceImpact(
    recommendations: EnhancedIndexRecommendation[],
    tableAnalysis: TableAnalysis,
  ): {
    estimatedQuerySpeedup: number;
    estimatedSpaceCost: number;
    maintenanceOverhead: number;
  } {
    let totalSpeedup = 0;
    let totalSpaceCost = 0;
    let totalMaintenanceCost = 0;

    for (const rec of recommendations) {
      totalSpeedup +=
        rec.impact.speedupFactor *
        (rec.impact.affectedQueries / tableAnalysis.queryPatterns.length);
      totalSpaceCost += rec.impact.spaceCost;
      totalMaintenanceCost += rec.impact.maintenanceCost;
    }

    return {
      estimatedQuerySpeedup: Math.min(90, totalSpeedup * 100), // 최대 90% 개선
      estimatedSpaceCost: totalSpaceCost,
      maintenanceOverhead: totalMaintenanceCost,
    };
  }

  /**
   * 배열 동등성 확인
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  /**
   * 부분집합 확인
   */
  private isSubset(subset: string[], superset: string[]): boolean {
    return subset.every(item => superset.includes(item));
  }
}
