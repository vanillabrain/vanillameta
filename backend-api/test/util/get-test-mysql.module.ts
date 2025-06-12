import { DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from '../../src/database/entities/database.entity';
import { DatabaseType } from '../../src/database/entities/database_type.entity';
import { Dataset } from '../../src/dataset/entities/dataset.entity';
import { TableQuery } from '../../src/widget/table-query/entity/table-query.entity';

/**
 * 테스트 데이터베이스 모듈 가져오기 (SQLite 사용)
 * QTT-001 테스트를 위해 필요한 최소한의 엔티티만 포함
 *
 * @returns {DynamicModule}
 */
export function getTestMysqlModule(): DynamicModule {
  return TypeOrmModule.forRoot({
    type: 'sqlite',
    database: ':memory:',
    entities: [Database, DatabaseType, Dataset, TableQuery],
    synchronize: true,
    logging: false,
    retryAttempts: 1,
  });
}
