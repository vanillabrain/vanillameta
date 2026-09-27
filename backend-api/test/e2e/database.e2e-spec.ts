import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, signIn } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';
import { Database } from '../../src/database/entities/database.entity';

describe('Database (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let customerDbPath: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app);
    customerDbPath = await createCustomerDb();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('인증 없이 조회하면 401 을 반환한다', async () => {
    await request(app.getHttpServer()).get('/v1/database').expect(401);
  });

  it('데이터소스 목록을 조회한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('SQLite 데이터소스를 생성하고 테이블 목록을 조회한다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'e2e sqlite',
        description: 'e2e fixture',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);

    expect(created.body.status).toBe('SUCCESS');
    expect(typeof created.body.data.id).toBe('number');

    const id = created.body.data.id;
    const detail = await request(app.getHttpServer())
      .get(`/v1/database/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.status).toBe('SUCCESS');
    const tableNames = detail.body.data.tables.map((t: any) => t.tableName);
    expect(tableNames).toContain('sample_table1');
  });

  it('데이터소스 연결정보는 평문이 아닌 암호화 형태로 저장된다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'e2e encrypted sqlite',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath, password: 'plain-text-secret' },
      })
      .expect(201);

    const id = created.body.data.id;
    const stored = await app.get(DataSource).getRepository(Database).findOne({ where: { id } });

    expect(stored.connectionConfig.startsWith('enc:v1:')).toBe(true);
    expect(stored.connectionConfig).not.toContain('plain-text-secret');
  });
});
