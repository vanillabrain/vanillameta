import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Request ID (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await signIn(app, SEED_USER);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('모든 응답에 x-request-id 헤더가 포함된다', async () => {
    const res = await request(app.getHttpServer()).get('/v1').expect(200);
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
  });

  it('클라이언트가 보낸 x-request-id 를 그대로 반영한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1')
      .set('x-request-id', 'client-supplied-id-123')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('client-supplied-id-123');
  });

  it('감사 로그에 requestId 가 함께 기록된다', async () => {
    const requestId = 'audit-corr-id-999';

    await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-request-id', requestId)
      .send({ title: 'correlation target', layout: [] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = (res.body.data as Array<any>).find(log => log.requestId === requestId);
    expect(entry).toBeDefined();
  });
});
