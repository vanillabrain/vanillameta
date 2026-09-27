import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Dataset execute / query guard edges (e2e)', () => {
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
        name: 'dataset execute datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);
    databaseId = database.body.data.id;

    const dataset = await request(app.getHttpServer())
      .post('/v1/dataset')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'dataset execute', databaseId, query: 'select * from sample_table1' })
      .expect(201);
    datasetId = dataset.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('DATASET 타입 데이터 조회 시 저장된 쿼리 결과를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/database/data')
      .query({ datasetType: 'DATASET', databaseId, datasetId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.datas).toHaveLength(3);
  });

  it('WITH(CTE) 읽기 쿼리는 허용된다', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/database/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: databaseId, query: 'WITH t AS (SELECT 1 AS a) SELECT * FROM t' })
      .expect(201);

    expect(res.body.status).toBe('SUCCESS');
  });

  it('멀티 스테이트먼트는 400 으로 거부된다', async () => {
    await request(app.getHttpServer())
      .post('/v1/database/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: databaseId, query: 'select 1; select 2' })
      .expect(400);
  });
});
