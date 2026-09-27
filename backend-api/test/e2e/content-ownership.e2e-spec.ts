import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Dataset/Widget ownership (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let intruderToken: string;
  let adminToken: string;
  let datasetId: number;
  let widgetId: number;

  const owner = {
    userId: 'e2e_content_owner',
    password: 'Passw0rd!23',
    email: 'e2e_content_owner@example.com',
  };
  const intruder = {
    userId: 'e2e_content_intruder',
    password: 'Passw0rd!23',
    email: 'e2e_content_intruder@example.com',
  };

  beforeAll(async () => {
    app = await createTestApp();
    const customerDbPath = await createCustomerDb();

    await request(app.getHttpServer()).post('/v1/login/signup').send(owner);
    await request(app.getHttpServer()).post('/v1/login/signup').send(intruder);

    ownerToken = await signIn(app, { userId: owner.userId, password: owner.password });
    intruderToken = await signIn(app, { userId: intruder.userId, password: intruder.password });
    adminToken = await signIn(app, SEED_USER);

    const database = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'content owner datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);
    const databaseId = database.body.data.id;

    const dataset = await request(app.getHttpServer())
      .post('/v1/dataset')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'owner dataset', databaseId, query: 'select * from sample_table1' })
      .expect(201);
    datasetId = dataset.body.data.id;

    const widget = await request(app.getHttpServer())
      .post('/v1/widget')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'owner widget',
        databaseId,
        componentId: 1,
        datasetType: 'DATASET',
        datasetId,
        option: { series: [] },
      })
      .expect(201);
    widgetId = widget.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('dataset', () => {
    it('소유자는 조회, 타 사용자는 403, 목록에서 제외된다', async () => {
      await request(app.getHttpServer())
        .get(`/v1/dataset/${datasetId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/v1/dataset/${datasetId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(403);

      const list = await request(app.getHttpServer())
        .get('/v1/dataset')
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(200);
      expect((list.body as Array<any>).map(d => d.id)).not.toContain(datasetId);
    });

    it('타 사용자는 데이터셋 수정/삭제를 할 수 없다 (403)', async () => {
      await request(app.getHttpServer())
        .put(`/v1/dataset/${datasetId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({ title: 'hacked' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/v1/dataset/${datasetId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(403);
    });

    it('관리자는 타 사용자의 데이터셋을 조회할 수 있다', async () => {
      await request(app.getHttpServer())
        .get(`/v1/dataset/${datasetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('widget', () => {
    it('소유자는 조회, 타 사용자는 403, 목록에서 제외된다', async () => {
      await request(app.getHttpServer())
        .get(`/v1/widget/${widgetId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/v1/widget/${widgetId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(403);

      const list = await request(app.getHttpServer())
        .get('/v1/widget')
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(200);
      expect((list.body.data as Array<any>).map(w => w.id)).not.toContain(widgetId);
    });

    it('타 사용자는 위젯 수정/삭제를 할 수 없다 (403)', async () => {
      await request(app.getHttpServer())
        .put(`/v1/widget/${widgetId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({ option: { series: [] } })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/v1/widget/${widgetId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(403);
    });

    it('관리자는 타 사용자의 위젯을 조회할 수 있다', async () => {
      await request(app.getHttpServer())
        .get(`/v1/widget/${widgetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('소유자는 자신의 위젯을 삭제할 수 있다', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/widget/${widgetId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });
});
