import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Widget lifecycle (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let databaseId: number;
  let datasetId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);
    const customerDbPath = await createCustomerDb();

    const database = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'widget lifecycle datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);
    databaseId = database.body.data.id;

    const dataset = await request(app.getHttpServer())
      .post('/v1/dataset')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'widget lifecycle dataset', databaseId, query: 'select * from sample_table1' })
      .expect(201);
    datasetId = dataset.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('데이터셋 기반 위젯을 생성/조회/수정/삭제한다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/widget')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'dataset widget',
        databaseId,
        componentId: 1,
        datasetType: 'DATASET',
        datasetId,
        option: { series: [] },
      })
      .expect(201);

    expect(created.body.status).toBe('SUCCESS');
    const widgetId = created.body.data.id;
    expect(created.body.data.componentId).toBe(1);
    expect(created.body.data.datasetId).toBe(datasetId);

    const found = await request(app.getHttpServer())
      .get(`/v1/widget/${widgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(found.body.status).toBe('SUCCESS');
    expect(found.body.data.title).toBe('dataset widget');

    const list = await request(app.getHttpServer())
      .get('/v1/widget')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((list.body.data as Array<any>).map(w => w.id)).toContain(widgetId);

    await request(app.getHttpServer())
      .put(`/v1/widget/${widgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'renamed widget', option: { series: [1] } })
      .expect(200);

    const renamed = await request(app.getHttpServer())
      .get(`/v1/widget/${widgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(renamed.body.data.title).toBe('renamed widget');

    await request(app.getHttpServer())
      .delete(`/v1/widget/${widgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get(`/v1/widget/${widgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterDelete.body.status).toBe('ERROR');
  });

  it('테이블 기반 위젯 생성 시 table_query 가 함께 생성된다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/widget')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'table widget',
        databaseId,
        componentId: 1,
        datasetType: 'TABLE',
        tableName: 'sample_table1',
        option: {},
      })
      .expect(201);

    expect(created.body.status).toBe('SUCCESS');
    expect(created.body.data.datasetType).toBe('TABLE');
    expect(typeof created.body.data.datasetId).toBe('number');
  });

  it('데이터셋 제목/쿼리를 수정하고 삭제한다', async () => {
    await request(app.getHttpServer())
      .put(`/v1/dataset/${datasetId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'updated dataset', query: 'select name from sample_table1' })
      .expect(200);

    const found = await request(app.getHttpServer())
      .get(`/v1/dataset/${datasetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(found.body.data.title).toBe('updated dataset');

    await request(app.getHttpServer())
      .delete(`/v1/dataset/${datasetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
