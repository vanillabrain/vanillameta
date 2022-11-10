import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { Database } from '../../src/database/entities/database.entity';
import { ConfigModule } from '@nestjs/config';
import { TableQuery } from '../../src/widget/tabel-query/entity/table-query.entity';
import { WidgetService } from '../../src/widget/widget.service';
import * as widgetTestoption from './widgetTestOption.json';
import { Widget } from '../../src/widget/entities/widget.entity';
import { Component } from '../../src/component/entities/component.entity';
import { TableQueryService } from '../../src/widget/tabel-query/table-query.service';
import { Connection, DataSource, getConnection, getRepository } from 'typeorm';
import { ResponseStatus } from '../../src/common/enum/response-status.enum';
import { DatasetType } from '../../src/common/enum/dataset-type.enum';

describe('QTT-002 : 위젯 생성', () => {
  let widgetService: WidgetService;
  let tableQueryService: TableQueryService;
  let widgetRepository: Widget;
  let connection: Connection;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: `.env.dev`,
        }),
        getTestMysqlModule(),
        TypeOrmModule.forFeature([Widget, Component, TableQuery, Database]),
      ],
      providers: [WidgetService, TableQueryService, Widget],
    }).compile();
    widgetService = module.get<WidgetService>(WidgetService);
    tableQueryService = module.get<TableQueryService>(TableQueryService);
    widgetRepository = module.get<Widget>(Widget);
    connection = module.get<Connection>(Connection);
  }, 10000);

  it('QTT-002-01: widget 생성 확인', async () => {
    // const result = await widgetService.create(Object.create(widgetTestoption['default']))

    const testData = widgetTestoption['default'];

    const tableQueryList = [];

    const tableData = testData.filter(item => item.datasetType === DatasetType.TABLE);

    for (const item of tableData) {
      const selectQuery = await tableQueryService.makeSelectAllQuery(
        Number(item.databaseId),
        item.tableName,
      );
      tableQueryList.push({ id: item.datasetId, databaseId: item.databaseId, query: selectQuery });
    }

    await connection.query('truncate table table_query');

    const tableQueryResult = await connection
      .createQueryBuilder()
      .insert()
      .into(TableQuery)
      .values(tableQueryList)
      .execute();

    testData.forEach(el => {
      el.option = JSON.stringify(el.option);
    });

    const widgetResult = await connection
      .createQueryBuilder()
      .insert()
      .into(Widget)
      .values(testData)
      .execute();

    return expect(widgetResult.raw.affectedRows).toEqual(100);
  });

  it('QTT-002-02: widget 목록 확인', async () => {
    const result = await widgetService.findAll();
    return expect(result.status).toEqual(ResponseStatus.SUCCESS);
  });
});
