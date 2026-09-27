import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn } from '../setup/test-app';

describe('User account (e2e)', () => {
  let app: INestApplication;
  let token: string;

  const user = {
    userId: 'e2e_account_user',
    password: 'Passw0rd!23',
    email: 'e2e_account_user@example.com',
  };
  const newPassword = 'NewPassw0rd!45';

  beforeAll(async () => {
    app = await createTestApp();
    await request(app.getHttpServer()).post('/v1/login/signup').send(user);
    token = await signIn(app, { userId: user.userId, password: user.password });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('유저 정보를 조회한다 (비밀번호 제외)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/user/userinfo')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.userId).toBe(user.userId);
    expect(res.body.data.password).toBeUndefined();
  });

  it('비밀번호 변경 후 새 비밀번호로 로그인된다', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/user/change-info')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: user.password, new_password: newPassword, email: user.email })
      .expect(200);
    expect(res.text).toBe('success');

    await request(app.getHttpServer())
      .post('/v1/login/signin')
      .send({ userId: user.userId, password: user.password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/v1/login/signin')
      .send({ userId: user.userId, password: newPassword })
      .expect(201);
  });

  it('본인확인 후 계정을 삭제하면 로그인이 불가하다', async () => {
    const res = await request(app.getHttpServer())
      .delete('/v1/user/delete-account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: newPassword })
      .expect(200);
    expect(res.text).toBe('success');

    await request(app.getHttpServer())
      .post('/v1/login/signin')
      .send({ userId: user.userId, password: newPassword })
      .expect(401);
  });
});
