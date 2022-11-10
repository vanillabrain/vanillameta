import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { Database } from '../../src/database/entities/database.entity';
import { ConfigModule } from '@nestjs/config';
import { Dataset } from '@google-cloud/bigquery';
import { TableQuery } from '../../src/widget/tabel-query/entity/table-query.entity';
import { DatabaseType } from '../../src/database/entities/database_type.entity';
import { ConnectionService } from '../../src/connection/connection.service';
import * as TestConnectionInfo from '../../test-connect-info.json';
import { ResponseStatus } from '../../src/common/enum/response-status.enum';

describe('Check MYSQL Connection', () => {
  let connectService: ConnectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.dev',
        }),
        getTestMysqlModule(),
        TypeOrmModule.forFeature([Database, Dataset, TableQuery, DatabaseType]),
      ],
      providers: [ConnectionService],
    }).compile();

    connectService = module.get<ConnectionService>(ConnectionService);
  }, 10000);
  const dbName = [
    'mysql',
    'maria',
    'pg',
    'oracle',
    'cockroach',
    'redshift',
    'bigquery',
    'sqlite',
    'mssql',
    'snowflake',
  ];

  for (let i = 0; i < dbName.length; i++) {
    it(`QTT-001-${String(i + 1).padStart(2, '0')}`, async () => {
      const result = await connectService.testConnection(
        Object.create(TestConnectionInfo[dbName[i]]),
      );
      return expect(result['status']).toStrictEqual(ResponseStatus.SUCCESS);
    });
  }
});
