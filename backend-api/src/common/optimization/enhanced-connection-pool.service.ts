import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Knex, knex } from 'knex';
import { DatabaseSpecificOptimizationService } from './database-specific-optimization.service';
import { CustomLoggerService } from '../logger/logger.service';

export interface ConnectionPoolMetrics {
  databaseId: number;
  engine: string;
  poolSize: {
    total: number;
    used: number;
    free: number;
    pending: number;
  };
  performance: {
    averageAcquireTime: number;
    averageQueryTime: number;
    connectionFailures: number;
    timeouts: number;
  };
  lastOptimized: Date;
  optimizationLevel: 'none' | 'basic' | 'advanced';
}

export interface PoolHealthStatus {
  isHealthy: boolean;
  issues: string[];
  recommendations: string[];
  metrics: ConnectionPoolMetrics;
}

@Injectable()
export class EnhancedConnectionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(EnhancedConnectionPoolService.name);
  private readonly connections = new Map<number, Knex>();
  private readonly poolMetrics = new Map<number, ConnectionPoolMetrics>();
  private readonly performanceHistory = new Map<number, Array<{ timestamp: Date; queryTime: number; acquireTime: number }>>();
  private readonly healthCheckInterval: NodeJS.Timeout;

  constructor(
    private readonly optimizationService: DatabaseSpecificOptimizationService,
    private readonly customLogger: CustomLoggerService,
  ) {
    // 주기적인 헬스 체크 (5분마다)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  async onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // 모든 연결 정리
    await this.destroyAllConnections();
  }

  /**
   * 최적화된 연결 풀 생성
   */
  async createOptimizedPool(
    databaseId: number,
    engine: string,
    baseConfig: Knex.Config,
  ): Promise<Knex> {
    if (this.connections.has(databaseId)) {
      return this.connections.get(databaseId)!;
    }

    try {
      // 데이터베이스별 최적화 설정 가져오기
      const isProduction = process.env.NODE_ENV === 'production';
      const optimizedPoolConfig = this.optimizationService.getOptimizedPoolConfig(engine, isProduction);
      
      // 고급 연결 설정 적용
      const enhancedConfig: Knex.Config = {
        ...baseConfig,
        pool: {
          ...optimizedPoolConfig,
          // 연결 검증 쿼리 설정
          ...(this.getConnectionValidationConfig(engine)),
          // 연결 생성/파괴 이벤트 핸들러
          afterCreate: (conn: any, done: Function) => {
            this.onConnectionCreate(databaseId, engine, conn, done);
          },
          beforeDestroy: (conn: any, done: Function) => {
            this.onConnectionDestroy(databaseId, conn, done);
          },
        },
        // 연결 타임아웃 설정
        acquireConnectionTimeout: optimizedPoolConfig.acquireTimeoutMillis || 30000,
        // 쿼리 타임아웃 설정
        ...(this.getQueryTimeoutConfig(engine)),
      };

      // 특별한 데이터베이스 설정 적용
      this.applyDatabaseSpecificConfig(enhancedConfig, engine);

      const knexInstance = knex(enhancedConfig);
      
      // 연결 풀 이벤트 리스너 설정
      this.setupPoolEventListeners(knexInstance, databaseId, engine);
      
      this.connections.set(databaseId, knexInstance);
      
      // 초기 메트릭 설정
      this.initializeMetrics(databaseId, engine);
      
      this.customLogger.info('Optimized connection pool created', 'EnhancedConnectionPoolService', {
        databaseId,
        engine,
        poolConfig: optimizedPoolConfig,
        isProduction,
      });

      return knexInstance;
      
    } catch (error) {
      this.logger.error(`Failed to create optimized pool for database ${databaseId}`, error.stack);
      throw error;
    }
  }

  /**
   * 연결 검증 설정
   */
  private getConnectionValidationConfig(engine: string): any {
    const validationQueries = {
      'pg': 'SELECT 1',
      'mysql2': 'SELECT 1',
      'mssql': 'SELECT 1',
      'oracledb': 'SELECT 1 FROM DUAL',
      'sqlite3': 'SELECT 1',
      'bigquery': 'SELECT 1',
      'snowflake': 'SELECT 1',
    };

    return {
      // 연결 검증 쿼리
      validate: (connection: any) => {
        const query = validationQueries[engine] || 'SELECT 1';
        return new Promise((resolve) => {
          try {
            connection.query(query, (err: any) => {
              resolve(!err);
            });
          } catch {
            resolve(false);
          }
        });
      },
      // 연결 생성 후 검증
      testOnBorrow: true,
    };
  }

  /**
   * 쿼리 타임아웃 설정
   */
  private getQueryTimeoutConfig(engine: string): any {
    const timeouts = {
      'pg': 30000,
      'mysql2': 30000,
      'mssql': 60000,
      'oracledb': 60000,
      'sqlite3': 10000,
      'bigquery': 120000, // BigQuery는 더 긴 타임아웃
      'snowflake': 120000, // Snowflake도 더 긴 타임아웃
    };

    return {
      timeout: timeouts[engine] || 30000,
      queryTimeout: timeouts[engine] || 30000,
    };
  }

  /**
   * 데이터베이스별 특별 설정 적용
   */
  private applyDatabaseSpecificConfig(config: Knex.Config, engine: string): void {
    switch (engine) {
      case 'mysql2':
        // MySQL 특별 설정
        config.connection = Object.assign({}, config.connection || {}, {
          typeCast: true,
          timezone: 'Z',
          charset: 'utf8mb4',
          acquireTimeout: 30000,
          reconnect: true,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });
        break;

      case 'pg':
        // PostgreSQL 특별 설정
        config.connection = Object.assign({}, config.connection || {}, {
          statement_timeout: 30000,
          query_timeout: 30000,
          connectionTimeoutMillis: 30000,
          keepAlive: true,
        });
        break;

      case 'mssql':
        // SQL Server 특별 설정
        config.connection = Object.assign({}, config.connection || {}, {
          requestTimeout: 60000,
          connectionTimeout: 30000,
          pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 300000,
          },
          options: {
            enableArithAbort: true,
            trustServerCertificate: true,
          },
        });
        break;

      case 'oracledb':
        // Oracle 특별 설정
        config.connection = Object.assign({}, config.connection || {}, {
          connectTimeout: 60,
          poolTimeout: 60,
          stmtCacheSize: 30,
        });
        break;

      case 'bigquery':
        // BigQuery 특별 설정
        config.connection = Object.assign({}, config.connection || {}, {
          maxResults: 10000,
          timeoutMs: 120000,
          useLegacySql: false,
        });
        break;

      case 'snowflake':
        // Snowflake 특별 설정
        config.connection = Object.assign({}, config.connection || {}, {
          clientRequestTimeout: 120000,
          clientSessionKeepAlive: true,
          clientSessionKeepAliveHeartbeatFrequency: 3600,
        });
        break;
    }
  }

  /**
   * 연결 풀 이벤트 리스너 설정
   */
  private setupPoolEventListeners(knexInstance: Knex, databaseId: number, engine: string): void {
    const pool = (knexInstance as any).client?.pool;
    if (!pool) return;

    // 연결 생성 이벤트
    pool.on('createSuccess', (eventId: string, resource: any) => {
      this.updateMetrics(databaseId, 'connectionCreated');
      this.customLogger.debug('Connection created successfully', 'EnhancedConnectionPoolService', {
        databaseId,
        engine,
        eventId,
      });
    });

    // 연결 생성 실패 이벤트
    pool.on('createFail', (eventId: string, err: Error) => {
      this.updateMetrics(databaseId, 'connectionFailed');
      this.customLogger.warn('Connection creation failed', 'EnhancedConnectionPoolService', {
        databaseId,
        engine,
        eventId,
        error: err.message,
      });
    });

    // 연결 획득 이벤트
    pool.on('acquireRequest', (eventId: string) => {
      this.recordAcquireStart(databaseId, eventId);
    });

    pool.on('acquireSuccess', (eventId: string, resource: any) => {
      this.recordAcquireEnd(databaseId, eventId, 'success');
    });

    pool.on('acquireFail', (eventId: string, err: Error) => {
      this.recordAcquireEnd(databaseId, eventId, 'fail');
      this.updateMetrics(databaseId, 'acquireFailed');
    });

    // 연결 해제 이벤트
    pool.on('release', (resource: any) => {
      this.updateMetrics(databaseId, 'connectionReleased');
    });

    // 연결 파괴 이벤트
    pool.on('destroySuccess', (eventId: string, resource: any) => {
      this.updateMetrics(databaseId, 'connectionDestroyed');
    });
  }

  /**
   * 연결 생성 시 호출되는 콜백
   */
  private onConnectionCreate(databaseId: number, engine: string, conn: any, done: Function): void {
    // 연결별 최적화 설정 적용
    try {
      switch (engine) {
        case 'mysql2':
          // MySQL 세션 변수 설정
          conn.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION'", (err: any) => {
            if (err) this.logger.warn(`Failed to set MySQL session variables: ${err.message}`);
          });
          break;

        case 'pg':
          // PostgreSQL 세션 설정
          conn.query('SET statement_timeout = 30000', (err: any) => {
            if (err) this.logger.warn(`Failed to set PostgreSQL session timeout: ${err.message}`);
          });
          break;

        case 'oracledb':
          // Oracle 세션 설정
          conn.execute("ALTER SESSION SET CURRENT_SCHEMA = SYSTEM", (err: any) => {
            if (err) this.logger.debug(`Oracle session setting skipped: ${err.message}`);
          });
          break;
      }

      done(null, conn);
    } catch (error) {
      done(error, conn);
    }
  }

  /**
   * 연결 파괴 시 호출되는 콜백
   */
  private onConnectionDestroy(databaseId: number, conn: any, done: Function): void {
    // 연결 정리 작업
    try {
      this.customLogger.debug('Connection being destroyed', 'EnhancedConnectionPoolService', {
        databaseId,
      });
      done();
    } catch (error) {
      done(error);
    }
  }

  /**
   * 메트릭 초기화
   */
  private initializeMetrics(databaseId: number, engine: string): void {
    this.poolMetrics.set(databaseId, {
      databaseId,
      engine,
      poolSize: {
        total: 0,
        used: 0,
        free: 0,
        pending: 0,
      },
      performance: {
        averageAcquireTime: 0,
        averageQueryTime: 0,
        connectionFailures: 0,
        timeouts: 0,
      },
      lastOptimized: new Date(),
      optimizationLevel: 'basic',
    });

    this.performanceHistory.set(databaseId, []);
  }

  /**
   * 메트릭 업데이트
   */
  private updateMetrics(databaseId: number, eventType: string): void {
    const metrics = this.poolMetrics.get(databaseId);
    if (!metrics) return;

    switch (eventType) {
      case 'connectionFailed':
        metrics.performance.connectionFailures++;
        break;
      case 'acquireFailed':
        metrics.performance.timeouts++;
        break;
    }

    // 풀 크기 정보 업데이트
    const knexInstance = this.connections.get(databaseId);
    if (knexInstance) {
      const pool = (knexInstance as any).client?.pool;
      if (pool) {
        metrics.poolSize = {
          total: pool.size || 0,
          used: pool.borrowed || 0,
          free: pool.free || 0,
          pending: pool.pending || 0,
        };
      }
    }
  }

  private acquireStartTimes = new Map<string, number>();

  /**
   * 연결 획득 시작 시간 기록
   */
  private recordAcquireStart(databaseId: number, eventId: string): void {
    this.acquireStartTimes.set(`${databaseId}-${eventId}`, Date.now());
  }

  /**
   * 연결 획득 종료 시간 기록
   */
  private recordAcquireEnd(databaseId: number, eventId: string, status: 'success' | 'fail'): void {
    const key = `${databaseId}-${eventId}`;
    const startTime = this.acquireStartTimes.get(key);
    
    if (startTime) {
      const acquireTime = Date.now() - startTime;
      this.acquireStartTimes.delete(key);
      
      if (status === 'success') {
        // 성능 히스토리에 기록
        const history = this.performanceHistory.get(databaseId) || [];
        history.push({
          timestamp: new Date(),
          queryTime: 0, // 쿼리 시간은 별도로 측정
          acquireTime,
        });
        
        // 최근 100개만 유지
        if (history.length > 100) {
          history.shift();
        }
        
        this.performanceHistory.set(databaseId, history);
        
        // 평균 획득 시간 업데이트
        const metrics = this.poolMetrics.get(databaseId);
        if (metrics) {
          const avgTime = history.reduce((sum, h) => sum + h.acquireTime, 0) / history.length;
          metrics.performance.averageAcquireTime = avgTime;
        }
      }
    }
  }

  /**
   * 연결 풀 상태 확인
   */
  getPoolStatus(databaseId: number): PoolHealthStatus | null {
    const metrics = this.poolMetrics.get(databaseId);
    const knexInstance = this.connections.get(databaseId);
    
    if (!metrics || !knexInstance) {
      return null;
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 풀 크기 검사
    if (metrics.poolSize.used / metrics.poolSize.total > 0.8) {
      issues.push('High pool utilization (>80%)');
      recommendations.push('Consider increasing pool size');
    }
    
    // 대기 중인 연결 요청 검사
    if (metrics.poolSize.pending > 5) {
      issues.push('High number of pending connection requests');
      recommendations.push('Increase pool size or optimize query performance');
    }
    
    // 연결 실패율 검사
    const totalOperations = metrics.performance.connectionFailures + metrics.poolSize.total;
    const failureRate = totalOperations > 0 ? metrics.performance.connectionFailures / totalOperations : 0;
    
    if (failureRate > 0.1) {
      issues.push('High connection failure rate (>10%)');
      recommendations.push('Check database connectivity and configuration');
    }
    
    // 평균 획득 시간 검사
    if (metrics.performance.averageAcquireTime > 5000) {
      issues.push('Slow connection acquisition (>5s)');
      recommendations.push('Optimize pool configuration or database performance');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
      metrics,
    };
  }

  /**
   * 주기적인 헬스 체크
   */
  private async performHealthCheck(): Promise<void> {
    for (const [databaseId] of this.connections) {
      try {
        const status = this.getPoolStatus(databaseId);
        if (status && !status.isHealthy) {
          this.customLogger.warn('Connection pool health issues detected', 'EnhancedConnectionPoolService', {
            databaseId,
            issues: status.issues,
            recommendations: status.recommendations,
            metrics: status.metrics,
          });
          
          // 자동 최적화 시도
          await this.attemptAutoOptimization(databaseId, status);
        }
      } catch (error) {
        this.logger.error(`Health check failed for database ${databaseId}`, error.stack);
      }
    }
  }

  /**
   * 자동 최적화 시도
   */
  private async attemptAutoOptimization(databaseId: number, status: PoolHealthStatus): Promise<void> {
    const metrics = status.metrics;
    
    // 풀 크기 자동 조정
    if (status.issues.includes('High pool utilization (>80%)') && 
        metrics.poolSize.total < 10) {
      
      this.customLogger.info('Attempting to increase pool size', 'EnhancedConnectionPoolService', {
        databaseId,
        currentSize: metrics.poolSize.total,
        newSize: Math.min(metrics.poolSize.total + 2, 10),
      });
      
      // 풀 크기 증가 로직 (실제 구현은 더 복잡)
      // 여기서는 로깅만 수행
    }
    
    // 유휴 연결 정리
    if (metrics.poolSize.free > metrics.poolSize.used * 2) {
      this.customLogger.info('Cleaning up idle connections', 'EnhancedConnectionPoolService', {
        databaseId,
        freeConnections: metrics.poolSize.free,
        usedConnections: metrics.poolSize.used,
      });
      
      // 유휴 연결 정리 로직
    }
    
    metrics.lastOptimized = new Date();
    metrics.optimizationLevel = 'advanced';
  }

  /**
   * 연결 풀 통계 반환
   */
  getAllPoolStats(): Map<number, ConnectionPoolMetrics> {
    return new Map(this.poolMetrics);
  }

  /**
   * 특정 데이터베이스의 성능 히스토리 반환
   */
  getPerformanceHistory(databaseId: number): Array<{ timestamp: Date; queryTime: number; acquireTime: number }> {
    return this.performanceHistory.get(databaseId) || [];
  }

  /**
   * 연결 풀 강제 새로고침
   */
  async refreshPool(databaseId: number): Promise<void> {
    const knexInstance = this.connections.get(databaseId);
    if (knexInstance) {
      try {
        // 기존 연결 풀 파괴
        await knexInstance.destroy();
        this.connections.delete(databaseId);
        this.poolMetrics.delete(databaseId);
        this.performanceHistory.delete(databaseId);
        
        this.customLogger.info('Connection pool refreshed', 'EnhancedConnectionPoolService', {
          databaseId,
        });
      } catch (error) {
        this.logger.error(`Failed to refresh pool for database ${databaseId}`, error.stack);
        throw error;
      }
    }
  }

  /**
   * 모든 연결 정리
   */
  private async destroyAllConnections(): Promise<void> {
    const destroyPromises: Promise<void>[] = [];
    
    for (const [databaseId, knexInstance] of this.connections) {
      destroyPromises.push(
        knexInstance.destroy().catch((error) => {
          this.logger.error(`Failed to destroy connection for database ${databaseId}`, error.stack);
        })
      );
    }
    
    await Promise.all(destroyPromises);
    
    this.connections.clear();
    this.poolMetrics.clear();
    this.performanceHistory.clear();
    
    this.logger.log('All connection pools destroyed');
  }

  /**
   * 연결 가져오기 (기존 ConnectionService와 호환)
   */
  async getConnection(databaseId: number): Promise<Knex | null> {
    return this.connections.get(databaseId) || null;
  }

  /**
   * 연결 존재 여부 확인 (기존 ConnectionService와 호환)
   */
  hasConnection(databaseId: number): boolean {
    return this.connections.has(databaseId);
  }
}