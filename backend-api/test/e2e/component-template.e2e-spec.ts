import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Component / Template (e2e)', () => {
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
        name: 'component template datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);

    const dataset = await request(app.getHttpServer())
      .post('/v1/dataset')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'component template dataset',
        databaseId: database.body.data.id,
        query: 'select * from sample_table1',
      })
      .expect(201);

    const widget = await request(app.getHttpServer())
      .post('/v1/widget')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'component template widget',
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

  it('컴포넌트 목록을 조회한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/component')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('componentType');
    expect(res.body[0]).toHaveProperty('title');
  });

  it('선택한 위젯으로 템플릿을 추천한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/template/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ widgets: [widgetId] })
      .expect(201);

    expect(res.body.status).toBe('SUCCESS');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('템플릿에 맞는 대시보드 레이아웃을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/template/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .send({ widgets: [widgetId], templateId: 7 })
      .expect(201);

    expect(res.body).toBeDefined();
  });
});
