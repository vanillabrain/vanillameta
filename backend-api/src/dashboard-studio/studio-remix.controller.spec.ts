jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { StudioRemixController } from './studio-remix.controller';
import { StudioRemixService } from './studio-remix.service';
import { StudioPublicationGuard, studioPublicationNoStore } from './studio-publication.controller';

describe('T9 authenticated no-store remix HTTP API', () => {
  let app: INestApplication;
  const service = {
    template: jest.fn(async (token, actor) => ({ token, actor })),
    preview: jest.fn(async (token, body, actor) => ({ token, body, actor })),
    remix: jest.fn(async (token, body, actor) => ({ token, body, actor })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StudioRemixController],
      providers: [
        StudioPublicationGuard,
        { provide: StudioRemixService, useValue: service },
        {
          provide: JwtService,
          useValue: {
            verify: (token: string) => {
              if (token === 'other') return { accessKeyData: { id: 9, userId: 'other' } };
              if (token !== 'valid') throw new Error();
              return { accessKeyData: { id: 8, userId: 'recipient' } };
            },
          },
        },
        {
          provide: DataSource,
          useValue: {
            options: { type: 'sqlite' },
            getRepository: () => ({ findOne: async () => ({ id: 8, userId: 'recipient' }) }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(studioPublicationNoStore);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it.each([
    ['get', 'remix-template'],
    ['post', 'remix-preview'],
    ['post', 'remix'],
  ])('requires auth for %s %s including cache headers on rejection', async (method, route) => {
    const url = '/studio/publications/' + 'a'.repeat(64) + '/' + route;
    for (const auth of [undefined, 'Bearer invalid']) {
      const req = request(app.getHttpServer())[method](url);
      if (auth) req.set('Authorization', auth);
      const response = await req.expect(401);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    }
    const response = await request(app.getHttpServer())
      [method](url)
      .set('Authorization', 'Bearer valid')
      .send({ targetSourceId: 2, mapping: {} })
      .expect(method === 'get' ? 200 : 201);
    expect(response.body.actor).toBe(8);
    expect(response.headers['cache-control']).toContain('no-store');
  });
  it.each(['remix-preview', 'remix'])(
    'answers 429 with Retry-After once one user passes the remix limit on %s',
    async route => {
      const saved = process.env.USER_THROTTLE_REMIX_PER_MIN;
      process.env.USER_THROTTLE_REMIX_PER_MIN = '2';
      try {
        const url = '/studio/publications/' + 'b'.repeat(64) + '/' + route;
        for (let i = 0; i < 2; i += 1)
          await request(app.getHttpServer())
            .post(url)
            .set('Authorization', 'Bearer other')
            .send({ targetSourceId: 2, mapping: {} })
            .expect(201);
        const response = await request(app.getHttpServer())
          .post(url)
          .set('Authorization', 'Bearer other')
          .send({ targetSourceId: 2, mapping: {} })
          .expect(429);
        expect(response.body).toMatchObject({
          error: 'RATE_LIMITED',
          retryAfterSeconds: expect.any(Number),
        });
        expect(response.headers['retry-after']).toMatch(/^[1-9]\d*$/);
        expect(response.headers['cache-control']).toContain('no-store');
      } finally {
        if (saved === undefined) delete process.env.USER_THROTTLE_REMIX_PER_MIN;
        else process.env.USER_THROTTLE_REMIX_PER_MIN = saved;
      }
    },
  );
});
