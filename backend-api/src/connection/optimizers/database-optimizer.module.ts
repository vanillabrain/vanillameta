import { Module } from '@nestjs/common';
import { DatabaseOptimizerFactory } from './database-optimizer.factory';
import { MySQLOptimizer } from './mysql.optimizer';
import { PostgreSQLOptimizer } from './postgresql.optimizer';
import { BigQueryOptimizer } from './bigquery.optimizer';
import { SnowflakeOptimizer } from './snowflake.optimizer';
import { OracleOptimizer } from './oracle.optimizer';

/**
 * 데이터베이스 최적화 모듈
 */
@Module({
  providers: [
    DatabaseOptimizerFactory,
    MySQLOptimizer,
    PostgreSQLOptimizer,
    BigQueryOptimizer,
    SnowflakeOptimizer,
    OracleOptimizer,
  ],
  exports: [
    DatabaseOptimizerFactory,
    MySQLOptimizer,
    PostgreSQLOptimizer,
    BigQueryOptimizer,
    SnowflakeOptimizer,
    OracleOptimizer,
  ],
})
export class DatabaseOptimizerModule {}