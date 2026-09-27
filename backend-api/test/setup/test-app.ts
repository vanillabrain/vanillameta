import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/user/entities/user.entity';

/**
 * E2E 용 Nest 애플리케이션 부팅.
 * - SQLite(테스트 DB) 위에서 동작
 * - 스키마는 TypeORM synchronize 로 생성
 * - 최초 1회 시드 데이터 주입 (guest 계정 등)
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await seedIfEmpty(app);

  return app;
}

async function seedIfEmpty(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const userCount = await dataSource.getRepository(User).count();
  if (userCount > 0) return;

  const { default: CreateInitialData } = await import(
    '../../src/database/seeds/create-initial-data'
  );
  await new CreateInitialData().run(dataSource);
}

export const SEED_USER = { userId: 'guest', password: 'Admin!@12' };

/** 로그인 후 Access Token 문자열을 반환한다. */
export async function signIn(
  app: INestApplication,
  credentials: { userId: string; password: string } = SEED_USER,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/login/signin')
    .send(credentials)
    .expect(201);
  return res.body.accessToken;
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
