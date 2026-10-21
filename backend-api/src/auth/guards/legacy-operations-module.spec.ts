import { Controller, Get, INestApplication, Module, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth.module';
import { RefreshToken } from '../entites/refresh_token.entity';
import { User } from '../../user/entities/user.entity';
import { CustomLoggerService } from '../../common/logger/logger.service';
import { LegacyOperationsGuard } from './legacy-operations.guard';

@Controller('operation-di-probe')
@UseGuards(LegacyOperationsGuard)
class OperationProbeController {
  @Get()
  read() {
    return { ready: true };
  }
}

// No local JWT, ConfigService or guard provider: feature modules consume AuthModule exports.
@Module({ imports: [AuthModule], controllers: [OperationProbeController] })
class OperationProbeModule {}

describe('legacy operation module DI and current authentication', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const previousSecret = process.env.ACCESS_SECRET;
  const secret = 'local-operation-module-regression-secret';
  const token = (id: number, authVersion: number) =>
    jwt.sign({ accessKeyData: { id, userId: `operator-${id}`, authVersion } }, { secret });

  beforeAll(async () => {
    process.env.ACCESS_SECRET = secret;
    const fixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ LEGACY_OPERATIONS_USER_IDS: '1' })],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, RefreshToken],
          synchronize: true,
        }),
        OperationProbeModule,
      ],
    })
      .overrideProvider(CustomLoggerService)
      .useValue({ debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() })
      .compile();
    app = fixture.createNestApplication();
    await app.init();
    jwt = app.get(JwtService);
    await app
      .get(DataSource)
      .getRepository(User)
      .save(
        [1, 2].map(id => ({
          id,
          userId: `operator-${id}`,
          email: `operator-${id}@example.test`,
          password: 'unused',
          active: true,
          authVersion: 3,
        })),
      );
  });

  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previousSecret;
  });

  it('starts real Nest controllers using the exported JWT/config/guard providers', async () => {
    await request(app.getHttpServer())
      .get('/operation-di-probe')
      .set('Authorization', `Bearer ${token(1, 3)}`)
      .expect(200, { ready: true });
  });

  it('denies authenticated actors outside the operator allowlist', async () => {
    await request(app.getHttpServer())
      .get('/operation-di-probe')
      .set('Authorization', `Bearer ${token(2, 3)}`)
      .expect(403);
  });

  it('denies a stale epoch even for the configured operator', async () => {
    await request(app.getHttpServer())
      .get('/operation-di-probe')
      .set('Authorization', `Bearer ${token(1, 2)}`)
      .expect(401);
  });
});
