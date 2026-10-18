jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { Test } from '@nestjs/testing';
import { ForbiddenException, GoneException, INestApplication, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  StudioPublicationController,
  StudioPublicationGuard,
  studioPublicationNoStore,
} from './studio-publication.controller';
import { StudioPublicationService } from './studio-publication.service';
describe('T8 publication HTTP optional authentication and no-store', () => {
  let app: INestApplication;
  const service = {
    read: jest.fn(async (_token, actor) => ({ owner: actor ?? null })),
    ownerMetadata: jest.fn(async () => null),
    publish: jest.fn(),
    revoke: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StudioPublicationController],
      providers: [
        StudioPublicationGuard,
        { provide: StudioPublicationService, useValue: service },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(token => {
              if (token !== 'valid') throw new Error();
              return { accessKeyData: { id: 7, userId: 'test' } };
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            options: { type: 'sqlite' },
            getRepository: () => ({ findOne: async () => ({ id: 7, userId: 'test' }) }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(studioPublicationNoStore);
    app.useGlobalGuards({
      canActivate(context) {
        if (context.switchToHttp().getRequest().headers['x-test-throttle'])
          throw new HttpException('rate limited', 429);
        return true;
      },
    });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  const noStore = response => {
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  };
  it('permits only exact publication GET anonymous; owner metadata/write/revoke always require JWT', async () => {
    const token = 'e'.repeat(64);
    const publicRead = await request(app.getHttpServer())
      .get('/studio/publications/' + token)
      .expect(200);
    expect(publicRead.body).toEqual({ owner: null });
    noStore(publicRead);
    const ownerRead = await request(app.getHttpServer())
      .get('/studio/publications/' + token)
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(ownerRead.body).toEqual({ owner: 7 });
    noStore(ownerRead);
    for (const [method, path] of [
      ['get', '/studio/dashboards/1/publications'],
      ['post', '/studio/dashboards/1/publications'],
      ['post', '/studio/publications/' + token + '/revoke'],
    ]) {
      const response = await request(app.getHttpServer())[method](path).expect(401);
      noStore(response);
    }
    const bad = await request(app.getHttpServer())
      .get('/studio/publications/' + token)
      .set('Authorization', 'Bearer bad')
      .expect(401);
    noStore(bad);
  });
  it('sets no-store on denied private, expired/revoked and malformed owner IDs', async () => {
    for (const failure of [new ForbiddenException('private'), new GoneException('expired')]) {
      service.read.mockRejectedValueOnce(failure);
      const response = await request(app.getHttpServer())
        .get('/studio/publications/' + 'e'.repeat(64))
        .expect(failure.getStatus());
      noStore(response);
      expect(response.body).not.toHaveProperty('snapshot');
    }
    const malformed = await request(app.getHttpServer())
      .get('/studio/dashboards/bad/publications')
      .set('Authorization', 'Bearer valid')
      .expect(400);
    noStore(malformed);
  });
  it('sets no-store even when the global guard rejects before route authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/studio/publications/' + 'e'.repeat(64))
      .set('x-test-throttle', '1')
      .expect(429);
    noStore(response);
  });
});
