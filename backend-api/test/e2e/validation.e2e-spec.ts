import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Validation (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await signIn(app, SEED_USER);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('whitelist: 알 수 없는 필드는 제거되어 권한 상승이 불가하다', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/login/signup')
      .send({
        userId: 'e2e_whitelist_user',
        password: 'Passw0rd!23',
        email: 'e2e_whitelist_user@example.com',
        role: 'admin', // 주입 시도 → whitelist 로 제거되어야 함
      })
      .expect(201);
    expect(res.text).toBe('success');

    const list = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const created = (list.body.data as Array<any>).find(u => u.userId === 'e2e_whitelist_user');
    expect(created).toBeDefined();
    expect(created.role).toBe('user');
  });

  it('필수 필드가 없으면 400 을 반환한다 (database 생성)', async () => {
    await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'no name', engine: 'sqlite3', type: 'sqlite', connectionConfig: {} })
      .expect(400);
  });

  it('타입이 맞지 않으면 400 을 반환한다 (execute id)', async () => {
    await request(app.getHttpServer())
      .post('/v1/database/execute')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: 'not-a-number', query: 'select 1' })
      .expect(400);
  });

  it('delete-account 는 password 만으로 검증을 통과한다 (본인확인 실패 시 Unauthorized)', async () => {
    const user = {
      userId: 'e2e_delete_user',
      password: 'Passw0rd!23',
      email: 'e2e_delete_user@example.com',
    };
    await request(app.getHttpServer()).post('/v1/login/signup').send(user);
    const token = await signIn(app, { userId: user.userId, password: user.password });

    const res = await request(app.getHttpServer())
      .delete('/v1/user/delete-account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'wrong-password' })
      .expect(200);

    // 검증(400) 통과 후 서비스에서 본인확인 실패로 처리됨
    expect(res.text).toBe('Unauthorized');
  });
});
