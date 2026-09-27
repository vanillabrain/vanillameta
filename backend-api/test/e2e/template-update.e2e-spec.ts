import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { Template } from '../../src/template/entities/template.entity';
import { TemplateItem } from '../../src/template/entities/template-item.entity';

describe('Template update (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let templateId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);

    const created = await request(app.getHttpServer())
      .post('/v1/template')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'update template',
        description: 'before',
        layout: [{ x: 0, y: 0, w: 6, h: 4, category: 'HORIZONTAL' }],
      })
      .expect(201);
    templateId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('템플릿 제목/레이아웃을 수정하면 항목이 교체된다', async () => {
    await request(app.getHttpServer())
      .put(`/v1/template/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'updated template',
        description: 'after',
        layout: [{ x: 0, y: 0, w: 12, h: 8, category: 'VERTICAL' }],
      })
      .expect(200);

    const dataSource = app.get(DataSource);
    const template = await dataSource.getRepository(Template).findOne({ where: { id: templateId } });
    expect(template.title).toBe('updated template');

    const items = await dataSource
      .getRepository(TemplateItem)
      .find({ where: { templateId } });
    expect(items).toHaveLength(1);
    expect(items[0].recommendCategory).toBe('VERTICAL');
    expect(items[0].width).toBe(12);
  });

  it('템플릿 단건 조회가 정상 응답한다', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/template/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.title).toBe('updated template');
    expect(Array.isArray(res.body.data.layout)).toBe(true);
  });
});
