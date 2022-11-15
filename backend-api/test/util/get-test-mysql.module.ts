import { DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import path from 'path';

/**
 * 테스트 MySQL 가져오기
 *
 * @returns {DynamicModule}
 */
export function getTestMysqlModule(): DynamicModule {
  const entityUrl = path.join(__dirname, '..', '..', '/src/**/*.entity{.ts,.js}');
  return TypeOrmModule.forRoot({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    autoLoadEntities: true,
    entities: [entityUrl],
    synchronize: false,
    logging: true,
    retryAttempts: 1,
  });
}
