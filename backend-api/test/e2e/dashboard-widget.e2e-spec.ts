import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Dashboard-Widget association (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let widgetId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);
    const customerDbPath = await createCustomerDb();

    const database = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'dashboard widget datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);

    const dataset = await request(app.getHttpServer())
      .post('/v1/dataset')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'dashboard widget dataset',
        databaseId: database.body.data.id,
        query: 'select * from sample_table1',
      })
      .expect(201);

    const widget = await request(app.getHttpServer())
      .post('/v1/widget')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'dashboard widget',
        databaseId: database.body.data.id,
        componentId: 1,
        datasetType: 'DATASET',
        datasetId: dataset.body.data.id,
        option: { series: [] },
      })
      .expect(201);
    widgetId = widget.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('레이아웃에 연결한 위젯이 대시보드 조회 시 포함된다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'dashboard with widget',
        layout: [{ x: 0, y: 0, w: 6, h: 4, i: widgetId }],
      })
      .expect(201);

    const dashboardId = created.body.data.id;

    const found = await request(app.getHttpServer())
      .get(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(found.body.status).toBe('SUCCESS');
    const widgetIds = (found.body.data.widgets as Array<any>).map(w => w.id);
    expect(widgetIds).toContain(widgetId);
  });
});
