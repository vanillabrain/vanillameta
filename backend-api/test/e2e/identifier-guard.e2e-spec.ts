import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Identifier guard (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let databaseId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);
    const customerDbPath = await createCustomerDb();

    const database = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'identifier guard datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);
    databaseId = database.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('허용된 테이블명은 조회된다', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/database/data')
      .query({ datasetType: 'TABLE', databaseId, tableName: 'sample_table1' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
  });

  it('안전하지 않은 테이블명은 400 을 반환한다', async () => {
    await request(app.getHttpServer())
      .get('/v1/database/data')
      .query({ datasetType: 'TABLE', databaseId, tableName: 'sample_table1; DROP TABLE users' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
