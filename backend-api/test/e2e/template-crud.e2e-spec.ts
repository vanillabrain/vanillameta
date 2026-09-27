import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Template CRUD (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('템플릿을 생성하고 목록에서 조회한 뒤 비활성화(useYn=N)한다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/template')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'e2e template',
        description: 'e2e',
        layout: [{ x: 0, y: 0, w: 6, h: 4, category: 'HORIZONTAL' }],
      })
      .expect(201);

    expect(created.body.status).toBe('SUCCESS');
    const templateId = created.body.data.id;
    expect(typeof templateId).toBe('number');

    const list = await request(app.getHttpServer())
      .get('/v1/template')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((list.body.data as Array<any>).map(t => t.id)).toContain(templateId);

    await request(app.getHttpServer())
      .delete(`/v1/template/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterRemove = await request(app.getHttpServer())
      .get('/v1/template')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((afterRemove.body.data as Array<any>).map(t => t.id)).not.toContain(templateId);
  });
});
