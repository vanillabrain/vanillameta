import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Component create (e2e)', () => {
  let app: INestApplication;
  let token: string;

  const component = {
    type: 'CHART_E2E_TEST',
    title: 'E2E 테스트 차트',
    category: 'SQUARE',
    option: { series: [] },
  };

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('컴포넌트를 생성하면 목록에 노출되고, 동일 type 은 중복 생성되지 않는다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/component')
      .set('Authorization', `Bearer ${token}`)
      .send(component)
      .expect(201);

    expect(created.body.type).toBe(component.type);

    const list = await request(app.getHttpServer())
      .get('/v1/component')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((list.body as Array<any>).map(c => c.componentType)).toContain(component.type);

    const duplicate = await request(app.getHttpServer())
      .post('/v1/component')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...component, title: '중복' })
      .expect(201);
    expect(duplicate.text).toBe('exist same widget');
  });
});
