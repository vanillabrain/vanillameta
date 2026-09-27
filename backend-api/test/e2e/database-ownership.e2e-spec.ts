import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Database ownership (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let intruderToken: string;
  let adminToken: string;
  let databaseId: number;
  let customerDbPath: string;

  const owner = {
    userId: 'e2e_db_owner',
    password: 'Passw0rd!23',
    email: 'e2e_db_owner@example.com',
  };
  const intruder = {
    userId: 'e2e_db_intruder',
    password: 'Passw0rd!23',
    email: 'e2e_db_intruder@example.com',
  };

  beforeAll(async () => {
    app = await createTestApp();
    customerDbPath = await createCustomerDb();

    await request(app.getHttpServer()).post('/v1/login/signup').send(owner);
    await request(app.getHttpServer()).post('/v1/login/signup').send(intruder);

    ownerToken = await signIn(app, { userId: owner.userId, password: owner.password });
    intruderToken = await signIn(app, { userId: intruder.userId, password: intruder.password });
    adminToken = await signIn(app, SEED_USER);

    const created = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'owner datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);

    databaseId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('소유자는 자신의 데이터소스를 조회할 수 있다', async () => {
    await request(app.getHttpServer())
      .get(`/v1/database/${databaseId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('다른 사용자는 데이터소스를 조회할 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .get(`/v1/database/${databaseId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);
  });

  it('다른 사용자는 데이터소스를 수정/삭제/실행할 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .put(`/v1/database/${databaseId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ name: 'hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/v1/database/${databaseId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/database/execute')
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ id: databaseId, query: 'select * from sample_table1' })
      .expect(403);
  });

  it('다른 사용자의 목록에는 소유자의 데이터소스가 포함되지 않는다', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/database')
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(200);

    const ids = (res.body.data as Array<any>).map(d => d.id);
    expect(ids).not.toContain(databaseId);
  });

  it('관리자는 다른 사용자의 데이터소스에 접근할 수 있다', async () => {
    await request(app.getHttpServer())
      .get(`/v1/database/${databaseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/database/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: databaseId, query: 'select * from sample_table1' })
      .expect(201);
  });

  it('소유자는 자신의 데이터소스를 삭제할 수 있다', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/database/${databaseId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
