import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';
import { Dataset } from '../../src/dataset/entities/dataset.entity';
import { Widget } from '../../src/widget/entities/widget.entity';
import { TableQuery } from '../../src/widget/table-query/entity/table-query.entity';

describe('Datasource cleanup (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let databaseId: number;
  let datasetId: number;
  let datasetWidgetId: number;
  let tableWidgetId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);
    const customerDbPath = await createCustomerDb();

    const database = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'cleanup datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);
    databaseId = database.body.data.id;

    const dataset = await request(app.getHttpServer())
      .post('/v1/dataset')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'cleanup dataset', databaseId, query: 'select * from sample_table1' })
      .expect(201);
    datasetId = dataset.body.data.id;

    const datasetWidget = await request(app.getHttpServer())
      .post('/v1/widget')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'cleanup dataset widget',
        databaseId,
        componentId: 1,
        datasetType: 'DATASET',
        datasetId,
        option: {},
      })
      .expect(201);
    datasetWidgetId = datasetWidget.body.data.id;

    const tableWidget = await request(app.getHttpServer())
      .post('/v1/widget')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'cleanup table widget',
        databaseId,
        componentId: 1,
        datasetType: 'TABLE',
        tableName: 'sample_table1',
        option: {},
      })
      .expect(201);
    tableWidgetId = tableWidget.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('데이터소스를 삭제하면 연관 데이터셋/위젯/테이블쿼리가 함께 제거된다', async () => {
    const dataSource = app.get(DataSource);
    const datasetRepo = dataSource.getRepository(Dataset);
    const widgetRepo = dataSource.getRepository(Widget);
    const tableQueryRepo = dataSource.getRepository(TableQuery);

    // 사전 확인
    expect(await datasetRepo.findOne({ where: { id: datasetId } })).not.toBeNull();
    expect(await widgetRepo.findOne({ where: { id: datasetWidgetId } })).not.toBeNull();
    expect(await widgetRepo.findOne({ where: { id: tableWidgetId } })).not.toBeNull();

    await request(app.getHttpServer())
      .delete(`/v1/database/${databaseId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // 연관 데이터 제거 확인
    expect(await datasetRepo.findOne({ where: { id: datasetId } })).toBeNull();
    expect(await widgetRepo.findOne({ where: { id: datasetWidgetId } })).toBeNull();
    expect(await widgetRepo.findOne({ where: { id: tableWidgetId } })).toBeNull();
    expect(await tableQueryRepo.findOne({ where: { databaseId } })).toBeNull();

    // 삭제된 데이터소스의 리소스는 더 이상 존재하지 않는다(ERROR)
    const datasetRes = await request(app.getHttpServer())
      .get(`/v1/dataset/${datasetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(datasetRes.body.status).toBe('ERROR');

    const widgetRes = await request(app.getHttpServer())
      .get(`/v1/widget/${tableWidgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(widgetRes.body.status).toBe('ERROR');
  });
});
