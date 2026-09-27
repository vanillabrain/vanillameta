import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Database info masking (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let databaseId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);

    const created = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'info masking datasource',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: 'sample.sqlite', password: 'secret-value' },
      })
      .expect(201);
    databaseId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('데이터소스 정보 조회 시 비밀번호가 마스킹된다', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/database/info/${databaseId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
    const config = res.body.data.databaseInfo.connectionConfig;
    expect(config.filename).toBe('sample.sqlite');
    expect(config.password).toBeUndefined();
  });
});
